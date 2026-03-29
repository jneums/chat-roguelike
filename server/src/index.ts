import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import express from "express";
import cors from "cors";
import http from "http";
import { GameRoom } from "./rooms/GameRoom";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Colyseus monitor (admin panel)
app.use("/colyseus", monitor());

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

// Register game room
gameServer.define("game", GameRoom);

const PORT = Number(process.env.PORT) || 2567;

gameServer.listen(PORT).then(() => {
  console.log(`🎮 Game server listening on http://localhost:${PORT}`);
  console.log(`📊 Monitor at http://localhost:${PORT}/colyseus`);
});
