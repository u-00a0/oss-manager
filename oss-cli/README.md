# OSS CLI 用户手册

`oss-cli` 是 OSS Manager 项目提供的终端交互工具，旨在为用户提供高效、直观的对象存储管理体验。

## 1. 安装与配置

### 1.1 安装
请在项目根目录下运行：
```bash
cargo install --path .
```

### 1.2 初始化
首次使用请初始化配置环境：
```bash
oss-cli init
```
该命令会生成：
*   **配置文件**: `~/.oss-manager/config.json`
*   **数据库文件**: `~/.oss-manager/oss.db` (用于存储传输任务状态)

### 1.3 配置管理

CLI 提供了便捷的命令来管理多环境配置（Profile）。

#### 添加配置 (`add`)
支持交互式向导或命令行参数两种方式。

*   **交互式模式**:
    ```bash
    oss-cli add
    ```
    程序将引导您输入 Profile 名称、提供商类型、AK/SK 等信息。

*   **参数模式**:
    ```bash
    oss-cli add --name production \
      --provider Aliyun \
      --access-key LTAI... \
      --secret-key xyz... \
      --region oss-cn-hangzhou
    ```

#### 删除配置 (`delete`)
```bash
oss-cli delete --name production
```

**支持的 Provider 类型**:
*   `Aws`: 标准 AWS S3
*   `CloudflareR2`: 自动适配 R2 Endpoint 格式
*   `Aliyun`: 阿里云 OSS (强制 Path Style)
*   `Tencent`: 腾讯云 COS (强制 Path Style)
*   `Custom`: 自定义服务 (如 MinIO)

## 2. 命令详解

所有命令均需通过 `-p` 或 `--profile` 参数指定使用的配置 Profile。

### 2.1 文件浏览 (`ls` / `tree`)

*   **`ls`**: 列出指定路径下的对象和子目录（Common Prefixes）。
    ```bash
    # 列出 bucket 根目录
    oss-cli ls oss://my-bucket/ -p default
    
    # 列出 logs 目录下的内容
    oss-cli ls oss://my-bucket/logs/ -p default
    ```

*   **`tree`**: 递归列出指定路径下的所有对象 Key，展示目录树结构。
    ```bash
    oss-cli tree oss://my-bucket/src/ -p default
    ```

### 2.2 拷贝与传输 (`cp`)

`cp` 是核心传输命令，程序会根据源地址和目标地址自动识别操作模式。

**基本语法**:
```bash
oss-cli cp <SOURCE> <DESTINATION> -p <PROFILE> [OPTIONS]
```

**参数**:
*   `-r, --recursive`: 递归操作（用于目录）。
*   `-j, --threads <NUM>`: 并发线程数（默认 4）。

#### 使用场景：

1.  **上传 (Local -> Cloud)**
    ```bash
    # 单文件
    oss-cli cp ./data.csv oss://bucket/data/ -p default
    # 递归目录
    oss-cli cp ./images/ oss://bucket/assets/images/ -p default -r -j 8
    ```

2.  **下载 (Cloud -> Local)**
    ```bash
    # 单文件
    oss-cli cp oss://bucket/report.pdf ./report.pdf -p default
    # 递归目录
    oss-cli cp oss://bucket/backup/ ./local_backup/ -p default -r
    ```

3.  **同桶复制 (Cloud -> Cloud)**
    *   **机制**: 服务端复制，无需本地带宽。
    ```bash
    oss-cli cp oss://bucket/v1/ oss://bucket/v2/ -p default -r
    ```

4.  **跨桶复制 (Cloud -> Cloud)**
    *   **机制**: 自动中转（下载到临时目录 -> 上传到目标 Bucket）。
    ```bash
    oss-cli cp oss://src-bucket/data/ oss://dest-bucket/archive/ -p default -r
    ```

### 2.3 移动与重命名 (`mv`)

在云端执行移动或重命名操作。

*   **机制**: 执行 Copy 操作后删除源文件。
*   **限制**: 仅支持同一 Bucket 内的操作。

```bash
# 重命名
oss-cli mv oss://bucket/old_name.txt oss://bucket/new_name.txt -p default

# 移动目录
oss-cli mv oss://bucket/temp/ oss://bucket/processed/ -p default
```

### 2.4 删除 (`rm`)

删除云端文件或目录。

*   **机制**: 调用 S3 DeleteObject 或 DeleteObjects (批量)。

```bash
# 删除单个文件
oss-cli rm oss://bucket/file.txt -p default

# 递归删除目录（需确认）
oss-cli rm oss://bucket/logs/ -p default -r
```

## 3. 故障恢复

`oss-cli` 内置了健壮的断点续传机制。如果传输过程被意外中断（如网络故障或手动终止）：
1.  **无需清理**: 传输状态已保存在本地数据库中。
2.  **直接重试**: 再次执行相同的命令，程序会自动跳过已验证完成的分片（Part）或文件，仅传输剩余部分。

```