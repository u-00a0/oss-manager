import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { 
    Minus, 
    Square, 
    X, 
    ArrowLeft, 
    ArrowRight, 
    Search,
    Menu
} from "lucide-react";
import clsx from "clsx";
import { useSearch } from "../contexts/SearchContext";

export default function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);
    const { searchQuery, setSearchQuery } = useSearch();
    const appWindow = getCurrentWindow();

    useEffect(() => {
        const updateState = async () => {
            setIsMaximized(await appWindow.isMaximized());
        };
        updateState();

        // Listen for resize events to update maximized state icon
        const unlisten = appWindow.listen('tauri://resize', updateState);
        return () => {
            unlisten.then(f => f());
        }
    }, [appWindow]);

    const handleMinimize = () => appWindow.minimize();
    const handleMaximize = async () => {
        if (await appWindow.isMaximized()) {
            appWindow.unmaximize();
            setIsMaximized(false);
        } else {
            appWindow.maximize();
            setIsMaximized(true);
        }
    };
    const handleClose = () => appWindow.close();

    return (
        <div data-tauri-drag-region className="h-9 bg-[#3c3c3c] flex items-center justify-between select-none text-[#cccccc] text-xs shrink-0">
            {/* Left Section: Icon + Menu + Nav */}
            <div className="flex items-center h-full space-x-2 px-2 shrink-0" data-tauri-drag-region> 
                <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center text-white font-bold text-[10px]">
                    O
                </div>

                {/* Menu Bar */}
                <div className="flex items-center space-x-1 ml-2">
                    {["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"].map(item => (
                        <div key={item} className="px-2 py-1 hover:bg-[#505050] rounded cursor-pointer hidden md:block">
                            {item}
                        </div>
                    ))}
                    <div className="md:hidden px-2 py-1 hover:bg-[#505050] rounded cursor-pointer">   
                        <Menu size={14} />
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center space-x-1 ml-4 text-[#858585]">
                    <div className="p-1 hover:bg-[#505050] rounded cursor-pointer hover:text-white"><ArrowLeft size={14} /></div>
                    <div className="p-1 hover:bg-[#505050] rounded cursor-pointer hover:text-white"><ArrowRight size={14} /></div>
                </div>
            </div>

            {/* Center: Search Box */}
            <div className="flex-1 flex justify-center max-w-lg mx-2 h-full items-center" data-tauri-drag-region>
                <div className="flex items-center bg-[#252526] border border-[#3c3c3c] rounded-md px-2 py-0.5 w-full max-w-[400px] text-[#cccccc] focus-within:border-[#007fd4] focus-within:bg-[#1e1e1e]">     
                    <Search size={12} className="mr-2 text-[#858585]" />
                    <input 
                        className="bg-transparent border-none outline-none w-full text-xs text-[#cccccc] placeholder-[#858585]"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        spellCheck={false}
                    />
                </div>
            </div>

            {/* Right: Window Controls */}
            <div className="flex items-center h-full">
                <div
                    className="h-full w-10 flex items-center justify-center hover:bg-[#505050] cursor-pointer"
                    onClick={handleMinimize}
                >
                    <Minus size={14} />
                </div>
                <div
                    className="h-full w-10 flex items-center justify-center hover:bg-[#505050] cursor-pointer"
                    onClick={handleMaximize}
                >
                    <Square size={12} className={clsx(isMaximized && "fill-transparent stroke-2")} />     
                </div>
                <div
                    className="h-full w-10 flex items-center justify-center hover:bg-[#e81123] hover:text-white cursor-pointer"
                    onClick={handleClose}
                >
                    <X size={14} />
                </div>
            </div>
        </div>
    );
}