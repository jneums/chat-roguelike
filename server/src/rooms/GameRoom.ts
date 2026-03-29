import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { GameConfig, TileType, Direction } from "@chat-roguelike/shared";
import { generateDungeon, DungeonResult } from "./dungeonGenerator";
import { findPath } from "./pathfinding";

// Schema classes for Colyseus state synchronization
export class Player extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 100;
  @type("number") maxHp: number = 100;
  @type("string") color: string = "#ffffff";
  @type("number") facingX: number = 0;
  @type("number") facingY: number = 1;
}

export class Projectile extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") dx: number = 0;
  @type("number") dy: number = 0;
  @type("string") ownerId: string = "";
  @type("string") color: string = "#ffffff";
}

export class Enemy extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 30;
  @type("string") enemyType: string = "goblin";
  @type("number") speed: number = 1;
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
  @type({ map: Projectile }) projectiles = new MapSchema<Projectile>();
  @type(["number"]) tiles = new ArraySchema<number>();
  @type("number") width: number = GameConfig.MAP_WIDTH;
  @type("number") height: number = GameConfig.MAP_HEIGHT;
}

const PLAYER_COLORS = [
  "#00ff88", "#00aaff", "#ff6600", "#ffff00",
  "#ff00ff", "#00ffff", "#88ff00", "#ff0088",
];

export class GameRoom extends Room<GameState> {
  private dungeon!: DungeonResult;
  private enemyCounter = 0;
  private tickCount = 0;
  private projectileCounter = 0;
  private spawnPoints: { x: number; y: number }[] = [];

  onCreate() {
    console.log("GameRoom created!");
    this.maxClients = 4;

    this.setState(new GameState());

    // Generate dungeon
    this.dungeon = generateDungeon(GameConfig.MAP_WIDTH, GameConfig.MAP_HEIGHT);

    // Flatten tiles into ArraySchema
    for (let y = 0; y < GameConfig.MAP_HEIGHT; y++) {
      for (let x = 0; x < GameConfig.MAP_WIDTH; x++) {
        this.state.tiles.push(this.dungeon.tiles[y][x]);
      }
    }

    // Collect spawn points (centers of rooms)
    this.spawnPoints = this.dungeon.rooms.map((room) => ({
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2),
    }));

    // Spawn enemies in rooms (skip first room as player spawn)
    for (let i = 1; i < this.dungeon.rooms.length; i++) {
      const room = this.dungeon.rooms[i];
      const numEnemies = Math.floor(Math.random() * 2) + 1;
      for (let j = 0; j < numEnemies; j++) {
        this.spawnEnemy(
          room.x + Math.floor(Math.random() * room.w),
          room.y + Math.floor(Math.random() * room.h)
        );
      }
    }

    // Handle input messages
    this.onMessage("input", (client, message: { direction: string; timestamp: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.hp <= 0) return;

      let dx = 0;
      let dy = 0;

      switch (message.direction) {
        case Direction.UP:    dy = -1; break;
        case Direction.DOWN:  dy = 1;  break;
        case Direction.LEFT:  dx = -1; break;
        case Direction.RIGHT: dx = 1;  break;
      }

      const newX = player.x + dx;
      const newY = player.y + dy;

      // Collision check — walls and other entities
      if (this.isWalkable(newX, newY) && !this.isTileOccupied(newX, newY, client.sessionId)) {
        player.x = newX;
        player.y = newY;
      }

      // Update facing direction
      player.facingX = dx;
      player.facingY = dy;
    });

    // Handle shoot messages
    this.onMessage("shoot", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.hp <= 0) return;
      if (player.facingX === 0 && player.facingY === 0) return;

      const proj = new Projectile();
      proj.id = `proj_${this.projectileCounter++}`;
      proj.x = player.x + player.facingX;
      proj.y = player.y + player.facingY;
      proj.dx = player.facingX;
      proj.dy = player.facingY;
      proj.ownerId = client.sessionId;
      proj.color = player.color;
      this.state.projectiles.set(proj.id, proj);
    });

    // Game loop at 20 FPS
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);
  }

  private isWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= GameConfig.MAP_WIDTH || y < 0 || y >= GameConfig.MAP_HEIGHT) {
      return false;
    }
    return this.state.tiles[y * GameConfig.MAP_WIDTH + x] === TileType.FLOOR;
  }

  private isTileOccupied(x: number, y: number, ignoreId?: string): boolean {
    // Check players
    for (const [, p] of this.state.players) {
      if (p.x === x && p.y === y) return true;
    }
    // Check enemies
    for (const [, e] of this.state.enemies) {
      if (ignoreId && e.id === ignoreId) continue;
      if (e.x === x && e.y === y && e.hp > 0) return true;
    }
    return false;
  }

  private isAdjacent(ax: number, ay: number, bx: number, by: number): boolean {
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }

  private spawnEnemy(x: number, y: number): void {
    const enemy = new Enemy();
    enemy.id = `enemy_${this.enemyCounter++}`;
    enemy.x = x;
    enemy.y = y;
    enemy.hp = 30;
    enemy.enemyType = Math.random() > 0.5 ? "goblin" : "skeleton";
    enemy.speed = 1;
    this.state.enemies.set(enemy.id, enemy);
  }

  onJoin(client: Client) {
    console.log(`Player ${client.sessionId} joined`);

    const player = new Player();
    player.id = client.sessionId;
    player.hp = 100;
    player.maxHp = 100;
    player.color = PLAYER_COLORS[this.state.players.size % PLAYER_COLORS.length];

    // Spawn in first room
    const spawn = this.spawnPoints[0] || { x: 5, y: 5 };
    player.x = spawn.x;
    player.y = spawn.y;

    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    console.log(`Player ${client.sessionId} left`);
    this.state.players.delete(client.sessionId);
  }

  private update(deltaTime: number): void {
    this.tickCount++;

    // Update projectiles every tick — they move fast
    const toRemove: string[] = [];
    this.state.projectiles.forEach((proj, id) => {
      proj.x += proj.dx;
      proj.y += proj.dy;

      // Remove if hit wall or out of bounds
      if (!this.isWalkable(proj.x, proj.y)) {
        toRemove.push(id);
        return;
      }

      // Check enemy hits
      this.state.enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        if (enemy.x === proj.x && enemy.y === proj.y) {
          enemy.hp -= 15;
          toRemove.push(id);
        }
      });
    });
    toRemove.forEach((id) => this.state.projectiles.delete(id));

    // Move enemies every 5 ticks (4 times per second)
    if (this.tickCount % 5 !== 0) return;

    const players = Array.from(this.state.players.values());
    if (players.length === 0) return;

    this.state.enemies.forEach((enemy, key) => {
      if (enemy.hp <= 0) {
        // Respawn dead enemy in a random room
        const room = this.dungeon.rooms[Math.floor(Math.random() * this.dungeon.rooms.length)];
        enemy.x = room.x + Math.floor(Math.random() * room.w);
        enemy.y = room.y + Math.floor(Math.random() * room.h);
        enemy.hp = 30;
        return;
      }

      // Find nearest reachable player using A* path distance
      const AGGRO_RANGE = 10;

      // Already adjacent to a player? Attack, don't move.
      let meleeTarget: typeof players[0] | null = null;
      for (const p of players) {
        if (p.hp <= 0) continue;
        if (this.isAdjacent(enemy.x, enemy.y, p.x, p.y)) {
          meleeTarget = p;
          break;
        }
      }

      if (meleeTarget) {
        meleeTarget.hp = Math.max(0, meleeTarget.hp - 10);
        if (meleeTarget.hp <= 0) {
          const target = meleeTarget;
          setTimeout(() => {
            const spawn = this.spawnPoints[0] || { x: 5, y: 5 };
            target.x = spawn.x;
            target.y = spawn.y;
            target.hp = target.maxHp;
          }, 3000);
        }
      } else {
        // Not adjacent — pathfind to an open tile adjacent to the nearest player
        let bestPath: { nextStep: { x: number; y: number }; pathLength: number } | null = null;

        for (const p of players) {
          if (p.hp <= 0) continue;
          const manhattan = Math.abs(p.x - enemy.x) + Math.abs(p.y - enemy.y);
          if (manhattan > AGGRO_RANGE * 2) continue;

          // Try each tile adjacent to the player, find the best reachable one
          const adjacentTiles = [
            { x: p.x, y: p.y - 1 },
            { x: p.x, y: p.y + 1 },
            { x: p.x - 1, y: p.y },
            { x: p.x + 1, y: p.y },
          ];

          for (const adj of adjacentTiles) {
            if (!this.isWalkable(adj.x, adj.y)) continue;
            // Skip if another enemy is already there (or heading there)
            if (this.isTileOccupied(adj.x, adj.y, enemy.id)) continue;

            // Already at this adjacent spot
            if (enemy.x === adj.x && enemy.y === adj.y) {
              // Shouldn't happen (isAdjacent check above), but just in case
              continue;
            }

            const path = findPath(
              enemy.x, enemy.y,
              adj.x, adj.y,
              this.state.tiles,
              GameConfig.MAP_WIDTH,
              GameConfig.MAP_HEIGHT
            );

            if (path && path.pathLength <= AGGRO_RANGE) {
              if (!bestPath || path.pathLength < bestPath.pathLength) {
                bestPath = path;
              }
            }
          }
        }

        if (bestPath) {
          const nextStep = bestPath.nextStep;
          if (!this.isTileOccupied(nextStep.x, nextStep.y, enemy.id)) {
            enemy.x = nextStep.x;
            enemy.y = nextStep.y;
          }
        }
      }
    });
  }
}
