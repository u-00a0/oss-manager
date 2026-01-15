import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { open } from "@tauri-apps/plugin-shell";
import { FolderOpen, Loader2, Check, Github, Globe, FileText } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import type { Language } from "../contexts/I18nContext";
import { getVersion } from "@tauri-apps/api/app";
import type { AppConfig } from "../types";
import NoticesModal from "../components/NoticesModal";

export default function SettingsView() {
    const { t, language, setLanguage } = useI18n();
    const [downloadDir, setDownloadDir] = useState("");
    const [appVersion, setAppVersion] = useState("Unknown");
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [isLoaded, setIsLoaded] = useState(false);
    const [showNotices, setShowNotices] = useState(false);
    
    // Use a ref to track if it's the first mount to prevent saving initial empty state
    // but actually we have isLoaded state.
    const saveTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        async function loadSettings() {
            try {
                const config = await invoke<AppConfig>("get_app_config");
                if (config.default_download_dir) {
                    setDownloadDir(config.default_download_dir);
                }
                // Language is already handled by App global loader, but we sync here just in case
                if (config.language && config.language !== language) {
                    setLanguage(config.language as Language);
                }
                setIsLoaded(true);
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        }
        loadSettings();
        getVersion().then(setAppVersion).catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-save effect
    useEffect(() => {
        if (!isLoaded) return;

        if (saveTimeoutRef.current) {
            window.clearTimeout(saveTimeoutRef.current);
        }

        setSaveStatus("saving");

        saveTimeoutRef.current = window.setTimeout(async () => {
            try {
                await invoke("save_app_settings", { 
                    language, 
                    defaultDownloadDir: downloadDir 
                });
                setSaveStatus("saved");
                
                // Clear "Saved" status after a while
                setTimeout(() => setSaveStatus("idle"), 2000);
            } catch (e) {
                console.error(e);
                setSaveStatus("error");
            }
        }, 1000); // Debounce 1s

        return () => {
            if (saveTimeoutRef.current) {
                window.clearTimeout(saveTimeoutRef.current);
            }
        }
    }, [language, downloadDir, isLoaded]);

    async function handleBrowse() {
        try {
            const selected = await openDialog({
                directory: true,
                multiple: false,
                defaultPath: downloadDir || undefined,
            });
            if (selected) {
                setDownloadDir(selected as string);
            }
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <div className="p-6 text-[#cccccc] max-w-2xl mx-auto h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-[#3e3e42] pb-2">
                <h1 className="text-2xl font-bold">{t("settings")}</h1>
                <div className="flex items-center text-xs">
                    {saveStatus === "saving" && (
                        <span className="flex items-center text-[#858585]">
                            <Loader2 size={12} className="animate-spin mr-1" />
                            {t("save")}...
                        </span>
                    )}
                    {saveStatus === "saved" && (
                        <span className="flex items-center text-green-500">
                            <Check size={12} className="mr-1" />
                            {t("saved")}
                        </span>
                    )}
                    {saveStatus === "error" && (
                        <span className="text-red-500">{t("error")}</span>
                    )}
                </div>
            </div>
            
            <div className="space-y-6">
                {/* General Settings */}
                <section>
                    <h2 className="text-lg font-semibold mb-4 text-[#e7e7e7]">{t("general")}</h2>
                    
                    <div className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                            <label className="text-sm font-medium">{t("language")}</label>
                            <div className="md:col-span-2">
                                <select 
                                    className="w-full bg-[#3c3c3c] border border-[#3c3c3c] p-1.5 text-white outline-none rounded-sm focus:border-[#007fd4]"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value as Language)}
                                >
                                    <option value="en">English</option>
                                    <option value="zh">简体中文</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                            <label className="text-sm font-medium">{t("defaultDownloadDir")}</label>
                            <div className="md:col-span-2 flex space-x-2">
                                <input 
                                    className="flex-1 bg-[#3c3c3c] border border-[#3c3c3c] p-1.5 text-white outline-none rounded-sm focus:border-[#007fd4]"
                                    value={downloadDir}
                                    onChange={(e) => setDownloadDir(e.target.value)}
                                    placeholder="e.g. C:\Downloads"
                                />
                                <button 
                                    className="bg-[#3c3c3c] hover:bg-[#4d4d4d] px-3 py-1.5 rounded-sm flex items-center border border-[#3c3c3c]"
                                    onClick={handleBrowse}
                                >
                                    <FolderOpen size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* About Section */}
                <section>
                    <h2 className="text-lg font-semibold mb-4 text-[#e7e7e7] pt-4 border-t border-[#3e3e42]">{t("about")}</h2>
                    <div className="bg-[#252526] p-6 rounded-md border border-[#3c3c3c] flex flex-col items-center text-center select-none">
                        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
                            <span className="text-3xl font-bold text-white">O</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">OSS Manager</h3>
                        <p className="text-[#858585] text-sm mb-6">{t("highPerformance")}</p>
                        
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-left w-full max-w-xs mb-6 bg-[#1e1e1e] p-4 rounded border border-[#333]">
                            <div className="text-[#858585] text-right">{t("version")}</div>
                            <div className="text-[#cccccc] font-mono">{appVersion}</div>
                            
                            <div className="text-[#858585] text-right">Core</div>
                            <div className="text-[#cccccc]">Rust + Tauri</div>
                            
                            <div className="text-[#858585] text-right">License</div>
                            <div className="text-[#cccccc]">Apache License, Version 2.0</div>
                            <div className="col-span-2 text-[#cccccc] text-center mt-2">© 2026 OSS Manager Contributors. Some rights reserved.</div>
                        </div>

                        <div className="flex space-x-4">
                            <div 
                                onClick={() => open('https://github.com/u-00a0/oss-manager')}
                                className="flex items-center space-x-2 bg-[#3c3c3c] hover:bg-[#4d4d4d] px-4 py-2 rounded transition-colors text-sm text-[#cccccc] hover:text-white cursor-pointer"
                            >
                                <Github size={16} />
                                <span>GitHub</span>
                            </div>
                            <div 
                                onClick={() => open('https://github.com/u-00a0/oss-manager/issues')}
                                className="flex items-center space-x-2 bg-[#3c3c3c] hover:bg-[#4d4d4d] px-4 py-2 rounded transition-colors text-sm text-[#cccccc] hover:text-white cursor-pointer"
                            >
                                <Globe size={16} />
                                <span>{t("reportIssue")}</span>
                            </div>
                            <div 
                                onClick={() => setShowNotices(true)}
                                className="flex items-center space-x-2 bg-[#3c3c3c] hover:bg-[#4d4d4d] px-4 py-2 rounded transition-colors text-sm text-[#cccccc] hover:text-white cursor-pointer"
                            >
                                <FileText size={16} />
                                <span>{t("openSourceNotices")}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
            
            {showNotices && <NoticesModal onClose={() => setShowNotices(false)} />}
        </div>
    );
}