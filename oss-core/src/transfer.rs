use crate::db::TaskRepository;
use crate::downloader::Downloader;
use crate::ops::S3Ops;
use crate::uploader::ResumableUploader;
use anyhow::{anyhow, Result};
use aws_sdk_s3::Client;
use std::path::Path;
use walkdir::WalkDir;
use tracing::{info, warn};
use std::collections::{BTreeMap, HashSet};
use tokio_util::sync::CancellationToken;

pub struct TransferManager {
    client: Client,
    db: TaskRepository,
    ops: S3Ops,
}

#[derive(Debug, Clone)]
pub enum TransferType {
    Upload,             // Local -> Cloud
    Download,           // Cloud -> Local
    CopyCloud,          // Cloud -> Cloud (Same Bucket)
    CopyCrossBucket,    // Cloud -> Cloud (Diff Bucket, via Local)
    MoveCloud,          // Cloud -> Cloud (Same Bucket + Delete)
}

impl TransferManager {
    pub fn new(client: Client, db: TaskRepository) -> Self {
        let ops = S3Ops::new(client.clone());
        Self { client, db, ops }
    }

    /// List directory contents (File + Folder)
    pub async fn ls(&self, bucket: &str, prefix: &str) -> Result<Vec<String>> {
        let mut results = Vec::new();
        
        // 1. Get Common Prefixes (Folders)
        let folders = self.ops.list_common_prefixes(bucket, prefix).await?;
        for f in folders {
            results.push(format!("DIR  {f}"));
        }

        // 2. Get Objects (Files)
        let files = self.ops.list_objects(bucket, prefix, false).await?;
        for f in files {
            if let (Some(key), Some(size)) = (f.key, f.size) {
                 // Skip the directory marker itself if it exists (e.g. "folder/")
                 if key != prefix && key != format!("{}/", prefix) {
                    results.push(format!("FILE {} ({} bytes)", key, size));
                 }
            }
        }
        Ok(results)
    }
    
    /// Recursive tree view (returns formatted tree string)
    pub async fn tree(&self, bucket: &str, prefix: &str) -> Result<Vec<String>> {
        // 1. List all objects recursively
        let files = self.ops.list_objects(bucket, prefix, true).await?;
        
        // 2. Extract directories
        let mut dirs = HashSet::new();
        
        for obj in files {
            if let Some(key) = obj.key {
                 // Clean prefix removal
                 let relative_key = if let Some(stripped) = key.strip_prefix(prefix) {
                     stripped
                 } else {
                     continue; 
                 };
                 // Remove leading slash if any
                 let relative_key = relative_key.trim_start_matches('/');
                 if relative_key.is_empty() { continue; }

                 if key.ends_with('/') {
                     // It's an explicit folder, remove trailing slash
                     let path = relative_key.trim_end_matches('/');
                     if !path.is_empty() {
                         dirs.insert(path.to_string());
                     }
                 } else {
                     // It's a file, get parent directory
                     let path = std::path::Path::new(relative_key);
                     if let Some(parent) = path.parent() {
                         let p_str = parent.to_string_lossy();
                         if !p_str.is_empty() && p_str != "." {
                            // We need to add all ancestors
                            let parts: Vec<&str> = p_str.split('/').collect();
                            let mut current = String::new();
                            for (i, part) in parts.iter().enumerate() {
                                if i > 0 { current.push('/'); }
                                current.push_str(part);
                                dirs.insert(current.clone());
                            }
                         }
                     }
                 }
            }
        }

        // 3. Build Tree Structure
        #[derive(Debug)]
        struct Node {
            children: BTreeMap<String, Node>,
        }
        
        let mut root = Node { children: BTreeMap::new() };
        
        for dir in dirs {
            let parts: Vec<&str> = dir.split('/').collect();
            let mut current_node = &mut root;
            for part in parts {
                current_node = current_node.children.entry(part.to_string()).or_insert(Node { children: BTreeMap::new() });
            }
        }

        // 4. Draw Tree
        let mut lines = Vec::new();
        
        // Helper recursive function
        fn draw(node: &Node, prefix: &str, lines: &mut Vec<String>) {
            let count = node.children.len();
            for (i, (name, child)) in node.children.iter().enumerate() {
                let is_last = i == count - 1;
                let connector = if is_last { "└── " } else { "├── " };
                lines.push(format!("{}{}{}", prefix, connector, name));
                
                let child_prefix = if is_last { "    " } else { "│   " };
                let new_prefix = format!("{}{}", prefix, child_prefix);
                draw(child, &new_prefix, lines);
            }
        }
        
        draw(&root, "", &mut lines);
        
        if lines.is_empty() {
            return Ok(vec!["No subdirectories found.".to_string()]);
        }

        Ok(lines)
    }

    pub async fn upload(
        &self,
        local_path: &Path,
        bucket: &str,
        dest_key: &str,
        recursive: bool,
        concurrency: usize,
        progress_callback: Option<std::sync::Arc<dyn Fn(u64) + Send + Sync>>,
        cancel_token: Option<CancellationToken>,
    ) -> Result<()> {
        let uploader = ResumableUploader::new(self.client.clone(), self.db.clone());
        
        if let Some(ref token) = cancel_token {
            if token.is_cancelled() {
                return Err(anyhow::anyhow!("Cancelled"));
            }
        }

        if local_path.is_file() {
            // Single file upload
            let key = if dest_key.ends_with('/') || dest_key.is_empty() {
                let filename = local_path.file_name().unwrap().to_string_lossy();
                format!("{dest_key}{filename}")
            } else {
                dest_key.to_string()
            };
            info!("Uploading: {:?} -> s3://{}/{}", local_path, bucket, key);
            uploader.upload_file(bucket, &key, local_path, concurrency, progress_callback, cancel_token).await?;
        } else if local_path.is_dir() {
            if !recursive {
                return Err(anyhow!("Source is a directory, use -r to upload recursively"));
            }
            let walker = WalkDir::new(local_path);
            let transferred_accumulator = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
            
            for entry in walker.into_iter().filter_map(|e| e.ok()) {
                if let Some(ref token) = cancel_token {
                    if token.is_cancelled() {
                        return Err(anyhow::anyhow!("Cancelled"));
                    }
                }

                if entry.file_type().is_file() {
                    let path = entry.path();
                    let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
                    
                    let relative_path = path.strip_prefix(local_path)?;
                    let relative_key = relative_path.to_string_lossy().replace("\\", "/");
                    
                    let key = if dest_key.ends_with('/') || dest_key.is_empty() {
                         format!("{dest_key}{relative_key}")
                    } else {
                         format!("{dest_key}/{relative_key}")
                    };
                    
                    let sub_cb = if let Some(main_cb) = &progress_callback {
                        let acc = transferred_accumulator.load(std::sync::atomic::Ordering::Relaxed);
                        let main_cb_clone = main_cb.clone();
                        Some(std::sync::Arc::new(move |current_file_bytes| {
                            main_cb_clone(acc + current_file_bytes);
                        }) as std::sync::Arc<dyn Fn(u64) + Send + Sync>)
                    } else {
                        None
                    };

                    info!("Uploading: {:?} -> s3://{}/{}", path, bucket, key);
                    uploader.upload_file(bucket, &key, path, concurrency, sub_cb, cancel_token.clone()).await?;
                    
                    transferred_accumulator.fetch_add(file_size, std::sync::atomic::Ordering::Relaxed);
                }
            }
        } else {
             return Err(anyhow!("Local path does not exist"));
        }
        Ok(())
    }

    pub async fn download(
        &self,
        bucket: &str,
        src_key: &str,
        local_path: &Path,
        recursive: bool,
        concurrency: usize,
        progress_callback: Option<std::sync::Arc<dyn Fn(u64) + Send + Sync>>,
        cancel_token: Option<CancellationToken>,
    ) -> Result<()> {
        let downloader = Downloader::new(self.client.clone(), self.db.clone());

        if let Some(ref token) = cancel_token {
            if token.is_cancelled() {
                return Err(anyhow::anyhow!("Cancelled"));
            }
        }

        if recursive {
            let objects = self.ops.list_objects(bucket, src_key, true).await?;
            if objects.is_empty() {
                 warn!("No objects found with prefix '{}'", src_key);
                 return Ok(());
            }
            
            let transferred_accumulator = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));

            for obj in objects {
                if let Some(ref token) = cancel_token {
                    if token.is_cancelled() {
                        return Err(anyhow::anyhow!("Cancelled"));
                    }
                }

                if let Some(key) = obj.key {
                    if key.ends_with('/') { continue; }
                    
                    let file_size = obj.size.unwrap_or(0) as u64;
                    
                    let relative_key = if let Some(stripped) = key.strip_prefix(src_key) {
                        stripped
                    } else {
                        &key
                    };
                    
                    let clean_relative = relative_key.trim_start_matches('/');
                    
                    let dest_file = if clean_relative.is_empty() {
                         local_path.to_path_buf()
                    } else {
                         local_path.join(clean_relative)
                    };
                    
                    let sub_cb = if let Some(main_cb) = &progress_callback {
                        let acc = transferred_accumulator.load(std::sync::atomic::Ordering::Relaxed);
                        let main_cb_clone = main_cb.clone();
                        Some(std::sync::Arc::new(move |current_file_bytes| {
                            main_cb_clone(acc + current_file_bytes);
                        }) as std::sync::Arc<dyn Fn(u64) + Send + Sync>)
                    } else {
                        None
                    };

                    info!("Downloading: s3://{}/{} -> {:?}", bucket, key, dest_file);
                    downloader.download_file(bucket, &key, &dest_file, concurrency, sub_cb, cancel_token.clone()).await?;
                    
                    transferred_accumulator.fetch_add(file_size, std::sync::atomic::Ordering::Relaxed);
                }
            }
        } else {
            info!("Downloading: s3://{}/{} -> {:?}", bucket, src_key, local_path);
            downloader.download_file(bucket, src_key, local_path, concurrency, progress_callback, cancel_token).await?;
        }

        Ok(())
    }

    pub async fn copy_cloud(
        &self,
        src_bucket: &str,
        src_key: &str,
        dest_bucket: &str,
        dest_key: &str,
        recursive: bool,
    ) -> Result<()> {
        if recursive {
            let objects = self.ops.list_objects(src_bucket, src_key, true).await?;
            for obj in objects {
                if let Some(key) = obj.key {
                    let relative = if let Some(stripped) = key.strip_prefix(src_key) {
                        stripped
                    } else {
                        &key
                    };
                    
                    let new_key = if dest_key.ends_with('/') {
                        format!("{dest_key}{relative}")
                    } else {
                         format!("{dest_key}/{relative}")
                    };
                    
                    let final_key = if key == src_key && !dest_key.ends_with('/') {
                        dest_key.to_string()
                    } else {
                        new_key
                    };

                    info!("Copying (Cloud): s3://{}/{} -> s3://{}/{}", src_bucket, key, dest_bucket, final_key);
                    self.ops.copy_object(src_bucket, &key, dest_bucket, &final_key).await?;
                }
            }
        } else {
            info!("Copying (Cloud): s3://{}/{} -> s3://{}/{}", src_bucket, src_key, dest_bucket, dest_key);
            self.ops.copy_object(src_bucket, src_key, dest_bucket, dest_key).await?;
        }
        Ok(())
    }

    pub async fn move_cloud(
        &self,
        src_bucket: &str,
        src_key: &str,
        dest_bucket: &str,
        dest_key: &str,
    ) -> Result<()> {
        let is_folder = src_key.ends_with('/');
        let objects = self.ops.list_objects(src_bucket, src_key, true).await?;
        
        if objects.is_empty() {
             return Err(anyhow!("Source path does not exist"));
        }
        
        let is_batch = objects.len() > 1 || is_folder;

        if is_batch {
             self.copy_cloud(src_bucket, src_key, dest_bucket, dest_key, true).await?;
             let keys: Vec<String> = objects.into_iter().filter_map(|o| o.key).collect();
             self.ops.delete_objects(src_bucket, keys).await?;
        } else {
             self.copy_cloud(src_bucket, src_key, dest_bucket, dest_key, false).await?;
             self.ops.delete_object(src_bucket, src_key).await?;
        }

        Ok(())
    }

    pub async fn copy_cross_bucket(
        &self,
        src_bucket: &str,
        src_key: &str,
        dest_bucket: &str,
        dest_key: &str,
        recursive: bool,
        concurrency: usize,
        cancel_token: Option<CancellationToken>,
    ) -> Result<()> {
        let temp_dir = std::env::temp_dir().join("oss-manager-transit").join(uuid::Uuid::new_v4().to_string());
        tokio::fs::create_dir_all(&temp_dir).await?;

        info!("Transit: Downloading to temporary {:?}", temp_dir);
        
        // Pass cancel_token to download
        self.download(src_bucket, src_key, &temp_dir, recursive, concurrency, None, cancel_token.clone()).await?;

        info!("Transit: Uploading to s3://{}/{}", dest_bucket, dest_key);
        
        if recursive {
            self.upload(&temp_dir, dest_bucket, dest_key, true, concurrency, None, cancel_token).await?;
        } else {
            let mut entries = tokio::fs::read_dir(&temp_dir).await?;
            if let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                self.upload(&path, dest_bucket, dest_key, false, concurrency, None, cancel_token).await?;
            }
        }

        tokio::fs::remove_dir_all(&temp_dir).await?;
        Ok(())
    }

    pub async fn remove(&self, bucket: &str, key: &str, recursive: bool) -> Result<()> {
        if recursive {
            // Delete everything with prefix
            let objects = self.ops.list_objects(bucket, key, true).await?;
            if objects.is_empty() {
                // Check if it's a "directory" marker
                if !key.ends_with('/') {
                    // Maybe user said "rm -r folder" without slash.
                    // Try listing "folder/"
                    let folder_key = format!("{}/", key);
                    let objects_retry = self.ops.list_objects(bucket, &folder_key, true).await?;
                    if !objects_retry.is_empty() {
                        let keys: Vec<String> = objects_retry.into_iter().filter_map(|o| o.key).collect();
                        self.ops.delete_objects(bucket, keys).await?;
                        return Ok(());
                    }
                }
                warn!("No objects found with prefix '{}'", key);
                return Ok(());
            }

            let keys: Vec<String> = objects.into_iter().filter_map(|o| o.key).collect();
            info!("Deleting {} objects recursively...", keys.len());
            self.ops.delete_objects(bucket, keys).await?;
        } else {
            // Delete single object
            info!("Deleting s3://{}/{}", bucket, key);
            self.ops.delete_object(bucket, key).await?;
        }
        Ok(())
    }
}
