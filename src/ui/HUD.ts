import { Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { xpToNextLevel } from '../ecs/systems/XPSystem';

const BAR_X = 8;
const BAR_Y = 30;
const BAR_W = 200;
const BAR_H = 12;
const XP_BAR_H = 6;
const POTION_COOLDOWN_MAX = 8;

const players = world.with('player', 'health');

let barBg: Graphics;
let barFill: Graphics;
let goldText: Text;
let potionBg: Graphics;
let potionFill: Graphics;
let potionLabel: Text;
let xpBarBg: Graphics;
let xpBarFill: Graphics;
let levelText: Text;
let statPointIndicator: Text;
let initialized = false;

function initHUD(): void {
  // Health bar background
  barBg = new Graphics();
  barBg.rect(BAR_X, BAR_Y, BAR_W, BAR_H).fill({ color: 0x333333 });
  game.hudLayer.addChild(barBg);

  // Health bar fill
  barFill = new Graphics();
  game.hudLayer.addChild(barFill);

  // XP bar background (below health bar)
  const xpBarY = BAR_Y + BAR_H + 2;
  xpBarBg = new Graphics();
  xpBarBg.rect(BAR_X, xpBarY, BAR_W, XP_BAR_H).fill({ color: 0x222233 });
  game.hudLayer.addChild(xpBarBg);

  // XP bar fill
  xpBarFill = new Graphics();
  game.hudLayer.addChild(xpBarFill);

  // Level text (right of XP bar)
  levelText = new Text({
    text: 'Lv.1',
    style: new TextStyle({
      fill: 0xaaaaff,
      fontSize: 11,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  levelText.position.set(BAR_X + BAR_W + 6, xpBarY - 2);
  game.hudLayer.addChild(levelText);

  // Stat points indicator
  statPointIndicator = new Text({
    text: '',
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 11,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  statPointIndicator.position.set(BAR_X + BAR_W + 50, xpBarY - 2);
  game.hudLayer.addChild(statPointIndicator);

  // Gold counter (shifted down to accommodate XP bar)
  const goldY = xpBarY + XP_BAR_H + 4;
  goldText = new Text({
    text: 'Gold: 0',
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 14,
      fontFamily: 'monospace',
    }),
  });
  goldText.position.set(BAR_X, goldY);
  game.hudLayer.addChild(goldText);

  // Potion cooldown indicator
  potionLabel = new Text({
    text: '[Q] Potion',
    style: new TextStyle({
      fill: 0x44ff44,
      fontSize: 12,
      fontFamily: 'monospace',
    }),
  });
  potionLabel.position.set(BAR_X, goldY + 18);
  game.hudLayer.addChild(potionLabel);

  // Potion cooldown bar background
  potionBg = new Graphics();
  potionBg.rect(BAR_X + 80, goldY + 20, 60, 8).fill({ color: 0x333333 });
  game.hudLayer.addChild(potionBg);

  // Potion cooldown fill
  potionFill = new Graphics();
  game.hudLayer.addChild(potionFill);

  initialized = true;
}

export function updateHUD(): void {
  if (!initialized) initHUD();

  if (players.entities.length === 0) return;
  const player = players.entities[0];

  // Update health bar fill
  const ratio = Math.max(0, player.health.current / player.health.max);
  barFill.clear();
  barFill.rect(BAR_X, BAR_Y, BAR_W * ratio, BAR_H).fill({ color: 0xdd3333 });

  // Update XP bar
  const xpBarY = BAR_Y + BAR_H + 2;
  const currentXP = player.xp ?? 0;
  const currentLevel = player.level ?? 1;
  const needed = xpToNextLevel(currentLevel);
  const xpRatio = Math.min(currentXP / needed, 1);
  xpBarFill.clear();
  xpBarFill.rect(BAR_X, xpBarY, BAR_W * xpRatio, XP_BAR_H).fill({ color: 0x7744dd });

  // Update level text
  levelText.text = `Lv.${currentLevel}`;

  // Update stat points indicator
  const sp = player.statPoints ?? 0;
  if (sp > 0) {
    statPointIndicator.text = `+${sp} [Tab]`;
    statPointIndicator.visible = true;
  } else {
    statPointIndicator.visible = false;
  }

  // Update gold counter
  const gold = player.gold ?? 0;
  goldText.text = `Gold: ${gold}`;

  // Update potion cooldown
  const goldY = xpBarY + XP_BAR_H + 4;
  const cd = player.potionCooldown ?? 0;
  potionFill.clear();
  if (cd > 0) {
    const cdRatio = cd / POTION_COOLDOWN_MAX;
    potionFill
      .rect(BAR_X + 80, goldY + 20, 60 * (1 - cdRatio), 8)
      .fill({ color: 0x44ff44 });
    potionLabel.style.fill = 0x888888;
  } else {
    potionFill
      .rect(BAR_X + 80, goldY + 20, 60, 8)
      .fill({ color: 0x44ff44 });
    potionLabel.style.fill = 0x44ff44;
  }
}
