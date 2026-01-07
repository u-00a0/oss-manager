import { useState, useEffect, useRef } from "react";
import { X, Save } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";

interface RenameModalProps {
    currentName: string;
    onRename: (newName: string) => void;
    onCancel: () => void;
}

export default function RenameModal({ currentName, onRename, onCancel }: RenameModalProps) {
    const { t } = useI18n();
    const [newName, setNewName] = useState(currentName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            // Select filename without extension if possible
            const lastDotIndex = currentName.lastIndexOf('.');
            if (lastDotIndex > 0) {
                inputRef.current.setSelectionRange(0, lastDotIndex);
            } else {
                inputRef.current.select();
            }
        }
    }, [currentName]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName && newName !== currentName) {
            onRename(newName);
        } else {
            onCancel();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#252526] border border-[#454545] shadow-2xl rounded-lg w-full max-w-sm flex flex-col animate-scale-in">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#3e3e42]">
                    <h3 className="font-semibold text-white">{t("rename")}</h3>
                    <button onClick={onCancel} className="text-[#858585] hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-4">
                    <input
                        ref={inputRef}
                        className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#007fd4] text-white px-2 py-1 outline-none rounded-sm"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    
                    <div className="flex justify-end mt-4 space-x-2">
                        <button 
                            type="button"
                            className="px-3 py-1 rounded hover:bg-[#3c3c3c] text-[#cccccc] text-sm"
                            onClick={onCancel}
                        >
                            {t("cancel")}
                        </button>
                        <button 
                            type="submit"
                            className="px-3 py-1 rounded bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm flex items-center"
                        >
                            <Save size={14} className="mr-1" />
                            {t("save")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
