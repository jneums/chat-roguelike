import { TileType } from "@chat-roguelike/shared";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsOverlap(a: Rect, b: Rect, padding = 1): boolean {
  return (
    a.x - padding < b.x + b.w &&
    a.x + a.w + padding > b.x &&
    a.y - padding < b.y + b.h &&
    a.y + a.h + padding > b.y
  );
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function carveHCorridor(
  tiles: number[][],
  x1: number,
  x2: number,
  y: number
): void {
  const startX = Math.min(x1, x2);
  const endX = Math.max(x1, x2);
  for (let x = startX; x <= endX; x++) {
    if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
      tiles[y][x] = TileType.FLOOR;
    }
  }
}

function carveVCorridor(
  tiles: number[][],
  y1: number,
  y2: number,
  x: number
): void {
  const startY = Math.min(y1, y2);
  const endY = Math.max(y1, y2);
  for (let y = startY; y <= endY; y++) {
    if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
      tiles[y][x] = TileType.FLOOR;
    }
  }
}

export interface DungeonResult {
  tiles: number[][];
  rooms: Rect[];
}

export function generateDungeon(
  width: number,
  height: number
): DungeonResult {
  // Initialize all walls
  const tiles: number[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = TileType.WALL;
    }
  }

  const rooms: Rect[] = [];
  const numRooms = randInt(5, 8);
  const maxAttempts = 200;

  // Place rooms
  for (let i = 0; i < numRooms; i++) {
    let placed = false;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const w = randInt(4, 8);
      const h = randInt(4, 7);
      const x = randInt(1, width - w - 2);
      const y = randInt(1, height - h - 2);
      const room: Rect = { x, y, w, h };

      const overlaps = rooms.some((r) => rectsOverlap(r, room, 2));
      if (!overlaps) {
        // Carve room
        for (let ry = room.y; ry < room.y + room.h; ry++) {
          for (let rx = room.x; rx < room.x + room.w; rx++) {
            tiles[ry][rx] = TileType.FLOOR;
          }
        }
        rooms.push(room);
        placed = true;
        break;
      }
    }
    if (!placed && rooms.length === 0) {
      // Force at least one room
      const room: Rect = { x: 2, y: 2, w: 6, h: 5 };
      for (let ry = room.y; ry < room.y + room.h; ry++) {
        for (let rx = room.x; rx < room.x + room.w; rx++) {
          tiles[ry][rx] = TileType.FLOOR;
        }
      }
      rooms.push(room);
    }
  }

  // Connect rooms with L-shaped corridors
  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];

    const prevCenterX = Math.floor(prev.x + prev.w / 2);
    const prevCenterY = Math.floor(prev.y + prev.h / 2);
    const currCenterX = Math.floor(curr.x + curr.w / 2);
    const currCenterY = Math.floor(curr.y + curr.h / 2);

    // Randomly choose horizontal-first or vertical-first
    if (Math.random() < 0.5) {
      carveHCorridor(tiles, prevCenterX, currCenterX, prevCenterY);
      carveVCorridor(tiles, prevCenterY, currCenterY, currCenterX);
    } else {
      carveVCorridor(tiles, prevCenterY, currCenterY, prevCenterX);
      carveHCorridor(tiles, prevCenterX, currCenterX, currCenterY);
    }
  }

  return { tiles, rooms };
}
