import { useNotification } from '../contexts/NotificationContext';
import NotificationItem from './NotificationItem';
import { ChevronDown } from 'lucide-react';
import { useI18n } from "../contexts/I18nContext";

export default function NotificationCenter() {
    const { t } = useI18n();
    const { notifications, isVisible, toggleVisibility } = useNotification();

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-9 right-4 z-[9999] flex flex-col items-end pointer-events-none max-h-[calc(100vh-60px)]">
            {notifications.length > 0 && (
                <div className="pointer-events-auto bg-[#252526] border border-[#454545] text-[#cccccc] text-xs px-3 py-1.5 mb-2 rounded-sm flex items-center gap-4 shadow-lg select-none">
                    <span className="font-semibold">{t("notifications")}</span>
                    <div className="flex items-center gap-1">
                         <span className="bg-[#007fd4] text-white px-1.5 rounded-full text-[10px] min-w-[16px] text-center">{notifications.length}</span>
                         <button onClick={toggleVisibility} className="hover:text-white ml-1" title={t("collapse")}>
                            <ChevronDown size={14} />
                         </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col items-end overflow-y-auto w-[320px] pr-1 pb-2 pointer-events-none">
                {notifications.map(notification => (
                    <NotificationItem key={notification.id} notification={notification} />
                ))}
            </div>
        </div>
    );
}
