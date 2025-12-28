use crate::db::TaskRepository;
use crate::downloader::Downloader;
use crate::ops::S3Ops;
use crate::uploader::ResumableUploader;
use anyhow::{anyhow, Result};
use aws_sdk_s3::Client;
use std::path::Path;
use walkdir::WalkDir;
use tracing::{info, warn};

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
            results.push(format!("DIR  {}", f));
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
    
    /// Recursive tree view (returns list of all keys)
    pub async fn tree(&self, bucket: &str, prefix: &str) -> Result<Vec<String>> {
        let files = self.ops.list_objects(bucket, prefix, true).await?;
        let mut keys = Vec::new();
        for f in files {
            if let Some(key) = f.key {
                keys.push(key);
            }
        }
        Ok(keys)
    }

    pub async fn upload(
        &self,
        local_path: &Path,
        bucket: &str,
        dest_key: &str,
        recursive: bool,
        concurrency: usize,
    ) -> Result<()> {
        let uploader = ResumableUploader::new(self.client.clone(), self.db.clone());
        
        if local_path.is_file() {
            // Single file upload
            let key = if dest_key.ends_with('/') || dest_key.is_empty() {
                let filename = local_path.file_name().unwrap().to_string_lossy();
                format!("{}{}", dest_key, filename)
            } else {
                dest_key.to_string()
            };
            info!("Uploading: {:?} -> s3://{}/{}", local_path, bucket, key);
            uploader.upload_file(bucket, &key, local_path, concurrency).await?;
        } else if local_path.is_dir() {
            if !recursive {
                return Err(anyhow!("Source is a directory, use -r to upload recursively"));
            }
            let walker = WalkDir::new(local_path);
            for entry in walker.into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    let path = entry.path();
                    let relative_path = path.strip_prefix(local_path)?;
                    let relative_key = relative_path.to_string_lossy().replace("\\", "/");
                    
                    let key = if dest_key.ends_with('/') || dest_key.is_empty() {
                         format!("{}{}", dest_key, relative_key)
                    } else {
                         format!("{}/{}", dest_key, relative_key)
                    };

                    info!("Uploading: {:?} -> s3://{}/{}", path, bucket, key);
                    uploader.upload_file(bucket, &key, path, concurrency).await?;
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
    ) -> Result<()> {
        let downloader = Downloader::new(self.client.clone(), self.db.clone());

        if recursive {
            let objects = self.ops.list_objects(bucket, src_key, true).await?;
            if objects.is_empty() {
                 warn!("No objects found with prefix '{}'", src_key);
                 return Ok(());
            }

            for obj in objects {
                if let Some(key) = obj.key {
                    if key.ends_with('/') { continue; }
                    
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

                    info!("Downloading: s3://{}/{} -> {:?}", bucket, key, dest_file);
                    downloader.download_file(bucket, &key, &dest_file, concurrency).await?;
                }
            }
        } else {
            info!("Downloading: s3://{}/{} -> {:?}", bucket, src_key, local_path);
            downloader.download_file(bucket, src_key, local_path, concurrency).await?;
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
                        format!("{}{}", dest_key, relative)
                    } else {
                         format!("{}/{}", dest_key, relative)
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
    ) -> Result<()> {
        let temp_dir = std::env::temp_dir().join("oss-manager-transit").join(uuid::Uuid::new_v4().to_string());
        tokio::fs::create_dir_all(&temp_dir).await?;

        info!("Transit: Downloading to temporary {:?}", temp_dir);
        
        self.download(src_bucket, src_key, &temp_dir, recursive, concurrency).await?;

        info!("Transit: Uploading to s3://{}/{}", dest_bucket, dest_key);
        
        if recursive {
            self.upload(&temp_dir, dest_bucket, dest_key, true, concurrency).await?;
        } else {
            let mut entries = tokio::fs::read_dir(&temp_dir).await?;
            if let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                self.upload(&path, dest_bucket, dest_key, false, concurrency).await?;
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