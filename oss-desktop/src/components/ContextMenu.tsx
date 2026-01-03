import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export interface MenuItem {
    label?: string;
    action?: () => void;
    icon?: React.ReactNode;
    shortcut?: string;
    disabled?: boolean;
    separator?: boolean;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        
        function handleScroll() {
            onClose();
        }

        // Delay adding the listener to avoid immediate trigger by the click that opened the menu
        const timer = setTimeout(() => {
             document.addEventListener("mousedown", handleClickOutside);
             window.addEventListener("scroll", handleScroll, true); 
             window.addEventListener("resize", handleScroll);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleScroll);
        };
    }, [onClose]);

    // Adjust position to keep within viewport
    // Note: A more robust implementation would use useLayoutEffect to measure dimensions
    // but for now we assume a standard width/height per item
    const style: React.CSSProperties = {
        top: y,
        left: x,
    };
    
    // Simple adjustment logic 
    if (x + 200 > window.innerWidth) {
        style.left = x - 200;
    }
    
    // Estimate height: ~28px per item + padding
    const estimatedHeight = items.length * 28 + 10;
    if (y + estimatedHeight > window.innerHeight) {
        style.top = Math.max(0, y - estimatedHeight);
    }

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[180px] bg-[#252526] border border-[#454545] shadow-xl rounded-md py-1 text-[#cccccc] text-xs select-none animate-menu-in"
            style={style}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, index) => {
                if (item.separator) {
                    return <div key={index} className="h-[1px] bg-[#454545] my-1 mx-2" />;
                }

                return (
                    <div
                        key={index}
                        className={clsx(
                            "flex items-center justify-between px-3 py-1.5 mx-1 rounded cursor-pointer",
                            item.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[#094771] hover:text-white",
                            item.danger && !item.disabled && "text-red-400 hover:text-white"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!item.disabled && item.action) {
                                item.action();
                                onClose();
                            }
                        }}
                    >
                        <div className="flex items-center gap-2">
                            {item.icon && <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>}
                            <span>{item.label}</span>
                        </div>
                        {item.shortcut && <span className="text-[#858585] ml-4">{item.shortcut}</span>}
                    </div>
                );
            })}
        </div>,
        document.body
    );
}
