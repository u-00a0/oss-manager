import { useState, useEffect, useRef } from "react";
import TitleBar from "./components/TitleBar";
import ActivityBar from "./components/ActivityBar";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import MainContent from "./components/MainContent";
import StatusBar from "./components/StatusBar";

import ExplorerSidebar from "./views/ExplorerSidebar";
import FileBrowser from "./views/FileBrowser";
import FileDetails from "./views/FileDetails";
import ProfilesView from "./views/ProfilesView";
import SettingsView from "./views/SettingsView";

import { I18nProvider, useI18n } from "./contexts/I18nContext";
import type { Language } from "./contexts/I18nContext";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import type { AppConfig } from "./types";
import { arrayMove } from "@dnd-kit/sortable";
import { NotificationProvider } from "./contexts/NotificationContext";
import { StatusBarProvider } from "./contexts/StatusBarContext";
import NotificationCenter from "./components/NotificationCenter";

// Type definitions for Tabs
interface Tab {
    id: string;
    title: string;
    type: "file-browser" | "settings" | "profiles" | "file-details";
    data?: { profile: string; bucket: string; fileKey?: string };
    active: boolean;
}

interface TabDragMoveEvent {
    payload: {
        windowLabel: string;
        tab: Tab;
        screenX: number;
        screenY: number;
    };
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
  const [activeActivity, setActiveActivity] = useState("files");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [remoteTab, setRemoteTab] = useState<Tab | null>(null);
  const windowLabel = useRef("");
  
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
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTabs([tabData]);
            setActiveTabId(tabData.id);
        } catch (e) {
            console.error("Failed to parse init tab data", e);
        }
    }

    // Listeners for Cross-Window Dragging
    const unlistenMove = listen('tab-drag-move', (event: TabDragMoveEvent) => {
        const { windowLabel: srcLabel, tab, screenX, screenY } = event.payload;
        if (srcLabel === windowLabel.current) return;

        // Check if cursor is inside this window
        const winX = window.screenX;
        const winY = window.screenY;
        const winW = window.outerWidth;
        const winH = window.outerHeight;

        if (screenX >= winX && screenX <= winX + winW &&
            screenY >= winY && screenY <= winY + winH) {
            setRemoteTab(tab);
        } else {
            setRemoteTab(null);
        }
    });

    const unlistenDrop = listen('tab-drag-drop', (event: TabDragDropEvent) => {
        const { windowLabel: srcLabel, tabId, tab, screenX, screenY } = event.payload;
        
        if (srcLabel === windowLabel.current) return;

        // Robust check: Verify coordinates even on drop
        const winX = window.screenX;
        const winY = window.screenY;
        const winW = window.outerWidth;
        const winH = window.outerHeight;

        const isInside = screenX >= winX && screenX <= winX + winW &&
                         screenY >= winY && screenY <= winY + winH;

        if (isInside) {
            // Accept the tab
            // Use the data from payload, not state, for atomic reliability
            const newTab = { ...tab, active: true };
            
            // Avoid adding duplicates
            setTabs(prev => {
                if (prev.find(t => t.id === tabId)) return prev;
                return [...prev, newTab];
            });
            setActiveTabId(newTab.id);
            setRemoteTab(null);
            
            // Notify source window that we claimed it
            emit('tab-claimed', { tabId, claimedBy: windowLabel.current });
        } else {
            setRemoteTab(null);
        }
    });

    const unlistenClaimed = listen('tab-claimed', (event: TabClaimedEvent) => {
        const { tabId, claimedBy } = event.payload;
        if (claimedBy === windowLabel.current) return;

        // If we were dragging this tab, remove it
        setTabs(prev => {
            const exists = prev.find(t => t.id === tabId);
            if (exists) {
                // Mark as claimed to prevent spawning new window
                if (pendingDropRef.current && pendingDropRef.current.id === tabId) {
                    pendingDropRef.current.claimed = true;
                }
                const newTabs = prev.filter(t => t.id !== tabId);
                // If we removed the active tab, switch to another
                if (activeTabId === tabId) {
                     const nextTab = newTabs.length > 0 ? newTabs[newTabs.length - 1] : null;
                     setActiveTabId(nextTab ? nextTab.id : null);
                }
                return newTabs;
            }
            return prev;
        });
    });

    return () => {
        unlistenMove.then(f => f());
        unlistenDrop.then(f => f());
        unlistenClaimed.then(f => f());
    };
  }, [activeTabId, setLanguage]); // Removed remoteTab dependency

  // Tab Management
  const openTab = (tab: Tab) => {
    const existing = tabs.find(t => t.id === tab.id);
    if (existing) {
        setActiveTabId(existing.id);
    } else {
        setTabs([...tabs, tab]);
        setActiveTabId(tab.id);
    }
  };

  const closeTab = (id: string) => {
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  const handleReorder = (oldIndex: number, newIndex: number) => {
      setTabs((items) => arrayMove(items, oldIndex, newIndex));
  };

  const handleTabOut = async (tabId: string) => {
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) return;
      
      pendingDropRef.current = { id: tabId, claimed: false };

      setTimeout(async () => {
          if (pendingDropRef.current && pendingDropRef.current.id === tabId && pendingDropRef.current.claimed) {
              console.log("Tab claimed by another window, not spawning new one.");
              return;
          }

          const label = `win-${Date.now()}`;
          const tabDataStr = encodeURIComponent(JSON.stringify(tab));
          const url = `/index.html?initTab=${tabDataStr}`;
          
          try {
              await invoke("create_window", { label, url });
              closeTab(tabId);
          } catch (e) {
              console.error("Failed to detach tab", e);
          }
      }, 200);
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
  
        const handleOpenFile = (profile: string, bucket: string, fileKey: string) => {
            openTab({
                id: `details-${profile}-${bucket}-${fileKey}`,
                title: fileKey.split('/').pop() || fileKey,
                type: 'file-details',
                data: { profile, bucket, fileKey },
                active: true
            });
        };
    
        // Render Sidebar Content based on Activity
        const renderSidebar = () => {
          switch (activeActivity) {          case "files":
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

  // Render Main Content
  const renderMainContent = () => {
      if (tabs.length === 0) {
          return (
              <div className="flex-1 flex items-center justify-center text-[#3e3e42] select-none h-full">
                  <div className="flex flex-col items-center">
                    <div className="codicon codicon-telescope text-6xl mb-4"></div>
                    <p>{t("selectBucket")}</p>
                  </div>
              </div>
          );
      }

            return tabs.map(tab => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                      key={tab.id}
                      className="h-full w-full"
                      style={{ display: isActive ? 'block' : 'none' }}
                  >
                      {renderTabContent(tab, isActive)}
                  </div>
                );
            });
        };
      
  const renderTabContent = (tab: Tab, isActive: boolean) => {
      switch (tab.type) {
          case "file-browser":
              if (!tab.data) return <div>{t("error")}: Missing tab data</div>;
              return <FileBrowser 
                        profile={tab.data.profile} 
                        bucket={tab.data.bucket} 
                        isActive={isActive} 
                        onOpenFile={(key) => handleOpenFile(tab.data.profile!, tab.data.bucket!, key)}
                     />;
          case "file-details":
              if (!tab.data || !tab.data.fileKey) return <div>{t("error")}: Missing file key</div>;
              return <FileDetails 
                        profile={tab.data.profile} 
                        bucket={tab.data.bucket} 
                        fileKey={tab.data.fileKey} 
                     />;
          case "profiles":
              return <ProfilesView />;
          case "settings":
              return <SettingsView />;
          default:
              return <div>Unknown Tab Type</div>;
      }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-sm bg-[#1e1e1e] text-[#cccccc]">
      <TitleBar />
      
      <TabBar 
        tabs={tabs.map(t => ({ ...t, active: t.id === activeTabId }))}
        onTabClick={setActiveTabId}
        onTabClose={closeTab}
        onReorder={handleReorder}
        onTabOut={handleTabOut}
        remoteTab={remoteTab}
      />

      <div className="flex-1 flex flex-row overflow-hidden">
        <ActivityBar 
            activeTab={activeActivity} 
            onTabChange={setActiveActivity} 
            onOpenSettings={handleOpenSettings}
            isSettingsTabActive={activeTabId === 'settings'}
        />

        {renderSidebar()}

        <MainContent>
            {renderMainContent()}
        </MainContent>
      </div>
      
      <StatusBar />
    </div>
  );
}

export default function App() {
    return (
        <NotificationProvider>
            <StatusBarProvider>
                <I18nProvider>
                    <AppContent />
                    <NotificationCenter />
                </I18nProvider>
            </StatusBarProvider>
        </NotificationProvider>
    );
}
