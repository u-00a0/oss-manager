# OSS Manager Desktop

**OSS Manager Desktop** is a modern, cross-platform graphical user interface for managing object storage. Built with **Tauri 2** and **React 19**, it combines the performance of a native Rust backend with the flexibility of a modern web frontend.

## Key Features

### 1. File Browser
*   **Navigation**: Breadcrumb bar with editable path support (Click to edit, Enter to jump).
*   **Views**: Toggle between List and Grid views.
*   **Drag & Drop**: Supports uploading files and folders by dragging them into the window.
*   **Context Menu**:
    *   Right-click on files to Download, Copy Path, or Delete.
    *   Right-click on background to Refresh.

### 2. File Preview & Details
*   **Double-Click**: Open files in a new tab to view details.
*   **Preview**:
    *   **Images**: Native preview for PNG, JPG, SVG, etc.
    *   **Text/Code**: Syntax highlighting for code and text files (limited to <5MB).
*   **Metadata**: View ETag, Size, Last Modified, and Content-Type.

### 3. Transfer Management
*   **Status Bar**: Real-time display of file counts and sync status.
*   **Notifications**:
    *   Non-intrusive toast notifications for success/error events.
    *   Progress bars for ongoing Uploads and Downloads in the notification center.
    *   Toggleable notification center via the status bar bell icon.

### 4. Tab System
*   **Multi-Tab Interface**: Open multiple buckets or file details simultaneously.
*   **Split View & Drag**: Reorder tabs or drag them out to create new windows (Tauri multi-window support).

## Development Guide

### Prerequisites
*   Node.js (v20+)
*   Rust (Latest Stable)
*   Tauri CLI: `npm install -g @tauri-apps/cli`

### Setup

```bash
cd oss-desktop
npm install
```

### Run in Development Mode

Starts the Vite dev server and the Tauri backend with hot-reloading.

```bash
npm run tauri dev
```

### Build for Production

Builds the frontend and packages the application into an installer (MSI/EXE on Windows, Deb/AppImage on Linux).

```bash
npm run tauri build
```

## Tech Stack

*   **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React (Icons).
*   **State Management**: React Context API (NotificationContext, SearchContext, StatusBarContext).
*   **Backend**: Rust (Tauri), leveraging `oss-core`.
*   **Packaging**: Inno Setup (Windows), Tauri Bundler (Linux).