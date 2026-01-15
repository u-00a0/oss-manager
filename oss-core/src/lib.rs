use aws_config::{BehaviorVersion, Region};
use aws_credential_types::Credentials;
use aws_sdk_s3::{config::Builder, Client};
use aws_types::sdk_config::SharedCredentialsProvider;
use serde::{Deserialize, Serialize};

pub use aws_sdk_s3;

pub mod config;
pub mod db;
pub mod downloader;
pub mod ops;
pub mod transfer;
pub mod uploader;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum S3Provider {
    Aws,
    CloudflareR2,
    Aliyun,
    Tencent,
    Custom,
}

/// Creates an S3 client based on the provider and configuration.
///
/// # Arguments
///
/// * `provider` - The S3 provider (AWS, Cloudflare R2, Aliyun, Tencent, or Custom).
/// * `access_key` - The access key ID.
/// * `secret_key` - The secret access key.
/// * `region` - The region string (e.g., "us-east-1").
/// * `endpoint` - Optional custom endpoint URL. Required for Cloudflare R2 if not handled automatically,
///                but typically R2 requires a specific endpoint format like `https://<account_id>.r2.cloudflarestorage.com`.
///
/// # Returns
///
/// * `aws_sdk_s3::Client` - The configured S3 client.
pub fn create_client(
    provider: S3Provider,
    access_key: String,
    secret_key: String,
    region: String,
    endpoint: Option<String>,
) -> Client {
    let credentials = Credentials::new(access_key, secret_key, None, None, "static");
    let credentials_provider = SharedCredentialsProvider::new(credentials);
    let region = Region::new(region);

    let mut config_builder = Builder::new()
        .behavior_version(BehaviorVersion::latest())
        .region(region)
        .credentials_provider(credentials_provider);

    match provider {
        S3Provider::CloudflareR2 => {
            if let Some(ep) = endpoint {
                config_builder = config_builder.endpoint_url(ep);
            }
            // R2 matches S3 path style generally, but verification of the endpoint format
            // is usually done by the user providing the correct URL.
            // We ensure it is treated as a custom endpoint.
        }
        S3Provider::Aliyun | S3Provider::Tencent => {
            // Force path style for these providers to avoid DNS resolution issues with virtual buckets
            config_builder = config_builder.force_path_style(true);

            if let Some(ep) = endpoint {
                config_builder = config_builder.endpoint_url(ep);
            }
        }
        S3Provider::Aws => {
            if let Some(ep) = endpoint {
                config_builder = config_builder.endpoint_url(ep);
            }
        }
        S3Provider::Custom => {
            config_builder = config_builder.force_path_style(true); // Often safer for custom/minio
            if let Some(ep) = endpoint {
                config_builder = config_builder.endpoint_url(ep);
            }
        }
    }

    let config = config_builder.build();
    Client::from_conf(config)
}
