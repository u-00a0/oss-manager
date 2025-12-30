import React, { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    settings: "Settings",
    language: "Language",
    defaultDownloadDir: "Default Download Location",
    browse: "Browse",
    about: "About",
    version: "Version",
    author: "Author",
    save: "Save",
    saved: "Settings Saved",
    explorer: "Explorer",
    profiles: "Profiles",
    files: "Files",
    welcome: "Welcome",
    ready: "Ready",
    loading: "Loading...",
    error: "Error",
    profileName: "Profile Name",
    provider: "Provider",
    accessKey: "Access Key ID",
    secretKey: "Secret Access Key",
    region: "Region",
    endpoint: "Endpoint",
    cancel: "Cancel",
    delete: "Delete",
    confirmDelete: "Are you sure you want to delete profile",
    editProfile: "Edit Profile",
    newProfile: "New Profile",
    noProfiles: "No profiles found.",
    pleaseCreateProfile: "Please create a profile first.",
    backToBuckets: "Back to Buckets",
    fileListingNotImplemented: "File listing not yet implemented.",
    manageProfiles: "Manage Profiles",
    openSettings: "Open Settings",
    selectBucket: "Select a bucket to view files",
    ossManager: "OSS Manager",
    checkForUpdates: "Check for Updates",
    keyboardShortcuts: "Keyboard Shortcuts"
  },
  zh: {
    settings: "设置",
    language: "语言",
    defaultDownloadDir: "默认下载位置",
    browse: "浏览",
    about: "关于",
    version: "版本",
    author: "作者",
    save: "保存",
    saved: "设置已保存",
    explorer: "资源管理器",
    profiles: "配置文件",
    files: "文件",
    welcome: "欢迎",
    ready: "就绪",
    loading: "加载中...",
    error: "错误",
    profileName: "配置名称",
    provider: "提供商",
    accessKey: "Access Key ID",
    secretKey: "Secret Access Key",
    region: "区域 (Region)",
    endpoint: "服务端点 (Endpoint)",
    cancel: "取消",
    delete: "删除",
    confirmDelete: "确定要删除配置文件",
    editProfile: "编辑配置",
    newProfile: "新建配置",
    noProfiles: "未找到配置文件。",
    pleaseCreateProfile: "请先创建一个配置文件。",
    backToBuckets: "返回存储桶列表",
    fileListingNotImplemented: "文件列表功能尚未实现。",
    manageProfiles: "管理配置文件",
    openSettings: "打开设置",
    selectBucket: "请选择一个存储桶以查看文件",
    ossManager: "对象存储管理器",
    checkForUpdates: "检查更新",
    keyboardShortcuts: "键盘快捷方式"
  }
};

export type Language = 'en' | 'zh';
type Translations = typeof translations.en;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: keyof Translations) => {
    return translations[language][key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
