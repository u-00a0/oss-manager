# OSS Manager
[![GitHub Release](https://img.shields.io/github/v/release/u-00a0/oss-manager)](https://github.com/u-00a0/oss-manager/releases/latest)
[![GitHub License](https://img.shields.io/github/license/u-00a0/oss-manager)](https://www.apache.org/licenses/LICENSE-2.0)
<br>
[![Release All](https://github.com/u-00a0/oss-manager/actions/workflows/release-all.yml/badge.svg)](https://github.com/u-00a0/oss-manager/actions/workflows/release-all.yml)
[![Build and Release CLI](https://github.com/u-00a0/oss-manager/actions/workflows/release.yml/badge.svg)](https://github.com/u-00a0/oss-manager/actions/workflows/release.yml) 
<br>

View **English Version** [Here](README_EN.md)

OSS Manager 是一套基于 Rust 语言开发的高性能对象存储（S3 兼容）文件传输解决方案。本项目旨在提供可靠、高效且跨平台的文件管理能力，支持断点续传、并发传输控制、递归目录操作以及多云厂商适配。

## 📥 下载

请前往 [Release](https://github.com/u-00a0/oss-manager/releases/latest) 页面下载：
- **Windows**: `.exe` 安装程序
- **Linux**: `.deb` 软件包 (Debian/Ubuntu)

## 🏗️ 项目架构

本项目采用 Rust Workspace 模式组织，由以下核心组件构成：

*   **[`oss-core`](./oss-core/README.md)**：核心逻辑库。
    *   封装了 S3 协议交互、传输状态管理、本地数据库持久化及配置处理等底层逻辑。
    *   支持断点续传、分片上传/下载、递归目录操作。
    *   使用 SQLite (`sqlx`) 持久化任务状态。
*   **[`oss-cli`](./oss-cli/README.md)**：命令行交互终端。
    *   基于 `oss-core` 构建，提供类 Unix 的文件操作指令 (`cp`, `mv`, `rm`, `ls`)。
    *   适用于自动化脚本及服务器环境。
*   **[`oss-desktop`](./oss-desktop/README.md)**：现代化桌面客户端。
    *   基于 **Tauri 2** (Rust) 与 **React 19** 构建。
    *   提供类 VS Code 的现代化操作体验，支持多标签页拖拽拆分、多窗口合并、实时文件预览、全局搜索等高级功能。

## ✨ 关键特性

*   **广泛的兼容性**：完美支持 AWS S3、阿里云 OSS、腾讯云 COS、Cloudflare R2 以及任何遵循 S3 协议的存储服务。
*   **高性能传输引擎**：内置并发控制与分片上传/下载逻辑，支持断点续传与任务校验。
*   **现代化桌面体验**：
    *   **多窗口/多标签**：支持标签页拖拽拆分出新窗口，以及跨窗口合并。
    *   **文件预览**：支持图片、代码、文本文件的实时预览。
    *   **全局搜索**：快速定位当前 Bucket 内的文件。
    *   **任务管理**：可视化的传输进度监控与通知系统。
*   **统一配置管理**：CLI 与桌面端共享相同的存储配置文件与传输任务历史。

## 🛠️ 构建先决条件

在从源码构建本项目之前，请确保环境中已安装以下依赖：

*   **Rust**: 稳定版编译器（建议 v1.75+）。
*   **Node.js**: 长期支持版（建议 v20+），用于构建桌面端前端。
*   **系统级依赖**:
    *   **Windows**: 需要安装 CMake 和 Inno Setup（用于打包安装程序）。
    *   **Linux**: 需要安装 `build-essential` 以及图形库开发包：`libgtk-3-dev`, `libwebkit2gtk-4.0-dev`, `libappindicator3-dev`, `librsvg2-dev` 等。

## 🚀 构建指南

### 1. 构建全项目二进制文件 (CLI)

在根目录下执行以下命令编译 Rust 相关组件：

```bash
cargo build --release
```

### 2. 构建桌面应用程序

桌面端需要独立进行前端安装与 Tauri 打包：

```bash
cd oss-desktop
npm install
npm run tauri build
```

## 📄 许可证

本项目采用 Apache-2.0 license 许可证。详情请参阅 [LICENSE](./LICENSE) 文件。