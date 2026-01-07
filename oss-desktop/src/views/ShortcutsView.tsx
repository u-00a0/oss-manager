import { useI18n } from "../contexts/I18nContext";

export default function ShortcutsView() {
    const { t } = useI18n();

    const shortcuts = [
        { category: t("general"), items: [
            { key: "Ctrl + Shift + N", desc: t("newWindow") },
            { key: "Ctrl + ,", desc: t("settings") },
            { key: "Ctrl + W", desc: t("closeTab") },
            { key: "Ctrl + R", desc: t("reloadWindow") },
            { key: "F11", desc: t("toggleFullscreen") },
        ]},
        { category: t("file"), items: [
            { key: "F5", desc: t("refresh") },
            { key: "Enter", desc: t("enterDirectory") },
            { key: "Delete", desc: t("deleteSelected") },
            { key: "Alt + Up", desc: t("goUp") },
            { key: "Ctrl + A", desc: t("selectAll") },
            { key: "Ctrl + C", desc: t("copy") },
            { key: "Ctrl + X", desc: t("cut") },
            { key: "Ctrl + V", desc: t("paste") },
            { key: "Ctrl + Shift + S", desc: t("saveAs") },
            { key: "F2", desc: `${t("rename")} (${t("comingSoon")})` },
        ]},
        { category: t("search"), items: [
            { key: "Ctrl + F", desc: t("find") },
            { key: "Ctrl + P", desc: t("goToFile") },
        ]}
    ];

    return (
        <div className="p-6 text-[#cccccc] max-w-4xl mx-auto h-full overflow-y-auto select-none">
            <h1 className="text-2xl font-bold mb-6">{t("keyboardShortcutsTitle")}</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {shortcuts.map(cat => (
                    <div key={cat.category}>
                        <h2 className="text-lg font-semibold mb-4 text-[#007fd4] border-b border-[#3e3e42] pb-2">{cat.category}</h2>
                        <div className="space-y-2">
                            {cat.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center group hover:bg-[#2a2d2e] p-2 rounded">
                                    <span className="text-sm text-[#cccccc]">{item.desc}</span>
                                    <span className="flex gap-1">
                                        {item.key.split(" + ").map((k, i) => (
                                            <span key={i} className="bg-[#3c3c3c] border border-[#454545] rounded px-1.5 py-0.5 text-xs font-mono text-[#e7e7e7] shadow-sm min-w-[20px] text-center">
                                                {k}
                                            </span>
                                        ))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
