import Phaser from "phaser";
import { ConnectScene } from "./scenes/ConnectScene";
import { GameScene } from "./scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: 800,
  height: 640,
  parent: "game-container",
  backgroundColor: "#1a1a2e",
  pixelArt: true,
  scene: [ConnectScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
