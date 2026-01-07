import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Image as ImageIcon, File, Loader2 } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import type { FileEntry } from "../types";

interface PreviewPaneProps {
    profile: string;
    bucket: string;
    file: FileEntry | null;
}

interface ObjectMetadata {
    key: string;
    size: number;
    last_modified?: number;
    etag?: string;
    content_type?: string;
}

export default function PreviewPane({ profile, bucket, file }: PreviewPaneProps) {
    const { t } = useI18n();
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewType, setPreviewType] = useState<"text" | "image" | "none">("none");
    const [metadata, setMetadata] = useState<ObjectMetadata | null>(null);

    useEffect(() => {
        if (!file || file.is_dir) {
            setContent(null);
            setMetadata(null);
            setPreviewType("none");
            return;
        }
        loadPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, profile, bucket]);

    async function loadPreview() {
        if (!file) return;
        setLoading(true);
        setContent(null);
        setPreviewType("none");
        
        try {
            // Get Metadata
            const meta = await invoke<ObjectMetadata>("head_object", {
                profileName: profile,
                bucket,
                key: file.path
            });
            setMetadata(meta);

            // Determine Preview
            const ext = file.path.split('.').pop()?.toLowerCase() || "";
            const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext);
            const isText = ["txt", "md", "json", "xml", "js", "jsx", "ts", "tsx", "rs", "py", "css", "html", "yml", "yaml", "toml", "log", "sql", "sh", "bat", "ini", "conf", "gitignore", "iss", "md"].includes(ext);

            if ((isImage || isText) && meta.size < 5 * 1024 * 1024) {
                const data = await invoke<number[]>("read_object", {
                    profileName: profile,
                    bucket,
                    key: file.path
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
            }
        } catch (e) {
            console.error("Preview load failed", e);
        } finally {
            setLoading(false);
        }
    }

    function formatSize(bytes: number) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    if (!file) {
        return (
            <div className="w-64 border-l border-[#2d2d2d] bg-[#252526] p-4 flex flex-col items-center justify-center text-[#858585] text-xs select-none">
                {t("selectSingleFile")}
            </div>
        );
    }

    return (
        <div className="w-72 border-l border-[#2d2d2d] bg-[#1e1e1e] flex flex-col text-[#cccccc] shrink-0">
            {/* 1. File Name */}
            <div className="p-4 border-b border-[#2d2d2d] bg-[#252526]">
                <div className="flex items-center gap-2 mb-1">
                    {previewType === 'image' ? <ImageIcon size={16} className="text-[#519aba]" /> : <FileText size={16} className="text-[#519aba]" />}
                    <h3 className="font-bold text-sm truncate" title={file.name}>{file.name}</h3>
                </div>
            </div>

            {/* 2. Preview Area */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[200px] border-b border-[#2d2d2d] bg-[#1e1e1e]">
                {loading ? (
                    <Loader2 size={24} className="animate-spin text-[#007fd4]" />
                ) : previewType === 'image' && content ? (
                    <img src={content} alt={file.name} className="max-w-full max-h-full object-contain shadow-sm" />
                ) : previewType === 'text' && content ? (
                    <div className="w-full h-full bg-[#252526] p-2 rounded border border-[#3c3c3c] overflow-hidden text-[10px] font-mono text-[#d4d4d4] select-none opacity-80">
                        {content.slice(0, 1000)}
                        {content.length > 1000 && "..."}
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-[#858585] gap-2">
                        <File size={48} className="opacity-20" />
                        <span className="text-xs">{t("noPreview")}</span>
                    </div>
                )}
            </div>

            {/* 3. Metadata */}
            <div className="p-4 text-xs space-y-3 bg-[#1e1e1e] overflow-y-auto">
                <div>
                    <span className="text-[#858585] block mb-0.5">{t("dateModified")}</span>
                    <span className="select-text">{file.last_modified ? new Date(file.last_modified).toLocaleString() : '-'}</span>
                </div>
                <div>
                    <span className="text-[#858585] block mb-0.5">{t("size")}</span>
                    <span className="select-text">{formatSize(file.size)}</span>
                </div>
                <div>
                    <span className="text-[#858585] block mb-0.5">{t("path")}</span>
                    <span className="break-all font-mono text-[10px] select-text bg-[#252526] p-1 rounded border border-[#3c3c3c] block mt-1">
                        {file.path}
                    </span>
                </div>
                {metadata?.content_type && (
                    <div>
                        <span className="text-[#858585] block mb-0.5">{t("type")}</span>
                        <span className="select-text">{metadata.content_type}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
