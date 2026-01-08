import { useTransfer } from "../contexts/TransferContext";
import { useI18n } from "../contexts/I18nContext";
import { ArrowUp, ArrowDown, ExternalLink, Folder, File, Pause, Play, Square, CheckCircle, XCircle } from "lucide-react";
import clsx from "clsx";

interface TransferSidebarProps {
    onOpenDashboard: () => void;
}

export default function TransferSidebar({ onOpenDashboard }: TransferSidebarProps) {
    const { t } = useI18n();
    const { tasks, pauseTask, resumeTask, cancelTask } = useTransfer();

    const activeTasks = Object.values(tasks)
        .filter(t => t.status === 'running' || t.status === 'paused')
        .sort((a, b) => b.startTime - a.startTime);
        
    const completedTasks = Object.values(tasks)
        .filter(t => t.status === 'completed' || t.status === 'failed')
        .sort((a, b) => b.startTime - a.startTime);

    function formatSize(bytes: number) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    return (
        <div className="h-full flex flex-col bg-[#252526]">
            {/* Header / Actions */}
            <div className="p-2 border-b border-[#3e3e42]">
                <button
                    className="w-full flex items-center justify-center gap-2 bg-[#0e639c] hover:bg-[#1177bb] text-white py-1.5 rounded text-xs transition-colors"
                    onClick={onOpenDashboard}
                >
                    <ExternalLink size={14} />
                    <span>{t("viewDetails")}</span>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {/* Active Section */}
                <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold text-[#cccccc] uppercase tracking-wider flex justify-between items-center">
                        <span>{t("activeTransfers")}</span>
                        <span className="bg-[#3c3c3c] text-[#cccccc] px-1.5 rounded-full text-[10px]">{activeTasks.length}</span>
                    </div>
                    
                    <div className="mt-1">
                        {activeTasks.length === 0 && (
                            <div className="px-4 py-2 text-[#858585] text-xs italic">{t("noActiveTransfers")}</div>
                        )}
                        {activeTasks.map(task => (
                            <div key={task.id} className="px-3 py-2 hover:bg-[#2a2d2e] border-l-2 border-transparent hover:border-[#007fd4] group">
                                <div className="flex items-center gap-2 mb-1 overflow-hidden">
                                    <div className="shrink-0">
                                        {task.type === 'upload' ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-green-400" />}
                                    </div>
                                    <div className="shrink-0">
                                        {task.isDir ? <Folder size={14} className="text-[#dcb67a]" /> : <File size={14} className="text-[#cccccc]" />}
                                    </div>
                                    <span className="text-xs text-[#cccccc] truncate flex-1" title={task.name}>{task.name}</span>
                                </div>
                                
                                <div className="w-full bg-[#3c3c3c] h-1 rounded-full overflow-hidden mb-1">
                                    <div 
                                        className={clsx("h-full transition-all duration-200", task.status === 'paused' ? "bg-yellow-500" : "bg-[#007fd4]")} 
                                        style={{ width: `${(task.transferred / task.total) * 100}%` }} 
                                    />
                                </div>
                                
                                <div className="flex justify-between items-center text-[10px] text-[#858585]">
                                    <span>{formatSize(task.speed)}/s</span>
                                    
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {task.status === 'running' ? (
                                            <button onClick={() => pauseTask(task.id)} className="hover:text-yellow-500" title="Pause"><Pause size={12} /></button>
                                        ) : (
                                            <button onClick={() => resumeTask(task.id)} className="hover:text-green-500" title="Resume"><Play size={12} /></button>
                                        )}
                                        <button onClick={() => cancelTask(task.id)} className="hover:text-red-500" title="Cancel"><Square size={12} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="h-[1px] bg-[#3e3e42] mx-2 my-1" />

                {/* Completed Section */}
                <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold text-[#cccccc] uppercase tracking-wider flex justify-between items-center">
                        <span>{t("completedTransfers")}</span>
                        <span className="bg-[#3c3c3c] text-[#cccccc] px-1.5 rounded-full text-[10px]">{completedTasks.length}</span>
                    </div>

                    <div className="mt-1">
                        {completedTasks.map(task => (
                            <div key={task.id} className="px-3 py-1.5 hover:bg-[#2a2d2e] flex items-center gap-2 group">
                                <div className="shrink-0">
                                    {task.status === 'completed' ? 
                                        <CheckCircle size={14} className="text-green-500" /> : 
                                        <XCircle size={14} className="text-red-500" />
                                    }
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className={clsx("text-xs truncate", task.status === 'failed' ? "text-red-400" : "text-[#cccccc]")} title={task.name}>
                                            {task.name}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-[#858585] flex justify-between">
                                        <span>{task.type === 'upload' ? t("upload") : t("download")}</span>
                                        <span>{formatSize(task.total)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
