import { useState, useEffect, useRef } from "react";
import TitleBar from "./components/TitleBar";
import ActivityBar from "./components/ActivityBar";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import StatusBar from "./components/StatusBar";
import EditorGroup from "./components/EditorGroup";
import type { Tab } from "./types";

import ExplorerSidebar from "./views/ExplorerSidebar";
import TransferDashboard from "./views/TransferDashboard";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

import { I18nProvider, useI18n } from "./contexts/I18nContext";
import type { Language } from "./contexts/I18nContext";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import type { AppConfig } from "./types";
import { arrayMove } from "@dnd-kit/sortable";
import { NotificationProvider } from "./contexts/NotificationContext";
import { StatusBarProvider } from "./contexts/StatusBarContext";
import { SearchProvider, useSearch } from "./contexts/SearchContext";
import { ClipboardProvider } from "./contexts/ClipboardContext";
import NotificationCenter from "./components/NotificationCenter";
import ErrorBoundary from "./components/ErrorBoundary";

// Group Definition
interface EditorGroupData {
    id: string;
    tabs: Tab[];
    activeTabId: string | null;
}

interface TabDragDropEvent {
    payload: {
        windowLabel: string;
        tabId: string;
        tab: Tab;
        screenX: number;
        screenY: number;
    };
}

interface TabClaimedEvent {
    payload: {
        tabId: string;
        claimedBy: string;
    };
}

function AppContent() {
  const { t, setLanguage } = useI18n();
  const { setSearchQuery } = useSearch();
  const [activeActivity, setActiveActivity] = useState("files");
  
  // Multi-Group State
  const [groups, setGroups] = useState<Record<string, EditorGroupData>>({
      "group-0": { id: "group-0", tabs: [], activeTabId: null }
  });
  const [groupIds, setGroupIds] = useState<string[]>(["group-0"]);
  const [activeGroupId, setActiveGroupId] = useState<string>("group-0");

  const windowLabel = useRef("");

  // Helper to get active tab ID globally (for menu/search context)
  const globalActiveTabId = groups[activeGroupId]?.activeTabId;

  // Clear search on tab switch
  useEffect(() => {
      setSearchQuery("");
  }, [globalActiveTabId, setSearchQuery]);

  // Track if we are currently dragging a tab that might be claimed
  const pendingDropRef = useRef<{ id: string, claimed: boolean } | null>(null);

  useEffect(() => {
    const win = getCurrentWindow();
    windowLabel.current = win.label;

    // Load config
    invoke<AppConfig>('get_app_config').then((config) => {
        if (config.language) {
            setLanguage(config.language as Language);
        }
    }).catch(console.error);

    // Check for init tab data from URL (New Window)
    const params = new URLSearchParams(window.location.search);
    const initTabJson = params.get("initTab");
    if (initTabJson) {
        try {
            const tabData = JSON.parse(decodeURIComponent(initTabJson));
            setGroups(prev => ({
                ...prev,
                "group-0": {
                    id: "group-0",
                    tabs: [tabData],
                    activeTabId: tabData.id
                }
            }));
        } catch (e) {
            console.error("Failed to parse init tab data", e);
        }
    }

    // Listeners for Cross-Window Dragging (Simplified for Groups)
    // Note: DND Logic needs to be group-aware. For now, we drop into the active group.
    
    // ... (Keeping listeners mostly similar but targeting activeGroupId)
    const unlistenDrop = listen('tab-drag-drop', (event: TabDragDropEvent) => {
        const { windowLabel: srcLabel, tabId, tab, screenX, screenY } = event.payload;
        if (srcLabel === windowLabel.current) return;

        const winX = window.screenX;
        const winY = window.screenY;
        const winW = window.outerWidth;
        const winH = window.outerHeight;

        const isInside = screenX >= winX && screenX <= winX + winW &&
                         screenY >= winY && screenY <= winY + winH;

        if (isInside) {
            // Drop into active group
            const newTab = { ...tab, active: true };
            
            setGroups(prev => {
                // Closure issue: activeGroupId might be stale here if not in dependency.
                // We'll fix this by using functional update correctly or ref.
                // ideally we find the group under cursor, but let's default to the last active one.
                return prev; 
            });

            // Re-implementing with functional update to access current state
            setGroups(currentGroups => {
                // Find target group (default to first or active)
                // Since we don't have mouse pos here easily without tracking, default to group-0 or active
                // A better way: The component state 'activeGroupId' is available if in dependency array.
                // However, listeners are set once. We need a ref for activeGroupId.
                return currentGroups; 
            });

            // Hack: Trigger a separate function or use ref for activeGroupId
            handleExternalDrop(tabId, newTab);
            
            emit('tab-claimed', { tabId, claimedBy: windowLabel.current });
        }
    });

    const unlistenClaimed = listen('tab-claimed', (event: TabClaimedEvent) => {
        const { tabId, claimedBy } = event.payload;
        if (claimedBy === windowLabel.current) return;

        // Remove from ANY group
        setGroups(prev => {
            const next = { ...prev };
            let changed = false;
            
            for (const gid of Object.keys(next)) {
                const group = next[gid];
                if (group.tabs.find(t => t.id === tabId)) {
                    if (pendingDropRef.current && pendingDropRef.current.id === tabId) {
                        pendingDropRef.current.claimed = true;
                    }
                    const newTabs = group.tabs.filter(t => t.id !== tabId);
                    let newActiveId = group.activeTabId;
                    if (group.activeTabId === tabId) {
                        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
                    }
                    next[gid] = { ...group, tabs: newTabs, activeTabId: newActiveId };
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    });

    return () => {
        unlistenDrop.then(f => f());
        unlistenClaimed.then(f => f());
    };
  }, []); // Empty dependency for listeners

  // Ref for active group to be used in event listeners if needed
  const activeGroupIdRef = useRef(activeGroupId);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);

  const handleExternalDrop = (tabId: string, tab: Tab) => {
      const targetId = activeGroupIdRef.current;
      setGroups(prev => {
          const group = prev[targetId];
          if (group.tabs.find(t => t.id === tabId)) return prev;
          return {
              ...prev,
              [targetId]: {
                  ...group,
                  tabs: [...group.tabs, tab],
                  activeTabId: tab.id
              }
          };
      });
  };

  // Tab Management
  const openTab = (tab: Tab, targetGroupId?: string) => {
    const gid = targetGroupId || activeGroupId;
    
    setGroups(prev => {
        const group = prev[gid];
        // Check if tab exists in THIS group
        const existing = group.tabs.find(t => t.id === tab.id);
        
        if (existing) {
            return {
                ...prev,
                [gid]: { ...group, activeTabId: existing.id }
            };
        } else {
            // Check if it exists in OTHER groups? VSCode usually duplicates or moves.
            // Let's duplicate for now (allow same file in multiple splits)
            return {
                ...prev,
                [gid]: { 
                    ...group, 
                    tabs: [...group.tabs, tab],
                    activeTabId: tab.id 
                }
            };
        }
    });
    
    if (gid !== activeGroupId) setActiveGroupId(gid);
  };

  const closeTab = (groupId: string, tabId: string) => {
    setGroups(prev => {
        const group = prev[groupId];
        const newTabs = group.tabs.filter(t => t.id !== tabId);
        let newActiveId = group.activeTabId;
        
        if (group.activeTabId === tabId) {
            newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }
        
        const newState = {
            ...prev,
            [groupId]: { ...group, tabs: newTabs, activeTabId: newActiveId }
        };

        // If group is empty and not the only one, remove group?
        // VSCode keeps empty groups open until explicitly closed, usually.
        // Let's keep it simple: keep group open.
        
        return newState;
    });
  };

  const handleReorder = (groupId: string, oldIndex: number, newIndex: number) => {
      setGroups(prev => {
          const group = prev[groupId];
          return {
              ...prev,
              [groupId]: {
                  ...group,
                  tabs: arrayMove(group.tabs, oldIndex, newIndex)
              }
          };
      });
  };

  const handleTabOut = async (groupId: string, tabId: string) => {
      const group = groups[groupId];
      const tab = group.tabs.find(t => t.id === tabId);
      if (!tab) return;
      
      pendingDropRef.current = { id: tabId, claimed: false };

      setTimeout(async () => {
          if (pendingDropRef.current && pendingDropRef.current.id === tabId && pendingDropRef.current.claimed) {
              return;
          }

          const label = `win-${Date.now()}`;
          const tabDataStr = encodeURIComponent(JSON.stringify(tab));
          const url = `/index.html?initTab=${tabDataStr}`;
          
          try {
              await invoke("create_window", { label, url });
              closeTab(groupId, tabId);
          } catch (e) {
              console.error("Failed to detach tab", e);
          }
      }, 200);
  };

  const handleSplit = () => {
      const sourceGroup = groups[activeGroupId];
      const currentTab = sourceGroup.tabs.find(t => t.id === sourceGroup.activeTabId);
      
      if (!currentTab) return;

      const newGroupId = `group-${Date.now()}`;
      
      setGroups(prev => ({
          ...prev,
          [newGroupId]: {
              id: newGroupId,
              tabs: [currentTab], // Clone the tab
              activeTabId: currentTab.id
          }
      }));
      
      setGroupIds(prev => [...prev, newGroupId]);
      setActiveGroupId(newGroupId);
  };

  // Activity Handlers
  const handleBucketSelect = (profile: string, bucket: string) => {
      openTab({
          id: `browser-${profile}-${bucket}`,
          title: bucket,
          type: "file-browser",
          data: { profile, bucket },
          active: true
      });
  };

  const handleOpenSettings = () => {
      openTab({ id: 'settings', title: t("settings"), type: 'settings', active: true });
  };

  const handleOpenProfiles = () => {
      openTab({ id: 'profiles-manager', title: t("manageProfiles"), type: 'profiles', active: true });    
  };

  const handleOpenShortcuts = () => {
      openTab({ id: 'shortcuts', title: t("keyboardShortcuts"), type: 'shortcuts', active: true });
  };

  const handleOpenTransfers = () => {
      openTab({ id: 'transfers', title: "Transfer Dashboard", type: 'transfers', active: true });
  };
  
  const handleOpenFile = (profile: string, bucket: string, fileKey: string) => {
      openTab({
          id: `details-${profile}-${bucket}-${fileKey}`,
          title: fileKey.split('/').pop() || fileKey,
          type: 'file-details',
          data: { profile, bucket, fileKey },
          active: true
      });
  };

  // Sidebar
  const renderSidebar = () => {
      switch (activeActivity) {
          case "files":
              return (
                  <Sidebar title={t("explorer")}>
                      <ExplorerSidebar onBucketSelect={handleBucketSelect} />
                  </Sidebar>
              );
          case "profiles":
              return (
                  <Sidebar title={t("profiles")}>
                      <div className="p-2">
                        <button
                            className="w-full bg-[#0e639c] text-white p-1 rounded"
                            onClick={handleOpenProfiles}
                        >
                            {t("manageProfiles")}
                        </button>
                      </div>
                  </Sidebar>
              );
          default:
              return <div className="w-64 bg-[#252526] border-r border-[#1e1e1e]" />;
      }
  };

  // Menu Event Listeners
  useEffect(() => {
      let cancelled = false;
      const unlisteners: (() => void)[] = [];

      const setupListeners = async () => {
          const handlers = [
              { event: 'menu:close-tab', action: () => { if (globalActiveTabId) closeTab(activeGroupId, globalActiveTabId); } },
              { event: 'menu:open-settings', action: handleOpenSettings },
              { event: 'menu:open-profiles', action: handleOpenProfiles },
              { event: 'menu:reload', action: () => window.location.reload() },
              { event: 'menu:split-right', action: () => handleSplit('right') },
          ];

          for (const { event, action } of handlers) {
              const unlisten = await listen(event, () => {
                  if (!cancelled) action();
              });
              if (cancelled) {
                  unlisten();
              } else {
                  unlisteners.push(unlisten);
              }
          }
      };

      setupListeners();

      return () => {
          cancelled = true;
          unlisteners.forEach(u => u());
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, globalActiveTabId]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-sm bg-[#1e1e1e] text-[#cccccc]">
      <TitleBar />
      
      <div className="flex-1 flex flex-row overflow-hidden">
        <ActivityBar 
            activeTab={activeActivity} 
            onTabChange={setActiveActivity} 
            onOpenSettings={handleOpenSettings}
            onOpenShortcuts={handleOpenShortcuts}
            onOpenTransfers={handleOpenTransfers}
            isSettingsTabActive={globalActiveTabId === 'settings'}
        />

        {renderSidebar()}

        <MainContent>
            {/* Split View Container */}
            <PanelGroup direction="horizontal" className="h-full w-full">
                {groupIds.map((gid, index) => {
                    const group = groups[gid];
                    if (!group) return null;

                    return (
                        <div key={gid} className="contents">
                            {index > 0 && (
                                <PanelResizeHandle className="w-1 bg-[#2d2d2d] hover:bg-[#007fd4] transition-colors cursor-col-resize z-50" />
                            )}
                            <Panel defaultSize={100 / groupIds.length} minSize={10}>
                                <EditorGroup 
                                    groupId={gid}
                                    tabs={group.tabs}
                                    activeTabId={group.activeTabId}
                                    isActiveGroup={activeGroupId === gid}
                                    onTabClick={(gid, tid) => {
                                        setActiveGroupId(gid);
                                        setGroups(p => ({
                                            ...p, 
                                            [gid]: { ...p[gid], activeTabId: tid }
                                        }));
                                    }}
                                    onTabClose={closeTab}
                                    onReorder={handleReorder}
                                    onTabOut={handleTabOut}
                                    onActivateGroup={setActiveGroupId}
                                    onSplit={() => handleSplit('right')}
                                    onOpenFile={handleOpenFile}
                                />
                            </Panel>
                        </div>
                    );
                })}
            </PanelGroup>
        </MainContent>
      </div>
      
      <StatusBar />
    </div>
  );
}

import { TransferProvider } from "./contexts/TransferContext";

export default function App() {
    return (
        <ErrorBoundary>
            <NotificationProvider>
                <StatusBarProvider>
                    <SearchProvider>
                        <ClipboardProvider>
                            <I18nProvider>
                                <TransferProvider>
                                    <AppContent />
                                    <NotificationCenter />
                                </TransferProvider>
                            </I18nProvider>
                        </ClipboardProvider>
                    </SearchProvider>
                </StatusBarProvider>
            </NotificationProvider>
        </ErrorBoundary>
    );
}