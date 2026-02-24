import { Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';

const BAR_X = 8;
const BAR_Y = 30;
const BAR_W = 200;
const BAR_H = 12;
const POTION_COOLDOWN_MAX = 8;

const players = world.with('player', 'health');

let barBg: Graphics;
let barFill: Graphics;
let goldText: Text;
let potionBg: Graphics;
let potionFill: Graphics;
let potionLabel: Text;
let initialized = false;

function initHUD(): void {
  // Health bar background
  barBg = new Graphics();
  barBg.rect(BAR_X, BAR_Y, BAR_W, BAR_H).fill({ color: 0x333333 });
  game.hudLayer.addChild(barBg);

  // Health bar fill
  barFill = new Graphics();
  game.hudLayer.addChild(barFill);

  // Gold counter
  goldText = new Text({
    text: 'Gold: 0',
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 14,
      fontFamily: 'monospace',
    }),
  });
  goldText.position.set(BAR_X, BAR_Y + BAR_H + 4);
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
  potionLabel.position.set(BAR_X, BAR_Y + BAR_H + 22);
  game.hudLayer.addChild(potionLabel);

  // Potion cooldown bar background
  potionBg = new Graphics();
  potionBg.rect(BAR_X + 80, BAR_Y + BAR_H + 24, 60, 8).fill({ color: 0x333333 });
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

  // Update gold counter
  const gold = player.gold ?? 0;
  goldText.text = `Gold: ${gold}`;

  // Update potion cooldown
  const cd = player.potionCooldown ?? 0;
  potionFill.clear();
  if (cd > 0) {
    const cdRatio = cd / POTION_COOLDOWN_MAX;
    potionFill
      .rect(BAR_X + 80, BAR_Y + BAR_H + 24, 60 * (1 - cdRatio), 8)
      .fill({ color: 0x44ff44 });
    potionLabel.style.fill = 0x888888;
  } else {
    potionFill
      .rect(BAR_X + 80, BAR_Y + BAR_H + 24, 60, 8)
      .fill({ color: 0x44ff44 });
    potionLabel.style.fill = 0x44ff44;
  }
}
