import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Profile, Profiles, S3Provider } from "../types";
import { Plus, Trash2, Save, X } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";

export default function ProfilesView() {
    const { t } = useI18n();
    const [profiles, setProfiles] = useState<Profiles>({});
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editProfile, setEditProfile] = useState<Profile>({
        provider: "Aws",
        access_key: "",
        secret_key: "",
        region: "us-east-1",
    });

    async function loadProfiles() {
        try {
            const res = await invoke<Profiles>("list_profiles");
            setProfiles(res);
        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        // eslint-disable-next-line
        loadProfiles();
    }, []);

    async function handleSave() {
        if (!editName) return;
        try {
            await invoke("save_profile", { name: editName, profile: editProfile });
            setIsEditing(false);
            loadProfiles();
        } catch (e) {
            console.error(e);
            alert(t("error") + ": " + e);
        }
    }

    async function handleDelete(name: string) {
        if (!confirm(`${t("confirmDelete")} "${name}"?`)) return;
        try {
            await invoke("delete_profile", { name });
            loadProfiles();
        } catch (e) {
            console.error(e);
        }
    }

    function startEdit(name?: string, profile?: Profile) {
        if (name && profile) {
            setEditName(name);
            setEditProfile({ ...profile });
        } else {
            setEditName("");
            setEditProfile({
                provider: "Aws",
                access_key: "",
                secret_key: "",
                region: "us-east-1",
            });
        }
        setIsEditing(true);
    }

    if (isEditing) {
        return (
            <div className="p-4 text-[#cccccc]">
                <h2 className="text-xl font-bold mb-4">{editName ? t("editProfile") : t("newProfile")}</h2>
                <div className="space-y-3 max-w-md">
                    <div>
                        <label className="block text-xs mb-1">{t("profileName")}</label>
                        <input
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-1 text-white outline-none"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={!!profiles[editName] && editName !== ""}
                        />
                    </div>
                    <div>
                        <label className="block text-xs mb-1">{t("provider")}</label>
                        <select
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] p-1 text-white outline-none"
                            value={editProfile.provider}
                            onChange={(e) => setEditProfile({ ...editProfile, provider: e.target.value as S3Provider })}
                        >
                            <option value="Aws">AWS</option>
                            <option value="CloudflareR2">Cloudflare R2</option>
                            <option value="Aliyun">Aliyun (Alibaba Cloud)</option>
                            <option value="Tencent">Tencent Cloud</option>
                            <option value="Custom">Custom / MinIO</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs mb-1">{t("accessKey")}</label>
                        <input
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-1 text-white outline-none"
                            value={editProfile.access_key}
                            onChange={(e) => setEditProfile({ ...editProfile, access_key: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs mb-1">{t("secretKey")}</label>
                        <input
                            type="password"
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-1 text-white outline-none"
                            value={editProfile.secret_key}
                            onChange={(e) => setEditProfile({ ...editProfile, secret_key: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs mb-1">{t("region")}</label>
                        <input
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-1 text-white outline-none"
                            value={editProfile.region}
                            onChange={(e) => setEditProfile({ ...editProfile, region: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs mb-1">{t("endpoint")} (Optional)</label>
                        <input
                            className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] p-1 text-white outline-none"
                            value={editProfile.endpoint || ""}
                            onChange={(e) => setEditProfile({ ...editProfile, endpoint: e.target.value || undefined })}
                            placeholder="https://s3.example.com"
                        />
                    </div>
                    <div className="flex space-x-2 pt-4">
                        <button
                            className="flex items-center bg-[#0e639c] hover:bg-[#1177bb] text-white px-3 py-1 rounded-sm"
                            onClick={handleSave}
                        >
                            <Save size={16} className="mr-1" /> {t("save")}
                        </button>
                        <button
                            className="flex items-center bg-[#3c3c3c] hover:bg-[#4d4d4d] text-white px-3 py-1 rounded-sm"
                            onClick={() => setIsEditing(false)}
                        >
                            <X size={16} className="mr-1" /> {t("cancel")}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-2 border-b border-[#2d2d2d] flex justify-between items-center">
                <span className="font-bold text-[#e7e7e7]">{t("profiles")}</span>
                <button
                    className="p-1 hover:bg-[#3c3c3c] rounded text-[#e7e7e7]"
                    onClick={() => startEdit()}
                    title={t("newProfile")}
                >
                    <Plus size={16} />
                </button>
            </div>
            <div className="flex-1 overflow-auto">
                {Object.entries(profiles).length === 0 && (
                    <div className="p-4 text-[#858585] text-center">{t("noProfiles")}</div>
                )}
                {Object.entries(profiles).map(([name, profile]) => (
                    <div key={name} className="flex justify-between items-center p-2 hover:bg-[#2a2d2e] group cursor-pointer" onClick={() => startEdit(name, profile)}>
                        <div className="flex flex-col">
                            <span className="text-[#e7e7e7] font-medium">{name}</span>
                            <span className="text-xs text-[#858585]">{profile.provider} - {profile.region}</span>
                        </div>
                        <button
                            className="p-1 hover:bg-[#3c3c3c] rounded text-[#e7e7e7] opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); handleDelete(name); }}
                            title={t("delete")}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}