import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface ProgressPayload {
    path: string;
    transferred: number;
    total: number;
}

export interface TransferTaskParams {
    profile: string;
    bucket: string;
    localPath: string;
    remotePath: string;
    isDir: boolean;
}

export interface TransferTask {
    id: string; // usually path
    type: 'upload' | 'download';
    name: string;
    transferred: number;
    total: number;
    speed: number; // bytes/sec
    status: 'running' | 'completed' | 'failed' | 'paused';
    startTime: number;
    params?: TransferTaskParams;
}

export interface HistoryPoint {
    time: string;
    uploadSpeed: number;
    downloadSpeed: number;
}

interface TransferContextType {
    tasks: Record<string, TransferTask>;
    history: HistoryPoint[];
    currentUploadSpeed: number;
    currentDownloadSpeed: number;
    registerTask: (path: string, type: 'upload' | 'download', params?: TransferTaskParams) => void;
    cancelTask: (id: string) => void;
    cancelAll: () => void;
    pauseTask: (id: string) => void;
    resumeTask: (id: string) => void;
    pauseAll: () => void;
    resumeAll: () => void;
}

const TransferContext = createContext<TransferContextType | undefined>(undefined);

export function TransferProvider({ children }: { children: React.ReactNode }) {
    const [tasks, setTasks] = useState<Record<string, TransferTask>>({});
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    
    const [currentUploadSpeed, setCurrentUploadSpeed] = useState(0);
    const [currentDownloadSpeed, setCurrentDownloadSpeed] = useState(0);

    const taskRefs = useRef<Record<string, { lastBytes: number, lastTime: number, speed: number }>>({});

    const registerTask = (path: string, type: 'upload' | 'download', params?: TransferTaskParams) => {
        setTasks(prev => ({
            ...prev,
            [path]: {
                id: path,
                type,
                name: path.split(/[/\\]/).pop() || path,
                transferred: 0,
                total: 0,
                speed: 0,
                status: 'running',
                startTime: Date.now(),
                params
            }
        }));
        taskRefs.current[path] = { lastBytes: 0, lastTime: Date.now(), speed: 0 };
    };

    const cancelTask = async (id: string) => {
        try {
            await invoke("cancel_transfer", { path: id });
            setTasks(prev => {
                if (!prev[id]) return prev;
                return {
                    ...prev,
                    [id]: { ...prev[id], status: 'failed', speed: 0 }
                };
            });
        } catch (e) {
            console.error("Failed to cancel task", e);
        }
    };

    const pauseTask = async (id: string) => {
        try {
            await invoke("cancel_transfer", { path: id });
            setTasks(prev => {
                if (!prev[id]) return prev;
                return {
                    ...prev,
                    [id]: { ...prev[id], status: 'paused', speed: 0 }
                };
            });
        } catch (e) {
            console.error(e);
        }
    };

    const resumeTask = async (id: string) => {
        // Need current tasks state
        setTasks(prev => {
            const task = prev[id];
            if (!task || !task.params) return prev;

            if (task.type === 'upload') {
                invoke("upload_file", {
                    profileName: task.params.profile,
                    bucket: task.params.bucket,
                    localPath: task.params.localPath,
                    destPrefix: task.params.remotePath
                }).catch(console.error);
            } else {
                invoke("download_file", {
                    profileName: task.params.profile,
                    bucket: task.params.bucket,
                    key: task.params.remotePath,
                    localPath: task.params.localPath,
                    isDir: task.params.isDir
                }).catch(console.error);
            }
            
            return {
                ...prev,
                [id]: { ...prev[id], status: 'running' }
            };
        });
    };

    const cancelAll = () => {
        Object.values(tasks).forEach(task => {
            if (task.status === 'running' || task.status === 'paused') {
                cancelTask(task.id);
            }
        });
    };

    const pauseAll = () => {
        Object.values(tasks).forEach(task => {
            if (task.status === 'running') {
                pauseTask(task.id);
            }
        });
    };

    const resumeAll = () => {
        Object.values(tasks).forEach(task => {
            if (task.status === 'paused') {
                resumeTask(task.id);
            }
        });
    };

    // Listeners
    useEffect(() => {
        let unlistenUpload: () => void;
        let unlistenDownload: () => void;

        const handleProgress = (type: 'upload' | 'download', payload: ProgressPayload) => {
            const { path, transferred, total } = payload;
            const now = Date.now();
            
            if (!taskRefs.current[path]) {
                taskRefs.current[path] = { lastBytes: 0, lastTime: now, speed: 0 };
            }
            
            const tracker = taskRefs.current[path];
            const timeDiff = (now - tracker.lastTime) / 1000;
            
            let speed = tracker.speed;
            if (timeDiff >= 0.5) { 
                const bytesDiff = transferred - tracker.lastBytes;
                speed = bytesDiff / timeDiff;
                tracker.lastBytes = transferred;
                tracker.lastTime = now;
                tracker.speed = speed;
            }

            setTasks(prev => {
                const existing = prev[path];
                // Auto-create if not exists (for robustness)
                if (!existing) {
                     return {
                         ...prev,
                         [path]: {
                             id: path,
                             type,
                             name: path.split(/[/\\]/).pop() || path,
                             transferred,
                             total,
                             speed,
                             status: transferred >= total && total > 0 ? 'completed' : 'running',
                             startTime: now
                         }
                     };
                }
                
                // If complete
                const isComplete = transferred >= total && total > 0;
                
                return {
                    ...prev,
                    [path]: {
                        ...existing,
                        transferred,
                        total,
                        speed: isComplete ? 0 : speed,
                        status: isComplete ? 'completed' : 'running'
                    }
                };
            });
        };

        const setup = async () => {
            unlistenUpload = await listen<ProgressPayload>('upload-progress', (e) => handleProgress('upload', e.payload));
            unlistenDownload = await listen<ProgressPayload>('download-progress', (e) => handleProgress('download', e.payload));
        };
        setup();

        return () => {
            if (unlistenUpload) unlistenUpload();
            if (unlistenDownload) unlistenDownload();
        };
    }, []);

    // Global Speed & History Ticker
    useEffect(() => {
        const interval = setInterval(() => {
            let totalUp = 0;
            let totalDown = 0;
            
            // Calculate aggregate speed from TASKS state
            Object.values(tasks).forEach(task => {
                if (task.status === 'running') {
                    if (task.type === 'upload') totalUp += task.speed;
                    if (task.type === 'download') totalDown += task.speed;
                }
            });

            setCurrentUploadSpeed(totalUp);
            setCurrentDownloadSpeed(totalDown);

            setHistory(prev => {
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
                const newPoint = { time: timeStr, uploadSpeed: totalUp, downloadSpeed: totalDown };
                
                // Keep last 60 points
                const newHistory = [...prev, newPoint];
                if (newHistory.length > 60) return newHistory.slice(newHistory.length - 60);
                return newHistory;
            });

        }, 1000);

        return () => clearInterval(interval);
    }, [tasks]);

    return (
        <TransferContext.Provider value={{ 
            tasks, history, currentUploadSpeed, currentDownloadSpeed, 
            registerTask, cancelTask, cancelAll,
            pauseTask, resumeTask, pauseAll, resumeAll
        }}>
            {children}
        </TransferContext.Provider>
    );
}

export const useTransfer = () => {
    const context = useContext(TransferContext);
    if (!context) throw new Error("useTransfer must be used within TransferProvider");
    return context;
};
