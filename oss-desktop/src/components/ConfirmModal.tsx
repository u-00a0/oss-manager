import { AlertTriangle, X } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({ 
    title, 
    message, 
    confirmText, 
    cancelText, 
    isDanger = false, 
    onConfirm, 
    onCancel 
}: ConfirmModalProps) {
    const { t } = useI18n();

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#252526] border border-[#454545] shadow-2xl rounded-lg w-full max-w-sm flex flex-col animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#3e3e42]">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className={isDanger ? "text-red-500" : "text-yellow-500"} />
                        <h3 className="font-semibold text-white">{title}</h3>
                    </div>
                    <button onClick={onCancel} className="text-[#858585] hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-4 text-[#cccccc] text-sm">
                    {message}
                </div>
                
                {/* Footer */}
                <div className="flex justify-end p-4 pt-0 space-x-2">
                    <button 
                        className="px-3 py-1.5 rounded hover:bg-[#3c3c3c] text-[#cccccc] text-xs"
                        onClick={onCancel}
                    >
                        {cancelText || t("cancel")}
                    </button>
                    <button 
                        className={`px-3 py-1.5 rounded text-white text-xs ${isDanger ? "bg-[#e81123] hover:bg-[#c4101e]" : "bg-[#0e639c] hover:bg-[#1177bb]"}`}
                        onClick={onConfirm}
                    >
                        {confirmText || t("delete")}
                    </button>
                </div>
            </div>
        </div>
    );
}
