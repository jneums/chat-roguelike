import Phaser from "phaser";
import * as Colyseus from "colyseus.js";

export class ConnectScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "ConnectScene" });
  }

  create() {
    this.statusText = this.add
      .text(400, 300, "Connecting...", {
        fontSize: "24px",
        color: "#e94560",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.connectToServer();
  }

  private getServerUrl(): string {
    // In production/preview: VITE_SERVER_URL is set by Render to the server's host
    const serverUrl = import.meta.env.VITE_SERVER_URL;
    if (serverUrl) {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      // serverUrl from Render is like "chat-roguelike-server-xxxx.onrender.com:443"
      const host = serverUrl.replace(/:443$/, "").replace(/^https?:\/\//, "");
      return `${protocol}://${host}`;
    }
    // Local dev: connect to localhost game server via Vite proxy
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.hostname}:2567`;
  }

  private async connectToServer() {
    try {
      const endpoint = this.getServerUrl();
      console.log("Connecting to:", endpoint);

      const client = new Colyseus.Client(endpoint);
      const room = await client.joinOrCreate("game");

      this.statusText.setText("Connected! Entering dungeon...");

      // Small delay for visual feedback
      this.time.delayedCall(500, () => {
        this.scene.start("GameScene", { room, client });
      });
    } catch (err) {
      console.error("Connection error:", err);
      this.statusText.setText("Connection failed!\nClick to retry.");
      this.input.once("pointerdown", () => {
        this.statusText.setText("Connecting...");
        this.connectToServer();
      });
    }
  }
}
