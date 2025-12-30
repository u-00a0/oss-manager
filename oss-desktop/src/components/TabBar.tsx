import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import ContextMenu, { MenuItem } from "./ContextMenu";

interface Tab {
    id: string;
    title: string;
    active: boolean;
    type: string;
    data?: { profile: string; bucket: string };
}

interface TabBarProps {
    tabs: Tab[];
    onTabClick: (id: string) => void;
    onTabClose: (id: string) => void;
    onReorder: (oldIndex: number, newIndex: number) => void;
    onTabOut?: (tabId: string) => void;
    remoteTab?: Tab | null;
}

export default function TabBar({ tabs, onTabClick, onTabClose, onReorder, onTabOut, remoteTab }: TabBarProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const windowLabel = useRef("");
    const lastMousePos = useRef({ x: 0, y: 0 });
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: MenuItem[] } | null>(null);

    useEffect(() => {
        windowLabel.current = getCurrentWindow().label;
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Global drag tracking
    useEffect(() => {
        if (!activeId) return;

        const handleWindowMouseMove = (e: MouseEvent) => {
            lastMousePos.current = { x: e.screenX, y: e.screenY };
            const tab = tabs.find(t => t.id === activeId);
            if (tab) {
                emit('tab-drag-move', {
                    windowLabel: windowLabel.current,
                    tab,
                    screenX: e.screenX,
                    screenY: e.screenY
                });
            }
        };

        window.addEventListener('mousemove', handleWindowMouseMove);
        return () => window.removeEventListener('mousemove', handleWindowMouseMove);
    }, [activeId, tabs]);

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as string);
        setContextMenu(null); // Close menu on drag
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        const currentId = active.id as string;
        const tab = tabs.find(t => t.id === currentId);

        if (tab) {
            emit('tab-drag-drop', {
                windowLabel: windowLabel.current,
                tabId: currentId,
                tab: tab,
                screenX: lastMousePos.current.x,
                screenY: lastMousePos.current.y
            });
        }

        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = tabs.findIndex((tab) => tab.id === active.id);
            const newIndex = tabs.findIndex((tab) => tab.id === over.id);
            onReorder(oldIndex, newIndex);
        } else if (!over && onTabOut) {
            onTabOut(currentId);
        }
    }

    function handleContextMenu(e: React.MouseEvent, tabId: string) {
        e.preventDefault();
        e.stopPropagation();

        const index = tabs.findIndex(t => t.id === tabId);
        
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
                { 
                    label: "Close", 
                    action: () => onTabClose(tabId) 
                },
                { 
                    label: "Close Others", 
                    action: () => {
                        const toClose = tabs.filter(t => t.id !== tabId);
                        toClose.forEach(t => onTabClose(t.id));
                    },
                    disabled: tabs.length <= 1
                },
                { 
                    label: "Close to the Right", 
                    action: () => {
                        const toClose = tabs.slice(index + 1);
                        toClose.forEach(t => onTabClose(t.id));
                    }, 
                    disabled: index === tabs.length - 1 
                }
            ]
        });
    }

    const activeTab = tabs.find(t => t.id === activeId);

    return (
        <>
            <div className="h-9 bg-[#252526] flex items-center overflow-x-auto scrollbar-hide border-b border-[#1e1e1e] shrink-0" onContextMenu={(e) => e.preventDefault()}>
                {tabs.length > 0 || remoteTab ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={pointerWithin}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={tabs.map(t => t.id)}
                            strategy={horizontalListSortingStrategy}
                        >
                            {tabs.map((tab) => (
                                <SortableTab
                                    key={tab.id}
                                    tab={tab}
                                    onTabClick={onTabClick}
                                    onTabClose={onTabClose}
                                    onContextMenu={(e) => handleContextMenu(e, tab.id)}
                                />
                            ))}
                        </SortableContext>

                        {remoteTab && (
                            <div className="opacity-50">
                                <TabItem
                                    tab={remoteTab}
                                    onTabClick={() => {}}
                                    onTabClose={() => {}}
                                />
                            </div>
                        )}

                        <DragOverlay modifiers={[restrictToWindowEdges]}>
                            {activeTab ? (
                                <TabItem
                                    tab={activeTab}
                                    onTabClick={() => {}}
                                    onTabClose={() => {}}
                                    isOverlay
                                />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                ) : (
                    <div className="px-4 text-xs text-[#858585] italic">No open tabs</div>
                )}
            </div>
            {contextMenu && (
                <ContextMenu 
                    x={contextMenu.x} 
                    y={contextMenu.y} 
                    items={contextMenu.items} 
                    onClose={() => setContextMenu(null)} 
                />
            )}
        </>
    );
}

function SortableTab({ tab, onTabClick, onTabClose, onContextMenu }: { 
    tab: Tab, 
    onTabClick: (id: string) => void, 
    onTabClose: (id: string) => void,
    onContextMenu: (e: React.MouseEvent) => void 
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: tab.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="h-full outline-none">
            <TabItem 
                tab={tab} 
                onTabClick={onTabClick} 
                onTabClose={onTabClose} 
                onContextMenu={onContextMenu}
            />
        </div>
    );
}

function TabItem({ tab, onTabClick, onTabClose, onContextMenu, isOverlay }: { 
    tab: Tab, 
    onTabClick: (id: string) => void, 
    onTabClose: (id: string) => void, 
    onContextMenu?: (e: React.MouseEvent) => void,
    isOverlay?: boolean 
}) {
    return (
        <div
            className={clsx(
                "group h-full px-3 min-w-[120px] max-w-[200px] flex items-center justify-between border-r border-[#1e1e1e] cursor-pointer text-xs select-none",
                isOverlay ? "bg-[#252526] shadow-lg opacity-90 cursor-grabbing border border-[#3e3e42]" : 
                (tab.active ? "bg-[#1e1e1e] text-[#ffffff]" : "bg-[#2d2d2d] text-[#969696] hover:bg-[#2a2d2e]")
            )}
            onClick={() => onTabClick(tab.id)}
            onContextMenu={onContextMenu}
        >
            <span className="truncate mr-2">{tab.title}</span>
            <div
                className={clsx(
                    "p-0.5 rounded-sm hover:bg-[#4d4d4d]",
                    (tab.active || isOverlay) ? "opacity-100" : "opacity-0 group-hover:opacity-100"       
                )}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                }}
            >
                <X size={14} />
            </div>
        </div>
    );
}