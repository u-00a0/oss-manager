import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { join } from "@tauri-apps/api/path";
import type { FileEntry, AppConfig } from "../types";
import ContextMenu from "../components/ContextMenu";
import type { MenuItem } from "../components/ContextMenu";
import { useNotification } from "../contexts/NotificationContext";
import { useStatusBar } from "../contexts/StatusBarContext";
import { useSearch } from "../contexts/SearchContext";
import { 
    Folder, 
    FileText, 
    Grid, 
    List, 
    RefreshCw, 
    ArrowUp, 
    ChevronRight, 
    Home, 
    UploadCloud,
    Download,
    Trash2,
    Copy,
    Upload,
    Save
} from "lucide-react";
import clsx from "clsx";

interface FileBrowserProps {
    profile: string;
    bucket: string;
    isActive: boolean;
    onOpenFile?: (key: string) => void;
}

interface DragDropPayload {
    paths: string[];
    position: { x: number; y: number };
}

export default function FileBrowser({ profile, bucket, isActive, onOpenFile }: FileBrowserProps) {
    const { addNotification, updateNotification, removeNotification } = useNotification();
    const { setLeftItem } = useStatusBar();
    const { searchQuery } = useSearch();
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [prefix, setPrefix] = useState("");
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    // Path Editing State
    const [isEditingPath, setIsEditingPath] = useState(false);
    const [pathInput, setPathInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: MenuItem[] } | null>(null);

    // Filter files
    const filteredFiles = files.filter(f => {
        if (!isActive || !searchQuery) return true;
        return f.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Update Status Bar
    useEffect(() => {
        if (isActive) {
            setLeftItem(
                <div className="flex items-center space-x-3 text-xs">
                    <span className="font-semibold">{bucket}</span>
                    <span className="w-[1px] h-3 bg-white/20"></span>
                    <span>{filteredFiles.length} items {isActive && searchQuery && `(of ${files.length})`}</span>
                    {loading && <span>(Syncing...)</span>}
                </div>
            );
        }
    }, [isActive, files.length, filteredFiles.length, loading, bucket, setLeftItem, searchQuery]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditingPath && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditingPath]);

    useEffect(() => {
        loadFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, bucket, prefix]);

    // Handle File Drop (Upload)
    useEffect(() => {
        let isCancelled = false;
        const unlisteners: (() => void)[] = [];

        const setupListeners = async () => {
            console.log("Setting up drag listeners for", bucket);
            
            const onDragEnter = await listen('tauri://drag-enter', (event) => {
                console.log('Drag enter', event);
                setIsDraggingOver(true);
            });
            if (isCancelled) { onDragEnter(); return; }
            unlisteners.push(onDragEnter);

            const onDragLeave = await listen('tauri://drag-leave', (event) => {
                console.log('Drag leave', event);
                setIsDraggingOver(false);
            });
            if (isCancelled) { onDragLeave(); return; }
            unlisteners.push(onDragLeave);

            const onDragDrop = await listen('tauri://drag-drop', async (event: { payload: DragDropPayload }) => {   
                console.log('Drag drop:', event);
                setIsDraggingOver(false);
                const paths = event.payload.paths;
                if (paths && paths.length > 0) {
                    await handleUpload(paths);
                }
            });
            if (isCancelled) { onDragDrop(); return; }
            unlisteners.push(onDragDrop);
        };

        setupListeners();

        return () => {
            isCancelled = true;
            console.log("Cleaning up drag listeners for", bucket);
            unlisteners.forEach(f => f());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, bucket, prefix]);

    async function loadFiles() {
        setLoading(true);
        setError("");
        try {
            const res = await invoke<FileEntry[]>("list_objects", {
                profileName: profile,
                bucket,
                prefix
            });
            setFiles(res);
        } catch (e) {
            console.error(e);
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }

    async function handleUpload(filePaths: string[]) {
        setLoading(true);
        const notifId = addNotification({
            title: `Uploading ${filePaths.length} items...`,
            type: 'progress',
            progress: 0
        });

        try {
            let completed = 0;
            for (const path of filePaths) {
                await invoke("upload_file", {
                    profileName: profile,
                    bucket,
                    localPath: path,
                    destPrefix: prefix
                });
                completed++;
                updateNotification(notifId, {
                    progress: Math.round((completed / filePaths.length) * 100)
                });
            }
            updateNotification(notifId, {
                title: "Upload Completed",
                type: 'success',
                progress: 100,
                duration: 3000
            });
            loadFiles();
        } catch (e) {
            console.error("Upload failed", e);
            updateNotification(notifId, {
                title: "Upload Failed",
                message: String(e),
                type: 'error',
                autoClose: false
            });
            setLoading(false);
        }
    }
    
    async function handleDelete(file: FileEntry) {
        if (!confirm(`Are you sure you want to delete ${file.name}?`)) return; 
        
        const notifId = addNotification({
            title: `Deleting ${file.name}...`,
            type: 'progress'
        });

        try {
            await invoke("delete_object", {
                profileName: profile,
                bucket,
                key: file.path
            });
            updateNotification(notifId, {
                title: `Deleted ${file.name}`,
                type: 'success',
                duration: 2000
            });
            loadFiles();
        } catch (e) {
            updateNotification(notifId, {
                title: "Delete Failed",
                message: String(e),
                type: 'error',
                autoClose: false
            });
        }
    }
    
    async function handleDownload(file: FileEntry) {
        const notifId = addNotification({
            title: `Downloading ${file.name}...`,
            type: 'progress'
        });

        try {
            const config = await invoke<AppConfig>("get_app_config");
            if (config.default_download_dir) {
                const localPath = await join(config.default_download_dir, file.name);
                await invoke("download_file", {
                    profileName: profile,
                    bucket,
                    key: file.path,
                    localPath,
                    isDir: file.is_dir
                });
                updateNotification(notifId, {
                    title: "Download Completed",
                    message: `Saved to ${localPath}`,
                    type: 'success',
                    progress: 100,
                    duration: 3000
                });
            } else {
                removeNotification(notifId);
                await handleSaveAs(file);
            }
        } catch (e) {
             updateNotification(notifId, {
                title: "Download Failed",
                message: String(e),
                type: 'error',
                autoClose: false
            });
        }
    }

    async function handleSaveAs(file: FileEntry) {
        try {
            const localPath = await save({
                defaultPath: file.name
            });
            
            if (localPath) {
                const notifId = addNotification({
                    title: `Downloading ${file.name}...`,
                    type: 'progress'
                });

                try {
                    await invoke("download_file", {
                        profileName: profile,
                        bucket,
                        key: file.path,
                        localPath,
                        isDir: file.is_dir
                    });
                    updateNotification(notifId, {
                        title: "Download Completed",
                        message: `Saved to ${localPath}`,
                        type: 'success',
                        progress: 100,
                        duration: 3000
                    });
                } catch(e) {
                     updateNotification(notifId, {
                        title: "Download Failed",
                        message: String(e),
                        type: 'error',
                        autoClose: false
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    function handleContextMenu(e: React.MouseEvent, file?: FileEntry) {
        e.preventDefault();
        e.stopPropagation();
        
        const x = e.clientX;
        const y = e.clientY;
        
        if (file) {
            setContextMenu({
                x, y,
                items: [
                    {
                        label: "Download", 
                        icon: <Download size={14} />,
                        action: () => handleDownload(file) 
                    },
                    {
                        label: "Save As...", 
                        icon: <Save size={14} />,
                        action: () => handleSaveAs(file) 
                    },
                    {
                        label: "Copy Path", 
                        icon: <Copy size={14} />,
                        action: () => {
                            navigator.clipboard.writeText(file.path);
                            addNotification({ title: "Path copied", type: 'success', duration: 2000 });
                        }
                    },
                    { separator: true, label: "" },
                    {
                        label: "Delete", 
                        icon: <Trash2 size={14} />,
                        danger: true,
                        action: () => handleDelete(file) 
                    }
                ]
            });
        } else {
             setContextMenu({
                x, y,
                items: [
                    {
                        label: "Refresh", 
                        icon: <RefreshCw size={14} />,
                        action: loadFiles 
                    },
                    {
                        label: "Upload Files", 
                        icon: <Upload size={14} />,
                        disabled: true, 
                        action: () => {} 
                    }
                ]
            });
        }
    }
    
    // Path Bar Handlers
    function startEditingPath() {
        setPathInput(prefix);
        setIsEditingPath(true);
    }

    function handlePathSubmit() {
        let newPath = pathInput.trim();
        // Normalize separators
        newPath = newPath.replace(/\\/g, "/");
        // Remove leading slash if user typed absolute path style
        if (newPath.startsWith("/")) newPath = newPath.substring(1);
        
        // Ensure directory convention (ends with /) unless empty
        // Assumption: User inputs directory path. If they want to go to root, input empty.
        if (newPath.length > 0 && !newPath.endsWith("/")) {
            newPath += "/";
        }
        
        setPrefix(newPath);
        setIsEditingPath(false);
    }
    
    function handlePathKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            handlePathSubmit();
        } else if (e.key === "Escape") {
            setIsEditingPath(false);
        }
    }

    function handleNavigate(entry: FileEntry) {
        if (entry.is_dir) {
            setPrefix(entry.path);
        } else {
            console.log("Clicked file:", entry.name);
        }
    }

    function handleUp() {
        if (!prefix) return;
        const parts = prefix.trimEnd().split("/");
        if (parts[parts.length - 1] === "") parts.pop();
        parts.pop();
        const newPrefix = parts.length > 0 ? parts.join("/") + "/" : "";
        setPrefix(newPrefix);
    }

    function handleBreadcrumb(index: number) {
        if (index === -1) {
            setPrefix("");
            return;
        }
        const parts = prefix.split("/").filter(p => p);
        const newPath = parts.slice(0, index + 1).join("/") + "/";
        setPrefix(newPath);
    }

    function formatSize(bytes: number) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    function formatDate(ts?: number) {
        if (!ts) return "-";
        return new Date(ts).toLocaleString();
    }

    const breadcrumbs = prefix.split("/").filter(p => p);

    return (
        <div 
            className="h-full flex flex-col text-[#cccccc] bg-[#1e1e1e] relative"
            onContextMenu={(e) => handleContextMenu(e)} // Background Context Menu
        >
            {/* Drag Over Overlay */}
            {isDraggingOver && (
                <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 z-50 flex items-center justify-center pointer-events-none">
                    <div className="bg-[#1e1e1e] p-4 rounded shadow-lg flex flex-col items-center">       
                        <UploadCloud size={48} className="text-blue-500 mb-2" />
                        <span className="text-white font-bold">Drop to Upload</span>
                    </div>
                </div>
            )}
            
            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu 
                    x={contextMenu.x} 
                    y={contextMenu.y} 
                    items={contextMenu.items} 
                    onClose={() => setContextMenu(null)} 
                />
            )}

            {/* Toolbar */}
            <div className="h-10 border-b border-[#2d2d2d] flex items-center px-4 gap-2 bg-[#252526]">
                {/* Up Button */}
                <button
                    className="p-1 hover:bg-[#3c3c3c] rounded disabled:opacity-50 text-[#cccccc] shrink-0"
                    onClick={handleUp}
                    disabled={!prefix}
                    title="Up"
                >
                    <ArrowUp size={16} />
                </button>

                {/* Path Bar */}
                <div 
                    className={clsx(
                        "flex-1 flex items-center h-7 bg-[#1e1e1e] border rounded px-2 overflow-hidden text-sm transition-colors",
                        isEditingPath ? "border-[#007fd4] ring-1 ring-[#007fd4]" : "border-[#3c3c3c] cursor-text hover:border-[#505050]"
                    )}
                    onClick={!isEditingPath ? startEditingPath : undefined}
                >
                    {isEditingPath ? (
                        <input
                            ref={inputRef}
                            className="w-full bg-transparent border-none outline-none text-[#cccccc] font-mono p-0 h-full"
                            value={pathInput}
                            onChange={(e) => setPathInput(e.target.value)}
                            onKeyDown={handlePathKeyDown}
                            onBlur={() => setIsEditingPath(false)}
                            spellCheck={false}
                        />
                    ) : (
                        <div className="flex items-center w-full h-full overflow-hidden">
                            <span
                                className="cursor-pointer hover:bg-[#3c3c3c] hover:text-white px-1 rounded flex items-center shrink-0"
                                onClick={(e) => { e.stopPropagation(); handleBreadcrumb(-1); }}
                                title={`Bucket: ${bucket}`}
                            >
                                <Home size={14} className="mr-1" />
                                {bucket}
                            </span>
                            
                            {breadcrumbs.length > 0 && (
                                <ChevronRight size={14} className="text-[#858585] mx-0.5 shrink-0" />
                            )}

                            {breadcrumbs.map((part, index) => (
                                <div key={index} className="flex items-center shrink-0">
                                    <span
                                        className="cursor-pointer hover:bg-[#3c3c3c] hover:text-white px-1 rounded"
                                        onClick={(e) => { e.stopPropagation(); handleBreadcrumb(index); }}
                                    >
                                        {part}
                                    </span>
                                    {index < breadcrumbs.length - 1 && (
                                        <ChevronRight size={14} className="text-[#858585] mx-0.5" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1 shrink-0">
                    <button
                        className={clsx("p-1.5 rounded hover:bg-[#3c3c3c]", viewMode === "list" && "bg-[#3c3c3c] text-white")}
                        onClick={() => setViewMode("list")}
                        title="List View"
                    >
                        <List size={16} />
                    </button>
                    <button
                        className={clsx("p-1.5 rounded hover:bg-[#3c3c3c]", viewMode === "grid" && "bg-[#3c3c3c] text-white")}
                        onClick={() => setViewMode("grid")}
                        title="Grid View"
                    >
                        <Grid size={16} />
                    </button>
                    <button
                        className="p-1.5 rounded hover:bg-[#3c3c3c]"
                        onClick={loadFiles}
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-2">
                {error && <div className="text-red-500 p-4">Error: {error}</div>}

                {filteredFiles.length === 0 && !loading && !error && (
                    <div className="text-[#858585] text-center mt-10">
                        {searchQuery ? "No matching files found." : "No files found."}
                    </div>
                )}

                {viewMode === "list" ? (
                    <div className="min-w-full inline-block align-middle">
                        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-1 text-sm p-2"> 
                            {/* Header */}
                            <div className="font-bold text-[#858585] border-b border-[#3e3e42] pb-1 col-span-2">Name</div>
                            <div className="font-bold text-[#858585] border-b border-[#3e3e42] pb-1 text-right">Size</div>
                            <div className="font-bold text-[#858585] border-b border-[#3e3e42] pb-1 text-right pl-4">Date Modified</div>

                            {/* Rows */}
                            {filteredFiles.map(file => (
                                <div
                                    key={file.path}
                                    className="contents group cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); handleNavigate(file); }}
                                    onDoubleClick={(e) => {
                                        if (!file.is_dir && onOpenFile) {
                                            e.stopPropagation();
                                            onOpenFile(file.path);
                                        }
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, file)}
                                    draggable // Placeholder for future drag out
                                >
                                    <div className="py-1 flex items-center group-hover:bg-[#2a2d2e] pl-2 rounded-l-sm">
                                        {file.is_dir ?
                                            <Folder size={16} className="text-yellow-500 mr-2 shrink-0" /> :
                                            <FileText size={16} className="text-blue-400 mr-2 shrink-0" />
                                        }
                                    </div>
                                    <div className="py-1 flex items-center group-hover:bg-[#2a2d2e] truncate select-none">
                                        {file.name}
                                    </div>
                                    <div className="py-1 text-right group-hover:bg-[#2a2d2e] text-[#858585] select-none">
                                        {file.is_dir ? "-" : formatSize(file.size)}
                                    </div>
                                    <div className="py-1 text-right group-hover:bg-[#2a2d2e] rounded-r-sm text-[#858585] pl-4 select-none">
                                        {formatDate(file.last_modified)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-4 p-2">      
                        {filteredFiles.map(file => (
                            <div
                                key={file.path}
                                className="flex flex-col items-center p-2 hover:bg-[#2a2d2e] rounded cursor-pointer group"
                                onClick={(e) => { e.stopPropagation(); handleNavigate(file); }}
                                onDoubleClick={(e) => {
                                    if (!file.is_dir && onOpenFile) {
                                        e.stopPropagation();
                                        onOpenFile(file.path);
                                    }
                                }}
                                onContextMenu={(e) => handleContextMenu(e, file)}
                                draggable // Placeholder for future drag out
                                title={file.name}
                            >
                                <div className="mb-2">
                                    {file.is_dir ?
                                        <Folder size={48} className="text-yellow-500" /> :
                                        <FileText size={48} className="text-blue-400" />
                                    }
                                </div>
                                <span className="text-xs text-center break-all line-clamp-2 group-hover:text-white text-[#cccccc] select-none">
                                    {file.name}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}