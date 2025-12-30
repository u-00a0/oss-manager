import { useI18n } from "../contexts/I18nContext";
import { useStatusBar } from "../contexts/StatusBarContext";
import { useNotification } from "../contexts/NotificationContext";
import { Bell } from "lucide-react";
import clsx from "clsx";

export default function StatusBar() {
    const { t } = useI18n();
    const { leftItem, rightItem } = useStatusBar();
    const { notifications, toggleVisibility, isVisible } = useNotification();

    return (
        <div className="h-6 bg-[#007fd4] text-white text-xs flex items-center px-3 justify-between shrink-0 select-none cursor-default z-50">
            {/* Left Section (File info etc) */}
            <div className="flex items-center space-x-4">
                {leftItem || (
                     <div className="flex items-center space-x-1 hover:bg-[#1f8ad2] px-1 rounded cursor-pointer">
                        <span>{t("ready")}</span>
                    </div>
                )}
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-2">
                {rightItem}
                
                <div className="hover:bg-[#1f8ad2] px-1 rounded cursor-pointer hidden sm:block">
                    <span>UTF-8</span>
                </div>
                
                {/* Notification Bell */}
                <div 
                    className={clsx(
                        "hover:bg-[#1f8ad2] px-2 py-0.5 rounded cursor-pointer flex items-center relative ml-2",
                        isVisible && "bg-[#1f8ad2]"
                    )}
                    onClick={toggleVisibility}
                    title="Toggle Notifications"
                >
                    <Bell size={12} />
                    {notifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full h-3 w-3 flex items-center justify-center font-bold shadow-sm">
                            {notifications.length > 9 ? '9+' : notifications.length}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
