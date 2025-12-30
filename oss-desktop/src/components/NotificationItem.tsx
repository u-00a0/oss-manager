import { X, Info, CheckCircle, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import type { Notification } from '../contexts/NotificationContext';

const icons = {
    info: <Info size={16} className="text-blue-400" />,
    success: <CheckCircle size={16} className="text-green-400" />,
    warning: <AlertTriangle size={16} className="text-yellow-400" />,
    error: <AlertCircle size={16} className="text-red-400" />,
    progress: <Loader2 size={16} className="text-blue-400 animate-spin" />
};

export default function NotificationItem({ notification }: { notification: Notification }) {
    const { removeNotification } = useNotification();
    
    return (
        <div className="w-[300px] bg-[#252526] border border-[#454545] shadow-lg rounded-sm mb-2 pointer-events-auto flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex p-3 gap-3">
                <div className="mt-0.5 shrink-0">
                    {icons[notification.type]}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-[#cccccc] leading-tight mb-1">{notification.title}</h4>
                    {notification.message && (
                        <p className="text-xs text-[#999999] break-words">{notification.message}</p>
                    )}
                </div>
                <button 
                    onClick={() => removeNotification(notification.id)}
                    className="shrink-0 text-[#999999] hover:text-white self-start"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Progress Bar */}
            {notification.type === 'progress' && (
                <div className="h-1 w-full bg-[#3c3c3c] overflow-hidden relative">
                    {notification.progress !== undefined ? (
                        <div
                            className="h-full bg-[#007fd4] transition-all duration-300"
                            style={{ width: `${notification.progress}%` }}
                        />
                    ) : (
                        <div className="absolute top-0 left-0 h-full w-1/3 bg-[#007fd4] animate-[indeterminate_1.5s_infinite_linear]" />
                    )}
                </div>
            )}
        </div>
    );
}