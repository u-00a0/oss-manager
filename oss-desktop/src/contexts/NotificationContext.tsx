import React, { createContext, useContext, useState, useCallback } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface Notification {
    id: string;
    title: string;
    message?: string;
    type: NotificationType;
    progress?: number; // 0-100, undefined for indeterminate
    autoClose?: boolean; // Defaults to true for non-progress
    duration?: number; // Defaults to 3000ms
}

interface NotificationContextType {
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id'>) => string;
    updateNotification: (id: string, updates: Partial<Notification>) => void;
    removeNotification: (id: string) => void;
    isVisible: boolean;
    setIsVisible: (visible: boolean) => void;
    toggleVisibility: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isVisible, setIsVisible] = useState(true);

    const toggleVisibility = useCallback(() => setIsVisible(v => !v), []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newNotification: Notification = { 
            id, 
            ...notification,
            autoClose: notification.autoClose ?? (notification.type !== 'progress')
        };
        
        setNotifications(prev => [...prev, newNotification]);

        if (newNotification.autoClose) {
            setTimeout(() => {
                removeNotification(id);
            }, notification.duration || 3000);
        }

        return id;
    }, [removeNotification]);

    const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
        setNotifications(prev => prev.map(n => {
            if (n.id === id) {
                const updated = { ...n, ...updates };
                // Handle auto-close trigger on update (e.g., progress -> success)
                // Only if the new type is NOT progress, and autoClose wasn't explicitly set to false
                if (updates.type && updates.type !== 'progress' && updated.autoClose !== false) {
                    // Use a timeout to allow user to see the success state briefly
                     setTimeout(() => {
                        removeNotification(id);
                    }, updated.duration || 3000);
                }
                return updated;
            }
            return n;
        }));
    }, [removeNotification]);

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            addNotification, 
            updateNotification, 
            removeNotification,
            isVisible,
            setIsVisible,
            toggleVisibility
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
