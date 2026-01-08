import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNotification } from "../contexts/NotificationContext";
import { Loader2, Download, FileText, Image as ImageIcon, File, AlertCircle, Copy } from "lucide-react";
import { join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../contexts/I18nContext";

interface FileDetailsProps {
    profile: string;
    bucket: string;
    fileKey: string;
}

interface ObjectMetadata {
    key: string;
    size: number;
    last_modified?: number;
    etag?: string;
    content_type?: string;
}

interface AppConfig {
    default_download_dir: string;
}

export default function FileDetails({ profile, bucket, fileKey }: FileDetailsProps) {
    const { t } = useI18n();
    const { addNotification, updateNotification } = useNotification();
    const [metadata, setMetadata] = useState<ObjectMetadata | null>(null);
    const [content, setContent] = useState<string | null>(null); // For text/base64
    const [loading, setLoading] = useState(true);
    const [previewType, setPreviewType] = useState<"text" | "image" | "none">("none");
    const [error, setError] = useState("");

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, bucket, fileKey]);

    async function loadData() {
        setLoading(true);
        setError("");
        setContent(null);
        setPreviewType("none");
        
        try {
            // 1. Head Object
            const meta = await invoke<ObjectMetadata>("head_object", {
                profileName: profile,
                bucket,
                key: fileKey
            });
            setMetadata(meta);

            // 2. Determine Preview Type
            const ext = fileKey.split('.').pop()?.toLowerCase() || "";
            const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext);
            const isText = ["txt", "md", "json", "xml", "js", "jsx", "ts", "tsx", "rs", "py", "css", "html", "yml", "yaml", "toml", "log", "sql", "sh", "bat", "ini", "conf", "gitignore", "iss"].includes(ext);

            if ((isImage || isText) && meta.size < 5 * 1024 * 1024) { // Limit 5MB
                try {
                    const data = await invoke<number[]>("read_object", {
                        profileName: profile,
                        bucket,
                        key: fileKey
                    });
                    
                    if (isImage) {
                        const base64 = btoa(new Uint8Array(data).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                        const mime = meta.content_type || `image/${ext === 'svg' ? 'svg+xml' : ext}`;
                        setContent(`data:${mime};base64,${base64}`);
                        setPreviewType("image");
                    } else {
                        const text = new TextDecoder().decode(new Uint8Array(data));
                        setContent(text);
                        setPreviewType("text");
                    }
                } catch (e) {
                    console.error("Preview failed", e);
                }
            }

        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }
    
    async function handleDownload() {
        if (!metadata) return;
        
        const notifId = addNotification({
            title: `${t("downloading")} ${metadata.key}...`,
            type: 'progress'
        });

        try {
            const config = await invoke<AppConfig>("get_app_config");
            let localPath = "";
            
            if (config.default_download_dir) {
                const name = metadata.key.split('/').pop() || metadata.key;
                localPath = await join(config.default_download_dir, name);
            } else {
                const name = metadata.key.split('/').pop() || metadata.key;
                const selected = await save({ defaultPath: name });
                if (!selected) {
                    // Cancelled
                    updateNotification(notifId, { type: 'info', title: t("downloadCancelled"), autoClose: true, progress: undefined, duration: 1000 });
                    return;
                }
                localPath = selected;
            }
            
            await invoke("download_file", {
                profileName: profile,
                bucket,
                key: metadata.key,
                localPath,
                isDir: false
            });
            
            updateNotification(notifId, {
                title: t("downloadCompleted"),
                message: `${t("savedTo")} ${localPath}`,
                type: 'success',
                progress: 100,
                duration: 3000
            });
        } catch (e) {
             updateNotification(notifId, {
                title: t("downloadFailed"),
                message: String(e),
                type: 'error',
                autoClose: false
            });
        }
    }

    function formatSize(bytes: number) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
    
    if (loading && !metadata) {
        return (
            <div className="h-full flex items-center justify-center text-[#cccccc]">
                <Loader2 size={32} className="animate-spin" />
            </div>
        );
    }
    
    if (error) {
         return (
            <div className="h-full flex flex-col items-center justify-center text-[#cccccc] gap-4">
                <AlertCircle size={48} className="text-red-500" />
                <div className="text-lg">{t("loadDetailsFailed")}</div>
                <div className="text-sm text-[#858585] bg-[#252526] p-2 rounded">{error}</div>
                <button onClick={loadData} className="px-3 py-1 bg-[#0e639c] text-white rounded hover:bg-[#1177bb]">{t("retry")}</button>
            </div>
        );
    }

    if (!metadata) return null;

    const name = metadata.key.split('/').pop() || metadata.key;

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden">
            {/* Header / Metadata Bar */}
            <div className="bg-[#252526] p-4 border-b border-[#3c3c3c] flex items-start justify-between shrink-0">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#3c3c3c] rounded">
                         {previewType === 'image' ? <ImageIcon size={32} /> : <FileText size={32} />}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold select-text text-white">{name}</h2>
                        <div className="text-xs text-[#858585] mt-1 space-y-0.5 select-text">
                            <div className="flex items-center">
                                <span>{t("key")}: </span>
                                <span className="text-[#cccccc] font-mono ml-1 mr-2">{metadata.key}</span>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(metadata.key);
                                        addNotification({ title: t("pathCopied"), type: 'success', duration: 2000 });
                                    }}
                                    className="p-1 hover:bg-[#454545] rounded text-[#858585] hover:text-white transition-colors"
                                    title={t("copyPath")}
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                            <div>{t("size")}: <span className="text-[#cccccc]">{formatSize(metadata.size)}</span></div>
                            <div>{t("lastModified")}: <span className="text-[#cccccc]">{metadata.last_modified ? new Date(metadata.last_modified).toLocaleString() : '-'}</span></div>
                            {metadata.content_type && <div>{t("type")}: <span className="text-[#cccccc]">{metadata.content_type}</span></div>}
                            {metadata.etag && <div>{t("etag")}: <span className="text-[#cccccc] font-mono">{metadata.etag}</span></div>}
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-[#0e639c] text-white px-3 py-1.5 rounded hover:bg-[#1177bb]"
                >
                    <Download size={16} />
                    <span>{t("download")}</span>
                </button>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#1e1e1e]">
                {previewType === 'image' && content ? (
                    <img src={content} alt={name} className="max-w-full max-h-full object-contain shadow-lg border border-[#3c3c3c] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iIzMzMyI+PHBhdGggZD0iTTAgMGgxMHYxMEgwem0xMCAxMGgxMHYxMEgxMHoiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+')] bg-repeat" />
                ) : previewType === 'text' && content ? (
                    <div className="w-full h-full bg-[#252526] p-4 rounded border border-[#3c3c3c] overflow-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all text-[#d4d4d4] select-text">{content}</pre>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-[#858585] gap-2">
                        <File size={48} className="opacity-50" />
                        <p>{t("noPreview")}</p>
                        {metadata.size > 5 * 1024 * 1024 && <p className="text-xs">{t("tooLarge")}</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
