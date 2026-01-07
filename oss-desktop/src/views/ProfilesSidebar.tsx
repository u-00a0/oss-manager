import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Settings, Plus, Download, Trash2, Upload } from "lucide-react";
import { save, confirm, message, open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useI18n } from "../contexts/I18nContext";
import type { Profiles } from "../types";

interface ProfilesSidebarProps {
    onOpenProfile: (name: string) => void;
    onNewProfile: () => void;
}

export default function ProfilesSidebar({ onOpenProfile, onNewProfile }: ProfilesSidebarProps) {
    const { t } = useI18n();
    const [profiles, setProfiles] = useState<Profiles>({});

    async function loadProfiles() {
        try {
            const res = await invoke<Profiles>("list_profiles");
            setProfiles(res);
        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        loadProfiles();
        
        // Listen for profile updates (saved/deleted)
        const unlisten = listen('profiles-updated', loadProfiles);
        
        return () => {
            unlisten.then(f => f());
        };
    }, []);

    async function handleExport(name: string) {
        console.log("Exporting", name);
        const profile = profiles[name];
        if (!profile) return;

        try {
            const filePath = await save({
                defaultPath: `${name}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });

            if (filePath) {
                await writeTextFile(filePath, JSON.stringify(profile, null, 2));
                await message(t("exportSuccess"), { title: t("success"), kind: "info" });
            }
        } catch (e) {
            console.error("Export failed", e);
            await message(String(e), { title: t("exportFailedTitle"), kind: "error" });
        }
    }

    async function handleImport() {
        try {
            const selected = await openDialog({
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            
            if (selected) {
                const content = await readTextFile(selected as string);
                const profile = JSON.parse(content);
                
                // Basic validation
                if (!profile.provider || !profile.access_key) {
                    throw new Error(t("invalidProfile"));
                }
                
                // Use filename as default name, but might need to prompt if exists?
                // For now, simple import.
                const pathStr = selected as string;
                // Extract filename without extension cross-platform way-ish (assuming / or \ separators)
                const name = pathStr.split(/[/\\]/).pop()?.replace(/\.json$/i, '') || t("importedProfile");
                
                await invoke("save_profile", { name, profile });
                await message(`${t("importSuccessTitle")}: ${name}`, { title: t("success"), kind: "info" });
            }
        } catch (e) {
            console.error("Import failed", e);
            await message(String(e), { title: t("importFailedTitle"), kind: "error" });
        }
    }

    async function handleDelete(name: string) {
        console.log("Deleting", name);
        const confirmed = await confirm(`${t("confirmDelete")} "${name}"?`, { title: t("confirmDeleteTitle"), kind: "warning" });
        if (!confirmed) return;
        
        try {
            await invoke("delete_profile", { name });
            // The list will auto-refresh via the profiles-updated event
        } catch (e) {
            console.error("Delete failed", e);
            await message(String(e), { title: t("deleteFailedTitle"), kind: "error" });
        }
    }

    return (
        <div className="h-full flex flex-col bg-[#252526]">
            <div className="p-2 border-b border-[#3e3e42] flex gap-2">
                <button
                    className="flex-1 flex items-center justify-center gap-2 bg-[#0e639c] hover:bg-[#1177bb] text-white py-1.5 rounded text-xs transition-colors"
                    onClick={onNewProfile}
                >
                    <Plus size={14} />
                    <span>{t("newProfile")}</span>
                </button>
                <button
                    className="flex items-center justify-center gap-2 bg-[#3c3c3c] hover:bg-[#4d4d4d] text-white px-3 py-1.5 rounded text-xs transition-colors"
                    onClick={handleImport}
                    title={t("import")}
                >
                    <Upload size={14} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {Object.keys(profiles).map(name => (
                    <div 
                        key={name} 
                        className="px-3 py-2 cursor-pointer hover:bg-[#2a2d2e] flex items-center text-[#cccccc] text-xs group relative"
                        onClick={() => onOpenProfile(name)}
                    >
                        <Settings size={14} className="mr-2 text-blue-400 shrink-0" />
                        <span className="truncate flex-1">{name}</span>
                        
                        {/* Hover Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#2a2d2e] pl-1 z-10">
                            <button
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleExport(name); 
                                }}
                                className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-white"
                                title={t("export")}
                            >
                                <Download size={14} />
                            </button>
                            <button
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleDelete(name); 
                                }}
                                className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-red-500"
                                title={t("delete")}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {Object.keys(profiles).length === 0 && (
                    <div className="p-4 text-[#858585] text-xs text-center italic">{t("noProfiles")}</div>
                )}
            </div>
        </div>
    );
}
