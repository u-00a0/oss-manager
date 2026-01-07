# OSS Manager Desktop

**OSS Manager Desktop** is a modern, cross-platform graphical client for object storage management. Built on the **Tauri 2** architecture, it combines the performance benefits of native Rust with the agile web frontend interaction of **React 19**, providing a professional-grade file management experience similar to VS Code.

## 🌟 Core Features

### 1. Modern Interface & Interaction
*   **VS Code Style Layout**: Familiar Activity Bar, Sidebar, and Status Bar layout for zero learning curve.
*   **Advanced Tab System**:
    *   **Drag & Drop Sorting**: Freely adjust the order of tabs.
    *   **Window Tear-out**: Drag a tab out of the main window to create a new independent window.
    *   **Window Merging**: Support merging tabs between different windows via drag and drop.
    *   **Split View**: Support splitting the editor into multiple panes within the same window.
*   **Global Search**: Title bar integrated search box (Ctrl+F) to quickly filter files and folders in the current bucket.

### 2. Deeply Integrated File Browser
*   **Efficient Navigation**: Breadcrumb bar supports click-to-jump and can switch to input mode for manual path entry.
*   **Multi-dimensional Views**: Provides "List" and "Grid" layout modes.
*   **Drag & Drop Operations**:
    *   **Upload**: Drag files from the system file explorer to the app to trigger upload.
    *   **Download**: Support right-click download or "Save As".
*   **File Management**:
    *   **Rename**: Support renaming files via right-click menu or `F2` shortcut.
    *   **Batch Delete**: Support batch deletion by selecting multiple files and pressing `Delete`, with safety confirmation.
    *   **Copy/Move**: Support file copy and move across Buckets or even across accounts.

### 3. File Preview & Details
*   **Preview Pane**: Sidebar preview panel similar to Windows Explorer, displaying file thumbnails, metadata (ETag, size, modification time), and path.
*   **Instant Preview**:
    *   **Images**: Direct preview support for mainstream formats (PNG, JPG, SVG, WebP).
    *   **Text/Code**: Built-in editor component supporting text file content viewing and syntax highlighting for files up to 5MB.
*   **Metadata Viewing**: Double-click a file to view full metadata via the sidebar or a new tab.

### 4. Smart Notifications & Transfer Management
*   **Global Status Bar**: Real-time display of current directory object count, selection status, and background task summary.
*   **Notification Center**: VS Code-like notification popups supporting progress bar display and collapsible history panel.
*   **Transfer Dashboard**:
    *   **Sidebar View**: Quickly view ongoing and completed tasks in the left activity bar.
    *   **Detailed View**: Independent dashboard tab providing real-time speed charts and detailed task lists.
    *   **Resumable Transfer**: Automatically records transfer progress, allowing tasks to resume after app restart.

### 5. Advanced Configuration Management
*   **Sidebar Management**: Independent configuration profile management sidebar.
*   **Import/Export**: Support exporting configurations to JSON files for backup or migration, and support direct import of configurations.
*   **Quick Actions**: Mouse hover over profile items to quickly perform export or delete operations.
*   **Multi-language Support**: Built-in English/Chinese switching with auto-saving configuration.

## 🛠️ Developer Guide

### Environment Requirements
*   Node.js (v20+)
*   Rust (Latest Stable)
*   Tauri CLI: `npm install -g @tauri-apps/cli`

### Initialization

```bash
cd oss-desktop
npm install
```

### Development Mode

Start the Vite development server and synchronize the Tauri debug window:

```bash
npm run tauri dev
```

### Build & Release

Generate production installers (Windows generates .exe, Linux generates .deb/.AppImage):

```bash
npm run tauri build
```

## 🧩 Tech Stack

*   **Frontend Framework**: React 19, TypeScript
*   **State Management**: React Context + Hooks
*   **Styling**: Tailwind CSS v4
*   **Icon System**: Lucide React
*   **UI Components**: Radix UI (Partial), dnd-kit (Drag interactions), Recharts (Charts)
*   **Cross-Platform Engine**: Tauri 2 (Rust)
