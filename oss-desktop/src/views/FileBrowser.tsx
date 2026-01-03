import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { join } from "@tauri-apps/api/path";
import type { FileEntry, AppConfig } from "../types";
import ContextMenu from "../components/ContextMenu";
import type { MenuItem } from "../components/ContextMenu";
import ObjectPicker from "../components/ObjectPicker";
import { useNotification } from "../contexts/NotificationContext";
import { useStatusBar } from "../contexts/StatusBarContext";
import { useSearch } from "../contexts/SearchContext";
import { useI18n } from "../contexts/I18nContext";
import { useClipboard } from "../contexts/ClipboardContext";
import { 
    Folder, 
    FileText, 
    Grid as GridIcon, 
    List as ListIcon, 
    RefreshCw, 
    ArrowUp, 
    ChevronRight, 
    Home, 
    UploadCloud,
    Download,
    Trash2,
    Copy,
    Upload,
    Save,
    FolderPlus,
    File as FileIcon,
    Scissors
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

import { useTransfer } from "../contexts/TransferContext";

interface ProgressPayload {
    path: string;
    transferred: number;
    total: number;
}

export default function FileBrowser({ profile, bucket, isActive, onOpenFile }: FileBrowserProps) {
    const { t } = useI18n();
    const { registerTask } = useTransfer();
    const { setClipboard, items: clipboardItems, operation: clipboardOp } = useClipboard();
    const { addNotification, updateNotification, removeNotification } = useNotification();
    const { setLeftItem } = useStatusBar();
    const { searchQuery } = useSearch();
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
    const [prefix, setPrefix] = useState("");
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [internalDragTarget, setInternalDragTarget] = useState<string | null>(null);
    
    // Copy/Move Picker State
    const [pickerState, setPickerState] = useState<{ open: boolean; mode: "copy" | "move"; items: FileEntry[] }>({ open: false, mode: "copy", items: [] });
    
    // Progress Tracking
    const activeUploads = useRef<Record<string, { notifId: string, lastBytes: number, lastTime: number }>>({});
    const activeDownloads = useRef<Record<string, { notifId: string, lastBytes: number, lastTime: number }>>({});

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
                    <span>{filteredFiles.length} {t("items")} {isActive && searchQuery && `(of ${files.length})`}</span>
                    {loading && <span>({t("loading")})</span>}
                </div>
            );
        }
    }, [isActive, files.length, filteredFiles.length, loading, bucket, setLeftItem, searchQuery, t]);

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

    async function handleDownloadSelected() {
        if (selectedPaths.size === 0) return;
        
        const filesToDownload = files.filter(f => selectedPaths.has(f.path));
        for (const file of filesToDownload) {
            await handleDownload(file);
        }
    }

    async function handleSaveAsSelected() {
        if (selectedPaths.size !== 1) {
             addNotification({ title: "Please select a single file to Save As", type: 'info' });
             return;
        }
        const file = files.find(f => selectedPaths.has(f.path));
        if (file) {
            await handleSaveAs(file);
        }
    }

    // Menu Action Listeners
    useEffect(() => {
        if (!isActive) return;

        let cancelled = false;
        const unlisteners: (() => void)[] = [];

        const setupListeners = async () => {
            const handlers = [
                { event: 'menu:upload-file', handler: handleUploadFile },
                { event: 'menu:upload-folder', handler: handleUploadFolder },
                { event: 'menu:copy', handler: handleCopy },
                { event: 'menu:cut', handler: handleCut },
                { event: 'menu:paste', handler: handlePaste },
                { event: 'menu:select-all', handler: handleSelectAll },
                { event: 'menu:reload', handler: loadFiles },
                { event: 'menu:download', handler: handleDownloadSelected },
                { event: 'menu:save-as', handler: handleSaveAsSelected },
            ];

            for (const { event, handler } of handlers) {
                const unlisten = await listen(event, () => {
                    if (!cancelled) handler();
                });
                if (cancelled) {
                    unlisten();
                } else {
                    unlisteners.push(unlisten);
                }
            }
        };

        setupListeners();

        return () => {
            cancelled = true;
            unlisteners.forEach(u => u());
        };
        // We only want to re-subscribe if the core identity of the view changes (profile/bucket/prefix)
        // or if our data-dependent handlers need fresh closures.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, profile, bucket, prefix, files, selectedPaths, clipboardItems, clipboardOp]);

    // Progress Listeners
    useEffect(() => {
        let unlistenUpload: () => void;
        let unlistenDownload: () => void;

        const setup = async () => {
            unlistenUpload = await listen<ProgressPayload>('upload-progress', (event) => {
                const { path, transferred, total } = event.payload;
                const tracker = activeUploads.current[path];
                if (tracker) {
                    const now = Date.now();
                    const timeDiff = (now - tracker.lastTime) / 1000;
                    
                    if (timeDiff >= 0.2) { // Update frequently for smooth UI
                        const bytesDiff = transferred - tracker.lastBytes;
                        const speed = bytesDiff / timeDiff;
                        const speedStr = speed >= 0 ? formatSize(speed) + "/s" : "-";
                        
                        const progress = total > 0 ? Math.round((transferred / total) * 100) : undefined;
                        
                        let message = `${formatSize(transferred)}`;
                        if (total > 0) {
                            const remaining = total - transferred;
                            const eta = speed > 0 ? remaining / speed : 0;
                            message += ` / ${formatSize(total)} (${speedStr}, ${formatTime(eta)} remaining)`;
                        } else {
                            message += ` (${speedStr})`;
                        }

                        updateNotification(tracker.notifId, {
                            message,
                            progress
                        });
                        
                        tracker.lastBytes = transferred;
                        tracker.lastTime = now;
                    }
                }
            });

            unlistenDownload = await listen<ProgressPayload>('download-progress', (event) => {
                const { path, transferred, total } = event.payload;
                const tracker = activeDownloads.current[path];
                if (tracker) {
                    const now = Date.now();
                    const timeDiff = (now - tracker.lastTime) / 1000;
                    
                    if (timeDiff >= 0.2) {
                        const bytesDiff = transferred - tracker.lastBytes;
                        const speed = bytesDiff / timeDiff;
                        const speedStr = speed >= 0 ? formatSize(speed) + "/s" : "-";
                        
                        const progress = total > 0 ? Math.round((transferred / total) * 100) : undefined;

                        let message = `${formatSize(transferred)}`;
                        if (total > 0) {
                            const remaining = total - transferred;
                            const eta = speed > 0 ? remaining / speed : 0;
                            message += ` / ${formatSize(total)} (${speedStr}, ${formatTime(eta)} remaining)`;
                        } else {
                            message += ` (${speedStr})`;
                        }

                        updateNotification(tracker.notifId, {
                            message,
                            progress
                        });
                        
                        tracker.lastBytes = transferred;
                        tracker.lastTime = now;
                    }
                }
            });
        };
        
        setup();

        return () => {
            if (unlistenUpload) unlistenUpload();
            if (unlistenDownload) unlistenDownload();
        };
    }, [updateNotification]);

    // Handle File Drop (Upload - OS Level)
    useEffect(() => {
        let isCancelled = false;
        const unlisteners: (() => void)[] = [];

        const setupListeners = async () => {
            // Drag Enter (Global / Window level)
            const onDragEnter = await listen('tauri://drag-enter', () => {
                 setIsDraggingOver(true);
            });
            if (isCancelled) { onDragEnter(); return; }
            unlisteners.push(onDragEnter);

            const onDragLeave = await listen('tauri://drag-leave', () => {
                setIsDraggingOver(false);
            });
            if (isCancelled) { onDragLeave(); return; }
            unlisteners.push(onDragLeave);

            const onDragDrop = await listen('tauri://drag-drop', async (event: { payload: DragDropPayload }) => {   
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
            unlisteners.forEach(f => f());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, bucket, prefix]);

    async function loadFiles() {
        setLoading(true);
        setError("");
        setSelectedPaths(new Set());
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

    async function handleUploadFile() {
        try {
            const selected = await open({
                multiple: true,
                directory: false
            });
            if (selected) {
                const paths = Array.isArray(selected) ? selected : [selected];
                await handleUpload(paths);
            }
        } catch (e) {
            console.error("File selection failed", e);
        }
    }

    async function handleUploadFolder() {
        try {
            const selected = await open({
                multiple: true,
                directory: true
            });
            if (selected) {
                const paths = Array.isArray(selected) ? selected : [selected];
                await handleUpload(paths);
            }
        } catch (e) {
            console.error("Folder selection failed", e);
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
                activeUploads.current[path] = { notifId, lastBytes: 0, lastTime: Date.now() };
                
                registerTask(path, 'upload', {
                    profile,
                    bucket,
                    localPath: path,
                    remotePath: prefix,
                    isDir: false // Assume false for initial simple upload, but if dir, we might want to flag it?
                    // Wait, upload_file command handles isDir internally via WalkDir if localPath is dir.
                    // But for resume we need to know.
                    // Actually, for upload, localPath is enough.
                });

                await invoke("upload_file", {
                    profileName: profile,
                    bucket,
                    localPath: path,
                    destPrefix: prefix
                });
                
                delete activeUploads.current[path];

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
    
    // Handle Selection Logic
    function handleSelection(e: React.MouseEvent, file: FileEntry) {
        if (e.target instanceof HTMLInputElement && e.target.type === "checkbox") {
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            const newSet = new Set(selectedPaths);
            if (newSet.has(file.path)) newSet.delete(file.path);
            else newSet.add(file.path);
            setSelectedPaths(newSet);
            setLastSelectedPath(file.path);
        } else if (e.shiftKey && lastSelectedPath) {
            const idx1 = filteredFiles.findIndex(f => f.path === lastSelectedPath);
            const idx2 = filteredFiles.findIndex(f => f.path === file.path);
            if (idx1 !== -1 && idx2 !== -1) {
                const start = Math.min(idx1, idx2);
                const end = Math.max(idx1, idx2);
                const range = filteredFiles.slice(start, end + 1).map(f => f.path);
                setSelectedPaths(new Set(range));
            }
        } else {
            setSelectedPaths(new Set([file.path]));
            setLastSelectedPath(file.path);
        }
    }

    function toggleSelection(path: string) {
        const newSet = new Set(selectedPaths);
        if (newSet.has(path)) newSet.delete(path);
        else newSet.add(path);
        setSelectedPaths(newSet);
        setLastSelectedPath(path);
    }

    function handleSelectAll() {
        if (selectedPaths.size === filteredFiles.length && filteredFiles.length > 0) {
            setSelectedPaths(new Set());
        } else {
            setSelectedPaths(new Set(filteredFiles.map(f => f.path)));
        }
    }

    function handleCopy() {
        if (selectedPaths.size === 0) return;
        const items = files.filter(f => selectedPaths.has(f.path)).map(f => ({
            profile, bucket, key: f.path, isDir: f.is_dir
        }));
        setClipboard(items, 'copy');
        addNotification({ title: `${items.length} items copied`, type: 'success', duration: 1000 });
    }

    function handleCut() {
        if (selectedPaths.size === 0) return;
        const items = files.filter(f => selectedPaths.has(f.path)).map(f => ({
            profile, bucket, key: f.path, isDir: f.is_dir
        }));
        setClipboard(items, 'move');
        addNotification({ title: `${items.length} items cut`, type: 'success', duration: 1000 });
    }

    async function handlePaste() {
        if (clipboardItems.length === 0 || !clipboardOp) return;
        
        const action = clipboardOp === 'copy' ? "copy_objects" : "move_objects";
        const actionName = clipboardOp === 'copy' ? t("copying") : t("moving");

        for (const item of clipboardItems) {
            const fileName = item.key.split('/').filter(p => p).pop();
            if (!fileName) continue;

            let destKey = prefix + fileName;
            if (item.isDir) destKey += "/";

            if (item.profile === profile && item.bucket === bucket && item.key === destKey) continue;

            const notifId = addNotification({
                title: `${actionName} ${fileName}...`,
                type: "progress"
            });

            try {
                await invoke(action, {
                    profileName: item.profile,
                    srcBucket: item.bucket,
                    srcKey: item.key,
                    destBucket: bucket,
                    destKey: destKey,
                    isDir: item.isDir
                });
                updateNotification(notifId, { title: `${actionName} ${t("completed")}`, type: 'success', duration: 2000 });
            } catch (e) {
                updateNotification(notifId, { title: t("operationFailed"), message: String(e), type: 'error' });
            }
        }
        loadFiles();
    }

    // Handle Internal Drop (Move/Copy)
    async function handleInternalDrop(e: React.DragEvent, targetPrefix: string) {
        e.preventDefault();
        e.stopPropagation();
        setInternalDragTarget(null);

        if (!e.dataTransfer.types.includes("application/json")) return;

        const dataStr = e.dataTransfer.getData("application/json");
        if (!dataStr) return;

        try {
            const data = JSON.parse(dataStr);
            if (data.type !== "oss-file") return;

            if (data.profile === profile && data.bucket === bucket && data.key === targetPrefix) return;
            
            if (data.isDir && targetPrefix.startsWith(data.key)) {
                addNotification({ title: t("cannotMoveIntoSelf"), type: "error" });
                return;
            }

            const isCopy = e.ctrlKey || e.altKey || (data.bucket !== bucket) || (data.profile !== profile);
            const action = isCopy ? "copy_objects" : "move_objects";
            const actionName = isCopy ? t("copying") : t("moving");

            const fileName = data.key.split('/').filter((p: string) => p).pop();
            if (!fileName) return; 

            let destKey = targetPrefix + fileName;
            if (data.isDir) destKey += "/";

            if (data.key === destKey && data.bucket === bucket && data.profile === profile) return;

            const notifId = addNotification({
                title: `${actionName} ${fileName}...`,
                type: "progress"
            });

            await invoke(action, {
                profileName: data.profile,
                srcBucket: data.bucket,
                srcKey: data.key,
                destBucket: bucket,
                destKey: destKey,
                isDir: data.isDir
            });

            updateNotification(notifId, {
                title: `${actionName} ${t("completed")}`,
                type: "success",
                duration: 2000
            });
            
            loadFiles();
            
        } catch (e) {
            console.error(e);
            addNotification({ title: t("operationFailed"), message: String(e), type: "error" });
        }
    }

    function handleDragStart(e: React.DragEvent, file: FileEntry) {
        e.dataTransfer.setData("application/json", JSON.stringify({
            type: "oss-file",
            profile,
            bucket,
            key: file.path,
            isDir: file.is_dir
        }));
        e.dataTransfer.effectAllowed = "copyMove";
    }
    
    async function handleDelete(file: FileEntry, skipConfirm = false) {
        if (!skipConfirm && !confirm(`Are you sure you want to delete ${file.name}?`)) return; 
        
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
                
                activeDownloads.current[file.path] = { notifId, lastBytes: 0, lastTime: Date.now() };
                
                registerTask(file.path, 'download', {
                    profile,
                    bucket,
                    localPath,
                    remotePath: file.path,
                    isDir: file.is_dir
                });

                await invoke("download_file", {
                    profileName: profile,
                    bucket,
                    key: file.path,
                    localPath,
                    isDir: file.is_dir
                });
                
                delete activeDownloads.current[file.path];

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
                    activeDownloads.current[file.path] = { notifId, lastBytes: 0, lastTime: Date.now() };

                    registerTask(file.path, 'download', {
                        profile,
                        bucket,
                        localPath,
                        remotePath: file.path,
                        isDir: file.is_dir
                    });

                    await invoke("download_file", {
                        profileName: profile,
                        bucket,
                        key: file.path,
                        localPath,
                        isDir: file.is_dir
                    });
                    
                    delete activeDownloads.current[file.path];

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

    async function handlePickerSelect(destBucket: string, destPrefix: string) {
        setPickerState(prev => ({ ...prev, open: false }));
        
        const action = pickerState.mode === "copy" ? "copy_objects" : "move_objects";
        const actionName = pickerState.mode === "copy" ? t("copying") : t("moving");

        for (const item of pickerState.items) {
            let destKey = destPrefix + item.name;
            if (item.is_dir) destKey += "/";
            
            if (profile === profile && bucket === destBucket && item.path === destKey) {
                continue;
            }

            const notifId = addNotification({
                title: `${actionName} ${item.name}...`,
                type: "progress"
            });

            try {
                await invoke(action, {
                    profileName: profile,
                    srcBucket: bucket,
                    srcKey: item.path,
                    destBucket: destBucket,
                    destKey: destKey,
                    isDir: item.is_dir
                });

                updateNotification(notifId, {
                    title: `${actionName} ${t("completed")}`,
                    type: "success",
                    duration: 2000
                });
            } catch (e) {
                console.error(e);
                updateNotification(notifId, {
                    title: t("operationFailed"),
                    message: String(e),
                    type: "error",
                    autoClose: false
                });
            }
        }
        
        if (bucket === destBucket || pickerState.mode === "move") {
            loadFiles();
        }
    }

    function handleContextMenu(e: React.MouseEvent, file?: FileEntry) {
        e.preventDefault();
        e.stopPropagation();
        
        if (file && !selectedPaths.has(file.path)) {
            setSelectedPaths(new Set([file.path]));
            setLastSelectedPath(file.path);
        }

        const x = e.clientX;
        const y = e.clientY;
        
        if (file) {
            setContextMenu({
                x, y,
                items: [
                    {
                        label: t("download"), 
                        icon: <Download size={14} />,
                        action: () => handleDownload(file) 
                    },
                    {
                        label: t("saveAs"), 
                        icon: <Save size={14} />,
                        action: () => handleSaveAs(file) 
                    },
                    {
                        label: t("copyPath"), 
                        icon: <Copy size={14} />,
                        action: () => {
                            navigator.clipboard.writeText(file.path);
                            addNotification({ title: t("pathCopied"), type: 'success', duration: 2000 });
                        }
                    },
                    { separator: true, label: "" },
                    {
                        label: t("cut"),
                        icon: <Scissors size={14} />,
                        action: handleCut
                    },
                    {
                        label: t("copy"),
                        icon: <Copy size={14} />,
                        action: handleCopy
                    },
                    {
                        label: t("paste"),
                        icon: <FileText size={14} />,
                        disabled: clipboardItems.length === 0,
                        action: handlePaste
                    },
                    { separator: true, label: "" },
                    {
                        label: t("copyTo"),
                        icon: <Copy size={14} />,
                        action: () => setPickerState({ open: true, mode: "copy", items: [file] })
                    },
                    {
                        label: t("moveTo"),
                        icon: <Scissors size={14} />,
                        action: () => setPickerState({ open: true, mode: "move", items: [file] })
                    },
                    { separator: true, label: "" },
                    {
                        label: t("delete"), 
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
                        label: t("refresh"), 
                        icon: <RefreshCw size={14} />,
                        action: loadFiles 
                    },
                    {
                        label: t("paste"),
                        icon: <FileText size={14} />,
                        disabled: clipboardItems.length === 0,
                        action: handlePaste
                    },
                    { separator: true, label: "" },
                    {
                        label: t("uploadFile"), 
                        icon: <Upload size={14} />,
                        action: handleUploadFile 
                    },
                    {
                        label: t("uploadFolder"), 
                        icon: <FolderPlus size={14} />,
                        action: handleUploadFolder 
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
        newPath = newPath.replaceAll("\\", "/");
        if (newPath.startsWith("/")) newPath = newPath.substring(1);
        
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

    // Keyboard Navigation
    function handleContainerKeyDown(e: React.KeyboardEvent) {
        // Global Shortcuts (No selection required)
        if (e.key === "F5") {
            e.preventDefault();
            loadFiles();
            return;
        }

        if (e.ctrlKey && (e.key === "a" || e.key === "A")) {
            e.preventDefault();
            handleSelectAll();
            return;
        }

        if (e.altKey && e.key === "ArrowUp") {
            e.preventDefault();
            handleUp();
            return;
        }

        if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
             e.preventDefault();
             handlePaste();
             return;
        }

        // Selection Context Shortcuts
        if (selectedPaths.size === 0) return;

        // Clipboard Ops (Copy/Cut)
        if (e.ctrlKey) {
            if (e.key === "c" || e.key === "C") {
                e.preventDefault();
                handleCopy();
                return;
            }
            if (e.key === "x" || e.key === "X") {
                e.preventDefault();
                handleCut();
                return;
            }
        }

        switch(e.key) {
            case "Delete": {
                e.preventDefault();
                const toDelete = files.filter(f => selectedPaths.has(f.path));
                if (toDelete.length > 0) {
                    if (confirm(`Are you sure you want to delete ${toDelete.length} items?`)) {
                         toDelete.forEach(f => handleDelete(f, true));
                    }
                }
                break;
            }
            
            case "Enter":
                e.preventDefault();
                if (selectedPaths.size === 1) {
                    const path = Array.from(selectedPaths)[0];
                    const file = files.find(f => f.path === path);
                    if (file) {
                        if (file.is_dir) {
                            setPrefix(file.path);
                        } else if (onOpenFile) {
                            onOpenFile(file.path);
                        }
                    }
                }
                break;
                
             case "F2":
                 e.preventDefault();
                 addNotification({ title: "Rename not implemented yet", type: "info" });
                 break;
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

    function formatTime(seconds: number) {
        if (!isFinite(seconds) || seconds < 0) return "--";
        if (seconds < 60) return `${Math.ceil(seconds)}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.ceil(seconds % 60);
        return `${mins}m ${secs}s`;
    }

    return (
        <div 
            className="h-full flex flex-col text-[#cccccc] bg-[#1e1e1e] relative select-none outline-none"
            tabIndex={0}
            onKeyDown={handleContainerKeyDown}
            onContextMenu={(e) => handleContextMenu(e)} 
            onDragEnter={(e) => e.preventDefault()}
            onDragOver={(e) => { 
                e.preventDefault(); 
                e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
            }} 
            onDrop={(e) => handleInternalDrop(e, prefix)}
            onClick={() => setSelectedPaths(new Set())}
        >
            {/* Drag Over Overlay (External) */}
            {isDraggingOver && (
                <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 z-50 flex items-center justify-center pointer-events-none">
                    <div className="bg-[#1e1e1e] p-4 rounded shadow-lg flex flex-col items-center">       
                        <UploadCloud size={48} className="text-blue-500 mb-2" />
                        <span className="text-white font-bold">{t("dropToUpload")}</span>
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
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        if (!isEditingPath) startEditingPath(); 
                    }}
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
                        <ListIcon size={16} />
                    </button>
                    <button
                        className={clsx("p-1.5 rounded hover:bg-[#3c3c3c]", viewMode === "grid" && "bg-[#3c3c3c] text-white")}
                        onClick={() => setViewMode("grid")}
                        title="Grid View"
                    >
                        <GridIcon size={16} />
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
            <div className="flex-1 overflow-auto bg-[#1e1e1e] relative">
                {error && <div className="text-red-500 p-4">Error: {error}</div>}

                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e1e]/50 z-20 backdrop-blur-[1px] transition-opacity duration-300 opacity-100">
                        <RefreshCw size={32} className="text-[#0e639c] animate-spin mb-2" />
                        <span className="text-sm text-[#858585]">{t("loading")}</span>
                    </div>
                )}

                {!loading && filteredFiles.length === 0 && !error && (
                    <div className="text-[#858585] text-center mt-10">
                        {searchQuery ? "No matching files found." : "No files found."}
                    </div>
                )}

                {viewMode === "list" ? (
                    <div className="min-w-full inline-block align-middle">
                        {/* Header */}
                        <div className="flex text-xs font-bold text-[#cccccc] px-4 py-2 border-b border-[#2d2d2d] sticky top-0 bg-[#1e1e1e] z-10 group/header">
                            <div className={clsx("w-8 shrink-0 flex items-center justify-center transition-opacity", selectedPaths.size > 0 ? "opacity-100" : "opacity-0 group-hover/header:opacity-100")}>
                                <input 
                                    type="checkbox" 
                                    className="custom-checkbox"
                                    checked={selectedPaths.size === filteredFiles.length && filteredFiles.length > 0}
                                    onChange={handleSelectAll}
                                />
                            </div>
                            <div className="flex-1">Name</div>
                            <div className="w-24 text-right">Size</div>
                            <div className="w-40 text-right">Date Modified</div>
                        </div>

                        {/* List Items */}
                        <div className="flex flex-col">
                            {filteredFiles.map(file => (
                                <div
                                    key={file.path}
                                    className={clsx(
                                        "flex items-center px-4 py-1 cursor-pointer border-l-2 group select-none transition-colors",
                                        selectedPaths.has(file.path) 
                                            ? "bg-[#094771]/40 border-[#007fd4]" 
                                            : "border-transparent hover:bg-[#2a2d2e]",
                                        internalDragTarget === file.path && "bg-[#2a2d2e] border-[#007fd4]"
                                    )}
                                    onClick={(e) => { e.stopPropagation(); handleSelection(e, file); }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (file.is_dir) {
                                            setPrefix(file.path);
                                        } else if (onOpenFile) {
                                            onOpenFile(file.path);
                                        }
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, file)}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, file)}
                                    onDragEnter={(e) => e.preventDefault()}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
                                        if (file.is_dir) {
                                            e.stopPropagation();
                                            if (internalDragTarget !== file.path) {
                                                setInternalDragTarget(file.path);
                                            }
                                        }
                                    }}
                                    onDragLeave={() => setInternalDragTarget(null)}
                                    onDrop={(e) => {
                                        if (file.is_dir) {
                                            e.stopPropagation();
                                            handleInternalDrop(e, file.path);
                                        }
                                    }}
                                >
                                    <div className={clsx("w-8 shrink-0 flex items-center justify-center transition-opacity", selectedPaths.has(file.path) ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                        <input 
                                            type="checkbox" 
                                            className="custom-checkbox"
                                            checked={selectedPaths.has(file.path)}
                                            onChange={() => toggleSelection(file.path)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="flex-1 flex items-center min-w-0">
                                        <div className="mr-2 shrink-0">
                                            {file.is_dir ?
                                                <Folder size={16} className="text-[#dcb67a]" /> :
                                                <FileIcon size={16} className="text-[#519aba]" />
                                            }
                                        </div>
                                        <span className={clsx("truncate text-sm group-hover:text-white", selectedPaths.has(file.path) ? "text-white" : "text-[#cccccc]")}>
                                            {file.name}
                                        </span>
                                    </div>
                                    <div className="w-24 text-right text-xs text-[#858585] shrink-0">
                                        {file.is_dir ? "-" : formatSize(file.size)}
                                    </div>
                                    <div className="w-40 text-right text-xs text-[#858585] shrink-0">
                                        {formatDate(file.last_modified)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 p-4">      
                        {filteredFiles.map(file => (
                            <div
                                key={file.path}
                                className={clsx(
                                    "flex flex-col items-center p-2 rounded cursor-pointer group relative transition-all",
                                    selectedPaths.has(file.path) 
                                        ? "bg-[#094771]/40 ring-1 ring-[#007fd4]" 
                                        : "hover:bg-[#2a2d2e]",
                                    internalDragTarget === file.path && "bg-[#2a2d2e] ring-1 ring-[#007fd4]"
                                )}
                                onClick={(e) => { e.stopPropagation(); handleSelection(e, file); }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (file.is_dir) {
                                        setPrefix(file.path);
                                    } else if (onOpenFile) {
                                        onOpenFile(file.path);
                                    }
                                }}
                                onContextMenu={(e) => handleContextMenu(e, file)}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, file)}
                                onDragEnter={(e) => e.preventDefault()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
                                    if (file.is_dir) {
                                        e.stopPropagation();
                                        if (internalDragTarget !== file.path) {
                                            setInternalDragTarget(file.path);
                                        }
                                    }
                                }}
                                onDragLeave={() => setInternalDragTarget(null)}
                                onDrop={(e) => {
                                    if (file.is_dir) {
                                        e.stopPropagation();
                                        handleInternalDrop(e, file.path);
                                    }
                                }}
                                title={file.name}
                            >
                                <div className={clsx("absolute top-1 left-1 z-10", selectedPaths.has(file.path) ? "block" : "hidden group-hover:block")}>
                                    <input 
                                        type="checkbox" 
                                        className="custom-checkbox"
                                        checked={selectedPaths.has(file.path)}
                                        onChange={() => toggleSelection(file.path)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="mb-2">
                                    {file.is_dir ?
                                        <Folder size={48} className="text-[#dcb67a]" /> :
                                        <FileIcon size={48} className="text-[#519aba]" />
                                    }
                                </div>
                                <span className="text-xs text-center break-all line-clamp-2 text-[#cccccc] group-hover:text-white select-none">
                                    {file.name}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Object Picker Modal */}
            {pickerState.open && (
                <ObjectPicker 
                    profile={profile}
                    initialBucket={bucket}
                    title={pickerState.mode === "copy" ? t("copyTo") : t("moveTo")}
                    onSelect={handlePickerSelect}
                    onCancel={() => setPickerState(prev => ({ ...prev, open: false }))}
                />
            )}
        </div>
    );
}