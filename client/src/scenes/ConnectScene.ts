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

  private async connectToServer() {
    try {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const host = window.location.hostname;
      const port = "2567";
      const endpoint = `${protocol}://${host}:${port}`;

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
