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
  PROJECTILE: 0xffff00,
};

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private playerSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private enemySprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private projectileSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private inputCooldown = 0;
  private shootCooldown = 0;
  private mapDrawn = false;
  private escKey!: Phaser.Input.Keyboard.Key;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private isPaused = false;

  // Touch controls state
  private touchDir: Direction | null = null;
  private touchShoot = false;
  private touchControlsContainer: Phaser.GameObjects.Container | null = null;
  private isTouchDevice = false;
  private dpadArrows: { up: Phaser.GameObjects.Graphics; down: Phaser.GameObjects.Graphics; left: Phaser.GameObjects.Graphics; right: Phaser.GameObjects.Graphics } | null = null;

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
    this.projectileSprites = new Map();
    this.mapDrawn = false;
    this.isPaused = false;
    this.pauseOverlay = null;
    this.inputCooldown = 0;
    this.touchDir = null;
    this.touchShoot = false;
    this.touchControlsContainer = null;
    this.dpadArrows = null;

    // Set up keyboard input
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
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

    // Create touch controls for mobile
    this.createTouchControls();

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

    // Projectile add
    state.projectiles.onAdd((proj: any, id: string) => {
      const container = this.add.container(
        proj.x * TILE + TILE / 2,
        proj.y * TILE + TILE / 2
      );
      container.setDepth(8);

      const gfx = this.add.graphics();
      const color = Phaser.Display.Color.HexStringToColor(proj.color).color;
      gfx.fillStyle(color, 1);
      gfx.fillCircle(0, 0, 6);
      container.add(gfx);

      this.projectileSprites.set(id, container);

      proj.onChange(() => {
        container.x = proj.x * TILE + TILE / 2;
        container.y = proj.y * TILE + TILE / 2;
      });
    });

    // Projectile remove
    state.projectiles.onRemove((_proj: any, id: string) => {
      const sprite = this.projectileSprites.get(id);
      if (sprite) {
        sprite.destroy();
        this.projectileSprites.delete(id);
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

  private createTouchControls() {
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!this.isTouchDevice) return;

    const cam = this.cameras.main;
    this.touchControlsContainer = this.add.container(0, 0);
    this.touchControlsContainer.setDepth(50);
    this.touchControlsContainer.setScrollFactor(0);

    // --- D-Pad (bottom-left) ---
    const dpadX = 90;
    const dpadY = cam.height - 90;
    const dpadRadius = 50;

    // Base circle
    const dpadBase = this.add.graphics();
    dpadBase.fillStyle(0x1a1a2e, 0.5);
    dpadBase.fillCircle(dpadX, dpadY, dpadRadius);
    dpadBase.lineStyle(2, 0xe94560, 0.3);
    dpadBase.strokeCircle(dpadX, dpadY, dpadRadius);
    dpadBase.setScrollFactor(0);
    this.touchControlsContainer.add(dpadBase);

    // Direction arrow helpers
    const drawArrow = (gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, dir: Direction, alpha: number) => {
      gfx.clear();
      gfx.fillStyle(0xe94560, alpha);
      const s = 10; // arrow size
      switch (dir) {
        case Direction.UP:
          gfx.fillTriangle(cx, cy - s, cx - s * 0.7, cy + s * 0.3, cx + s * 0.7, cy + s * 0.3);
          break;
        case Direction.DOWN:
          gfx.fillTriangle(cx, cy + s, cx - s * 0.7, cy - s * 0.3, cx + s * 0.7, cy - s * 0.3);
          break;
        case Direction.LEFT:
          gfx.fillTriangle(cx - s, cy, cx + s * 0.3, cy - s * 0.7, cx + s * 0.3, cy + s * 0.7);
          break;
        case Direction.RIGHT:
          gfx.fillTriangle(cx + s, cy, cx - s * 0.3, cy - s * 0.7, cx - s * 0.3, cy + s * 0.7);
          break;
      }
    };

    // Create arrow graphics
    const arrowOffset = 30;
    const upArrow = this.add.graphics().setScrollFactor(0);
    const downArrow = this.add.graphics().setScrollFactor(0);
    const leftArrow = this.add.graphics().setScrollFactor(0);
    const rightArrow = this.add.graphics().setScrollFactor(0);

    drawArrow(upArrow, dpadX, dpadY - arrowOffset, Direction.UP, 0.3);
    drawArrow(downArrow, dpadX, dpadY + arrowOffset, Direction.DOWN, 0.3);
    drawArrow(leftArrow, dpadX - arrowOffset, dpadY, Direction.LEFT, 0.3);
    drawArrow(rightArrow, dpadX + arrowOffset, dpadY, Direction.RIGHT, 0.3);

    this.touchControlsContainer.add([upArrow, downArrow, leftArrow, rightArrow]);
    this.dpadArrows = { up: upArrow, down: downArrow, left: leftArrow, right: rightArrow };

    // Interactive zone for d-pad
    const dpadZone = this.add.zone(dpadX, dpadY, dpadRadius * 2, dpadRadius * 2)
      .setScrollFactor(0)
      .setInteractive();

    const updateDpadDir = (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - dpadX;
      const dy = pointer.y - dpadY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 8) {
        this.touchDir = null;
        this.resetDpadHighlight(dpadX, dpadY, arrowOffset);
        return;
      }

      const angle = Math.atan2(dy, dx);
      // -PI/4 to PI/4 = right, PI/4 to 3PI/4 = down, etc
      let dir: Direction;
      if (angle >= -Math.PI / 4 && angle < Math.PI / 4) {
        dir = Direction.RIGHT;
      } else if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) {
        dir = Direction.DOWN;
      } else if (angle >= -3 * Math.PI / 4 && angle < -Math.PI / 4) {
        dir = Direction.UP;
      } else {
        dir = Direction.LEFT;
      }
      this.touchDir = dir;
      this.highlightDpadArrow(dir, dpadX, dpadY, arrowOffset);
    };

    dpadZone.on('pointerdown', updateDpadDir);
    dpadZone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) updateDpadDir(pointer);
    });
    dpadZone.on('pointerup', () => {
      this.touchDir = null;
      this.resetDpadHighlight(dpadX, dpadY, arrowOffset);
    });
    dpadZone.on('pointerout', () => {
      this.touchDir = null;
      this.resetDpadHighlight(dpadX, dpadY, arrowOffset);
    });

    this.touchControlsContainer.add(dpadZone);

    // --- Fire Button (bottom-right) ---
    const fireX = cam.width - 80;
    const fireY = cam.height - 90;
    const fireRadius = 35;

    const fireBg = this.add.graphics().setScrollFactor(0);
    fireBg.fillStyle(0xe94560, 0.4);
    fireBg.fillCircle(fireX, fireY, fireRadius);
    fireBg.lineStyle(2, 0xe94560, 0.6);
    fireBg.strokeCircle(fireX, fireY, fireRadius);
    this.touchControlsContainer.add(fireBg);

    // Crosshair inside fire button
    const crosshair = this.add.graphics().setScrollFactor(0);
    crosshair.lineStyle(2, 0xffffff, 0.6);
    crosshair.strokeCircle(fireX, fireY, 8);
    crosshair.lineBetween(fireX, fireY - 14, fireX, fireY - 4);
    crosshair.lineBetween(fireX, fireY + 4, fireX, fireY + 14);
    crosshair.lineBetween(fireX - 14, fireY, fireX - 4, fireY);
    crosshair.lineBetween(fireX + 4, fireY, fireX + 14, fireY);
    this.touchControlsContainer.add(crosshair);

    const fireZone = this.add.zone(fireX, fireY, fireRadius * 2, fireRadius * 2)
      .setScrollFactor(0)
      .setInteractive();

    fireZone.on('pointerdown', () => {
      this.touchShoot = true;
      fireBg.clear();
      fireBg.fillStyle(0xe94560, 0.7);
      fireBg.fillCircle(fireX, fireY, fireRadius);
      fireBg.lineStyle(2, 0xe94560, 0.8);
      fireBg.strokeCircle(fireX, fireY, fireRadius);
    });
    fireZone.on('pointerup', () => {
      this.touchShoot = false;
      fireBg.clear();
      fireBg.fillStyle(0xe94560, 0.4);
      fireBg.fillCircle(fireX, fireY, fireRadius);
      fireBg.lineStyle(2, 0xe94560, 0.6);
      fireBg.strokeCircle(fireX, fireY, fireRadius);
    });
    fireZone.on('pointerout', () => {
      this.touchShoot = false;
      fireBg.clear();
      fireBg.fillStyle(0xe94560, 0.4);
      fireBg.fillCircle(fireX, fireY, fireRadius);
      fireBg.lineStyle(2, 0xe94560, 0.6);
      fireBg.strokeCircle(fireX, fireY, fireRadius);
    });

    this.touchControlsContainer.add(fireZone);
  }

  private highlightDpadArrow(dir: Direction, cx: number, cy: number, offset: number) {
    if (!this.dpadArrows) return;
    const s = 10;
    const drawArrow = (gfx: Phaser.GameObjects.Graphics, ax: number, ay: number, d: Direction, alpha: number) => {
      gfx.clear();
      gfx.fillStyle(0xe94560, alpha);
      switch (d) {
        case Direction.UP:
          gfx.fillTriangle(ax, ay - s, ax - s * 0.7, ay + s * 0.3, ax + s * 0.7, ay + s * 0.3);
          break;
        case Direction.DOWN:
          gfx.fillTriangle(ax, ay + s, ax - s * 0.7, ay - s * 0.3, ax + s * 0.7, ay - s * 0.3);
          break;
        case Direction.LEFT:
          gfx.fillTriangle(ax - s, ay, ax + s * 0.3, ay - s * 0.7, ax + s * 0.3, ay + s * 0.7);
          break;
        case Direction.RIGHT:
          gfx.fillTriangle(ax + s, ay, ax - s * 0.3, ay - s * 0.7, ax - s * 0.3, ay + s * 0.7);
          break;
      }
    };

    drawArrow(this.dpadArrows.up, cx, cy - offset, Direction.UP, dir === Direction.UP ? 0.8 : 0.3);
    drawArrow(this.dpadArrows.down, cx, cy + offset, Direction.DOWN, dir === Direction.DOWN ? 0.8 : 0.3);
    drawArrow(this.dpadArrows.left, cx - offset, cy, Direction.LEFT, dir === Direction.LEFT ? 0.8 : 0.3);
    drawArrow(this.dpadArrows.right, cx + offset, cy, Direction.RIGHT, dir === Direction.RIGHT ? 0.8 : 0.3);
  }

  private resetDpadHighlight(cx: number, cy: number, offset: number) {
    this.highlightDpadArrow(null as any, cx, cy, offset);
  }

  update(time: number, delta: number) {
    // Don't process input while paused
    if (this.isPaused) {
      // Hide touch controls when paused
      if (this.touchControlsContainer) this.touchControlsContainer.setVisible(false);
      return;
    }
    // Show touch controls when not paused
    if (this.touchControlsContainer) this.touchControlsContainer.setVisible(true);

    // Shoot handling (separate cooldown)
    this.shootCooldown -= delta;
    if ((this.keys.SPACE.isDown || this.touchShoot) && this.shootCooldown <= 0) {
      this.room.send("shoot");
      this.shootCooldown = 300;
    }

    // Input handling with cooldown (150ms between moves for grid-based movement)
    this.inputCooldown -= delta;
    if (this.inputCooldown > 0) return;

    let direction: Direction | null = null;

    if (this.keys.W.isDown) direction = Direction.UP;
    else if (this.keys.S.isDown) direction = Direction.DOWN;
    else if (this.keys.A.isDown) direction = Direction.LEFT;
    else if (this.keys.D.isDown) direction = Direction.RIGHT;
    else if (this.touchDir) direction = this.touchDir;

    if (direction) {
      this.room.send("input", {
        direction,
        timestamp: Date.now(),
      });
      this.inputCooldown = 120;
    }
  }
}
