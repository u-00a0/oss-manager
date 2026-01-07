# OSS Core

**`oss-core`** 是 OSS Manager 生态系统的底层逻辑支柱，负责屏蔽 S3 协议的复杂性，并管理文件传输的生命周期。它采用异步 I/O 驱动，结合 `aws-sdk-s3` 进行协议通信，并利用 `sqlx` (SQLite) 记录传输状态。

## 🧩 核心模块设计

### 1. 配置管理 (`config`)
负责存储账户（Profile）与应用设置。支持 JSON 序列化，确保凭证的安全加载与管理。

*   **存储账户**: 涵盖 Access Key, Secret Key, Region, Endpoint 及 Provider 类型。
*   **全局设置**: 管理默认下载目录、语言偏好等跨组件共享的配置。

### 2. S3 基础操作 (`ops`)
在原生 SDK 之上提供了一层高级抽象，简化了常见的存储桶与对象操作，并为 UI 层提供数据支持。

*   **存储桶管理**: 列表查询、创建与删除。
*   **对象操作**: 
    *   **列表**: 分页查询（支持 Common Prefixes），自动合并文件与文件夹视图。
    *   **预览/读取**: 支持 `head_object` 获取元数据，以及 `read_object` 读取小文件内容（用于文本/代码预览，默认限制 5MB）。
    *   **管理**: 对象删除、复制、移动。
*   **厂商适配**: 自动处理不同云服务商（AWS, Aliyun, R2 等）在协议实现上的微小差异。

### 3. 传输引擎 (`transfer`)
本项目最具技术含量的组件，专门处理大规模文件传输。

*   **上传逻辑**: 
    *   支持递归目录上传。
    *   大文件自动分片并行上传。
    *   MD5 校验确保数据完整性。
*   **下载逻辑**: 
    *   实现 Ranged GET 并行下载。
    *   支持断点续传。
    *   **递归下载**: 支持通过 `is_dir` 标志递归下载整个文件夹结构。
*   **任务持久化**: 传输过程中的每一个分片状态均实时持久化至本地 SQLite 数据库，确保在网络中断或程序崩溃后可无缝恢复。

### 4. 数据库层 (`db`)
基于 `sqlx` 实现的数据访问层。

*   **Schema 架构**:
    *   `tasks`: 记录文件级传输任务（状态：等待中、运行中、已暂停、已完成、失败）。
    *   `parts`: 记录分片级传输进度，支持精细化的续传控制。
*   **稳健性**: 包含数据库连接错误日志与自动迁移机制。

## 💻 集成示例

```rust
use oss_core::{create_client, config::ConfigManager, ops::S3Ops};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 加载配置文件
    let config = ConfigManager::load_from_file(&path)?;
    let profile = config.get_profile("my-aliyun").ok_or("账户不存在")?;

    // 2. 初始化 S3 客户端
    let client = create_client(
        profile.provider,
        profile.access_key.clone(),
        profile.secret_key.clone(),
        profile.region.clone(),
        profile.endpoint.clone(),
    );

    // 3. 执行操作
    let ops = S3Ops::new(client);
    let objects = ops.list_objects("my-bucket", "backup/", false).await?;
    
    for obj in objects {
        println!("对象名称: {:?}", obj.key);
    }

    Ok(())
}
```

## 🧪 测试

本项目包含详尽的单元测试与集成测试：

```bash
cargo test -p oss-core
```
