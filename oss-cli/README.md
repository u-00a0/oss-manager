# OSS Manager CLI

**`oss-cli`** 是一款高性能的命令行工具，旨在为 S3 存储管理提供类 Unix 指令的操作体验。它具备极高的灵活性，完美支持断点续传、递归操作与多账户管理。

## 📦 安装指南

### Windows
从 [Releases](https://github.com/u-00a0/oss-manager/releases) 页面下载最新的 `.exe` 安装程序。

### Linux (Debian/Ubuntu)
下载 `.deb` 软件包并执行安装：

```bash
sudo dpkg -i oss-manager-cli_x.x.x_amd64.deb
```

### 从源码编译安装
```bash
cargo install --path oss-cli
```

## 🎮 指令参考

### 账户配置管理

*   **查看账户列表**: `oss-cli profile list`
*   **交互式添加账户**: `oss-cli profile add`
*   **移除账户**: `oss-cli profile remove <name>`

### 存储操作指令

通配语法：`oss-cli <command> <source> <destination> [options]`

*   **列出存储桶**: `oss-cli ls`
*   **列出对象**: `oss-cli ls s3://bucket-name/prefix/`
*   **复制 (上传/下载)**: 
    *   上传: `oss-cli cp ./local-file.zip s3://my-bucket/backups/`
    *   下载: `oss-cli cp s3://my-bucket/data.csv ./downloads/`
*   **移动/重命名**: `oss-cli mv <src> <dest>`
*   **删除对象**: `oss-cli rm s3://bucket/key`

### 全局选项

*   `--recursive` / `-r`: 递归处理文件夹及其子内容（适用于 `cp`, `mv`, `rm`）。
*   `--profile` / `-p`: 指定操作所使用的账户名称（覆盖默认值）。

## 🤖 自动化支持

CLI 遵循标准 POSIX 规范，输出结果清晰且易于通过 `grep` 或 `awk` 处理。

### 退出码 (Exit Codes)
*   `0`: 操作成功完成。
*   `非0`: 发生错误（如凭证无效、网络中断或路径不存在）。