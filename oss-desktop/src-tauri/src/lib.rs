use oss_core::config::{ConfigManager, Profile};
use oss_core::create_client;
use oss_core::ops::S3Ops;
use oss_core::db::TaskRepository;
use oss_core::transfer::TransferManager;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl, State};
use serde::{Serialize, Deserialize};
use sqlx::sqlite::SqlitePoolOptions;
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: i64,
    pub last_modified: Option<i64>, // Timestamp in milliseconds
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ObjectMetadata {
    pub key: String,
    pub size: i64,
    pub last_modified: Option<i64>,
    pub etag: Option<String>,
    pub content_type: Option<String>,
}

fn get_config_path() -> PathBuf {
    dirs::home_dir().expect("Could not find home directory").join(".oss-manager").join("config.json")
}

fn get_db_path() -> PathBuf {
    dirs::home_dir().expect("Could not find home directory").join(".oss-manager").join("oss.db")
}

#[tauri::command]
async fn create_window(app: AppHandle, label: String, url: String) -> Result<(), String> {
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title("OSS Manager")
        .inner_size(800.0, 600.0)
        .decorations(false) // Use our custom titlebar
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn list_objects(profile_name: String, bucket: String, prefix: String) -> Result<Vec<FileEntry>, String> {
    let path = get_config_path();
    let manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    let profile = manager.get_profile(&profile_name).ok_or("Profile not found")?;

    let client = create_client(
        profile.provider,
        profile.access_key.clone(),
        profile.secret_key.clone(),
        profile.region.clone(),
        profile.endpoint.clone(),
    );

    let ops = S3Ops::new(client);
    let mut entries = Vec::new();

    // 1. List "directories"
    let dirs = ops.list_common_prefixes(&bucket, &prefix).await.map_err(|e| e.to_string())?;
    for d in dirs {
        let name = d.trim_end_matches('/').split('/').last().unwrap_or(&d).to_string();
        entries.push(FileEntry {
            name,
            path: d,
            is_dir: true,
            size: 0,
            last_modified: None,
        });
    }

    // 2. List files (non-recursive)
    let files = ops.list_objects(&bucket, &prefix, false).await.map_err(|e| e.to_string())?;
    for f in files {
        if let Some(key) = f.key {
            // Skip the directory placeholder itself if it exists
            if key == prefix {
                continue;
            }
            let name = key.split('/').last().unwrap_or(&key).to_string();
            let size = f.size.unwrap_or(0);
            let last_modified = f.last_modified.map(|t| t.to_millis().unwrap_or(0));
            
            entries.push(FileEntry {
                name,
                path: key,
                is_dir: false,
                size,
                last_modified: Some(last_modified.unwrap_or(0)),
            });
        }
    }

    // Sort: Dirs first, then files
    entries.sort_by(|a, b| {
        if a.is_dir && !b.is_dir {
            std::cmp::Ordering::Less
        } else if !a.is_dir && b.is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(entries)
}

#[tauri::command]
async fn upload_file(
    repo: State<'_, TaskRepository>,
    profile_name: String, 
    bucket: String, 
    local_path: String, 
    dest_prefix: String
) -> Result<(), String> {
    let path = get_config_path();
    let manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    let profile = manager.get_profile(&profile_name).ok_or("Profile not found")?;

    let client = create_client(
        profile.provider,
        profile.access_key.clone(),
        profile.secret_key.clone(),
        profile.region.clone(),
        profile.endpoint.clone(),
    );

    let tm = TransferManager::new(client, repo.inner().clone());
    let path = Path::new(&local_path);
    
    // Default concurrency 4
    tm.upload(path, &bucket, &dest_prefix, true, 4).await.map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn download_file(
    repo: State<'_, TaskRepository>,
    profile_name: String,
    bucket: String,
    key: String,
    local_path: String,
    is_dir: bool
) -> Result<(), String> {
    println!("download_file called: profile='{}', bucket='{}', key='{}', to='{}', is_dir={}", 
        profile_name, bucket, key, local_path, is_dir);

    let path = get_config_path();
    let manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    let profile = manager.get_profile(&profile_name).ok_or("Profile not found")?;

    let client = create_client(
        profile.provider,
        profile.access_key.clone(),
        profile.secret_key.clone(),
        profile.region.clone(),
        profile.endpoint.clone(),
    );

    let tm = TransferManager::new(client, repo.inner().clone());
    let dest_path = Path::new(&local_path);

    // Use is_dir to determine if recursive download is needed
    tm.download(&bucket, &key, dest_path, is_dir, 4).await.map_err(|e| e.to_string())?;

    Ok(())
}    
    #[tauri::command]
    async fn delete_object(
        profile_name: String,
        bucket: String,
        key: String,
    ) -> Result<(), String> {
        let path = get_config_path();
        let manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
        let profile = manager.get_profile(&profile_name).ok_or("Profile not found")?;
    
        let client = create_client(
            profile.provider,
            profile.access_key.clone(),
            profile.secret_key.clone(),
            profile.region.clone(),
            profile.endpoint.clone(),
        );
    
        let ops = S3Ops::new(client);
        ops.delete_object(&bucket, &key).await.map_err(|e| e.to_string())?;
    
                Ok(())
    
            }
    
        
    
            #[tauri::command]
    
            async fn head_object(profile_name: String, bucket: String, key: String) -> Result<ObjectMetadata, String> {
    
                let path = get_config_path();
    
                let manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    
                let profile = manager.get_profile(&profile_name).ok_or("Profile not found")?;
    
        
    
                let client = create_client(
    
                    profile.provider,
    
                    profile.access_key.clone(),
    
                    profile.secret_key.clone(),
    
                    profile.region.clone(),
    
                    profile.endpoint.clone(),
    
                );
    
        
    
                let resp = client.head_object().bucket(&bucket).key(&key).send().await.map_err(|e| e.to_string())?;
    
        
    
                Ok(ObjectMetadata {
    
                    key,
    
                    size: resp.content_length.unwrap_or(0),
    
                    last_modified: resp.last_modified.map(|t| t.to_millis().unwrap_or(0)),
    
                    etag: resp.e_tag.map(String::from),
    
                    content_type: resp.content_type.map(String::from),
    
                })
    
            }
    
        
    
            #[tauri::command]
    
            async fn read_object(profile_name: String, bucket: String, key: String) -> Result<Vec<u8>, String> {
    
                let path = get_config_path();
    
                let manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    
                let profile = manager.get_profile(&profile_name).ok_or("Profile not found")?;
    
        
    
                let client = create_client(
    
                    profile.provider,
    
                    profile.access_key.clone(),
    
                    profile.secret_key.clone(),
    
                    profile.region.clone(),
    
                    profile.endpoint.clone(),
    
                );
    
        
    
                // Limit to 5MB for preview
    
                let range = "bytes=0-5242880"; 
    
                
    
                let resp = client.get_object().bucket(&bucket).key(&key).range(range).send().await.map_err(|e| e.to_string())?;
    
                
    
                let data = resp.body.collect().await.map_err(|e| e.to_string())?.into_bytes();
    
                Ok(data.to_vec())
    
            }
    
        
    
            #[tauri::command]
    
            fn list_profiles() -> Result<std::collections::HashMap<String, Profile>, String> {    let path = get_config_path();
    let manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    Ok(manager.profiles)
}

#[tauri::command]
fn save_profile(name: String, profile: Profile) -> Result<(), String> {
    let path = get_config_path();
    let mut manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    manager.add_profile(name, profile);
    manager.save_to_file(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_profile(name: String) -> Result<(), String> {
    let path = get_config_path();
    let mut manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    manager.profiles.remove(&name);
    manager.save_to_file(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn list_buckets(profile_name: String) -> Result<Vec<String>, String> {
    let path = get_config_path();
    let manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    let profile = manager.get_profile(&profile_name).ok_or("Profile not found")?;

    let client = create_client(
        profile.provider,
        profile.access_key.clone(),
        profile.secret_key.clone(),
        profile.region.clone(),
        profile.endpoint.clone(),
    );

    let resp = client.list_buckets().send().await.map_err(|e| e.to_string())?;
    let buckets = resp.buckets().iter().filter_map(|b| b.name().map(String::from)).collect();
    Ok(buckets)
}

#[tauri::command]
fn get_app_config() -> Result<ConfigManager, String> {
    let path = get_config_path();
    let manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    Ok(manager)
}

#[tauri::command]
fn save_app_settings(language: String, default_download_dir: String) -> Result<(), String> {
    let path = get_config_path();
    let mut manager = ConfigManager::load_from_file(&path).map_err(|e| e.to_string())?;
    manager.language = language;
    manager.default_download_dir = default_download_dir;
    manager.save_to_file(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        greet,
        list_profiles,
        save_profile,
        delete_profile,
        list_buckets,
        list_objects,
        get_app_config,
        save_app_settings,
        create_window,
        upload_file,
        download_file,
        delete_object,
        head_object,
        read_object
    ])
        .setup(|app| {
          app.handle().plugin(tauri_plugin_dialog::init())?;
          app.handle().plugin(tauri_plugin_fs::init())?;
          
          // Always enable logging
          app.handle().plugin(
            tauri_plugin_log::Builder::default()
              .level(log::LevelFilter::Info)
              .build(),
          )?;
    
          // Initialize Database
          let db_path = get_db_path();
          if let Some(parent) = db_path.parent() {
              let _ = fs::create_dir_all(parent);
          }
    
          // Ensure file exists for sqlite
          if !db_path.exists() {
              let _ = fs::File::create(&db_path);
          }
    
          let db_url = format!("sqlite://{}", db_path.to_string_lossy());
          let app_handle = app.handle().clone();
    
          tauri::async_runtime::block_on(async move {
              let pool = SqlitePoolOptions::new()
                  .max_connections(5)
                  .connect(&db_url)
                  .await
                  .unwrap_or_else(|e| {
                      log::error!("Failed to connect to database at {}: {}", db_url, e);
                      panic!("Failed to connect to database: {}", e);
                  });
    
              let repo = TaskRepository::new(pool);
              // Run migrations
              repo.migrate().await.unwrap_or_else(|e| {
                  log::error!("Failed to migrate database: {}", e);
                  panic!("Failed to migrate database: {}", e);
              });
    
              app_handle.manage(repo);
          });
    
          Ok(())
        })    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}