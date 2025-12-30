import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Profiles } from "../types";
import { Database, ChevronRight, ChevronDown } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";

interface ExplorerSidebarProps {
    onBucketSelect: (profile: string, bucket: string) => void;
}

export default function ExplorerSidebar({ onBucketSelect }: ExplorerSidebarProps) {
    const { t } = useI18n();
    const [profiles, setProfiles] = useState<Profiles>({});
    const [expandedProfiles, setExpandedProfiles] = useState<Record<string, boolean>>({});
    const [buckets, setBuckets] = useState<Record<string, string[]>>({});
    const [loadingBuckets, setLoadingBuckets] = useState<Record<string, boolean>>({});

    useEffect(() => {
        async function loadProfiles() {
            try {
                const res = await invoke<Profiles>("list_profiles");
                setProfiles(res);
                // Auto-expand the first profile if exists
                const names = Object.keys(res);
                if (names.length > 0) {
                    toggleProfile(names[0]);
                }
            } catch (e) {
                console.error(e);
            }
        }
        loadProfiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function toggleProfile(name: string) {
        const isExpanded = !!expandedProfiles[name];
        setExpandedProfiles(prev => ({ ...prev, [name]: !isExpanded }));

        if (!isExpanded && !buckets[name]) {
            setLoadingBuckets(prev => ({ ...prev, [name]: true }));
            try {
                const res = await invoke<string[]>("list_buckets", { profileName: name });
                setBuckets(prev => ({ ...prev, [name]: res }));
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingBuckets(prev => ({ ...prev, [name]: false }));
            }
        }
    }

    return (
        <div className="flex flex-col h-full text-[#cccccc]">
            <div className="flex-1 overflow-auto">
                {Object.keys(profiles).map(profileName => (
                    <div key={profileName}>
                        <div
                            className="flex items-center px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer select-none"
                            onClick={() => toggleProfile(profileName)}
                        >
                            {expandedProfiles[profileName] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span className="ml-1 font-bold text-xs uppercase">{profileName}</span>
                        </div>

                        {expandedProfiles[profileName] && (
                            <div>
                                {loadingBuckets[profileName] && <div className="pl-6 text-xs text-[#858585]">{t("loading")}</div>}
                                {buckets[profileName]?.map(bucket => (
                                    <div
                                        key={bucket}
                                        className="flex items-center pl-6 pr-2 py-1 hover:bg-[#2a2d2e] cursor-pointer text-sm"
                                        onClick={() => onBucketSelect(profileName, bucket)}
                                    >
                                        <Database size={14} className="mr-2 text-yellow-500" />
                                        <span className="truncate">{bucket}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}