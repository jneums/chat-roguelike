import Phaser from "phaser";
import { Room } from "colyseus.js";
import { GameConfig, TileType, Direction } from "@chat-roguelike/shared";

const TILE = GameConfig.TILE_SIZE;
const COLORS = {
  BG: 0x1a1a2e,
  FLOOR: 0x16213e,
  WALL: 0x0f3460,
  ENEMY: 0xe94560,
  HP_BAR_BG: 0x333333,
  HP_BAR: 0x00ff88,
};

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private playerSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private enemySprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private inputCooldown = 0;
  private mapDrawn = false;
  private escKey!: Phaser.Input.Keyboard.Key;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private isPaused = false;

  constructor() {
    super({ key: "GameScene" });
  }

  init(data: { room: Room }) {
    this.room = data.room;
  }

  create() {
    // Reset state for scene restart
    this.playerSprites = new Map();
    this.enemySprites = new Map();
    this.mapDrawn = false;
    this.isPaused = false;
    this.pauseOverlay = null;
    this.inputCooldown = 0;

    // Set up keyboard input
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Escape key for pause menu
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on("down", () => {
      if (this.isPaused) {
        this.hidePauseOverlay();
      } else {
        this.showPauseOverlay();
      }
    });

    // Tile layer
    this.tileGraphics = this.add.graphics();
    this.tileGraphics.setDepth(0);

    // Set camera bounds
    this.cameras.main.setBounds(
      0, 0,
      GameConfig.MAP_WIDTH * TILE,
      GameConfig.MAP_HEIGHT * TILE
    );

    // Listen for state changes
    this.setupStateListeners();

    // Handle disconnect
    this.room.onLeave(() => {
      if (this.scene.isActive()) {
        this.scene.start("MenuScene");
      }
    });
  }

  private showPauseOverlay() {
    if (this.pauseOverlay) return;
    this.isPaused = true;

    const cam = this.cameras.main;
    this.pauseOverlay = this.add.container(0, 0);
    this.pauseOverlay.setDepth(100);
    this.pauseOverlay.setScrollFactor(0);

    // Dim background
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.7);
    dimBg.fillRect(0, 0, cam.width, cam.height);
    dimBg.setScrollFactor(0);
    this.pauseOverlay.add(dimBg);

    // Click on dim area dismisses
    const dismissZone = this.add.zone(0, 0, cam.width, cam.height).setOrigin(0, 0).setScrollFactor(0).setInteractive();
    dismissZone.on("pointerdown", () => this.hidePauseOverlay());
    this.pauseOverlay.add(dismissZone);

    // "PAUSED" text
    const pausedText = this.add
      .text(cam.width / 2, cam.height / 2 - 60, "PAUSED", {
        fontSize: "36px",
        color: "#e94560",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.pauseOverlay.add(pausedText);

    // Leave Room button
    const btnW = 220;
    const btnH = 44;
    const btnX = cam.width / 2;
    const btnY = cam.height / 2 + 10;

    const btnBg = this.add.graphics();
    btnBg.setScrollFactor(0);
    const drawNormal = () => {
      btnBg.clear();
      btnBg.fillStyle(0xe94560, 1);
      btnBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
    };
    const drawHover = () => {
      btnBg.clear();
      btnBg.fillStyle(0xff5577, 1);
      btnBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
    };
    drawNormal();
    this.pauseOverlay.add(btnBg);

    const btnText = this.add
      .text(btnX, btnY, "LEAVE ROOM", {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.pauseOverlay.add(btnText);

    const btnZone = this.add
      .zone(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    btnZone.on("pointerover", drawHover);
    btnZone.on("pointerout", drawNormal);
    btnZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.leaveRoom();
    });
    this.pauseOverlay.add(btnZone);

    // ESC hint
    const hintText = this.add
      .text(cam.width / 2, btnY + 50, "Press ESC to resume", {
        fontSize: "12px",
        color: "#666688",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.pauseOverlay.add(hintText);
  }

  private hidePauseOverlay() {
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy(true);
      this.pauseOverlay = null;
    }
    this.isPaused = false;
  }

  private leaveRoom() {
    this.hidePauseOverlay();
    this.room.leave();
    this.scene.start("MenuScene");
  }

  private setupStateListeners() {
    const state = this.room.state as any;

    // Draw map when tiles are available
    state.tiles.onAdd(() => {
      if (!this.mapDrawn && state.tiles.length >= GameConfig.MAP_WIDTH * GameConfig.MAP_HEIGHT) {
        this.drawMap(state.tiles, state.width);
        this.mapDrawn = true;
      }
    });

    // Player add
    state.players.onAdd((player: any, sessionId: string) => {
      const container = this.createPlayerSprite(player);
      this.playerSprites.set(sessionId, container);

      // Follow local player
      if (sessionId === this.room.sessionId) {
        this.cameras.main.startFollow(container, true, 0.1, 0.1);
      }

      // Listen to changes
      player.onChange(() => {
        this.updatePlayerSprite(sessionId, player);
      });
    });

    // Player remove
    state.players.onRemove((_player: any, sessionId: string) => {
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) {
        sprite.destroy();
        this.playerSprites.delete(sessionId);
      }
    });

    // Enemy add
    state.enemies.onAdd((enemy: any, id: string) => {
      const container = this.createEnemySprite(enemy);
      this.enemySprites.set(id, container);

      enemy.onChange(() => {
        this.updateEnemySprite(id, enemy);
      });
    });

    // Enemy remove
    state.enemies.onRemove((_enemy: any, id: string) => {
      const sprite = this.enemySprites.get(id);
      if (sprite) {
        sprite.destroy();
        this.enemySprites.delete(id);
      }
    });
  }

  private drawMap(tiles: any, width: number) {
    this.tileGraphics.clear();
    const height = GameConfig.MAP_HEIGHT;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y * width + x];
        if (tile === TileType.WALL) {
          this.tileGraphics.fillStyle(COLORS.WALL, 1);
        } else {
          this.tileGraphics.fillStyle(COLORS.FLOOR, 1);
        }
        this.tileGraphics.fillRect(x * TILE, y * TILE, TILE, TILE);

        // Grid lines for floor tiles
        if (tile === TileType.FLOOR) {
          this.tileGraphics.lineStyle(1, 0x1a1a3e, 0.3);
          this.tileGraphics.strokeRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
  }

  private createPlayerSprite(player: any): Phaser.GameObjects.Container {
    const container = this.add.container(
      player.x * TILE + TILE / 2,
      player.y * TILE + TILE / 2
    );
    container.setDepth(10);

    // Body
    const color = Phaser.Display.Color.HexStringToColor(player.color).color;
    const body = this.add.graphics();
    body.fillStyle(color, 1);
    body.fillCircle(0, 0, TILE / 2 - 2);
    body.lineStyle(2, 0xffffff, 0.5);
    body.strokeCircle(0, 0, TILE / 2 - 2);
    container.add(body);

    // HP bar background
    const hpBg = this.add.graphics();
    hpBg.fillStyle(COLORS.HP_BAR_BG, 0.8);
    hpBg.fillRect(-TILE / 2, -TILE / 2 - 6, TILE, 4);
    container.add(hpBg);

    // HP bar fill
    const hpBar = this.add.graphics();
    const hpRatio = player.hp / player.maxHp;
    hpBar.fillStyle(COLORS.HP_BAR, 1);
    hpBar.fillRect(-TILE / 2, -TILE / 2 - 6, TILE * hpRatio, 4);
    container.add(hpBar);

    // Store reference for updates
    (container as any).hpBar = hpBar;
    (container as any).hpBg = hpBg;
    (container as any).bodyGfx = body;

    return container;
  }

  private updatePlayerSprite(sessionId: string, player: any) {
    const container = this.playerSprites.get(sessionId);
    if (!container) return;

    container.x = player.x * TILE + TILE / 2;
    container.y = player.y * TILE + TILE / 2;

    // Update HP bar
    const hpBar = (container as any).hpBar as Phaser.GameObjects.Graphics;
    if (hpBar) {
      hpBar.clear();
      const hpRatio = Math.max(0, player.hp / player.maxHp);
      const barColor = hpRatio > 0.5 ? COLORS.HP_BAR : 0xff4444;
      hpBar.fillStyle(barColor, 1);
      hpBar.fillRect(-TILE / 2, -TILE / 2 - 6, TILE * hpRatio, 4);
    }

    // Dim if dead
    container.setAlpha(player.hp > 0 ? 1 : 0.3);
  }

  private createEnemySprite(enemy: any): Phaser.GameObjects.Container {
    const container = this.add.container(
      enemy.x * TILE + TILE / 2,
      enemy.y * TILE + TILE / 2
    );
    container.setDepth(5);

    const body = this.add.graphics();
    body.fillStyle(COLORS.ENEMY, 1);
    // Diamond shape for enemies
    body.fillTriangle(
      0, -(TILE / 2 - 3),
      -(TILE / 2 - 3), 0,
      0, TILE / 2 - 3
    );
    body.fillTriangle(
      0, -(TILE / 2 - 3),
      TILE / 2 - 3, 0,
      0, TILE / 2 - 3
    );
    container.add(body);

    return container;
  }

  private updateEnemySprite(id: string, enemy: any) {
    const container = this.enemySprites.get(id);
    if (!container) return;

    container.x = enemy.x * TILE + TILE / 2;
    container.y = enemy.y * TILE + TILE / 2;
    container.setAlpha(enemy.hp > 0 ? 1 : 0.2);
  }

  update(time: number, delta: number) {
    // Don't process input while paused
    if (this.isPaused) return;

    // Input handling with cooldown (150ms between moves for grid-based movement)
    this.inputCooldown -= delta;
    if (this.inputCooldown > 0) return;

    let direction: Direction | null = null;

    if (this.keys.W.isDown) direction = Direction.UP;
    else if (this.keys.S.isDown) direction = Direction.DOWN;
    else if (this.keys.A.isDown) direction = Direction.LEFT;
    else if (this.keys.D.isDown) direction = Direction.RIGHT;

    if (direction) {
      this.room.send("input", {
        direction,
        timestamp: Date.now(),
      });
      this.inputCooldown = 120;
    }
  }
}
