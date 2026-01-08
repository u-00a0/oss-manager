import { useState } from "react";
import { Files, Settings, Sliders, Activity } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "../contexts/I18nContext";

interface ActivityBarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onOpenSettings: () => void;
    onOpenShortcuts: () => void;
    isSettingsTabActive: boolean;
}

export default function ActivityBar({ activeTab, onTabChange, onOpenSettings, onOpenShortcuts, isSettingsTabActive }: ActivityBarProps) {
    const { t } = useI18n();
    const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);

    const toggleSettingsMenu = () => setIsSettingsMenuOpen(!isSettingsMenuOpen);
    const closeSettingsMenu = () => setIsSettingsMenuOpen(false);

    return (
        <div className="w-12 bg-[#333333] flex flex-col items-center py-2 space-y-4 shrink-0 relative z-40">
            <ActivityItem
                icon={<Files size={24} />}
                active={activeTab === "files"}
                onClick={() => {
                    closeSettingsMenu();
                    onTabChange("files");
                }}
                title={t("explorer")}
            />
            <ActivityItem
                icon={<Sliders size={24} />}
                active={activeTab === "profiles"}
                onClick={() => {
                    closeSettingsMenu();
                    onTabChange("profiles");
                }}
                title={t("profiles")}
            />
            <ActivityItem
                icon={<Activity size={24} />}
                active={activeTab === "transfers"}
                onClick={() => {
                    closeSettingsMenu();
                    onTabChange("transfers");
                }}
                title={t("transfers")}
            />

            <div className="flex-1" />

            <div className="relative">
                <ActivityItem
                    icon={<Settings size={24} />}
                    active={isSettingsTabActive || isSettingsMenuOpen}
                    onClick={toggleSettingsMenu}
                    title={t("settings")}
                />

                {isSettingsMenuOpen && (
                    <>
                        {/* Backdrop to close menu on click outside */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={closeSettingsMenu}
                        />

                        {/* Menu */}
                        <div className="absolute left-10 bottom-0 bg-[#252526] border border-[#454545] shadow-xl text-[#cccccc] text-xs min-w-[200px] z-50 rounded-sm py-1 select-none animate-menu-in">
                            <MenuItem
                                label={t("keyboardShortcuts")}
                                onClick={() => {
                                    onOpenShortcuts();
                                    closeSettingsMenu();
                                }} 
                            />
                            <MenuItem
                                label={t("settings")}
                                onClick={() => {
                                    onOpenSettings();
                                    closeSettingsMenu();
                                }}
                            />
                            <div className="border-t border-[#454545] my-1 mx-2" />
                            <MenuItem
                                label={t("checkForUpdates")}
                                onClick={() => {
                                    console.log("Check for Updates clicked");
                                    closeSettingsMenu();
                                }}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
function ActivityItem({ icon, active, onClick, title }: { icon: React.ReactNode, active: boolean, onClick: () => void, title: string }) {
    return (
        <div
            className={clsx(
                "p-2 cursor-pointer transition-colors relative flex justify-center",
                active ? "text-white" : "text-[#858585] hover:text-[#e7e7e7]"
            )}
            onClick={onClick}
            title={title}
        >
            {active && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white" />}
            {icon}
        </div>
    )
}

function MenuItem({ label, onClick }: { label: string, onClick: () => void }) {
    return (
        <div 
            className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer flex items-center"
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
            {label}
        </div>
    )
}