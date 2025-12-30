# OSS Manager Context

## Project Overview

**OSS Manager** is a high-performance, cross-platform file transfer solution for S3-compatible object storage, written in Rust. It features resumable transfers, precise concurrency control, and support for multiple cloud providers.

The project is organized as a Rust Workspace with the following members:

*   **`oss-core`**: The core library containing the business logic.
    *   **S3 Client Factory**: optimized for AWS, Cloudflare R2, Aliyun, Tencent, etc.
    *   **State Management**: Uses SQLite (`sqlx`) to persist task progress for resumable transfers.
    *   **Transfer Logic**: Implements recursive upload/download, server-side copy/move, and cross-bucket transfer.
*   **`oss-cli`**: A command-line interface built on top of `oss-core`.
    *   Provides commands like `cp`, `mv`, `rm`, `ls`, `tree`.
    *   Manages configuration profiles interactively.
    *   **Packaging**:
        *   Contains `package.metadata.deb` for building Debian packages (`.deb`).
        *   Contains `setup.iss` for building Windows installers using Inno Setup.
*   **`oss-desktop`**: GUI application (Planned).
    *   Built with Tauri, pnpm, and React 19.
    *   Aims for a VSCode-like file management experience covering all core functionalities.

## Build and Run Instructions

### Prerequisites
*   Rust toolchain (1.70+)
*   CMake (required for building some C dependencies like `aws-lc-sys`)

### Core Commands

*   **Build Workspace**:
    ```bash
    cargo build
    ```
*   **Run CLI (Dev)**:
    ```bash
    cargo run -p oss-cli -- <ARGS>
    # Example: cargo run -p oss-cli -- --help
    ```
*   **Install CLI**:
    ```bash
    cargo install --path oss-cli
    ```
*   **Run Tests**:
    ```bash
    cargo test
    ```

## Codebase Architecture

### `oss-core` (Library)

*   **`src/lib.rs`**: Entry point, exports modules and the `create_client` factory.
*   **`src/config.rs`**: Manages user profiles (JSON serialization).
*   **`src/db.rs`**: SQLite database interaction using `sqlx`. Defines `Task` and `Part` schemas.
*   **`migrations/`**: Contains SQL migration scripts managed by `sqlx`.
    *   Creates `tasks` table: tracks file path, remote key, bucket, size, and status.
    *   Creates `parts` table: tracks multipart upload progress (start/end bytes, etag).
*   **`src/ops.rs`**: Low-level S3 operations wrapper (List, Copy, Delete).
*   **`src/transfer.rs`**: High-level orchestration. Contains `TransferManager` which handles recursion and logic for `upload`, `download`, `copy_cloud`, `move_cloud`, `remove`.
*   **`src/uploader.rs`**: Implements `ResumableUploader` (Multipart Upload with state sync).
*   **`src/downloader.rs`**: Implements `Downloader` (Concurrent ranged GET requests).

### `oss-cli` (Application)

*   **`src/main.rs`**: The single source file for the CLI.
    *   Uses `clap` for argument parsing.
    *   Uses `inquire` for interactive prompts (e.g., `oss-cli add`).
    *   Uses `tracing` for logging output.
    *   Dispatches commands to `TransferManager` or `ConfigManager`.

### `oss-desktop` (Planned GUI)

**Technology Stack**
*   **Frontend**: React 19, TypeScript, pnpm.
*   **Backend**: Rust (Tauri), utilizing `oss-core`.
*   **Design System**: VSCode-like layout and interaction model.

**UI/UX Requirements**
*   **Layout**:
    *   **Top Menu**: Standard application menu.
    *   **Side Bar (Activity Bar)**: Leftmost vertical strip for switching views (Files, Buckets, Profiles, Settings).
    *   **Primary Side Panel**: Expandable panel next to Activity Bar (e.g., file tree, bucket list).
    *   **Main Content Area**: Tabbed interface for file browsing and operations.
    *   **Bottom Panel**: Terminal (invoking `oss-cli`) and Log/Task Output.
*   **Tab System**:
    *   Comprehensive multi-tab support (Drag & Drop sorting).
    *   Split-view support (Drag to split).
    *   Multi-window support (Drag tab out to create new window, drag in to merge).

**Functional Requirements**
*   **Full `oss-core` Coverage**:
    *   Profile Management (Add/Edit/Remove/Switch).
    *   File/Bucket Browser (Recursive listing, Tree view).
    *   Transfer Operations (Upload, Download, Copy, Move, Remove) with resumable support.
    *   Task Management (View active/completed tasks, Pause/Resume/Cancel).

## Development Conventions

*   **Async/Await**: The project is fully asynchronous, powered by `tokio`.
*   **Error Handling**: Uses `anyhow` for result propagation.
*   **Database**: Migrations are handled by `sqlx`. Ensure `sqlx-cli` is installed if modifying schemas manually, though the code runs migrations on startup.
*   **Logging**: `tracing` is used for logging. In the CLI, logs from `oss-core` are filtered to `info` level by default.

## Key Configuration Files

*   **`~/.oss-manager/config.json`**: Stores user profiles (Access Keys, Regions).
*   **`~/.oss-manager/oss.db`**: SQLite database file tracking active and completed transfer tasks.
