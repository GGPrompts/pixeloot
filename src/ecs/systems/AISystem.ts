import { world } from '../world';
import { fireEnemyProjectile } from '../../entities/Projectile';
import { updateFlowField, getFlowDirection } from '../../map/Pathfinding';
import { game } from '../../Game';
import { Graphics } from 'pixi.js';
import { spawnDamageNumber } from '../../ui/DamageNumbers';
import { applyStatus, StatusType } from '../../core/StatusEffects';
import { sfxPlayer } from '../../audio/SFXManager';
import { getDamageReduction } from '../../core/ComputedStats';

const enemies = world.with('enemy', 'position', 'velocity', 'speed');
const players = world.with('player', 'position');

/** Sniper preferred range band */
const SNIPER_MIN_RANGE = 150;
const SNIPER_MAX_RANGE = 250;
const SNIPER_FIRE_INTERVAL = 2; // seconds

/** Flanker behavior constants */
const FLANKER_CIRCLE_TIME = 3;  // seconds circling before dash
const FLANKER_DASH_TIME = 0.6;  // seconds of dash

/** Bomber behavior constants */
const BOMBER_FUSE_RANGE = 40;      // px: triggers fuse
const BOMBER_FUSE_TIME = 0.6;      // seconds
const BOMBER_EXPLODE_RADIUS = 60;  // px

/** Charger behavior constants */
const CHARGER_CHARGE_INTERVAL = 4; // seconds between charges
const CHARGER_WINDUP_TIME = 1;     // seconds telegraph
const CHARGER_DASH_SPEED = 400;    // px/sec
const CHARGER_DASH_TIME = 0.5;     // seconds

/** Pulsar behavior constants */
const PULSAR_PULSE_INTERVAL = 3;   // seconds between pulses
const PULSAR_PULSE_WINDUP = 0.5;   // seconds telegraph
const PULSAR_PULSE_RADIUS = 80;    // px

/**
 * Get the direction toward the player for an enemy, using the flow field
 * with a fallback to direct beeline if unreachable.
 */
function getChaseDirection(
  enemyX: number,
  enemyY: number,
  playerX: number,
  playerY: number,
): { x: number; y: number } {
  const flow = getFlowDirection(enemyX, enemyY);
  if (flow && (flow.x !== 0 || flow.y !== 0)) {
    return flow;
  }

  // Fallback: direct beeline
  const dx = playerX - enemyX;
  const dy = playerY - enemyY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= 0) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Sets enemy velocity based on enemyType each fixed tick.
 * Called before movementSystem so velocity is applied in the same frame.
 */
export function aiSystem(dt: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  // Update flow field (internally caches and skips if player hasn't moved tiles)
  if (game.tileMap) {
    updateFlowField(player.position.x, player.position.y, game.tileMap);
  }

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
        // Use flow field for base direction, add jitter so the pack spreads out
        const dir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        const jitterX = (Math.random() - 0.5) * 0.6;
        const jitterY = (Math.random() - 0.5) * 0.6;
        const sx = dir.x + jitterX;
        const sy = dir.y + jitterY;
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
          // Use flow field to approach
          const dir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = dir.x * enemy.speed;
          enemy.velocity.y = dir.y * enemy.speed;
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
          // Dash: use flow field for wall-aware approach
          const dir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = dir.x * enemy.speed * 1.8;
          enemy.velocity.y = dir.y * enemy.speed * 1.8;

          if ((enemy.aiTimer ?? 0) <= 0) {
            enemy.aiState = 'circling';
            enemy.aiTimer = FLANKER_CIRCLE_TIME;
          }
        } else {
          // Circle: move perpendicular to player direction with slight approach
          // Use flow field for the approach component
          const dir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          const perpX = -ny;
          const perpY = nx;
          const approach = 0.2;
          enemy.velocity.x = (perpX + dir.x * approach) * enemy.speed;
          enemy.velocity.y = (perpY + dir.y * approach) * enemy.speed;

          if ((enemy.aiTimer ?? 0) <= 0) {
            enemy.aiState = 'dashing';
            enemy.aiTimer = FLANKER_DASH_TIME;
          }
        }
        break;
      }

      case 'splitter': {
        // Use flow field to chase player
        const dir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        enemy.velocity.x = dir.x * enemy.speed;
        enemy.velocity.y = dir.y * enemy.speed;
        break;
      }

      case 'shielder': {
        // Use flow field to chase player
        const dir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        enemy.velocity.x = dir.x * enemy.speed;
        enemy.velocity.y = dir.y * enemy.speed;
        break;
      }

      case 'bomber': {
        // If fuse is active, count down and stop moving
        if (enemy.bomberFuse !== undefined) {
          enemy.bomberFuse -= dt;
          enemy.velocity.x = 0;
          enemy.velocity.y = 0;
          // Pulsing visual: scale oscillates faster as fuse burns down
          if (enemy.sprite) {
            const pulseRate = 10 + (BOMBER_FUSE_TIME - enemy.bomberFuse) * 30;
            const scale = 1 + Math.sin(enemy.bomberFuse * pulseRate) * 0.15;
            enemy.sprite.scale.set(scale, scale);
          }
          // Fuse expired -> explosion handled in CollisionSystem
          break;
        }

        // Chase player via flow field
        const bomberDir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        enemy.velocity.x = bomberDir.x * enemy.speed;
        enemy.velocity.y = bomberDir.y * enemy.speed;

        // Trigger fuse when close enough
        if (len <= BOMBER_FUSE_RANGE) {
          enemy.bomberFuse = BOMBER_FUSE_TIME;
        }
        break;
      }

      case 'charger': {
        // Tick AI timer
        if (enemy.aiTimer !== undefined) {
          enemy.aiTimer -= dt;
        }

        // Self-stun after hitting a wall
        if (enemy.selfStunTimer !== undefined && enemy.selfStunTimer > 0) {
          enemy.selfStunTimer -= dt;
          enemy.velocity.x = 0;
          enemy.velocity.y = 0;
          if (enemy.sprite) {
            enemy.sprite.alpha = 0.5 + Math.sin(enemy.selfStunTimer * 15) * 0.3;
          }
          if (enemy.selfStunTimer <= 0) {
            enemy.selfStunTimer = undefined;
            enemy.aiState = 'walking';
            enemy.aiTimer = CHARGER_CHARGE_INTERVAL;
            if (enemy.sprite) enemy.sprite.alpha = 1;
          }
          break;
        }

        if (enemy.aiState === 'charging') {
          // Dash in locked direction at high speed
          if (enemy.chargerDir) {
            enemy.velocity.x = enemy.chargerDir.x * CHARGER_DASH_SPEED;
            enemy.velocity.y = enemy.chargerDir.y * CHARGER_DASH_SPEED;
          }
          if ((enemy.aiTimer ?? 0) <= 0) {
            // Charge ended without hitting wall
            enemy.aiState = 'walking';
            enemy.aiTimer = CHARGER_CHARGE_INTERVAL;
            enemy.chargerDir = undefined;
          }
          // Check wall collision: if the charger is inside a wall tile, self-stun
          if (game.tileMap) {
            const tile = game.tileMap.worldToTile(enemy.position.x, enemy.position.y);
            if (game.tileMap.blocksMovement(tile.x, tile.y)) {
              enemy.selfStunTimer = 1;
              enemy.velocity.x = 0;
              enemy.velocity.y = 0;
              enemy.chargerDir = undefined;
            }
          }
          break;
        }

        if (enemy.aiState === 'windup') {
          // During windup, stand still and shake
          enemy.velocity.x = 0;
          enemy.velocity.y = 0;
          if (enemy.sprite) {
            enemy.sprite.position.x = enemy.position.x + (Math.random() - 0.5) * 3;
            enemy.sprite.position.y = enemy.position.y + (Math.random() - 0.5) * 3;
          }
          if ((enemy.aiTimer ?? 0) <= 0) {
            // Lock direction to current player position and start charging
            enemy.aiState = 'charging';
            enemy.aiTimer = CHARGER_DASH_TIME;
            // chargerDir was set when windup began
          }
          break;
        }

        // Walking state: slow chase via flow field
        const chargerDir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        enemy.velocity.x = chargerDir.x * enemy.speed;
        enemy.velocity.y = chargerDir.y * enemy.speed;

        // Start charge windup when timer expires
        if ((enemy.aiTimer ?? 0) <= 0) {
          enemy.aiState = 'windup';
          enemy.aiTimer = CHARGER_WINDUP_TIME;
          // Lock charge direction toward player at START of windup
          enemy.chargerDir = { x: nx, y: ny };

          // Draw telegraph line
          const telegraphLine = new Graphics();
          telegraphLine.moveTo(0, 0)
            .lineTo(nx * 200, ny * 200)
            .stroke({ color: 0xff0000, width: 2, alpha: 0.6 });
          telegraphLine.position.set(enemy.position.x, enemy.position.y);
          game.effectLayer.addChild(telegraphLine);
          // Remove telegraph after windup
          setTimeout(() => {
            telegraphLine.removeFromParent();
            telegraphLine.destroy();
          }, CHARGER_WINDUP_TIME * 1000);
        }
        break;
      }

      case 'pulsar': {
        // Chase player via flow field
        const pulsarDir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        enemy.velocity.x = pulsarDir.x * enemy.speed;
        enemy.velocity.y = pulsarDir.y * enemy.speed;

        // Tick pulse timer
        if (enemy.aiTimer !== undefined) {
          enemy.aiTimer -= dt;

          // Visual windup: expand glow in last 0.5s before pulse
          if (enemy.aiTimer <= PULSAR_PULSE_WINDUP && enemy.aiTimer > 0 && enemy.sprite) {
            const t = 1 - (enemy.aiTimer / PULSAR_PULSE_WINDUP);
            enemy.sprite.scale.set(1 + t * 0.3, 1 + t * 0.3);
          }

          if (enemy.aiTimer <= 0) {
            enemy.aiTimer = PULSAR_PULSE_INTERVAL;
            // Reset scale
            if (enemy.sprite) enemy.sprite.scale.set(1, 1);

            // Pulse AoE visual: expanding ring
            const ring = new Graphics();
            ring.circle(0, 0, 10).stroke({ color: 0xffff88, width: 3, alpha: 0.8 });
            ring.position.set(enemy.position.x, enemy.position.y);
            game.effectLayer.addChild(ring);
            const ringStart = performance.now();
            const expandRing = () => {
              const elapsed = performance.now() - ringStart;
              const t = Math.min(elapsed / 300, 1);
              const r = 10 + t * (PULSAR_PULSE_RADIUS - 10);
              ring.clear();
              ring.circle(0, 0, r).stroke({ color: 0xffff88, width: 3, alpha: 0.8 * (1 - t) });
              if (t >= 1) {
                ring.removeFromParent();
                ring.destroy();
              } else {
                requestAnimationFrame(expandRing);
              }
            };
            requestAnimationFrame(expandRing);

            // Damage player if within pulse radius
            if (len <= PULSAR_PULSE_RADIUS && player.health) {
              const rawDmg = enemy.damage ?? 12;
              const dr = getDamageReduction(enemy.level ?? 1);
              const pulsarDmg = Math.max(1, Math.round(rawDmg * (1 - dr)));
              player.health.current -= pulsarDmg;
              spawnDamageNumber(player.position.x, player.position.y - 10, pulsarDmg, 0xffff00);
              sfxPlayer.play('hit_magic');
              applyStatus(player, StatusType.Shock, enemy.position);
              if (player.health.current <= 0) {
                player.health.current = 0;
              }
            }
          }
        }
        break;
      }

      // 'rusher' and 'tank' both chase directly (tank is just slower)
      default: {
        const dir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        enemy.velocity.x = dir.x * enemy.speed;
        enemy.velocity.y = dir.y * enemy.speed;
        break;
      }
    }

    // Rotate sprite to face movement direction
    if (enemy.sprite) {
      enemy.sprite.rotation = Math.atan2(enemy.velocity.y, enemy.velocity.x);
    }
  }
}
