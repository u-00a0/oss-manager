import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Profile, Profiles, S3Provider } from "../types";
import { Save, Trash2, ChevronDown } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import clsx from "clsx";

interface ProfileDetailViewProps {
    profileName: string;
}

export default function ProfileDetailView({ profileName }: ProfileDetailViewProps) {
    const { t } = useI18n();
    const [name, setName] = useState(profileName);
    const [profile, setProfile] = useState<Profile>({
        provider: "Aws",
        access_key: "",
        secret_key: "",
        region: "",
    });
    const [isNew, setIsNew] = useState(!profileName);
    const [isProviderOpen, setIsProviderOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const providers: { id: S3Provider; label: string }[] = [
        { id: "Aws", label: t("providerAws") },
        { id: "CloudflareR2", label: t("providerR2") },
        { id: "Aliyun", label: t("providerAliyun") },
        { id: "Tencent", label: t("providerTencent") },
        { id: "Custom", label: t("providerCustom") },
    ];

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProviderOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (profileName) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsNew(false);
            setName(profileName);
            // Load profile data
            invoke<Profiles>("list_profiles").then(profiles => {
                if (profiles[profileName]) {
                    setProfile(profiles[profileName]);
                }
            });
        } else {
            setIsNew(true);
            setName("");
            setProfile({
                provider: "Aws",
                access_key: "",
                secret_key: "",
                region: "",
            });
        }
    }, [profileName]);

    async function handleSave() {
        if (!name) return;
        try {
            await invoke("save_profile", { name, profile });
            setIsNew(false);
        } catch (e) {
            console.error(e);
            alert(t("error") + ": " + e);
        }
    }
    
    async function handleDelete() {
        if (!confirm(`${t("confirmDelete")} "${name}"?`)) return;
        try {
            await invoke("delete_profile", { name });
        } catch (e) {
            console.error(e);
        }
    }

    const currentProviderLabel = providers.find(p => p.id === profile.provider)?.label || profile.provider;

    return (
        <div className="p-6 text-[#cccccc] max-w-2xl mx-auto h-full overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 border-b border-[#3e3e42] pb-2">{isNew ? t("newProfile") : t("editProfile")}</h2>
            
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-1.5">{t("profileName")}</label>
                    <input
                        className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-2 text-white outline-none rounded-sm"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!isNew}
                        placeholder="e.g. My AWS Production"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1.5">{t("provider")}</label>
                    <div className="relative" ref={dropdownRef}>
                        <div 
                            className={clsx(
                                "w-full bg-[#3c3c3c] border p-2 text-white cursor-pointer rounded-sm flex items-center justify-between transition-colors",
                                isProviderOpen ? "border-[#007fd4]" : "border-[#3c3c3c]"
                            )}
                            onClick={() => setIsProviderOpen(!isProviderOpen)}
                        >
                            <span>{currentProviderLabel}</span>
                            {/* 图标位置：微调间距使其不再过于靠左 */}
                            <div className="mr-1">
                                <ChevronDown size={14} className={clsx("transition-transform duration-200", isProviderOpen && "rotate-180")} />
                            </div>
                        </div>

                        {isProviderOpen && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-[#252526] border border-[#454545] shadow-xl z-50 rounded-sm py-1 animate-menu-in">
                                {providers.map((p) => (
                                    <div
                                        key={p.id}
                                        className={clsx(
                                            "px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-[#094771] hover:text-white",
                                            profile.provider === p.id ? "bg-[#3c3c3c] text-white" : "text-[#cccccc]"
                                        )}
                                        onClick={() => {
                                            setProfile({ ...profile, provider: p.id });
                                            setIsProviderOpen(false);
                                        }}
                                    >
                                        {p.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">{t("accessKey")}</label>
                        <input
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-2 text-white outline-none rounded-sm font-mono"
                            value={profile.access_key}
                            onChange={(e) => setProfile({ ...profile, access_key: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">{t("secretKey")}</label>
                        <input
                            type="password"
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-2 text-white outline-none rounded-sm font-mono"
                            value={profile.secret_key}
                            onChange={(e) => setProfile({ ...profile, secret_key: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">{t("region")}</label>
                        <input
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-2 text-white outline-none rounded-sm"
                            value={profile.region}
                            onChange={(e) => setProfile({ ...profile, region: e.target.value })}
                            placeholder="e.g. us-east-1"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">{t("endpoint")} (Optional)</label>
                        <input
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-2 text-white outline-none rounded-sm"
                            value={profile.endpoint || ""}
                            onChange={(e) => setProfile({ ...profile, endpoint: e.target.value || undefined })}
                            placeholder="https://s3.example.com"
                        />
                    </div>
                </div>

                <div className="flex space-x-3 pt-6 border-t border-[#3e3e42]">
                    <button
                        className="flex items-center bg-[#0e639c] hover:bg-[#1177bb] text-white px-4 py-2 rounded-sm transition-colors"
                        onClick={handleSave}
                    >
                        <Save size={16} className="mr-2" /> {t("save")}
                    </button>
                    {!isNew && (
                        <button
                            className="flex items-center bg-[#3c3c3c] hover:bg-[#e81123] hover:text-white text-[#cccccc] px-4 py-2 rounded-sm transition-colors"
                            onClick={handleDelete}
                        >
                            <Trash2 size={16} className="mr-2" /> {t("delete")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
