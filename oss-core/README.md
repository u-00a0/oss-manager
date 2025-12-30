# OSS Core

**`oss-core`** is the underlying library for the OSS Manager ecosystem, encapsulating the complexity of S3 interactions, state management, and transfer logic. It relies on `aws-sdk-s3` for protocol communication and `sqlx` (SQLite) for local state persistence.

## Architecture Modules

### 1. `config`
Manages user profiles and application settings. Supports encryption of sensitive credentials (future roadmap) and JSON-based serialization.

*   **Profiles**: Stores Access Key, Secret Key, Region, Endpoint, and Provider type.
*   **Settings**: Manages global preferences like default download paths and language.

### 2. `ops` (Operations)
Provides a high-level abstraction over raw S3 SDK calls.

*   **Bucket Operations**: List, Create, Delete buckets.
*   **Object Operations**: List objects (with delimiter support), Head object, Delete object.
*   **Provider Adaptations**: Handles minor protocol differences between cloud providers (e.g., Aliyun CNAME behavior).

### 3. `transfer`
The core engine for file transmission.

*   **Upload**: Supports recursive directory uploads, multipart uploads for large files, and concurrency control.
*   **Download**: Implements ranged GET requests for parallel downloading and resumable support.
*   **Resumability**: Automatically tracks transfer progress in the local SQLite database.

### 4. `db`
Persistence layer using `sqlx`.

*   **Schema**:
    *   `tasks`: Tracks file-level transfer status (Pending, Running, Paused, Completed, Failed).
    *   `parts`: Tracks chunk-level status for multipart transfers.

## Usage Example

```rust
use oss_core::{create_client, config::ConfigManager, ops::S3Ops};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Load Configuration
    let config = ConfigManager::load_from_file(&path)?;
    let profile = config.get_profile("my-profile").unwrap();

    // 2. Initialize Client
    let client = create_client(
        profile.provider,
        profile.access_key.clone(),
        profile.secret_key.clone(),
        profile.region.clone(),
        profile.endpoint.clone(),
    );

    // 3. Perform Operations
    let ops = S3Ops::new(client);
    let objects = ops.list_objects("my-bucket", "", false).await?;
    
    for obj in objects {
        println!("Key: {:?}", obj.key);
    }

    Ok(())
}
```

## Testing

Unit and integration tests are provided. Ensure the test environment is configured or use mocked credentials where applicable.

```bash
cargo test -p oss-core
```
