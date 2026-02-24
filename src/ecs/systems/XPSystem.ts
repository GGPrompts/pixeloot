import { Text, TextStyle } from 'pixi.js';
import { world } from '../world';
import { game } from '../../Game';

const players = world.with('player', 'xp', 'level', 'statPoints', 'stats');

/** XP required to reach the next level from the current one. */
export function xpToNextLevel(level: number): number {
  return level * 100;
}

/** Base XP values by enemy type. Extend as new enemies are added. */
const BASE_XP: Record<string, number> = {
  rusher: 15,
  swarm: 5,
  tank: 40,
  sniper: 25,
  flanker: 20,
};

/**
 * Grants XP to the player. Call this when an enemy dies.
 * Handles level-ups, stat point grants, and level-up visual feedback.
 */
export function grantXP(amount: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  player.xp += amount;

  // Check for level-ups (can level multiple times at once)
  let needed = xpToNextLevel(player.level);
  while (player.xp >= needed) {
    player.xp -= needed;
    player.level += 1;
    player.statPoints += 3;

    // Visual feedback
    spawnLevelUpText(player.position!.x, player.position!.y);

    needed = xpToNextLevel(player.level);
  }
}

/**
 * Returns the base XP for a given enemy type key.
 */
export function getEnemyXP(type: string): number {
  return BASE_XP[type] ?? 15;
}

/**
 * Spawns a floating "LEVEL UP!" text above the player.
 * Gold colored, rises and fades out over 1.2 seconds.
 */
function spawnLevelUpText(x: number, y: number): void {
  const text = new Text({
    text: 'LEVEL UP!',
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 22,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 3 },
    }),
  });

  text.anchor.set(0.5, 0.5);
  text.position.set(x, y - 20);
  game.effectLayer.addChild(text);

  const startY = y - 20;
  const start = performance.now();
  const duration = 1200;

  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / duration, 1);

    text.position.y = startY - 50 * t;
    text.alpha = 1 - t;
    // Scale up slightly then back down
    const scale = 1 + 0.3 * Math.sin(t * Math.PI);
    text.scale.set(scale, scale);

    if (t >= 1) {
      text.removeFromParent();
      text.destroy();
    } else {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}
