import Phaser from "phaser";
import * as Colyseus from "colyseus.js";

interface ConnectData {
  action: "create" | "join";
  roomId?: string;
  serverUrl: string;
}

export class ConnectScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "ConnectScene" });
  }

  create(data: ConnectData) {
    this.statusText = this.add
      .text(400, 300, "Connecting...", {
        fontSize: "24px",
        color: "#e94560",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.connectToServer(data);
  }

  private async connectToServer(data: ConnectData) {
    try {
      const endpoint = data.serverUrl;
      console.log("Connecting to:", endpoint, "action:", data.action);

      const client = new Colyseus.Client(endpoint);
      let room: Colyseus.Room;

      if (data.action === "join" && data.roomId) {
        room = await client.joinById(data.roomId);
      } else {
        room = await client.create("game");
      }

      this.statusText.setText("Connected! Entering dungeon...");

      this.time.delayedCall(500, () => {
        this.scene.start("GameScene", { room, client });
      });
    } catch (err) {
      console.error("Connection error:", err);
      this.statusText.setText("Connection failed!\nClick to go back.");
      this.input.once("pointerdown", () => {
        this.scene.start("MenuScene");
      });
    }
  }
}
