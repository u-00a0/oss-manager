use anyhow::{Context, Result};
use aws_sdk_s3::Client;
use aws_sdk_s3::types::{Object, Delete};
use aws_sdk_s3::types::ObjectIdentifier;

pub struct S3Ops {
    client: Client,
}

impl S3Ops {
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    /// List objects with prefix. Returns a vector of Objects.
    /// Handles pagination automatically.
    pub async fn list_objects(&self, bucket: &str, prefix: &str, recursive: bool) -> Result<Vec<Object>> {
        let mut objects = Vec::new();
        let mut continuation_token = None;

        let prefix_clean = if prefix.ends_with('/') || prefix.is_empty() {
            prefix.to_string()
        } else if recursive {
            // If recursive but no trailing slash, assume it's a directory
            format!("{}/", prefix)
        } else {
             // Exact match or directory prefix check happens outside usually,
             // but for listing "a directory", we usually want the slash.
             // If user passes "path/to/file", we list just that.
             prefix.to_string()
        };

        loop {
            let mut req = self.client.list_objects_v2()
                .bucket(bucket);
            
            if !prefix_clean.is_empty() {
                req = req.prefix(&prefix_clean);
            }
            
            if let Some(token) = continuation_token {
                req = req.continuation_token(token);
            }

            // If not recursive, we use delimiter '/' to emulate directories
            if !recursive {
                req = req.delimiter("/");
            }

            let resp = req.send().await.context("Failed to list objects")?;

            if let Some(contents) = resp.contents {
                objects.extend(contents);
            }

            // If not recursive, common_prefixes contains "subdirectories"
            // We might want to return these as well if we are doing a generic "ls".
            // But for this specific function returning `Vec<Object>`, we only get files.
            // "ls" command might need a different struct.
            
            if resp.is_truncated.unwrap_or(false) {
                continuation_token = resp.next_continuation_token;
            } else {
                break;
            }
        }
        Ok(objects)
    }

    /// List "directories" (CommonPrefixes) for non-recursive listing
    pub async fn list_common_prefixes(&self, bucket: &str, prefix: &str) -> Result<Vec<String>> {
         let mut prefixes = Vec::new();
         let mut continuation_token = None;
         let prefix = if !prefix.is_empty() && !prefix.ends_with('/') {
             format!("{}/", prefix)
         } else {
             prefix.to_string()
         };

         loop {
            let mut req = self.client.list_objects_v2()
                .bucket(bucket)
                .delimiter("/"); // Crucial for listing "folders"
            
            if !prefix.is_empty() {
                req = req.prefix(&prefix);
            }

            if let Some(token) = continuation_token {
                req = req.continuation_token(token);
            }

            let resp = req.send().await.context("Failed to list common prefixes")?;

            if let Some(common) = resp.common_prefixes {
                for p in common {
                    if let Some(prefix) = p.prefix {
                        prefixes.push(prefix);
                    }
                }
            }
            
            if resp.is_truncated.unwrap_or(false) {
                continuation_token = resp.next_continuation_token;
            } else {
                break;
            }
         }
         Ok(prefixes)
    }

    pub async fn copy_object(&self, src_bucket: &str, src_key: &str, dest_bucket: &str, dest_key: &str) -> Result<()> {
        // CopySource must be URL-encoded? SDK usually handles it, but format is "bucket/key"
        // Wait, standard S3 CopySource is "bucket/key". 
        // For special chars, encoding might be needed.
        let copy_source = format!("{}/{}", src_bucket, src_key);
        // We should URL encode the key part potentially, but aws-sdk-rust documentation says:
        // "The name of the source bucket and key name of the source object, separated by a slash (/)."
        // Let's rely on basic format for now.

        self.client.copy_object()
            .copy_source(copy_source)
            .bucket(dest_bucket)
            .key(dest_key)
            .send()
            .await
            .context(format!("Failed to copy {}/{} to {}/{}", src_bucket, src_key, dest_bucket, dest_key))?;
        
        Ok(())
    }

    pub async fn delete_object(&self, bucket: &str, key: &str) -> Result<()> {
        self.client.delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .context(format!("Failed to delete {}/{}", bucket, key))?;
        Ok(())
    }

    pub async fn delete_objects(&self, bucket: &str, keys: Vec<String>) -> Result<()> {
        // Batch delete (max 1000)
        for chunk in keys.chunks(1000) {
             let objects: Vec<ObjectIdentifier> = chunk.iter()
                .map(|k| ObjectIdentifier::builder().key(k).build().unwrap()) // unwrap safe for simple builder
                .collect();

             let delete = Delete::builder()
                .set_objects(Some(objects))
                .quiet(true)
                .build()
                .unwrap();

             self.client.delete_objects()
                .bucket(bucket)
                .delete(delete)
                .send()
                .await
                .context("Failed to batch delete objects")?;
        }
        Ok(())
    }
}
