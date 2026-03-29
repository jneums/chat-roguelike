// Game configuration constants
export const GameConfig = {
  TILE_SIZE: 32,
  MAP_WIDTH: 40,
  MAP_HEIGHT: 30,
  PLAYER_SPEED: 3,
} as const;

// Tile types for the dungeon map
export enum TileType {
  FLOOR = 0,
  WALL = 1,
}

// Movement directions
export enum Direction {
  UP = "up",
  DOWN = "down",
  LEFT = "left",
  RIGHT = "right",
}

// Player state interface
export interface PlayerState {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  color: string;
}

// Enemy state interface
export interface EnemyState {
  id: string;
  x: number;
  y: number;
  hp: number;
  type: string;
  speed: number;
}

// Room state interface
export interface RoomState {
  players: Map<string, PlayerState>;
  enemies: Map<string, EnemyState>;
  tiles: number[];
  width: number;
  height: number;
}

// Input message from client to server
export interface InputMessage {
  direction: Direction;
  timestamp: number;
}
