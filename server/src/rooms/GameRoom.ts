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
  private spawnPoints: { x: number; y: number }[] = [];

  onCreate() {
    console.log("GameRoom created!");

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

      // Collision check
      if (this.isWalkable(newX, newY)) {
        player.x = newX;
        player.y = newY;
      }
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
      const AGGRO_RANGE = 10; // tiles of actual walking distance
      let bestPath: { nextStep: { x: number; y: number }; pathLength: number } | null = null;

      for (const p of players) {
        if (p.hp <= 0) continue;

        // Quick Manhattan pre-check to skip obviously far players
        const manhattan = Math.abs(p.x - enemy.x) + Math.abs(p.y - enemy.y);
        if (manhattan > AGGRO_RANGE * 2) continue;

        const path = findPath(
          enemy.x, enemy.y,
          p.x, p.y,
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

      if (bestPath) {
        enemy.x = bestPath.nextStep.x;
        enemy.y = bestPath.nextStep.y;
      }

      // Check collision with players (damage)
      for (const p of players) {
        if (p.hp <= 0) continue;
        if (enemy.x === p.x && enemy.y === p.y) {
          p.hp = Math.max(0, p.hp - 10);
          if (p.hp <= 0) {
            // Respawn player after a delay
            setTimeout(() => {
              const spawn = this.spawnPoints[0] || { x: 5, y: 5 };
              p.x = spawn.x;
              p.y = spawn.y;
              p.hp = p.maxHp;
            }, 3000);
          }
        }
      }
    });
  }
}
