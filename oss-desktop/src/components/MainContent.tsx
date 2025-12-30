import React from "react";

interface MainContentProps {
    children: React.ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] overflow-hidden relative">
            {children}
        </div>
    );
}
