import { world } from '../world';
import { game } from '../../Game';
import { despawnProjectile } from '../../entities/Projectile';
import type { Entity } from '../world';

const SCREEN_W = 1280;
const SCREEN_H = 720;

const projectiles = world.with('projectile', 'position', 'velocity', 'lifetime');
const enemyProjectiles = world.with('enemyProjectile', 'position', 'velocity', 'lifetime');

/**
 * Checks a projectile-like entity for lifetime expiry, wall collision, and bounds.
 * Returns true if the entity should be despawned.
 */
function shouldDespawn(entity: Entity & { position: { x: number; y: number }; lifetime: number }, dt: number): boolean {
  entity.lifetime -= dt;
  if (entity.lifetime <= 0) return true;

  const tile = game.tileMap.worldToTile(entity.position.x, entity.position.y);
  if (game.tileMap.isSolid(tile.x, tile.y)) return true;

  if (
    entity.position.x < 0 ||
    entity.position.x > SCREEN_W ||
    entity.position.y < 0 ||
    entity.position.y > SCREEN_H
  ) {
    return true;
  }

  return false;
}

/**
 * Updates projectile lifetime, checks wall/bounds collisions, and despawns as needed.
 * Handles both player projectiles and enemy projectiles.
 * Called from fixedUpdate at 60 Hz.
 */
export function projectileSystem(dt: number): void {
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
