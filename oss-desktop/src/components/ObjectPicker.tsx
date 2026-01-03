import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Folder, ChevronRight, Home, Check, X, RefreshCw } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import type { FileEntry } from "../types";
import clsx from "clsx";

interface ObjectPickerProps {
    profile: string;
    initialBucket: string;
    onSelect: (bucket: string, prefix: string) => void;
    onCancel: () => void;
    title: string;
}

export default function ObjectPicker({ profile, initialBucket, onSelect, onCancel, title }: ObjectPickerProps) {
    const { t } = useI18n();
    const [bucket, setBucket] = useState(initialBucket);
    const [prefix, setPrefix] = useState("");
    const [buckets, setBuckets] = useState<string[]>([]);
    const [folders, setFolders] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"buckets" | "folders">("folders");

    // Load Buckets on mount
    useEffect(() => {
        setLoading(true);
        invoke<string[]>("list_buckets", { profileName: profile })
            .then(setBuckets)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [profile]);

    // Load Folders when bucket/prefix changes
    useEffect(() => {
        if (mode === "buckets") return;
        
        setLoading(true);
        invoke<FileEntry[]>("list_objects", { profileName: profile, bucket, prefix })
            .then(entries => {
                // Filter only folders
                setFolders(entries.filter(e => e.is_dir));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [profile, bucket, prefix, mode]);

    const handleBucketClick = (b: string) => {
        setBucket(b);
        setPrefix("");
        setMode("folders");
    };

    const handleFolderClick = (path: string) => {
        setPrefix(path);
    };

    const handleUp = () => {
        if (!prefix) {
            setMode("buckets");
            return;
        }
        const parts = prefix.trimEnd().split("/");
        if (parts[parts.length - 1] === "") parts.pop();
        parts.pop();
        const newPrefix = parts.length > 0 ? parts.join("/") + "/" : "";
        setPrefix(newPrefix);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#252526] border border-[#454545] shadow-2xl rounded-lg w-full max-w-lg h-[500px] flex flex-col animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#3e3e42]">
                    <h3 className="font-semibold text-white">{title}</h3>
                    <button onClick={onCancel} className="text-[#858585] hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Path / Nav */}
                <div className="px-4 py-2 border-b border-[#3e3e42] flex items-center space-x-2 text-sm bg-[#1e1e1e]">
                    <button 
                        className="p-1 hover:bg-[#3c3c3c] rounded"
                        onClick={() => setMode("buckets")}
                        disabled={mode === "buckets"}
                    >
                        <Home size={16} className={mode === "buckets" ? "text-white" : "text-[#858585]"} />
                    </button>
                    {mode === "folders" && (
                        <>
                            <ChevronRight size={14} className="text-[#858585]" />
                            <span className="font-semibold text-white">{bucket}</span>
                            {prefix && (
                                <>
                                    <ChevronRight size={14} className="text-[#858585]" />
                                    <span className="text-[#cccccc] truncate">{prefix}</span>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* List */}
                <div className="flex-1 overflow-auto p-2 relative">
                    {/* Loading Overlay */}
                    <div className={clsx(
                        "absolute inset-0 flex flex-col items-center justify-center bg-[#252526]/50 z-20 backdrop-blur-[1px] transition-opacity duration-300",
                        loading ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    )}>
                        <RefreshCw size={24} className="text-[#0e639c] animate-spin mb-2" />
                        <span className="text-xs text-[#858585]">{t("loading")}</span>
                    </div>

                    {mode === "buckets" ? (
                        <div className="grid grid-cols-2 gap-2">
                            {buckets.map(b => (
                                <div 
                                    key={b}
                                    className="flex items-center p-2 hover:bg-[#2a2d2e] cursor-pointer rounded"
                                    onClick={() => handleBucketClick(b)}
                                >
                                    <div className="text-yellow-500 mr-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10h16v10H4zM4 6h16v2H4z" /></svg>
                                    </div>
                                    <span className="text-[#cccccc] truncate">{b}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {prefix && (
                                <div 
                                    className="flex items-center p-2 hover:bg-[#2a2d2e] cursor-pointer rounded text-[#858585]"
                                    onClick={handleUp}
                                >
                                    <div className="w-4 mr-2 text-center">..</div>
                                    <span>{t("back")}</span>
                                </div>
                            )}
                            {folders.map(f => (
                                <div 
                                    key={f.path}
                                    className="flex items-center p-2 hover:bg-[#2a2d2e] cursor-pointer rounded group"
                                    onClick={() => handleFolderClick(f.path)}
                                >
                                    <Folder size={16} className="text-[#dcb67a] mr-2" />
                                    <span className="text-[#cccccc] group-hover:text-white truncate">{f.name}</span>
                                </div>
                            ))}
                            {!loading && folders.length === 0 && (
                                <div className="text-center text-[#555] py-4 text-xs">{t("noSubfolders")}</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[#3e3e42] flex justify-end space-x-2 bg-[#252526]">
                    <button 
                        className="px-4 py-1.5 rounded hover:bg-[#3c3c3c] text-[#cccccc] text-sm"
                        onClick={onCancel}
                    >
                        {t("cancel")}
                    </button>
                    <button 
                        className="px-4 py-1.5 rounded bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm flex items-center disabled:opacity-50"
                        onClick={() => onSelect(bucket, prefix)}
                        disabled={mode === "buckets"}
                    >
                        <Check size={14} className="mr-2" />
                        {t("selectDestination")}
                    </button>
                </div>
            </div>
        </div>
    );
}
