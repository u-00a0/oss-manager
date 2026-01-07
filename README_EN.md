# OSS Manager

[![Release All](https://github.com/u-00a0/oss-manager/actions/workflows/release-all.yml/badge.svg)](https://github.com/u-00a0/oss-manager/actions/workflows/release-all.yml)
[![Build and Release CLI](https://github.com/u-00a0/oss-manager/actions/workflows/release.yml/badge.svg)](https://github.com/u-00a0/oss-manager/actions/workflows/release.yml)

OSS Manager is a high-performance, cross-platform file transfer solution for S3-compatible object storage, written in Rust. It aims to provide reliable and efficient file management capabilities, featuring resumable transfers, precise concurrency control, recursive directory operations, and support for multiple cloud providers.

## 📥 Download

Please visit the [Releases](https://github.com/u-00a0/oss-manager/releases/latest) page to download:
- **Windows**: `.exe` installer
- **Linux**: `.deb` package (Debian/Ubuntu)

## 🏗️ Project Architecture

The project is organized as a Rust Workspace, consisting of the following core components:

*   **[`oss-core`](./oss-core/README_EN.md)**: The core logic library.
    *   Encapsulates low-level logic for S3 protocol interaction, transfer state management, local database persistence, and configuration handling.
    *   Supports resumable transfers, multipart upload/download, and recursive directory operations.
    *   Uses SQLite (`sqlx`) to persist task state.
*   **[`oss-cli`](./oss-cli/README_EN.md)**: Command-line interface.
    *   Built on `oss-core`, providing Unix-like file operation commands (`cp`, `mv`, `rm`, `ls`).
    *   Suitable for automation scripts and server environments.
*   **[`oss-desktop`](./oss-desktop/README_EN.md)**: Modern desktop client.
    *   Built with **Tauri 2** (Rust) and **React 19**.
    *   Provides a VS Code-like modern experience, supporting multi-tab drag-and-drop tear-out, multi-window merging, real-time file preview, global search, and other advanced features.

## ✨ Key Features

*   **Broad Compatibility**: Perfectly supports AWS S3, Aliyun OSS, Tencent Cloud COS, Cloudflare R2, and any storage service following the S3 protocol.
*   **High-Performance Transfer Engine**: Built-in concurrency control and multipart upload/download logic, supporting resumable transfers and task verification.
*   **Modern Desktop Experience**:
    *   **Multi-Window/Multi-Tab**: Supports dragging tabs out to create new windows and merging them across windows.
    *   **File Preview**: Supports real-time preview of images, code, and text files.
    *   **Global Search**: Quickly locate files within the current bucket.
    *   **Task Management**: Visual transfer progress monitoring and notification system.
*   **Unified Configuration**: The CLI and Desktop share the same storage configuration files and transfer task history.

## 🛠️ Build Prerequisites

Before building from source, ensure the following dependencies are installed:

*   **Rust**: Stable compiler (v1.75+ recommended).
*   **Node.js**: LTS version (v20+ recommended), for building the desktop frontend.
*   **System Dependencies**:
    *   **Windows**: Requires CMake and Inno Setup (for building the installer).
    *   **Linux**: Requires `build-essential` and graphics library dev packages: `libgtk-3-dev`, `libwebkit2gtk-4.0-dev`, `libappindicator3-dev`, `librsvg2-dev`, etc.

## 🚀 Build Guide

### 1. Build All Binaries (CLI)

Run the following command in the root directory to compile Rust components:

```bash
cargo build --release
```

### 2. Build Desktop Application

The desktop app requires separate frontend installation and Tauri build:

```bash
cd oss-desktop
npm install
npm run tauri build
```

## 📄 License

This project is licensed under the Apache-2.0 license. See the [LICENSE](./LICENSE) file for details.
