import Phaser from "phaser";
import { MenuScene } from "./scenes/MenuScene";
import { ConnectScene } from "./scenes/ConnectScene";
import { GameScene } from "./scenes/GameScene";
import { startVersionCheck, getClientVersion } from "./utils/versionCheck";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: "game-container",
  backgroundColor: "#1a1a2e",
  pixelArt: true,
  scene: [MenuScene, ConnectScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);

// --- Update banner ---
startVersionCheck(() => {
  const banner = document.createElement("div");
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #1a1a2e; color: #f0a500; font-family: monospace;
    font-size: 14px; padding: 8px 16px; text-align: center;
    border-bottom: 2px solid #f0a500; display: flex;
    align-items: center; justify-content: center; gap: 12px;
  `;
  banner.innerHTML = `
    <span>🔄 New version available</span>
    <button style="background:#f0a500;color:#1a1a2e;border:none;padding:4px 12px;
      font-family:monospace;font-size:13px;cursor:pointer;border-radius:3px;
      font-weight:bold;">Reload</button>
  `;
  banner.querySelector("button")!.onclick = () => window.location.reload();
  document.body.prepend(banner);
});

// --- Version overlay (bottom-right) ---
const versionOverlay = document.createElement("div");
versionOverlay.style.cssText = `
  position: fixed; bottom: 4px; right: 6px; z-index: 9998;
  font-family: monospace; font-size: 10px; color: rgba(255,255,255,0.35);
  pointer-events: none; text-align: right; line-height: 1.4;
`;
versionOverlay.textContent = `client: ${getClientVersion()}`;
document.body.appendChild(versionOverlay);

// Fetch server version
function getServerUrl(): string {
  const serverUrl = import.meta.env.VITE_SERVER_URL;
  if (serverUrl) {
    const protocol = window.location.protocol === "https:" ? "https" : "http";
    const host = serverUrl.replace(/:443$/, "").replace(/^https?:\/\//, "");
    return `${protocol}://${host}`;
  }
  const hostname = window.location.hostname;
  if (hostname.includes(".onrender.com")) {
    const serverHost = hostname.replace("-client", "-server");
    return `https://${serverHost}`;
  }
  return `http://${hostname}:2567`;
}

fetch(`${getServerUrl()}/version`)
  .then((r) => r.json())
  .then((data) => {
    versionOverlay.textContent = `client: ${getClientVersion()}\nserver: ${data.version}`;
    versionOverlay.style.whiteSpace = "pre";
  })
  .catch(() => {
    // server version unavailable, just show client
  });
