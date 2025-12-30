import React from 'react';
import { useNotification } from '../contexts/NotificationContext';
import NotificationItem from './NotificationItem';

export default function NotificationCenter() {
    const { notifications } = useNotification();

    return (
        <div className="fixed bottom-8 right-4 z-[9999] flex flex-col items-end pointer-events-none">
            {notifications.map(notification => (
                <NotificationItem key={notification.id} notification={notification} />
            ))}
        </div>
    );
}
