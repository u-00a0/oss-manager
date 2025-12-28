# OSS Core 开发文档

`oss-core` 是 OSS Manager 的核心库，提供了一套基于 `aws-sdk-s3` 的高层抽象，旨在简化构建高性能、可靠的 S3 文件传输应用。

## 1. 核心设计理念

*   **状态持久化**: 摒弃内存状态管理，使用 SQLite 持久化所有传输任务（Task）和分片（Part）状态，确保断点续传的可靠性。
*   **并发控制**: 使用 `tokio::sync::Semaphore` 实现精确的并发请求限制，防止在大规模递归操作中耗尽系统资源。
*   **机械细节屏蔽**: 固定分块大小（10MB），将性能调优的重心放在并发数控制上，简化调用者逻辑。

## 2. 核心模块

### 2.1 客户端构建 (`lib.rs`)

提供了 `create_client` 工厂函数，封装了针对不同云厂商的优化配置（如 Endpoint 解析、Path Style 强制等）。

```rust
use oss_core::{create_client, S3Provider};

let client = create_client(
    S3Provider::Aliyun,
    "AK", "SK", "region", None
);
```

### 2.2 数据库层 (`db.rs`)

基于 `sqlx` (SQLite) 实现。

*   **Task 表**: 记录文件级别的传输任务（上传/下载），包含总大小、状态、Upload ID 等。
*   **Part 表**: 记录分片级别的状态，包含 Start/End Byte、ETag 等。
*   **Repository**: 提供了 `create_task`, `get_incomplete_parts`, `mark_part_completed` 等原子操作。

### 2.3 传输逻辑

#### 上传 (`uploader.rs`)
实现了 `ResumableUploader`。
1.  **检查**: 查询 DB 是否存在未完成任务。
2.  **同步**: 若存在 Upload ID，调用 `ListParts` 同步服务端状态，避免重复上传。
3.  **并发**: 使用信号量控制并发上传缺失分片。
4.  **完成**: 调用 `CompleteMultipartUpload`。

#### 下载 (`downloader.rs`)
实现了 `Downloader`。
1.  **分片**: 逻辑上将文件切分为固定大小的 Range。
2.  **并发**: 并发发送 Range Get 请求。
3.  **写入**: 使用 `tokio::fs::File` 的 `seek` 功能将数据写入指定偏移量。

#### 传输管理 (`transfer.rs`)
`TransferManager` 是最高层的门面模式（Facade），封装了复杂的业务逻辑：
*   **递归操作**: 使用 `walkdir` (本地) 或 `list_objects` (云端) 遍历目录。
*   **跨桶复制**: 实现了"下载-中转-上传"的流水线逻辑。
*   **移动操作**: 封装了 Copy + Delete 的事务性逻辑（尽力而为）。
*   **删除操作**: 支持前缀递归删除和批量删除（DeleteObjects）。

## 3. 开发指南

### 添加依赖
```toml
[dependencies]
oss-core = { path = "../oss-core" }
```

### 数据库迁移
在使用 `TaskRepository` 前，必须运行迁移以初始化表结构：

```rust
let repo = TaskRepository::new(pool);
repo.migrate().await?;
```

### 示例：实现自定义上传

```rust
use oss_core::transfer::TransferManager;

let tm = TransferManager::new(client, repo);
tm.upload(Path::new("large_file.iso"), "bucket", "key", false, 8).await?;
```