import { world } from '../world';
import { game } from '../../Game';
import { despawnProjectile } from '../../entities/Projectile';
import type { Entity } from '../world';
import { TILE_SIZE } from '../../core/constants';
import { hasCryoBarrier, hitCryoBarrier } from '../../core/HazardSystem';

const projectiles = world.with('projectile', 'position', 'velocity', 'lifetime');
const enemyProjectiles = world.with('enemyProjectile', 'position', 'velocity', 'lifetime');
const homingProjectiles = world.with('projectile', 'position', 'velocity', 'homing');
const rotatingProjectiles = world.with('rotateWithVelocity', 'velocity', 'sprite');
const enemiesForHoming = world.with('enemy', 'position', 'health');

/** Max steering angle per frame in radians (~3 degrees). */
const HOMING_MAX_STEER = (3 * Math.PI) / 180;
/** Homing only activates within this pixel range. */
const HOMING_RANGE = 200;
const HOMING_RANGE_SQ = HOMING_RANGE * HOMING_RANGE;

/**
 * Checks a projectile-like entity for lifetime expiry, wall collision, and bounds.
 * Returns true if the entity should be despawned.
 */
function shouldDespawn(entity: Entity & { position: { x: number; y: number }; lifetime: number }, dt: number): boolean {
  entity.lifetime -= dt;
  if (entity.lifetime <= 0) return true;

  // Whisperstring Steady Aim: wall-piercing projectiles ignore wall collisions
  if (!entity.wallPiercing) {
    const tile = game.tileMap.worldToTile(entity.position.x, entity.position.y);
    if (game.tileMap.isSolid(tile.x, tile.y)) return true;

    // Cryo barriers: projectiles damage them and get consumed (don't block projectiles, just damage)
    if (hasCryoBarrier(tile.x, tile.y)) {
      hitCryoBarrier(tile.x, tile.y, entity.damage ?? 10);
    }
  }

  const worldW = game.tileMap.width * TILE_SIZE;
  const worldH = game.tileMap.height * TILE_SIZE;
  if (
    entity.position.x < 0 ||
    entity.position.x > worldW ||
    entity.position.y < 0 ||
    entity.position.y > worldH
  ) {
    return true;
  }

  return false;
}

/**
 * Gently steer homing projectiles toward the nearest enemy.
 * Adjusts velocity direction by up to HOMING_MAX_STEER radians per frame,
 * preserving speed magnitude.
 */
function updateHoming(): void {
  for (const proj of homingProjectiles) {
    // Find nearest enemy within range
    let nearestDistSq = HOMING_RANGE_SQ;
    let nearestEnemy: (typeof enemiesForHoming.entities)[number] | null = null;

    for (const enemy of enemiesForHoming) {
      if (enemy.health.current <= 0) continue;
      const dx = enemy.position.x - proj.position.x;
      const dy = enemy.position.y - proj.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestEnemy = enemy;
      }
    }

    if (!nearestEnemy) continue;

    // Current velocity angle
    const currentAngle = Math.atan2(proj.velocity.y, proj.velocity.x);
    const speed = Math.sqrt(proj.velocity.x * proj.velocity.x + proj.velocity.y * proj.velocity.y);

    // Desired angle toward enemy
    const dx = nearestEnemy.position.x - proj.position.x;
    const dy = nearestEnemy.position.y - proj.position.y;
    const desiredAngle = Math.atan2(dy, dx);

    // Compute shortest angular difference
    let angleDiff = desiredAngle - currentAngle;
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Clamp steering
    const steer = Math.max(-HOMING_MAX_STEER, Math.min(HOMING_MAX_STEER, angleDiff));
    const newAngle = currentAngle + steer;

    proj.velocity.x = Math.cos(newAngle) * speed;
    proj.velocity.y = Math.sin(newAngle) * speed;
  }
}

/**
 * Updates projectile lifetime, checks wall/bounds collisions, and despawns as needed.
 * Handles both player projectiles and enemy projectiles.
 * Also steers homing projectiles toward nearest enemies.
 * Called from fixedUpdate at 60 Hz.
 */
export function projectileSystem(dt: number): void {
  // Steer homing projectiles before movement/despawn checks
  updateHoming();

  // Rotate sprites that track velocity direction (arrows, missiles)
  for (const proj of rotatingProjectiles) {
    proj.sprite.rotation = Math.atan2(proj.velocity.y, proj.velocity.x);
  }

  // Collect entities to despawn (avoid mutating during iteration)
  const toDespawn: Entity[] = [];

  for (const entity of projectiles) {
    if (shouldDespawn(entity, dt)) {
      toDespawn.push(entity);
    }
  }

  for (const entity of enemyProjectiles) {
    if (shouldDespawn(entity, dt)) {
      toDespawn.push(entity);
    }
  }

  for (const entity of toDespawn) {
    despawnProjectile(entity);
  }
}
