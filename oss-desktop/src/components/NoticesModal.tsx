/// <reference types="vite/client" />
import { useState } from "react";
import { X, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import hmosLicense from "../assets/license/HMOS.txt?raw";
import apacheLicense from "../assets/license/Apache_License-2.0.txt?raw";
import mitLicense from "../assets/license/MIT_License.txt?raw";
import iscLicense from "../assets/license/ISC_License.txt?raw";

interface NoticesModalProps {
    onClose: () => void;
}

interface LicenseItem {
    name: string;
    licenseName: string;
    content: string;
}

const items: LicenseItem[] = [
    { name: "aws-sdk-rust", licenseName: "Apache License 2.0", content: apacheLicense },
    { name: "dnd-kit", licenseName: "MIT License", content: mitLicense },
    { name: "HarmonyOS Sans Fonts", licenseName: "HarmonyOS Sans Fonts License", content: hmosLicense },
    { name: "Lucide Icons", licenseName: "ISC License", content: `${iscLicense}\n\n=================================================================\n\n${mitLicense}` }, 
    { name: "React", licenseName: "MIT License", content: mitLicense },
    { name: "Recharts", licenseName: "MIT License", content: mitLicense },
    { name: "sqlx", licenseName: "MIT / Apache-2.0", content: `${mitLicense}\n\n=================================================================\n\n${apacheLicense}` },
    { name: "Tailwind CSS", licenseName: "MIT License", content: mitLicense },
    { name: "Tauri", licenseName: "MIT / Apache-2.0", content: `${mitLicense}\n\n=================================================================\n\n${apacheLicense}` },
];

export default function NoticesModal({ onClose }: NoticesModalProps) {
    const [selectedItem, setSelectedItem] = useState<LicenseItem | null>(null);

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#252526] border border-[#454545] shadow-2xl rounded-lg w-full max-w-lg flex flex-col animate-scale-in h-[500px]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#3e3e42] shrink-0">
                    <div className="flex items-center gap-2">
                        {selectedItem ? (
                            <button 
                                onClick={() => setSelectedItem(null)} 
                                className="mr-1 hover:bg-[#3c3c3c] rounded p-0.5 text-[#cccccc]"
                            >
                                <ChevronLeft size={18} />
                            </button>
                        ) : (
                            <FileText size={18} className="text-[#cccccc]" />
                        )}
                        <h3 className="font-semibold text-white">
                            {selectedItem ? selectedItem.name : "Open Source Notices"}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-[#858585] hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-hidden relative">
                    <div 
                        className="absolute inset-0 flex w-[200%] transition-transform duration-300 ease-in-out"
                        style={{ transform: selectedItem ? 'translateX(-50%)' : 'translateX(0)' }}
                    >
                        {/* List View */}
                        <div className="w-1/2 h-full overflow-y-auto">
                            {items.map((item, index) => (
                                <div 
                                    key={index}
                                    className="px-4 py-3 border-b border-[#3e3e42] hover:bg-[#2a2d2e] cursor-pointer flex items-center justify-between group"
                                    onClick={() => setSelectedItem(item)}
                                >
                                    <div>
                                        <div className="text-sm text-white font-medium mb-0.5">{item.name}</div>
                                        <div className="text-xs text-[#858585]">{item.licenseName}</div>
                                    </div>
                                    <ChevronRight size={16} className="text-[#505050] group-hover:text-[#cccccc]" />
                                </div>
                            ))}
                        </div>

                        {/* Detail View */}
                        <div className="w-1/2 h-full overflow-y-auto p-4 text-[#cccccc] text-xs whitespace-pre-wrap leading-relaxed select-text font-mono bg-[#1e1e1e]">
                            {selectedItem?.content}
                        </div>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="p-3 border-t border-[#3e3e42] flex justify-end bg-[#252526] shrink-0">
                    <button 
                        className="px-4 py-1.5 rounded hover:bg-[#3c3c3c] text-[#cccccc] text-sm border border-[#3c3c3c]"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}