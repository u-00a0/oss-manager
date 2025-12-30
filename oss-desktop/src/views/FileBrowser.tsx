import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import type { FileEntry } from "../types";
import ContextMenu, { MenuItem } from "../components/ContextMenu";
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
    Upload
} from "lucide-react";
import clsx from "clsx";

interface FileBrowserProps {
    profile: string;
    bucket: string;
}

interface DragDropPayload {
    paths: string[];
    position: { x: number; y: number };
}

export default function FileBrowser({ profile, bucket }: FileBrowserProps) {
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [prefix, setPrefix] = useState("");
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: MenuItem[] } | null>(null);

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
        setLoading(true); // Indicate activity
        try {
            // Sequential upload for simplicity, or Promise.all
            for (const path of filePaths) {
                await invoke("upload_file", {
                    profileName: profile,
                    bucket,
                    localPath: path,
                    destPrefix: prefix
                });
            }
            // Refresh
            loadFiles();
        } catch (e) {
            console.error("Upload failed", e);
            alert("Upload failed: " + e);
            setLoading(false);
        }
    }
    
    async function handleDelete(file: FileEntry) {
        if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;
        
        try {
            await invoke("delete_object", {
                profileName: profile,
                bucket,
                key: file.path
            });
            loadFiles();
        } catch (e) {
            alert("Delete failed: " + e);
        }
    }
    
    async function handleDownload(file: FileEntry) {
        try {
            const localPath = await save({
                defaultPath: file.name
            });
            
            if (localPath) {
                await invoke("download_file", {
                    profileName: profile,
                    bucket,
                    key: file.path,
                    localPath
                });
                alert("Download started");
            }
        } catch (e) {
            alert("Download failed: " + e);
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
                        label: "Copy Path", 
                        icon: <Copy size={14} />,
                        action: () => navigator.clipboard.writeText(file.path) 
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
                        disabled: true, // Not implemented yet via dialog
                        action: () => {} 
                    }
                ]
            });
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
            <div className="h-10 border-b border-[#2d2d2d] flex items-center px-4 justify-between bg-[#252526]">
                {/* Navigation */}
                <div className="flex items-center space-x-2 text-sm overflow-hidden">
                    <button
                        className="p-1 hover:bg-[#3c3c3c] rounded disabled:opacity-50"
                        onClick={handleUp}
                        disabled={!prefix}
                        title="Up"
                    >
                        <ArrowUp size={16} />
                    </button>

                    <div className="flex items-center">
                        <span
                            className="cursor-pointer hover:text-white flex items-center"
                            onClick={() => handleBreadcrumb(-1)}
                        >
                            <Home size={14} className="mr-1" />
                            {bucket}
                        </span>
                        {breadcrumbs.map((part, index) => (
                            <div key={index} className="flex items-center">
                                <ChevronRight size={14} className="text-[#858585] mx-1" />
                                <span
                                    className="cursor-pointer hover:text-white"
                                    onClick={() => handleBreadcrumb(index)}
                                >
                                    {part}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
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
            <div className="flex-1 overflow-auto p-2" onContextMenu={(e) => {
                 // Prevent background context menu from triggering when clicking on list/grid items container
                 // But wait, we want the background context menu here!
                 // The items themselves stop propagation.
                 // So this is fine.
            }}>
                {error && <div className="text-red-500 p-4">Error: {error}</div>}

                {files.length === 0 && !loading && !error && (
                    <div className="text-[#858585] text-center mt-10">No files found.</div>
                )}

                {viewMode === "list" ? (
                    <div className="min-w-full inline-block align-middle">
                        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-1 text-sm p-2"> 
                            {/* Header */}
                            <div className="font-bold text-[#858585] border-b border-[#3e3e42] pb-1 col-span-2">Name</div>
                            <div className="font-bold text-[#858585] border-b border-[#3e3e42] pb-1 text-right">Size</div>
                            <div className="font-bold text-[#858585] border-b border-[#3e3e42] pb-1 text-right pl-4">Date Modified</div>

                            {/* Rows */}
                            {files.map(file => (
                                <div
                                    key={file.path}
                                    className="contents group cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); handleNavigate(file); }}
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
                        {files.map(file => (
                            <div
                                key={file.path}
                                className="flex flex-col items-center p-2 hover:bg-[#2a2d2e] rounded cursor-pointer group"
                                onClick={(e) => { e.stopPropagation(); handleNavigate(file); }}
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

            {/* Status Footer */}
            <div className="h-6 bg-[#007fd4] text-white text-xs flex items-center px-3 justify-between">  
                <span>{files.length} items</span>
                <span>{loading ? "Syncing..." : "Synced"}</span>
            </div>
        </div>
    );
}
