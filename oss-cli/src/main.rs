use anyhow::{anyhow, Context, Result};
use clap::{Parser, Subcommand, CommandFactory, FromArgMatches};
use inquire::{Confirm, Password, Select, Text};
use oss_core::config::{ConfigManager, Profile};
use oss_core::db::TaskRepository;
use oss_core::transfer::TransferManager;
use oss_core::{create_client, S3Provider};
use sqlx::sqlite::SqlitePoolOptions;
use std::path::{Path, PathBuf};
use indicatif::{ProgressBar, ProgressStyle};
use std::sync::Arc;

fn create_progress_bar(total_bytes: u64) -> ProgressBar {
    let pb = ProgressBar::new(total_bytes);
    pb.set_style(ProgressStyle::with_template("{spinner:.green} [{elapsed_precise}] [{wide_bar:.cyan/blue}] {bytes}/{total_bytes} ({bytes_per_sec}, {eta})")
        .unwrap()
        .progress_chars("#>-"));
    pb
}

#[derive(Parser)]
#[command(name = "oss-cli")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Path to config file
    #[arg(short, long, global = true)]
    config: Option<PathBuf>,
}

#[derive(Subcommand)]
enum Commands {
    /// List files in bucket
    Ls {
        /// Path (oss://bucket/prefix)
        path: String,
        
        /// Profile name
        #[arg(short, long)]
        profile: String,
    },
    /// List file tree in bucket
    Tree {
        /// Path (oss://bucket/prefix)
        path: String,
        
        /// Profile name
        #[arg(short, long)]
        profile: String,
    },
    /// Copy files
    Cp {
        /// Source path (local or oss://)
        source: String,

        /// Destination path (local or oss://)
        destination: String,

        /// Profile name
        #[arg(short, long)]
        profile: String,

        /// Recursive copy
        #[arg(short, long)]
        recursive: bool,

        /// Concurrent threads
        #[arg(short = 'j', long, default_value_t = 4)]
        threads: usize,
    },
    /// Move/Rename files (Cloud only)
    Mv {
        /// Source path (oss://bucket/key)
        source: String,

        /// Destination path (oss://bucket/key)
        destination: String,

        /// Profile name
        #[arg(short, long)]
        profile: String,
    },
    /// Init configuration
    Init,
    /// Add a new profile
    Add {
        /// Profile name
        #[arg(long)]
        name: Option<String>,

        /// Provider type (Aws, CloudflareR2, Aliyun, Tencent, Custom)
        #[arg(long)]
        provider: Option<String>,

        /// Access Key ID
        #[arg(long)]
        access_key: Option<String>,

        /// Secret Access Key
        #[arg(long)]
        secret_key: Option<String>,

        /// Region
        #[arg(long)]
        region: Option<String>,

        /// Endpoint (Optional)
        #[arg(long)]
        endpoint: Option<String>,

        /// Default Bucket (Optional)
        #[arg(long)]
        default_bucket: Option<String>,
    },
    /// Delete a profile
    Delete {
        /// Profile name to delete
        name: String,
    },
    /// Delete files/folders (Cloud only)
    Rm {
        /// Path (oss://bucket/key)
        path: String,

        /// Profile name
        #[arg(short, long)]
        profile: String,

        /// Recursive delete
        #[arg(short, long)]
        recursive: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive("oss_core=info".parse().unwrap()))
        .with_target(false) // Hide module path for cleaner CLI output
        .init();

    // Dynamically build about message
    let exe_path = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    
    let about = format!(
        "A CLI for managing OSS/S3 files\nOSS Manager CLI {}\n\nPath: {}",
        env!("CARGO_PKG_VERSION"),
        exe_path
    );

    let cmd = Cli::command().about(about);
    let matches = cmd.get_matches();
    let cli = Cli::from_arg_matches(&matches)
        .unwrap_or_else(|e| e.exit());

    let config_path = if let Some(p) = cli.config {
        p
    } else {
        dirs::home_dir()
            .context("Could not find home directory")?
            .join(".oss-manager")
            .join("config.json")
    };

    match cli.command {
        Commands::Rm { path, profile, recursive } => {
            let (tm, _, _) = setup_env(&config_path, &profile).await?;
            let (bucket, key) = parse_s3_uri(&path)?;
            
            // Confirm deletion
            if recursive {
                let confirm = Confirm::new(&format!("Are you sure you want to delete 's3://{}/{}' recursively?", bucket, key))
                    .with_default(false)
                    .prompt()?;
                if !confirm {
                    println!("Aborted.");
                    return Ok(());
                }
            }

            tm.remove(&bucket, &key, recursive).await?;
            println!("Deleted s3://{}/{}", bucket, key);
        }
        Commands::Init => {
            if config_path.exists() {
                 let overwrite = Confirm::new("Config file already exists. Overwrite?")
                    .with_default(false)
                    .prompt()?;
                 if !overwrite {
                     println!("Aborted.");
                     return Ok(());
                 }
            }
            
            let mut manager = ConfigManager::new();
            manager.add_profile(
                "default".to_string(),
                oss_core::config::Profile {
                    provider: S3Provider::Aws,
                    access_key: "ChangeMe".to_string(),
                    secret_key: "ChangeMe".to_string(),
                    region: "us-east-1".to_string(),
                    endpoint: None,
                    default_bucket: None,
                },
            );
            manager.save_to_file(&config_path)?;
            println!("Initialized config at {:?}", config_path);
        }
        Commands::Add {
            name, 
            provider, 
            access_key, 
            secret_key, 
            region, 
            endpoint, 
            default_bucket 
        } => {
            // Load existing or create new
            let mut manager = ConfigManager::load_from_file(&config_path).unwrap_or_else(|_| ConfigManager::new());

            let profile_name = match name {
                Some(n) => n,
                None => Text::new("Profile Name:")
                    .with_validator(|input: &str| {
                        if input.is_empty() {
                            Ok(inquire::validator::Validation::Invalid("Name cannot be empty".into()))
                        } else if manager.get_profile(input).is_some() {
                             Ok(inquire::validator::Validation::Invalid("Profile already exists".into()))
                        } else {
                            Ok(inquire::validator::Validation::Valid)
                        }
                    })
                    .prompt()? 
            };

            if manager.get_profile(&profile_name).is_some() {
                return Err(anyhow!("Profile '{}' already exists", profile_name));
            }

            let provider_str = match provider {
                Some(p) => p,
                None => {
                    let options = vec!["Aws", "CloudflareR2", "Aliyun", "Tencent", "Custom"];
                    Select::new("Select Provider:", options).prompt()?.to_string()
                }
            };

            let provider_enum = match provider_str.as_str() {
                "Aws" => S3Provider::Aws,
                "CloudflareR2" => S3Provider::CloudflareR2,
                "Aliyun" => S3Provider::Aliyun,
                "Tencent" => S3Provider::Tencent,
                "Custom" => S3Provider::Custom,
                _ => return Err(anyhow!("Invalid provider. Options: Aws, CloudflareR2, Aliyun, Tencent, Custom")),
            };

            let ak = match access_key {
                Some(k) => k,
                None => Password::new("Access Key ID:")
                    .with_display_mode(inquire::PasswordDisplayMode::Masked)
                    .without_confirmation()
                    .prompt()? 
            };

            let sk = match secret_key {
                Some(k) => k,
                None => Password::new("Secret Access Key:")
                    .with_display_mode(inquire::PasswordDisplayMode::Masked)
                    .without_confirmation()
                    .prompt()? 
            };

            let reg = match region {
                Some(r) => r,
                None => Text::new("Region (e.g., us-east-1, auto):").prompt()? 
            };

            let ep = match endpoint {
                Some(e) => Some(e),
                None => {
                    let input = Text::new("Endpoint (Optional):").prompt()?;
                    if input.is_empty() { None } else { Some(input) }
                }
            };
            
            let db = match default_bucket {
                 Some(b) => Some(b),
                 None => {
                     let input = Text::new("Default Bucket (Optional):").prompt()?;
                     if input.is_empty() { None } else { Some(input) }
                 }
            };

            let profile = Profile {
                provider: provider_enum,
                access_key: ak,
                secret_key: sk,
                region: reg,
                endpoint: ep,
                default_bucket: db,
            };

            manager.add_profile(profile_name.clone(), profile);
            manager.save_to_file(&config_path)?;
            println!("Profile '{}' added successfully.", profile_name);
            println!("Config file updated at: {:?}", config_path);
        }
        Commands::Delete { name } => {
            let mut manager = ConfigManager::load_from_file(&config_path)?;
            
            if manager.get_profile(&name).is_none() {
                return Err(anyhow!("Profile '{}' not found", name));
            }

            manager.profiles.remove(&name);
            manager.save_to_file(&config_path)?;
            println!("Profile '{}' deleted.", name);
        }
        Commands::Ls { path, profile } => {
            let (tm, _, _) = setup_env(&config_path, &profile).await?;
            let (bucket, key) = parse_s3_uri(&path)?;
            let results = tm.ls(&bucket, &key).await?;
            for line in results {
                println!("{}", line);
            }
        }
        Commands::Tree { path, profile } => {
             let (tm, _, _) = setup_env(&config_path, &profile).await?;
             let (bucket, key) = parse_s3_uri(&path)?;
             let results = tm.tree(&bucket, &key).await?;
             for line in results {
                 println!("{}", line);
             }
        }
        Commands::Cp { source, destination, profile, recursive, threads } => {
            let (tm, _, client) = setup_env(&config_path, &profile).await?;

            let src_is_oss = source.starts_with("oss://") || source.starts_with("s3://");
            let dest_is_oss = destination.starts_with("oss://") || destination.starts_with("s3://");

            if !src_is_oss && dest_is_oss {
                // Upload: Local -> Cloud
                let (bucket, key) = parse_s3_uri(&destination)?;
                let local_path = Path::new(&source);
                
                let mut progress_callback = None;
                let mut _pb_guard = None;

                if local_path.is_file() {
                    let total_size = std::fs::metadata(local_path)?.len();
                    let pb = create_progress_bar(total_size);
                    let pb_clone = pb.clone();
                    progress_callback = Some(Arc::new(move |transferred| {
                        pb_clone.set_position(transferred);
                    }) as Arc<dyn Fn(u64) + Send + Sync>);
                    _pb_guard = Some(pb);
                }

                tm.upload(local_path, &bucket, &key, recursive, threads, progress_callback, None).await?;
                if let Some(pb) = _pb_guard { pb.finish_with_message("Upload completed"); }
                println!("Upload completed.");

            } else if src_is_oss && !dest_is_oss {
                // Download: Cloud -> Local
                let (bucket, key) = parse_s3_uri(&source)?;
                let local_path = Path::new(&destination);
                
                let mut progress_callback = None;
                let mut _pb_guard = None;

                // Only get size for single file download to avoid complexity
                if !recursive && !key.ends_with('/') {
                    if let Ok(head) = client.head_object().bucket(&bucket).key(&key).send().await {
                        if let Some(size) = head.content_length {
                            let pb = create_progress_bar(size as u64);
                            let pb_clone = pb.clone();
                            progress_callback = Some(Arc::new(move |transferred| {
                                pb_clone.set_position(transferred);
                            }) as Arc<dyn Fn(u64) + Send + Sync>);
                            _pb_guard = Some(pb);
                        }
                    }
                }

                tm.download(&bucket, &key, local_path, recursive, threads, progress_callback, None).await?;
                if let Some(pb) = _pb_guard { pb.finish_with_message("Download completed"); }
                println!("Download completed.");

            } else if src_is_oss && dest_is_oss {
                // Cloud -> Cloud
                let (src_bucket, src_key) = parse_s3_uri(&source)?;
                let (dest_bucket, dest_key) = parse_s3_uri(&destination)?;

                if src_bucket == dest_bucket {
                    // Same Bucket Copy
                    tm.copy_cloud(&src_bucket, &src_key, &dest_bucket, &dest_key, recursive).await?;
                    println!("Cloud copy completed.");
                } else {
                    // Cross Bucket Copy (via Local)
                    tm.copy_cross_bucket(&src_bucket, &src_key, &dest_bucket, &dest_key, recursive, threads, None).await?;
                    println!("Cross-bucket copy completed.");
                }
            } else {
                return Err(anyhow!("Local to Local copy not supported. Use system cp command."));
            }
        }
        Commands::Mv { source, destination, profile } => {
            let (tm, _, _) = setup_env(&config_path, &profile).await?;
            let (src_bucket, src_key) = parse_s3_uri(&source)?;
            let (dest_bucket, dest_key) = parse_s3_uri(&destination)?;

            if src_bucket != dest_bucket {
                return Err(anyhow!("Move across buckets not supported directly. Use cp then rm."));
            }
            
            tm.move_cloud(&src_bucket, &src_key, &dest_bucket, &dest_key).await?;
            println!("Moved s3://{}/{} to s3://{}/{}", src_bucket, src_key, dest_bucket, dest_key);
        }
    }

    Ok(())
}

async fn setup_env(config_path: &Path, profile_name: &str) -> Result<(TransferManager, TaskRepository, oss_core::aws_sdk_s3::Client)> {
    let manager = ConfigManager::load_from_file(config_path)?;
    let profile_config = manager
        .get_profile(profile_name)
        .ok_or_else(|| anyhow!("Profile '{}' not found", profile_name))?;

    let client = create_client(
        profile_config.provider,
        profile_config.access_key.clone(),
        profile_config.secret_key.clone(),
        profile_config.region.clone(),
        profile_config.endpoint.clone(),
    );

    let db_path = dirs::home_dir()
        .context("Could not find home directory")?
        .join(".oss-manager");
    tokio::fs::create_dir_all(&db_path).await?;
    let db_url = format!("sqlite://{}/oss.db?mode=rwc", db_path.to_string_lossy());
    
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .context("Failed to connect to database")?;
    
    let repo = TaskRepository::new(pool);
    repo.migrate().await.context("Failed to migrate database")?;

    Ok((TransferManager::new(client.clone(), repo.clone()), repo, client))
}

fn parse_s3_uri(uri: &str) -> Result<(String, String)> {
    let stripped = uri.strip_prefix("oss://").or_else(|| uri.strip_prefix("s3://")).ok_or_else(|| anyhow!("Invalid S3 URI"))?;
    let parts: Vec<&str> = stripped.splitn(2, '/').collect();
    if parts.len() < 2 {
        if parts.len() == 1 {
             return Ok((parts[0].to_string(), "".to_string()));
        }
        return Err(anyhow!("Invalid S3 URI format: expected oss://bucket/key"));
    }
    Ok((parts[0].to_string(), parts[1].to_string()))
}