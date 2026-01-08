import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { exit } from "@tauri-apps/plugin-process";
import { 
    Minus, 
    Square, 
    X, 
    ArrowLeft, 
    ArrowRight, 
    Search,
    Menu,
    ChevronRight
} from "lucide-react";
import clsx from "clsx";
import { useSearch } from "../contexts/SearchContext";
import { useI18n } from "../contexts/I18nContext";

export default function TitleBar() {
    const { t } = useI18n();
    const [isMaximized, setIsMaximized] = useState(false);
    const { searchQuery, setSearchQuery } = useSearch();
    const appWindow = getCurrentWindow();
    
    // Menu State
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

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
    
    // Close menu on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenu(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Global Keyboard Shortcuts (Intercept Ctrl+F)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
    
    // Actions
    const handleNewWindow = async () => {
        // eslint-disable-next-line react-hooks/purity
        const label = `win-${Date.now()}`;
        try {
            await invoke("create_window", { label, url: "/index.html" });
        } catch (e) {
            console.error("Failed to create window", e);
        }
        setActiveMenu(null);
    };

    const handleUploadFile = () => {
        emit("menu:upload-file");
        setActiveMenu(null);
    };

    const handleUploadFolder = () => {
        emit("menu:upload-folder");
        setActiveMenu(null);
    };

    const handleCloseTab = () => {
        emit("menu:close-tab");
        setActiveMenu(null);
    };

    const handleOpenSettings = () => {
        emit("menu:open-settings");
        setActiveMenu(null);
    };

    const handleOpenProfiles = () => {
        emit("menu:open-profiles");
        setActiveMenu(null);
    };

    const handleReload = () => {
        emit("menu:reload");
        setActiveMenu(null);
    };

    const handleSplitEditor = () => {
        emit("menu:split-right");
        setActiveMenu(null);
    };

    const handleTogglePreview = () => {
        emit("menu:toggle-preview");
        setActiveMenu(null);
    };

    const handleToggleDevTools = () => {
        invoke("open_devtools"); // This might need a custom command or just ignore if not easy
        setActiveMenu(null);
    };

    const handleExit = async () => {
        await exit(0);
    };

    // Edit Actions
    const handleUndo = () => { emit("menu:undo"); setActiveMenu(null); };
    const handleRedo = () => { emit("menu:redo"); setActiveMenu(null); };
    const handleCut = () => { emit("menu:cut"); setActiveMenu(null); };
    const handleCopy = () => { emit("menu:copy"); setActiveMenu(null); };
    const handlePaste = () => { emit("menu:paste"); setActiveMenu(null); };
    const handleFind = () => { 
        searchInputRef.current?.focus(); 
        setActiveMenu(null); 
    };
    const handleSelectAll = () => { emit("menu:select-all"); setActiveMenu(null); };
    const handleRename = () => { emit("menu:rename"); setActiveMenu(null); };
    const handleSaveAs = () => { emit("menu:save-as"); setActiveMenu(null); };
    const handleDownload = () => { emit("menu:download"); setActiveMenu(null); };

    interface SubMenuItem {
        label?: string;
        action?: () => void;
        shortcut?: string;
        disabled?: boolean;
        separator?: boolean;
        submenu?: SubMenuItem[];
    }

    interface MenuCategory {
        id: string;
        label: string;
        items?: SubMenuItem[];
    }

    const menuItems: MenuCategory[] = [
        { 
            id: "file", 
            label: t("file"), 
            items: [
                { label: t("newWindow"), action: handleNewWindow, shortcut: "Ctrl+Shift+N" },
                { separator: true },
                { label: t("uploadFile"), action: handleUploadFile },
                { label: t("uploadFolder"), action: handleUploadFolder },
                { separator: true },
                { label: t("saveAs"), action: handleSaveAs, shortcut: "Ctrl+Shift+S" },
                { label: t("download"), action: handleDownload },
                { separator: true },
                { label: t("closeTab"), action: handleCloseTab, shortcut: "Ctrl+W" },
                { separator: true },
                { 
                    label: t("preferences"), 
                    submenu: [
                        { label: t("settings"), action: handleOpenSettings, shortcut: "Ctrl+," },
                        { label: t("manageProfiles"), action: handleOpenProfiles }
                    ]
                },
                { separator: true },
                { label: t("exit"), action: handleExit }
            ]
        },
        { 
            id: "edit", 
            label: t("edit"),
            items: [
                { label: t("undo"), action: handleUndo, shortcut: "Ctrl+Z", disabled: true },
                { label: t("redo"), action: handleRedo, shortcut: "Ctrl+Y", disabled: true },
                { separator: true },
                { label: t("cut"), action: handleCut, shortcut: "Ctrl+X" },
                { label: t("copy"), action: handleCopy, shortcut: "Ctrl+C" },
                { label: t("paste"), action: handlePaste, shortcut: "Ctrl+V" },
                { separator: true },
                { label: t("rename"), action: handleRename, shortcut: "F2" },
                { label: t("find"), action: handleFind, shortcut: "Ctrl+F" },
                { separator: true },
                { label: t("selectAll"), action: handleSelectAll, shortcut: "Ctrl+A" }
            ]
        },
        { 
            id: "selection", 
            label: t("selection"),
            items: [
                { label: t("expandSelection"), shortcut: "Shift+Alt+Right", disabled: true },
                { label: t("shrinkSelection"), shortcut: "Shift+Alt+Left", disabled: true },
                { separator: true },
                { label: t("copyLineUp"), shortcut: "Shift+Alt+Up", disabled: true },
                { label: t("copyLineDown"), shortcut: "Shift+Alt+Down", disabled: true },
            ]
        },
        { 
            id: "view", 
            label: t("view"),
            items: [
                { label: t("reloadWindow"), action: handleReload, shortcut: "Ctrl+R" },
                { label: t("refreshExplorer"), action: () => emit("menu:reload"), shortcut: "F5" },
                { label: t("splitEditorRight"), action: handleSplitEditor, shortcut: "Ctrl+\\" },
                { label: t("togglePreviewPane"), action: handleTogglePreview },
                { separator: true },
                { label: t("toggleDevTools"), action: handleToggleDevTools }
            ] 
        },
        { 
            id: "go", 
            label: t("go"),
            items: [
                { label: t("back"), shortcut: "Alt+Left", disabled: true },
                { label: t("forward"), shortcut: "Alt+Right", disabled: true },
                { separator: true },
                { label: t("goToFile"), shortcut: "Ctrl+P", action: handleFind }
            ]
        },
        { 
            id: "run", 
            label: t("run"),
            items: [
                { label: t("startDebugging"), shortcut: "Ctrl+D", disabled: true },
                { label: t("runWithoutDebugging"), shortcut: "Ctrl+F5", disabled: true }
            ]
        },
        { 
            id: "terminal", 
            label: t("terminal"),
            items: [
                { label: t("newTerminal"), shortcut: "Ctrl+Shift+`", disabled: true }
            ]
        },
        { 
            id: "help", 
            label: t("help"),
            items: [
                { label: t("githubRepository"), action: () => invoke('open_url', { url: 'https://github.com/u-00a0/oss-manager' }).catch(() => window.open('https://github.com/u-00a0/oss-manager', '_blank')) },
                { label: t("checkForUpdates"), action: () => {} }
            ]
        }
    ];

    return (
        <div data-tauri-drag-region className="h-9 bg-[#3c3c3c] flex items-center justify-between select-none text-[#cccccc] text-xs shrink-0 relative z-50">
            {/* Left Section: Icon + Menu + Nav */}
            <div className="flex items-center h-full space-x-2 px-2 shrink-0" data-tauri-drag-region> 
                <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center text-white font-bold text-[10px]">
                    O
                </div>

                {/* Menu Bar */}
                <div className="flex items-center space-x-1 ml-2" ref={menuRef}>
                    {menuItems.map(item => (
                        <div key={item.id} className="relative">
                            <div 
                                className={clsx(
                                    "px-2 py-1 rounded cursor-pointer hidden md:block",
                                    activeMenu === item.id ? "bg-[#505050] text-white" : "hover:bg-[#505050]"
                                )}
                                onClick={() => setActiveMenu(activeMenu === item.id ? null : item.id)}
                            >
                                {item.label}
                            </div>
                            
                            {/* Dropdown */}
                            {activeMenu === item.id && item.items && (
                                <div className="absolute top-full left-0 mt-1 w-60 bg-[#252526] border border-[#454545] shadow-xl rounded-md py-1 flex flex-col z-50 animate-menu-in">
                                    {item.items.map((subItem, idx) => {
                                        if (subItem.separator) {
                                            return <div key={idx} className="h-[1px] bg-[#454545] my-1 mx-2" />;
                                        }
                                        
                                        if (subItem.submenu) {
                                            return (
                                                <div key={idx} className="relative group/submenu">
                                                    <div className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer flex justify-between items-center">
                                                        <span>{subItem.label}</span>
                                                        <ChevronRight size={10} />
                                                    </div>
                                                    {/* Submenu Dropdown */}
                                                    <div className="absolute left-full top-0 w-48 bg-[#252526] border border-[#454545] shadow-xl rounded-md py-1 hidden group-hover/submenu:flex flex-col animate-menu-in">
                                                        {subItem.submenu.map((nestedItem: SubMenuItem, nIdx: number) => (
                                                            <div 
                                                                key={nIdx}
                                                                className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer flex justify-between items-center"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    nestedItem.action?.();
                                                                    setActiveMenu(null);
                                                                }}
                                                            >
                                                                <span>{nestedItem.label}</span>
                                                                {nestedItem.shortcut && <span className="text-[#858585] text-[10px]">{nestedItem.shortcut}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div 
                                                key={idx}
                                                className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer flex justify-between items-center group"
                                                onClick={() => {
                                                    subItem.action?.();
                                                    // Don't close if it's just opening a submenu (though handled above)
                                                    setActiveMenu(null);
                                                }}
                                            >
                                                <span>{subItem.label}</span>
                                                {subItem.shortcut && <span className="text-[#858585] group-hover:text-white text-[10px]">{subItem.shortcut}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                        ref={searchInputRef}
                        className="bg-transparent border-none outline-none w-full text-xs text-[#cccccc] placeholder-[#858585]"
                        placeholder={t("searchPlaceholder")}
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