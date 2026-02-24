import { world } from '../world';
import { despawnProjectile } from '../../entities/Projectile';

const HIT_RADIUS = 16;

const projectiles = world.with('projectile', 'position', 'damage');
const enemies = world.with('enemy', 'position', 'health');

/**
 * Checks projectile-enemy collisions using simple distance checks.
 * Deals damage and despawns projectiles on hit.
 * Removes enemies at zero health.
 * Called from fixedUpdate at 60 Hz.
 */
export function collisionSystem(_dt: number): void {
  const projectilesToDespawn: typeof projectiles.entities[number][] = [];
  const enemiesToRemove: typeof enemies.entities[number][] = [];

  for (const proj of projectiles) {
    for (const enemy of enemies) {
      const dx = proj.position.x - enemy.position.x;
      const dy = proj.position.y - enemy.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < HIT_RADIUS * HIT_RADIUS) {
        // Deal damage
        enemy.health.current -= proj.damage;
        projectilesToDespawn.push(proj);

        // Flash effect on the enemy sprite
        if (enemy.sprite) {
          enemy.sprite.alpha = 0.3;
          setTimeout(() => {
            if (enemy.sprite) enemy.sprite.alpha = 1;
          }, 100);
        }

        if (enemy.health.current <= 0) {
          enemiesToRemove.push(enemy);
        }

        break; // This projectile is consumed
      }
    }
  }

  for (const proj of projectilesToDespawn) {
    despawnProjectile(proj);
  }

  for (const enemy of enemiesToRemove) {
    if (enemy.sprite) {
      enemy.sprite.removeFromParent();
    }
    world.remove(enemy);
  }
}
