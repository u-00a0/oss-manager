# OSS Core

**`oss-core`** is the foundational logic pillar of the OSS Manager ecosystem, responsible for abstracting the complexity of the S3 protocol and managing the lifecycle of file transfers. It is powered by asynchronous I/O, utilizes `aws-sdk-s3` for protocol communication, and uses `sqlx` (SQLite) to track transfer states.

## 🧩 Core Module Design

### 1. Configuration Management (`config`)
Responsible for storing accounts (Profiles) and application settings. Supports JSON serialization to ensure secure loading and management of credentials.

*   **Storage Accounts**: Covers Access Key, Secret Key, Region, Endpoint, and Provider type.
*   **Global Settings**: Manages shared configurations like default download directory and language preference.

### 2. S3 Basic Operations (`ops`)
Provides a high-level abstraction over the native SDK, simplifying common bucket and object operations, and supplying data for the UI layer.

*   **Bucket Management**: List, create, and delete buckets.
*   **Object Operations**:
    *   **Listing**: Paginated queries (supporting Common Prefixes), automatically merging file and folder views.
    *   **Preview/Read**: Supports `head_object` to get metadata, and `read_object` to read small file content (for text/code preview, default limit 5MB).
    *   **Management**: Delete, copy, and move objects.
*   **Provider Adaptation**: Automatically handles minor differences in protocol implementation across different cloud providers (AWS, Aliyun, R2, etc.).

### 3. Transfer Engine (`transfer`)
The most technically sophisticated component of the project, specialized in handling large-scale file transfers.

*   **Upload Logic**:
    *   Supports recursive directory uploads.
    *   Automatic multipart parallel uploads for large files.
    *   MD5 verification to ensure data integrity.
*   **Download Logic**:
    *   Implements concurrent Ranged GET downloads.
    *   Supports resumable transfers.
    *   **Recursive Download**: Supports downloading entire folder structures recursively via the `is_dir` flag.
*   **Task Persistence**: The state of every part during transfer is persisted in real-time to a local SQLite database, ensuring seamless resumption after network interruptions or program crashes.

### 4. Database Layer (`db`)
Data access layer implemented based on `sqlx`.

*   **Schema Architecture**:
    *   `tasks`: Tracks file-level transfer tasks (Status: Pending, Running, Paused, Completed, Failed).
    *   `parts`: Tracks part-level transfer progress, supporting fine-grained resumption control.
*   **Robustness**: Includes database connection error logging and automatic migration mechanisms.

## 💻 Integration Example

```rust
use oss_core::{create_client, config::ConfigManager, ops::S3Ops};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Load configuration
    let config = ConfigManager::load_from_file(&path)?;
    let profile = config.get_profile("my-aliyun").ok_or("Account not found")?;

    // 2. Initialize S3 client
    let client = create_client(
        profile.provider,
        profile.access_key.clone(),
        profile.secret_key.clone(),
        profile.region.clone(),
        profile.endpoint.clone(),
    );

    // 3. Execute operations
    let ops = S3Ops::new(client);
    let objects = ops.list_objects("my-bucket", "backup/", false).await?;
    
    for obj in objects {
        println!("Object Name: {:?}", obj.key);
    }

    Ok(())
}
```

## 🧪 Testing

The project includes comprehensive unit tests and integration tests:

```bash
cargo test -p oss-core
```
