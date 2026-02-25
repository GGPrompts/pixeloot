import { Text, TextStyle } from 'pixi.js';
import { world } from '../world';
import { game } from '../../Game';
import { scaleXP } from '../../core/MonsterScaling';
import { getComputedStats } from '../../core/ComputedStats';
import { sfxPlayer } from '../../audio/SFXManager';
import { Fonts, FontSize } from '../../ui/UITheme';

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
  splitter: 20,
  shielder: 30,
  bomber: 10,
  charger: 35,
  pulsar: 30,
  mirror: 25,
  phaser: 20,
  burrower: 30,
  warper: 15,
  linker: 20,
  mimic: 25,
  necromancer: 35,
  overcharger: 40,
};

/**
 * Grants XP to the player. Call this when an enemy dies.
 * Handles level-ups, stat point grants, and level-up visual feedback.
 */
export function grantXP(amount: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  // Apply XP multiplier from gear affixes
  const xpGain = Math.round(amount * getComputedStats().xpMultiplier);
  player.xp += xpGain;

  // Check for level-ups (can level multiple times at once)
  let needed = xpToNextLevel(player.level);
  while (player.xp >= needed) {
    player.xp -= needed;
    player.level += 1;
    player.statPoints += 3;

    // Visual + audio feedback
    spawnLevelUpText(player.position!.x, player.position!.y);
    sfxPlayer.play('level_up');

    needed = xpToNextLevel(player.level);
  }
}

/**
 * Returns the XP for a given enemy type, scaled by monster level.
 */
export function getEnemyXP(type: string, monsterLevel = 1): number {
  const base = BASE_XP[type] ?? 15;
  return scaleXP(base, monsterLevel);
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
      fontSize: FontSize.base,
      fontFamily: Fonts.display,
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
