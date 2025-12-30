import React from "react";

interface SidebarProps {
    title: string;
    children: React.ReactNode;
}

export default function Sidebar({ title, children }: SidebarProps) {
    return (
        <div className="w-64 bg-[#252526] border-r border-[#1e1e1e] flex flex-col shrink-0">
            <div className="h-9 px-4 flex items-center text-xs font-bold text-[#bbbbbb] uppercase tracking-wide">
                {title}
            </div>
            <div className="flex-1 overflow-auto">
                {children}
            </div>
        </div>
    );
}
