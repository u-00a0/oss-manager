# OSS Manager

**OSS Manager** is a high-performance, cross-platform object storage management solution designed for S3-compatible services. It provides a comprehensive ecosystem consisting of a robust core library, a flexible command-line interface, and a modern desktop graphical user interface.

## Project Architecture

The project is organized as a Rust Workspace containing the following components:

*   **`oss-core`**: The foundational library implementing the core business logic, including S3 client abstraction, transfer management, database persistence, and configuration handling.
*   **`oss-cli`**: A feature-rich terminal application built upon `oss-core`, providing scripting capabilities and efficient file operations.
*   **`oss-desktop`**: A modern GUI application built with **Tauri 2** and **React 19**, offering a VS Code-like experience for file management, visualization, and resumable transfers.

## Key Features

*   **Broad Compatibility**: Supports AWS S3, Aliyun OSS, Tencent COS, Cloudflare R2, and generic S3 providers.
*   **High Performance**: Implements concurrent transfer logic with multipart upload/download support and checkpoint-based resumability.
*   **Cross-Platform**: Builds for Windows, Linux, and macOS.
*   **Unified Configuration**: Profiles and task history are shared between the CLI and Desktop applications.

## Prerequisites

To build the project from source, ensure the following dependencies are installed:

*   **Rust**: Stable toolchain (1.75+ recommended).
*   **Node.js**: LTS version (v20+ recommended) for the desktop frontend.
*   **System Dependencies**:
    *   **Windows**: CMake, Inno Setup (for packaging).
    *   **Linux**: `build-essential`, `libgtk-3-dev`, `libwebkit2gtk-4.0-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`.

## Build Instructions

### 1. Build the Workspace

Compile the Rust binaries for `oss-core` and `oss-cli`:

```bash
cargo build --release
```

### 2. Build the Desktop Application

The desktop application requires building both the React frontend and the Tauri backend:

```bash
cd oss-desktop
npm install
npm run tauri build
```

## Contributing

Contributions are welcome. Please ensure that any code changes are accompanied by relevant unit tests and that all existing tests pass.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.