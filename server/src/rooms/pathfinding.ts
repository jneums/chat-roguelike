import { TileType } from "@chat-roguelike/shared";

interface Node {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: Node | null;
}

const DIRECTIONS = [
  { x: 0, y: -1 }, // up
  { x: 0, y: 1 },  // down
  { x: -1, y: 0 }, // left
  { x: 1, y: 0 },  // right
];

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by); // Manhattan distance
}

export interface PathResult {
  nextStep: { x: number; y: number };
  pathLength: number; // total tiles to reach target
}

/**
 * A* pathfinding on a tile grid.
 * Returns the next step and total path length, or null if no path.
 * maxSearch limits nodes explored to keep it fast for real-time use.
 */
export function findPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tiles: any,
  width: number,
  height: number,
  maxSearch: number = 200
): PathResult | null {
  if (fromX === toX && fromY === toY) return null;

  const getTile = (x: number, y: number): number => {
    if (Array.isArray(tiles)) return tiles[y * width + x];
    return (tiles as any)[y * width + x];
  };

  const open: Node[] = [];
  const closed = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  const startNode: Node = {
    x: fromX,
    y: fromY,
    g: 0,
    h: heuristic(fromX, fromY, toX, toY),
    f: heuristic(fromX, fromY, toX, toY),
    parent: null,
  };

  open.push(startNode);
  let searched = 0;

  while (open.length > 0 && searched < maxSearch) {
    // Find node with lowest f
    let lowestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[lowestIdx].f) lowestIdx = i;
    }
    const current = open.splice(lowestIdx, 1)[0];
    searched++;

    // Reached the goal — trace back to the first step
    if (current.x === toX && current.y === toY) {
      const pathLength = current.g;
      let node = current;
      while (node.parent && node.parent.parent) {
        node = node.parent;
      }
      return { nextStep: { x: node.x, y: node.y }, pathLength };
    }

    closed.add(key(current.x, current.y));

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;

      // Bounds check
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      // Wall check
      if (getTile(nx, ny) !== TileType.FLOOR) continue;

      // Already visited
      if (closed.has(key(nx, ny))) continue;

      const g = current.g + 1;
      const h = heuristic(nx, ny, toX, toY);
      const f = g + h;

      // Check if already in open with better score
      const existing = open.find((n) => n.x === nx && n.y === ny);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
        continue;
      }

      open.push({ x: nx, y: ny, g, h, f, parent: current });
    }
  }

  // No path found (or too far) — return null
  return null;
}
