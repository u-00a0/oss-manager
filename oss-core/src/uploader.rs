use crate::db::{Part, TaskRepository, TaskStatus};
use anyhow::{Context, Result};
use aws_sdk_s3::types::{CompletedMultipartUpload, CompletedPart};
use aws_sdk_s3::Client;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;

const CHUNK_SIZE: u64 = 10 * 1024 * 1024; // 10 MB

use std::sync::atomic::{AtomicU64, Ordering};

pub struct ResumableUploader {
    client: Client,
    db: TaskRepository,
}

impl ResumableUploader {
    pub fn new(client: Client, db: TaskRepository) -> Self {
        Self { client, db }
    }

    pub async fn upload_file(
        &self,
        bucket: &str,
        key: &str,
        file_path: &Path,
        concurrency: usize,
        progress_callback: Option<Arc<dyn Fn(u64) + Send + Sync>>,
        cancel_token: Option<CancellationToken>,
    ) -> Result<()> {
        let file_path_str = file_path.to_string_lossy().to_string();
        let file_size = tokio::fs::metadata(file_path).await?.len();
        
        // Initial progress (0)
        if let Some(ref cb) = progress_callback {
            cb(0);
        }

        // Check cancellation
        if let Some(ref token) = cancel_token {
            if token.is_cancelled() {
                return Err(anyhow::anyhow!("Cancelled"));
            }
        }

        // 1. Check for existing active task or create new one
        let task = self.db.find_active_task(bucket, key).await?;
        
        let (task_id, upload_id) = if let Some(t) = task {
             (t.id, t.upload_id)
        } else {
            let id = self.db.create_task(&file_path_str, key, bucket, file_size as i64).await?;
            (id, None)
        };

        self.db.update_task_status(task_id, TaskStatus::Running).await?;

        // 2. Initiate Multipart Upload if needed
        let upload_id = match upload_id {
            Some(uid) => uid,
            None => {
                let resp = self.client
                    .create_multipart_upload()
                    .bucket(bucket)
                    .key(key)
                    .send()
                    .await
                    .context("Failed to initiate multipart upload")?;
                let uid = resp.upload_id.context("No upload ID returned")?;
                self.db.set_upload_id(task_id, &uid).await?;
                uid
            }
        };

        // 3. Generate Parts (in DB) if not exist
        let (total_parts_count, _) = self.db.get_task_progress(task_id).await?;
        if total_parts_count == 0 {
             let mut parts = Vec::new();
            let mut part_number = 1;
            let mut start_byte = 0;

            while start_byte < file_size {
                let end_byte = std::cmp::min(start_byte + CHUNK_SIZE, file_size);
                parts.push(Part {
                    task_id,
                    part_number,
                    start_byte: start_byte as i64,
                    end_byte: end_byte as i64,
                    is_completed: false,
                    etag: None,
                });
                start_byte = end_byte;
                part_number += 1;
            }
            self.db.create_parts(parts).await?;
        }

        // 4. Sync with S3 (ListParts)
        let mut continuation_token = None;
        loop {
            if let Some(ref token) = cancel_token {
                if token.is_cancelled() {
                    return Err(anyhow::anyhow!("Cancelled"));
                }
            }

            let resp = self.client
                .list_parts()
                .bucket(bucket)
                .key(key)
                .upload_id(&upload_id)
                .set_part_number_marker(continuation_token)
                .send()
                .await
                .context("Failed to list parts from S3")?;

            if let Some(parts) = resp.parts {
                for p in parts {
                    if let (Some(pn), Some(etag)) = (p.part_number, p.e_tag) {
                         self.db.mark_part_completed(task_id, pn as i64, Some(etag)).await?;
                    }
                }
            }

            if resp.is_truncated.unwrap_or(false) {
                continuation_token = resp.next_part_number_marker.map(|i| i.to_string());
            } else {
                break;
            }
        }

        // 5. Upload missing parts
        let pending_parts = self.db.get_incomplete_parts(task_id).await?;
        
        // Calculate initial progress
        let mut transferred = 0u64;
        let completed_parts_init = self.db.get_completed_parts(task_id).await?;
        for p in completed_parts_init {
            transferred += (p.end_byte - p.start_byte) as u64;
        }
        
        let transferred_atomic = Arc::new(AtomicU64::new(transferred));
        if let Some(ref cb) = progress_callback {
            cb(transferred);
        }

        let semaphore = Arc::new(Semaphore::new(concurrency));
        let mut join_set = JoinSet::new();
        let client = self.client.clone();
        let db = self.db.clone();
        let bucket = bucket.to_string();
        let key = key.to_string();
        let upload_id_clone = upload_id.clone();
        let file_path_buf = file_path.to_path_buf();

        for part in pending_parts {
            if let Some(ref token) = cancel_token {
                if token.is_cancelled() {
                    return Err(anyhow::anyhow!("Cancelled"));
                }
            }

            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let client = client.clone();
            let db = db.clone();
            let bucket = bucket.clone();
            let key = key.clone();
            let upload_id = upload_id_clone.clone();
            let file_path = file_path_buf.clone();
            
            let cb = progress_callback.clone();
            let transferred_atomic = transferred_atomic.clone();

            join_set.spawn(async move {
                let _permit = permit;
                let part_size = (part.end_byte - part.start_byte) as u64;
                Self::upload_part(client, db, bucket, key, upload_id, file_path, part).await?;
                
                let new_total = transferred_atomic.fetch_add(part_size, Ordering::Relaxed) + part_size;
                if let Some(callback) = cb {
                    callback(new_total);
                }
                Ok::<(), anyhow::Error>(())
            });
        }

        let mut error_occurred = false;
        while let Some(res) = join_set.join_next().await {
            if let Some(ref token) = cancel_token {
                if token.is_cancelled() {
                    join_set.abort_all();
                    return Err(anyhow::anyhow!("Cancelled"));
                }
            }

             match res {
                Ok(Ok(_)) => {},
                Ok(Err(e)) => {
                    eprintln!("Part upload failed: {:?}", e);
                    error_occurred = true;
                }
                Err(e) => {
                    eprintln!("Task panic: {:?}", e);
                    error_occurred = true;
                }
            }
        }

        if error_occurred {
             self.db.update_task_status(task_id, TaskStatus::Failed).await?;
             anyhow::bail!("One or more parts failed to upload");
        }

        // 6. Complete Multipart Upload
        let completed_parts_db = self.db.get_completed_parts(task_id).await?;
        let mut completed_multipart_upload_parts = Vec::new();
        
        for p in completed_parts_db {
             if let Some(etag) = p.etag {
                 completed_multipart_upload_parts.push(
                     CompletedPart::builder()
                        .part_number(p.part_number as i32)
                        .e_tag(etag)
                        .build()
                 );
             }
        }

        let completed_multipart_upload = CompletedMultipartUpload::builder()
            .set_parts(Some(completed_multipart_upload_parts))
            .build();

        self.client
            .complete_multipart_upload()
            .bucket(bucket)
            .key(key)
            .upload_id(&upload_id)
            .multipart_upload(completed_multipart_upload)
            .send()
            .await
            .context("Failed to complete multipart upload")?;

        self.db.update_task_status(task_id, TaskStatus::Completed).await?;

        Ok(())
    }
    
    async fn upload_part(
        client: Client,
        db: TaskRepository,
        bucket: String,
        key: String,
        upload_id: String,
        file_path: PathBuf,
        part: Part,
    ) -> Result<()> {
        let mut file = File::open(&file_path).await?;
        file.seek(SeekFrom::Start(part.start_byte as u64)).await?;
        
        let mut buffer = vec![0u8; (part.end_byte - part.start_byte) as usize];
        file.read_exact(&mut buffer).await?;

        let resp = client.upload_part()
            .bucket(&bucket)
            .key(&key)
            .upload_id(&upload_id)
            .part_number(part.part_number as i32)
            .body(buffer.into())
            .send()
            .await
            .context(format!("Failed to upload part {}", part.part_number))?;

        db.mark_part_completed(part.task_id, part.part_number, resp.e_tag).await?;
        Ok(())
    }
}
