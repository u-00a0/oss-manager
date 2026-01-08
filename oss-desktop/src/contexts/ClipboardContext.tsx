import React, { createContext, useContext, useState } from 'react';

export interface ClipboardItem {
    profile: string;
    bucket: string;
    key: string;
    isDir: boolean;
}

interface ClipboardContextType {
    items: ClipboardItem[];
    operation: 'copy' | 'move' | null;
    setClipboard: (items: ClipboardItem[], operation: 'copy' | 'move') => void;
    clearClipboard: () => void;
}

const ClipboardContext = createContext<ClipboardContextType | undefined>(undefined);

export function ClipboardProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<ClipboardItem[]>([]);
    const [operation, setOperation] = useState<'copy' | 'move' | null>(null);

    const setClipboard = (newItems: ClipboardItem[], op: 'copy' | 'move') => {
        setItems(newItems);
        setOperation(op);
    };

    const clearClipboard = () => {
        setItems([]);
        setOperation(null);
    };

    return (
        <ClipboardContext.Provider value={{ items, operation, setClipboard, clearClipboard }}>
            {children}
        </ClipboardContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClipboard() {
    const context = useContext(ClipboardContext);
    if (!context) {
        throw new Error('useClipboard must be used within a ClipboardProvider');
    }
    return context;
}
