# Chat Roguelike

A real-time multiplayer roguelike game built with Phaser 3, Colyseus, and TypeScript.

## Tech Stack

- **Client**: Phaser 3 + Vite + TypeScript
- **Server**: Colyseus 0.15 + Express + TypeScript
- **Shared**: Common types and constants

## Setup

```bash
npm install
npm run dev
```

This starts both the game server (port 2567) and the Vite dev server (port 3000).

Open http://localhost:3000 in your browser. Open multiple tabs for multiplayer!

## Scripts

- `npm run dev` — Run both client and server in development mode
- `npm run dev:client` — Run only the Vite client dev server
- `npm run dev:server` — Run only the Colyseus game server
- `npm run build` — Build all packages for production

## How to Play

- **WASD** — Move your character
- Explore the procedurally generated dungeon
- Avoid or fight enemies (red shapes)
- Play with friends in real-time!
