import { useMemo } from "react";
import TabBar from "./TabBar";
import FileBrowser from "../views/FileBrowser";
import FileDetails from "../views/FileDetails";
import ProfilesView from "../views/ProfilesView";
import SettingsView from "../views/SettingsView";
import ShortcutsView from "../views/ShortcutsView";
import TransferDashboard from "../views/TransferDashboard";
import { useI18n } from "../contexts/I18nContext";
import type { Tab } from "../types";

interface EditorGroupProps {
    groupId: string;
    tabs: Tab[];
    activeTabId: string | null;
    isActiveGroup: boolean;
    onTabClick: (groupId: string, tabId: string) => void;
    onTabClose: (groupId: string, tabId: string) => void;
    onReorder: (groupId: string, oldIndex: number, newIndex: number) => void;
    onTabOut: (groupId: string, tabId: string) => void;
    onSplit?: (groupId: string) => void;
    onActivateGroup: (groupId: string) => void;
    // For file operations
    onOpenFile: (profile: string, bucket: string, fileKey: string) => void;
}

export default function EditorGroup({
    groupId,
    tabs,
    activeTabId,
    isActiveGroup,
    onTabClick,
    onTabClose,
    onReorder,
    onTabOut,
    onSplit,
    onActivateGroup,
    onOpenFile
}: EditorGroupProps) {
    const { t } = useI18n();

    // Prepare tabs with 'active' flag for the TabBar component
    const tabBarTabs = useMemo(() => {
        return tabs.map(t => ({
            ...t,
            active: t.id === activeTabId
        }));
    }, [tabs, activeTabId]);

    const activeTab = tabs.find(t => t.id === activeTabId);

    const renderContent = () => {
        if (!activeTab) {
            return (
                <div className="flex-1 flex items-center justify-center text-[#3e3e42] select-none h-full bg-[#1e1e1e]">
                    <div className="flex flex-col items-center">
                        <div className="codicon codicon-telescope text-6xl mb-4"></div>
                        <p>{t("selectBucket")}</p>
                    </div>
                </div>
            );
        }

        switch (activeTab.type) {
            case "file-browser": {
                const data = activeTab.data;
                if (!data) return <div>{t("error")}: Missing tab data</div>;
                return <FileBrowser
                          profile={data.profile}
                          bucket={data.bucket}
                          isActive={isActiveGroup}
                          onOpenFile={(key) => onOpenFile(data.profile, data.bucket, key)}
                       />;
            }
            case "file-details": {
                const data = activeTab.data;
                if (!data || !data.fileKey) return <div>{t("error")}: Missing file key</div>;
                return <FileDetails
                          profile={data.profile}
                          bucket={data.bucket}
                          fileKey={data.fileKey}
                       />;
            }
            case "profiles": return <ProfilesView />;
            case "settings": return <SettingsView />;
            case "shortcuts": return <ShortcutsView />;
            case "transfers": return <TransferDashboard />;
            default: return <div>Unknown Tab Type</div>;
        }
    };

    return (
        <div 
            className="flex flex-col h-full min-w-0" 
            onClick={() => onActivateGroup(groupId)}
        >
            <TabBar 
                tabs={tabBarTabs}
                onTabClick={(id) => onTabClick(groupId, id)}
                onTabClose={(id) => onTabClose(groupId, id)}
                onReorder={(o, n) => onReorder(groupId, o, n)}
                onTabOut={(id) => onTabOut(groupId, id)}
                onSplit={onSplit ? () => onSplit(groupId) : undefined}
                remoteTab={null} // We'll handle this at App level later if needed
            />
            <div className="flex-1 overflow-hidden relative">
                {renderContent()}
                
                {/* Dim overlay for inactive groups (optional, VSCode doesn't really dim, but focuses border) */}
                {/* {!isActiveGroup && <div className="absolute inset-0 bg-black/5 pointer-events-none" />} */}
            </div>
        </div>
    );
}
