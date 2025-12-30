import React, { createContext, useContext, useState } from 'react';

interface StatusBarContextType {
    leftItem: React.ReactNode;
    setLeftItem: (item: React.ReactNode) => void;
    rightItem: React.ReactNode;
    setRightItem: (item: React.ReactNode) => void;
}

const StatusBarContext = createContext<StatusBarContextType | undefined>(undefined);

export function StatusBarProvider({ children }: { children: React.ReactNode }) {
    const [leftItem, setLeftItem] = useState<React.ReactNode>(null);
    const [rightItem, setRightItem] = useState<React.ReactNode>(null);

    return (
        <StatusBarContext.Provider value={{ leftItem, setLeftItem, rightItem, setRightItem }}>
            {children}
        </StatusBarContext.Provider>
    );
}

export function useStatusBar() {
    const context = useContext(StatusBarContext);
    if (!context) {
        throw new Error('useStatusBar must be used within a StatusBarProvider');
    }
    return context;
}
