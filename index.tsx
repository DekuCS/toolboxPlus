import { definePlugin } from "@utils/types";
import { Webpack } from "@utils/webpack";
import { patcher } from "@utils/patcher";
import React, { useState, useEffect } from "react";

// 1. Discord Webpack Module suchen
const HeaderBar = Webpack.findByProps("Icon", "Title");
const ModalActions = Webpack.findByProps("openModal", "closeModal");
const ModalComponents = Webpack.findByProps("ModalRoot", "ModalContent");
const SwitchItem = Webpack.findByDisplayName("SwitchItem");
const Button = Webpack.findByProps("Sizes", "Colors", "Looks");
const TextArea = Webpack.findByDisplayName("TextArea");
const Tooltip = Webpack.findByProps("TooltipContainer")?.TooltipContainer;

// Icon für die Toolbox (Standard SVG)
const ToolboxIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <path d="M12 11v6"></path>
        <path d="M9 14h6"></path>
    </svg>
);

export default definePlugin({
    name: "ToolboxPlus",
    description: "Fügt eine Toolbox in der Top-Bar für Schnellfunktionen und Plugin-Injektion hinzu.",
    authors: [{ name: "DeinName", id: 0n }],

    start() {
        // Starte alle dynamisch gespeicherten Plugins beim Discord-Start
        this.loadDynamicPlugins();

        // Patch die HeaderBar (Navigationsleiste oben rechts)
        if (HeaderBar) {
            patcher.after(HeaderBar, "default", (_, __, res) => {
                const toolbar = res?.props?.toolbar;
                if (!toolbar) return;

                // Verhindern, dass der Button mehrfach rendert
                if (toolbar.some((item: any) => item?.key === "vencord-toolbox-btn")) return;

                // Button in die Toolbar pushen
                toolbar.push(
                    <div key="vencord-toolbox-btn" style={{ cursor: "pointer", display: "flex", alignItems: "center", marginRight: "8px" }}>
                        <Tooltip text="Toolbox öffnen" position="bottom">
                            {(props: any) => (
                                <div {...props} onClick={() => this.openToolboxModal()}>
                                    <ToolboxIcon />
                                </div>
                            )}
                        </Tooltip>
                    </div>
                );
            });
        }
    },

    stop() {
        patcher.unpatchAll();
    },

    // Das Popup-Menü (Modal)
    openToolboxModal() {
        if (!ModalActions || !ModalComponents) return;

        const { ModalRoot, ModalHeader, ModalContent, ModalCloseButton } = ModalComponents;

        ModalActions.openModal((props: any) => {
            const [fakeDeaf, setFakeDeaf] = useState(localStorage.getItem("toolbox_fake_deaf") === "true");
            const [pluginCode, setPluginCode] = useState("");

            // Fake Deafen Toggle Handler
            const handleFakeDeafChange = (v: boolean) => {
                setFakeDeaf(v);
                localStorage.setItem("toolbox_fake_deaf", String(v));
                // HIER: Deine Logik für das Gateway/Voice-State-Intercepting triggern
                console.log(`Fake Deafen ist jetzt: ${v}`);
            };

            // Dynamisches Plugin speichern
            const installPlugin = () => {
                if (!pluginCode.trim()) return;
                try {
                    const savedPlugins = JSON.parse(localStorage.getItem("vencord_dynamic_plugins") || "[]");
                    savedPlugins.push(pluginCode);
                    localStorage.setItem("vencord_dynamic_plugins", JSON.stringify(savedPlugins));
                    
                    // Sofort im laufenden Betrieb ausführen
                    new Function(pluginCode)();
                    
                    setPluginCode("");
                    alert("Plugin erfolgreich injiziert und für zukünftige Starts gespeichert!");
                } catch (err) {
                    alert("Fehler beim Kompilieren des Plugins: " + err);
                }
            };

            return (
                <ModalRoot {...props} size="medium">
                    <ModalHeader justify="space-between">
                        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff" }}>🧰 Vencord Toolbox</div>
                        <ModalCloseButton onClick={props.onClose} />
                    </ModalHeader>
                    
                    <ModalContent style={{ padding: "20px", color: "#ddd" }}>
                        {/* SEKTION 1: SCHNELLFUNKTIONEN */}
                        <div style={{ marginBottom: "24px" }}>
                            <h3 style={{ color: "#fff", marginBottom: "10px" }}>Funktionen</h3>
                            <SwitchItem value={fakeDeaf} onChange={handleFakeDeafChange}>
                                Fake Deafen aktivieren
                            </SwitchItem>
                        </div>

                        <hr style={{ border: "0", borderTop: "1px solid #444", margin: "20px 0" }} />

                        {/* SEKTION 2: RUNTIME INJECTOR */}
                        <div>
                            <h3 style={{ color: "#fff", marginBottom: "5px" }}>User-Plugin direkt hinzufügen</h3>
                            <p style={{ fontSize: "12px", color: "#aaa", marginBottom: "10px" }}>
                                Füge hier den reinen JavaScript/TypeScript Code ein. Er wird sofort ausgeführt und bei jedem Discord-Start geladen.
                            </p>
                            
                            {TextArea && (
                                <TextArea 
                                    value={pluginCode} 
                                    onChange={(v: string) => setPluginCode(v)} 
                                    placeholder="export default definePlugin({ ... }) oder reiner JS Code..."
                                    rows={8}
                                    style={{ backgroundColor: "#1e1f22", color: "#fff", fontFamily: "monospace" }}
                                />
                            )}

                            <div style={{ marginTop: "15px", display: "flex", justifyContent: "flex-end" }}>
                                <Button 
                                    size={Button?.Sizes?.MEDIUM} 
                                    color={Button?.Colors?.GREEN}
                                    onClick={installPlugin}
                                >
                                    Plugin injizieren & speichern
                                </Button>
                            </div>
                        </div>
                    </ModalContent>
                </ModalRoot>
            );
        });
    },

    // Lädt die injizierten Plugins aus dem Speicher
    loadDynamicPlugins() {
        try {
            const savedPlugins = JSON.parse(localStorage.getItem("vencord_dynamic_plugins") || "[]");
            savedPlugins.forEach((code: string) => {
                // Führt den Code im globalen Kontext aus
                new Function(code)();
            });
        } catch (e) {
            console.error("[ToolboxPlus] Fehler beim Laden dynamischer Plugins", e);
        }
    }
});