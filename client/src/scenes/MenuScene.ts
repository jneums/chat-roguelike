import Phaser from "phaser";

interface RoomListing {
  roomId: string;
  clients: number;
  maxClients: number;
  metadata?: any;
}

export class MenuScene extends Phaser.Scene {
  private roomListContainer: Phaser.GameObjects.Container | null = null;
  private refreshTimer: Phaser.Time.TimerEvent | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "MenuScene" });
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.cameras.main.setBackgroundColor("#1a1a2e");

    // Title
    this.add
      .text(width / 2, 60, "DUNGEON CRAWL", {
        fontSize: "48px",
        color: "#e94560",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, 105, "multiplayer roguelike", {
        fontSize: "16px",
        color: "#555577",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Create Room button
    this.createButton(width / 2, 160, "⚔  CREATE ROOM", () => {
      this.scene.start("ConnectScene", {
        action: "create",
        serverUrl: this.getWsUrl(),
      });
    });

    // Fullscreen button (useful on mobile to hide browser chrome)
    if (document.fullscreenEnabled || (document as any).webkitFullscreenEnabled) {
      this.createButton(width / 2, 215, "⛶  FULLSCREEN", () => {
        const el = document.documentElement as any;
        if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
          (el.requestFullscreen?.() || el.webkitRequestFullscreen?.());
        } else {
          (document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.());
        }
      });
    }

    // Rooms header
    this.add
      .text(width / 2, 270, "— AVAILABLE ROOMS —", {
        fontSize: "18px",
        color: "#888899",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Status text (loading / no rooms)
    this.statusText = this.add
      .text(width / 2, 350, "Loading rooms...", {
        fontSize: "14px",
        color: "#555577",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Container for room list items
    this.roomListContainer = this.add.container(0, 0);

    // Fetch rooms immediately and then every 3 seconds
    this.fetchRooms();
    this.refreshTimer = this.time.addEvent({
      delay: 3000,
      callback: this.fetchRooms,
      callbackScope: this,
      loop: true,
    });
  }

  shutdown() {
    if (this.refreshTimer) {
      this.refreshTimer.destroy();
      this.refreshTimer = null;
    }
  }

  private getHttpUrl(): string {
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

  private getWsUrl(): string {
    const serverUrl = import.meta.env.VITE_SERVER_URL;
    if (serverUrl) {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const host = serverUrl.replace(/:443$/, "").replace(/^https?:\/\//, "");
      return `${protocol}://${host}`;
    }
    const hostname = window.location.hostname;
    if (hostname.includes(".onrender.com")) {
      const serverHost = hostname.replace("-client", "-server");
      return `wss://${serverHost}`;
    }
    return `ws://${hostname}:2567`;
  }

  private async fetchRooms() {
    try {
      const httpUrl = this.getHttpUrl();
      const response = await fetch(`${httpUrl}/matchmake/game`);
      const rooms: RoomListing[] = await response.json();
      this.displayRooms(rooms);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
      if (this.statusText) {
        this.statusText.setText("Could not reach server...");
        this.statusText.setVisible(true);
      }
    }
  }

  private displayRooms(rooms: RoomListing[]) {
    if (!this.roomListContainer) return;

    // Clear previous entries
    this.roomListContainer.removeAll(true);

    const { width } = this.scale;
    const startY = 300;

    if (rooms.length === 0) {
      if (this.statusText) {
        this.statusText.setText("No rooms yet — create one!");
        this.statusText.setVisible(true);
        this.statusText.setY(350);
      }
      return;
    }

    if (this.statusText) {
      this.statusText.setVisible(false);
    }

    rooms.forEach((room, index) => {
      const y = startY + index * 55;
      if (y > 580) return; // Don't overflow

      const btnW = 400;
      const btnH = 42;
      const btnX = width / 2 - btnW / 2;

      // Background rect
      const bg = this.add.graphics();
      bg.fillStyle(0x16213e, 1);
      bg.fillRoundedRect(btnX, y, btnW, btnH, 6);
      bg.lineStyle(1, 0x0f3460, 1);
      bg.strokeRoundedRect(btnX, y, btnW, btnH, 6);
      this.roomListContainer!.add(bg);

      // Room ID text
      const roomLabel = this.add
        .text(btnX + 16, y + btnH / 2, `Room ${room.roomId.slice(0, 8)}`, {
          fontSize: "15px",
          color: "#e0e0e0",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0.5);
      this.roomListContainer!.add(roomLabel);

      // Player count
      const playerCount = this.add
        .text(
          btnX + btnW - 16,
          y + btnH / 2,
          `${room.clients}/${room.maxClients} players`,
          {
            fontSize: "14px",
            color: "#00ff88",
            fontFamily: "monospace",
          }
        )
        .setOrigin(1, 0.5);
      this.roomListContainer!.add(playerCount);

      // Hit zone for interaction
      const hitZone = this.add
        .zone(btnX, y, btnW, btnH)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      hitZone.on("pointerover", () => {
        bg.clear();
        bg.fillStyle(0x1a2a4e, 1);
        bg.fillRoundedRect(btnX, y, btnW, btnH, 6);
        bg.lineStyle(2, 0xe94560, 1);
        bg.strokeRoundedRect(btnX, y, btnW, btnH, 6);
      });

      hitZone.on("pointerout", () => {
        bg.clear();
        bg.fillStyle(0x16213e, 1);
        bg.fillRoundedRect(btnX, y, btnW, btnH, 6);
        bg.lineStyle(1, 0x0f3460, 1);
        bg.strokeRoundedRect(btnX, y, btnW, btnH, 6);
      });

      hitZone.on("pointerdown", () => {
        this.scene.start("ConnectScene", {
          action: "join",
          roomId: room.roomId,
          serverUrl: this.getWsUrl(),
        });
      });

      this.roomListContainer!.add(hitZone);
    });
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void
  ) {
    const btnW = 280;
    const btnH = 44;

    const bg = this.add.graphics();
    const drawNormal = () => {
      bg.clear();
      bg.fillStyle(0xe94560, 1);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 8);
    };
    const drawHover = () => {
      bg.clear();
      bg.fillStyle(0xff5577, 1);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 8);
    };
    drawNormal();

    const text = this.add
      .text(x, y, label, {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const zone = this.add
      .zone(x - btnW / 2, y - btnH / 2, btnW, btnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    zone.on("pointerover", drawHover);
    zone.on("pointerout", drawNormal);
    zone.on("pointerdown", onClick);

    return { bg, text, zone };
  }
}
