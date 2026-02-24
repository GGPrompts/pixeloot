import { world } from '../world';
import { fireEnemyProjectile } from '../../entities/Projectile';

const enemies = world.with('enemy', 'position', 'velocity', 'speed');
const players = world.with('player', 'position');

/** Sniper preferred range band */
const SNIPER_MIN_RANGE = 150;
const SNIPER_MAX_RANGE = 250;
const SNIPER_FIRE_INTERVAL = 2; // seconds

/** Flanker behavior constants */
const FLANKER_CIRCLE_TIME = 3;  // seconds circling before dash
const FLANKER_DASH_TIME = 0.6;  // seconds of dash

/**
 * Sets enemy velocity based on enemyType each fixed tick.
 * Called before movementSystem so velocity is applied in the same frame.
 */
export function aiSystem(dt: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  for (const enemy of enemies) {
    const dx = player.position.x - enemy.position.x;
    const dy = player.position.y - enemy.position.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len <= 0) continue;

    const nx = dx / len;
    const ny = dy / len;

    const type = enemy.enemyType ?? 'rusher';

    switch (type) {
      case 'swarm': {
        // Chase player with random jitter so the pack spreads out
        const jitterX = (Math.random() - 0.5) * 0.6;
        const jitterY = (Math.random() - 0.5) * 0.6;
        const sx = nx + jitterX;
        const sy = ny + jitterY;
        const sLen = Math.sqrt(sx * sx + sy * sy);
        enemy.velocity.x = (sx / sLen) * enemy.speed;
        enemy.velocity.y = (sy / sLen) * enemy.speed;
        break;
      }

      case 'sniper': {
        // Stay at preferred range, move away if too close, approach if too far
        if (len < SNIPER_MIN_RANGE) {
          // Back away from player
          enemy.velocity.x = -nx * enemy.speed;
          enemy.velocity.y = -ny * enemy.speed;
        } else if (len > SNIPER_MAX_RANGE) {
          // Move toward player
          enemy.velocity.x = nx * enemy.speed;
          enemy.velocity.y = ny * enemy.speed;
        } else {
          // In range: strafe slightly
          enemy.velocity.x = -ny * enemy.speed * 0.3;
          enemy.velocity.y = nx * enemy.speed * 0.3;
        }

        // Fire projectile on cooldown
        if (enemy.aiTimer !== undefined) {
          enemy.aiTimer -= dt;
          if (enemy.aiTimer <= 0) {
            enemy.aiTimer = SNIPER_FIRE_INTERVAL;
            fireEnemyProjectile(
              enemy.position.x,
              enemy.position.y,
              player.position.x,
              player.position.y,
            );
          }
        }
        break;
      }

      case 'flanker': {
        // Tick AI timer
        if (enemy.aiTimer !== undefined) {
          enemy.aiTimer -= dt;
        }

        if (enemy.aiState === 'dashing') {
          // Dash directly at player
          enemy.velocity.x = nx * enemy.speed * 1.8;
          enemy.velocity.y = ny * enemy.speed * 1.8;

          if ((enemy.aiTimer ?? 0) <= 0) {
            enemy.aiState = 'circling';
            enemy.aiTimer = FLANKER_CIRCLE_TIME;
          }
        } else {
          // Circle: move perpendicular to player direction with slight approach
          const perpX = -ny;
          const perpY = nx;
          const approach = 0.2;
          enemy.velocity.x = (perpX + nx * approach) * enemy.speed;
          enemy.velocity.y = (perpY + ny * approach) * enemy.speed;

          if ((enemy.aiTimer ?? 0) <= 0) {
            enemy.aiState = 'dashing';
            enemy.aiTimer = FLANKER_DASH_TIME;
          }
        }
        break;
      }

      case 'splitter': {
        // Chase player directly, same as rusher but faster
        enemy.velocity.x = nx * enemy.speed;
        enemy.velocity.y = ny * enemy.speed;
        break;
      }

      case 'shielder': {
        // Chase player directly, shield faces toward the player (handled by sprite rotation)
        enemy.velocity.x = nx * enemy.speed;
        enemy.velocity.y = ny * enemy.speed;
        break;
      }

      // 'rusher' and 'tank' both chase directly (tank is just slower)
      default: {
        enemy.velocity.x = nx * enemy.speed;
        enemy.velocity.y = ny * enemy.speed;
        break;
      }
    }

    // Rotate sprite to face movement direction
    if (enemy.sprite) {
      enemy.sprite.rotation = Math.atan2(enemy.velocity.y, enemy.velocity.x);
    }
  }
}
