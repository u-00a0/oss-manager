# OSS Manager
[![Release All](https://github.com/u-00a0/oss-manager/actions/workflows/release-all.yml/badge.svg)](https://github.com/u-00a0/oss-manager/actions/workflows/release-all.yml)
[![Build and Release CLI](https://github.com/u-00a0/oss-manager/actions/workflows/release.yml/badge.svg)](https://github.com/u-00a0/oss-manager/actions/workflows/release.yml) <br>
**OSS Manager** 是一款面向 S3 兼容对象存储服务的高性能、跨平台管理解决方案。本项目旨在提供一个统一的生态系统，包含健壮的核心逻辑库、灵活的命令行工具（CLI）以及现代化的桌面图形客户端（GUI）。

## 项目架构

本项目采用 Rust Workspace 模式组织，由以下核心组件构成：

*   **`oss-core`**：核心逻辑库。封装了 S3 协议交互、传输状态管理、本地数据库持久化及配置处理等底层逻辑。
*   **`oss-cli`**：命令行交互终端。基于 `oss-core` 构建，提供高效的文件操作指令，适用于自动化脚本及高级用户。
*   **`oss-desktop`**：桌面客户端。基于 **Tauri 2** 与 **React 19** 构建，提供类 VS Code 的现代化操作体验，支持可视化管理、实时预览及多任务并行。

## 关键特性

*   **广泛的兼容性**：完美支持 AWS S3、阿里云 OSS、腾讯云 COS、Cloudflare R2 以及任何遵循 S3 协议的存储服务。
*   **高性能传输引擎**：内置并发控制与分片上传/下载逻辑，支持断点续传与任务校验。
*   **跨平台支持**：支持 Windows、Linux 及 macOS 原生编译。
*   **统一配置管理**：CLI 与桌面端共享相同的存储配置文件与传输任务历史。

## 构建先决条件

在从源码构建本项目之前，请确保环境中已安装以下依赖：

*   **Rust**: 稳定版编译器（建议 v1.75+）。
*   **Node.js**: 长期支持版（建议 v20+），用于构建桌面端前端。
*   **系统级依赖**:
    *   **Windows**: 需要安装 CMake 和 Inno Setup（用于打包安装程序）。
    *   **Linux**: 需要安装 `build-essential` 以及图形库开发包：`libgtk-3-dev`, `libwebkit2gtk-4.0-dev`, `libappindicator3-dev`, `librsvg2-dev` 等。

## 构建指南

### 1. 构建全项目二进制文件

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

## 许可证

本项目采用 MIT 许可证。详情请参阅 `LICENSE` 文件。
