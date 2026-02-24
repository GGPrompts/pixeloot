import { world } from '../world';
import { game } from '../../Game';
import { despawnProjectile } from '../../entities/Projectile';

const SCREEN_W = 1280;
const SCREEN_H = 720;

const projectiles = world.with('projectile', 'position', 'velocity', 'lifetime');

/**
 * Updates projectile lifetime, checks wall/bounds collisions, and despawns as needed.
 * Called from fixedUpdate at 60 Hz.
 */
export function projectileSystem(dt: number): void {
  // Collect entities to despawn (avoid mutating during iteration)
  const toDespawn: typeof projectiles.entities[number][] = [];

  for (const entity of projectiles) {
    // Decrease lifetime
    entity.lifetime -= dt;
    if (entity.lifetime <= 0) {
      toDespawn.push(entity);
      continue;
    }

    // Check wall collision
    const tile = game.tileMap.worldToTile(entity.position.x, entity.position.y);
    if (game.tileMap.isSolid(tile.x, tile.y)) {
      toDespawn.push(entity);
      continue;
    }

    // Check out of screen bounds
    if (
      entity.position.x < 0 ||
      entity.position.x > SCREEN_W ||
      entity.position.y < 0 ||
      entity.position.y > SCREEN_H
    ) {
      toDespawn.push(entity);
    }
  }

  for (const entity of toDespawn) {
    despawnProjectile(entity);
  }
}
