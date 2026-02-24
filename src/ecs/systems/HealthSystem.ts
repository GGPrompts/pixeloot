import { Graphics } from 'pixi.js';
import { world } from '../world';
import { game } from '../../Game';
import { InputManager } from '../../core/InputManager';
import { spawnInitialEnemies } from '../../entities/EnemySpawner';

const POTION_COOLDOWN = 8; // seconds
const POTION_HEAL_PERCENT = 0.3; // 30% of max HP
const POTION_DURATION = 2; // seconds
const POTION_TICK_INTERVAL = 0.25; // seconds

const players = world.with('player', 'position', 'health');
const enemiesQuery = world.with('enemy', 'position', 'health');

let deathTimer = -1; // -1 = not dead
let deathOverlay: Graphics | null = null;
let flashAlpha = 0;
let hotAccumulator = 0; // tracks time for HoT ticks
let hotHealPerTick = 0; // how much to heal per tick

/**
 * Health system: handles potion usage (Q key), heal-over-time ticks,
 * player death sequence, and respawn.
 * Called from fixedUpdate at 60 Hz.
 */
export function healthSystem(dt: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  // --- Potion cooldown tick ---
  if (player.potionCooldown !== undefined && player.potionCooldown > 0) {
    player.potionCooldown -= dt;
    if (player.potionCooldown <= 0) {
      player.potionCooldown = 0;
    }
  }

  // --- Potion usage (Q key) ---
  const input = InputManager.instance;
  if (
    input.isPressed('KeyQ') &&
    !player.dead &&
    (player.potionCooldown === undefined || player.potionCooldown <= 0) &&
    player.health.current < player.health.max
  ) {
    world.addComponent(player, 'potionCooldown', POTION_COOLDOWN);
    world.addComponent(player, 'hotTimer', POTION_DURATION);
    hotAccumulator = 0;
    const totalHeal = player.health.max * POTION_HEAL_PERCENT;
    const totalTicks = POTION_DURATION / POTION_TICK_INTERVAL;
    hotHealPerTick = totalHeal / totalTicks;
  }

  // --- Heal-over-time ticks ---
  if (player.hotTimer !== undefined && player.hotTimer > 0) {
    player.hotTimer -= dt;
    hotAccumulator += dt;

    while (hotAccumulator >= POTION_TICK_INTERVAL && player.hotTimer !== undefined) {
      hotAccumulator -= POTION_TICK_INTERVAL;
      player.health.current = Math.min(
        player.health.max,
        player.health.current + hotHealPerTick,
      );
    }

    if (player.hotTimer <= 0) {
      player.hotTimer = 0;
      hotAccumulator = 0;
    }
  }

  // --- Death check ---
  if (player.health.current <= 0 && !player.dead) {
    triggerDeath(player);
  }

  // --- Death timer ---
  if (player.dead && deathTimer >= 0) {
    deathTimer -= dt;

    // Fade flash overlay
    if (deathOverlay) {
      flashAlpha = Math.max(0, flashAlpha - dt * 2); // fade over ~0.5s
      deathOverlay.alpha = flashAlpha;
    }

    if (deathTimer <= 0) {
      respawn(player);
    }
  }
}

type PlayerEntity = (typeof players.entities)[number];

function triggerDeath(player: PlayerEntity): void {
  world.addComponent(player, 'dead', true as const);
  world.addComponent(player, 'inputDisabled', true as const);

  // Lose 10% gold
  if (player.gold !== undefined && player.gold > 0) {
    player.gold = Math.floor(player.gold * 0.9);
  }

  // Screen flash
  deathOverlay = new Graphics();
  deathOverlay.rect(0, 0, 1280, 720).fill({ color: 0xffffff });
  flashAlpha = 0.5;
  deathOverlay.alpha = flashAlpha;
  game.hudLayer.addChild(deathOverlay);

  deathTimer = 1; // 1 second until respawn
}

function respawn(player: PlayerEntity): void {
  // Remove flash overlay
  if (deathOverlay) {
    deathOverlay.removeFromParent();
    deathOverlay.destroy();
    deathOverlay = null;
  }

  // Reset player health
  player.health.current = player.health.max;

  // Move to spawn point
  const spawnTile = game.tileMap.spawn;
  const spawnPos = game.tileMap.tileToWorld(spawnTile.x, spawnTile.y);
  player.position.x = spawnPos.x;
  player.position.y = spawnPos.y;

  // Remove dead / inputDisabled flags
  world.removeComponent(player, 'dead');
  world.removeComponent(player, 'inputDisabled');

  deathTimer = -1;

  // Respawn enemies: remove existing then spawn new ones
  for (const enemy of [...enemiesQuery.entities]) {
    if (enemy.sprite) {
      enemy.sprite.removeFromParent();
    }
    world.remove(enemy);
  }
  spawnInitialEnemies(5);
}
