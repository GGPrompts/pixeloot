import { Text, TextStyle } from 'pixi.js';
import { world, Entity } from '../world';
import { game } from '../../Game';
import { Rarity } from '../../loot/ItemTypes';

const PICKUP_RADIUS = 32;
const PICKUP_RADIUS_SQ = PICKUP_RADIUS * PICKUP_RADIUS;

const pickups = world.with('pickup', 'position');
const players = world.with('player', 'position');

const RARITY_COLORS: Record<Rarity, number> = {
  [Rarity.Normal]: 0xcccccc,
  [Rarity.Magic]: 0x4444ff,
  [Rarity.Rare]: 0xffff00,
  [Rarity.Unique]: 0xff8800,
};

/**
 * Spawn a floating text that rises and fades (used for pickup feedback).
 */
function spawnPickupText(x: number, y: number, message: string, color: number): void {
  const text = new Text({
    text: message,
    style: new TextStyle({
      fill: color,
      fontSize: 14,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2 },
    }),
  });
  text.anchor.set(0.5, 0.5);
  text.position.set(x, y);
  game.effectLayer.addChild(text);

  const startY = y;
  const start = performance.now();
  const RISE_PX = 30;
  const DURATION_MS = 1000;

  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / DURATION_MS, 1);
    text.position.y = startY - RISE_PX * t;
    text.alpha = 1 - t;

    if (t >= 1) {
      text.removeFromParent();
      text.destroy();
    } else {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

/**
 * Checks if any pickup entity is within range of the player and collects it.
 * Called from fixedUpdate at 60 Hz.
 */
export function pickupSystem(_dt: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  const toRemove: Entity[] = [];

  for (const pickup of pickups) {
    const dx = pickup.position.x - player.position.x;
    const dy = pickup.position.y - player.position.y;
    const distSq = dx * dx + dy * dy;

    if (distSq >= PICKUP_RADIUS_SQ) continue;

    if (pickup.lootDrop) {
      const item = pickup.lootDrop.item;
      const color = RARITY_COLORS[item.rarity] ?? 0xcccccc;
      spawnPickupText(pickup.position.x, pickup.position.y - 10, item.name, color);
      // TODO: add item to player inventory (inventory UI is a separate task)
      console.log('[Loot] Picked up:', item.name, `(${Rarity[item.rarity]})`, item);
    }

    if (pickup.goldDrop !== undefined) {
      const amount = pickup.goldDrop;
      spawnPickupText(pickup.position.x, pickup.position.y - 10, `+${amount} gold`, 0xffd700);
      // Add gold to player
      if (player.gold !== undefined) {
        player.gold += amount;
      } else {
        world.addComponent(player, 'gold', amount);
      }
    }

    toRemove.push(pickup);
  }

  for (const entity of toRemove) {
    if (entity.sprite) {
      entity.sprite.removeFromParent();
    }
    world.remove(entity);
  }
}
