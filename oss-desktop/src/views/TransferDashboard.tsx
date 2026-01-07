import { useTransfer } from "../contexts/TransferContext";
import type { TransferTask } from "../contexts/TransferContext";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowDown, ArrowUp, CheckCircle, XCircle, Clock, Square, Pause, Play } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "../contexts/I18nContext";

function formatSize(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function TransferDashboard() {
    const { t } = useI18n();
    const { tasks, history, currentUploadSpeed, currentDownloadSpeed, cancelAll, cancelTask, pauseAll, resumeAll, pauseTask, resumeTask } = useTransfer();
    
    const activeTasks = Object.values(tasks).filter(t => t.status === 'running' || t.status === 'paused').sort((a, b) => b.startTime - a.startTime);
    const completedTasks = Object.values(tasks).filter(t => t.status === 'completed' || t.status === 'failed').sort((a, b) => b.startTime - a.startTime);

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden">
            {/* Header / Graph Area */}
            <div className="h-64 bg-[#252526] border-b border-[#3e3e42] p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-4">
                        <h2 className="text-xl font-bold text-white">{t("networkUsage")}</h2>
                        {activeTasks.length > 0 && (
                            <div className="flex space-x-2">
                                <button 
                                    className="flex items-center space-x-1 px-2 py-1 bg-[#3c3c3c] hover:bg-[#007fd4] hover:text-white rounded text-xs transition-colors"
                                    onClick={pauseAll}
                                >
                                    <Pause size={12} fill="currentColor" />
                                    <span>{t("pauseAll")}</span>
                                </button>
                                <button 
                                    className="flex items-center space-x-1 px-2 py-1 bg-[#3c3c3c] hover:bg-[#007fd4] hover:text-white rounded text-xs transition-colors"
                                    onClick={resumeAll}
                                >
                                    <Play size={12} fill="currentColor" />
                                    <span>{t("resumeAll")}</span>
                                </button>
                                <button 
                                    className="flex items-center space-x-1 px-2 py-1 bg-[#3c3c3c] hover:bg-[#e81123] hover:text-white rounded text-xs transition-colors"
                                    onClick={cancelAll}
                                >
                                    <Square size={12} fill="currentColor" />
                                    <span>{t("cancelAll")}</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex space-x-6 text-sm">
                        <div className="flex items-center text-blue-400">
                            <ArrowUp size={16} className="mr-1" />
                            <span>{t("upload")}: {formatSize(currentUploadSpeed)}/s</span>
                        </div>
                        <div className="flex items-center text-green-400">
                            <ArrowDown size={16} className="mr-1" />
                            <span>{t("download")}: {formatSize(currentDownloadSpeed)}/s</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history}>
                            <defs>
                                <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="time" stroke="#666" tick={{fontSize: 10}} interval={5} />
                            <YAxis stroke="#666" tick={{fontSize: 10}} tickFormatter={(val) => formatSize(val) + "/s"} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#252526', borderColor: '#3e3e42' }}
                                itemStyle={{ fontSize: 12 }}
                                formatter={(val: number | undefined) => formatSize(val || 0) + "/s"}
                            />
                            <Area type="monotone" dataKey="uploadSpeed" stroke="#60a5fa" fillOpacity={1} fill="url(#colorUp)" name={t("upload")} isAnimationActive={false} />
                            <Area type="monotone" dataKey="downloadSpeed" stroke="#4ade80" fillOpacity={1} fill="url(#colorDown)" name={t("download")} isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Tasks List */}
            <div className="flex-1 overflow-auto p-4">
                <h3 className="text-lg font-bold mb-4 text-white">{t("activeTransfers")} ({activeTasks.length})</h3>
                <div className="space-y-2 mb-8">
                    {activeTasks.map(task => (
                        <TaskItem 
                            key={task.id} 
                            task={task} 
                            onCancel={() => cancelTask(task.id)} 
                            onPause={() => pauseTask(task.id)}
                            onResume={() => resumeTask(task.id)}
                        />
                    ))}
                    {activeTasks.length === 0 && <div className="text-[#858585] text-sm italic">{t("noActiveTransfers")}</div>}
                </div>

                <h3 className="text-lg font-bold mb-4 text-white">{t("completedTransfers")} ({completedTasks.length})</h3>
                <div className="space-y-2">
                    {completedTasks.map(task => (
                        <TaskItem key={task.id} task={task} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function TaskItem({ task, onCancel, onPause, onResume }: { task: TransferTask, onCancel?: () => void, onPause?: () => void, onResume?: () => void }) {
    const progress = task.total > 0 ? (task.transferred / task.total) * 100 : 0;
    
    return (
        <div className="bg-[#2a2d2e] p-3 rounded border border-[#3e3e42] flex items-center space-x-4">
            <div className="p-2 bg-[#3c3c3c] rounded">
                {task.type === 'upload' ? <ArrowUp className="text-blue-400" size={20} /> : <ArrowDown className="text-green-400" size={20} />}
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                    <span className="font-medium text-white truncate" title={task.id}>{task.name}</span>
                    <span className="text-xs text-[#858585] flex items-center">
                        {task.status === 'completed' && <CheckCircle size={12} className="text-green-500 mr-1" />}
                        {task.status === 'failed' && <XCircle size={12} className="text-red-500 mr-1" />}
                        {task.status === 'running' && <Clock size={12} className="animate-spin mr-1" />}
                        {task.status === 'paused' && <Pause size={12} className="text-yellow-500 mr-1" />}
                        {task.status}
                    </span>
                </div>
                
                {task.status === 'running' || task.status === 'paused' ? (
                    <div className="w-full bg-[#3c3c3c] h-1.5 rounded-full overflow-hidden mb-1">
                        <div className={clsx("h-full transition-all duration-200", task.status === 'paused' ? "bg-yellow-500" : "bg-[#007fd4]")} style={{ width: `${progress}%` }} />
                    </div>
                ) : (
                    <div className="w-full bg-[#3c3c3c] h-1.5 rounded-full overflow-hidden mb-1">
                        <div className={clsx("h-full w-full", task.status === 'completed' ? "bg-green-500" : "bg-red-500")} />
                    </div>
                )}
                
                <div className="flex justify-between text-xs text-[#858585]">
                    <span>{formatSize(task.transferred)} / {formatSize(task.total)}</span>
                    {task.status === 'running' && <span>{formatSize(task.speed)}/s</span>}
                </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-1">
                {task.status === 'running' && onPause && (
                    <button 
                        className="p-2 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-yellow-500 transition-colors"
                        onClick={onPause}
                        title="Pause"
                    >
                        <Pause size={16} fill="currentColor" />
                    </button>
                )}
                {task.status === 'paused' && onResume && (
                    <button 
                        className="p-2 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-green-500 transition-colors"
                        onClick={onResume}
                        title="Resume"
                    >
                        <Play size={16} fill="currentColor" />
                    </button>
                )}
                {(task.status === 'running' || task.status === 'paused') && onCancel && (
                    <button 
                        className="p-2 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-[#e81123] transition-colors"
                        onClick={onCancel}
                        title="Cancel"
                    >
                        <Square size={16} fill="currentColor" />
                    </button>
                )}
            </div>
        </div>
    );
}
