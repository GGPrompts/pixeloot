import { world } from '../world';
import { fireEnemyProjectile } from '../../entities/Projectile';
import { updateFlowField, getFlowDirection } from '../../map/Pathfinding';
import { game } from '../../Game';
import { Graphics } from 'pixi.js';
import { spawnDamageNumber } from '../../ui/DamageNumbers';
import { applyStatus, StatusType } from '../../core/StatusEffects';
import { sfxPlayer } from '../../audio/SFXManager';
import { getDamageReduction } from '../../core/ComputedStats';
import { Container } from 'pixi.js';

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

/** Mirror behavior constants */
const MIRROR_ORBIT_RADIUS = 180;   // px orbit distance from player
const MIRROR_REFLECT_COOLDOWN = 2; // seconds cracked after reflecting

/** Phaser behavior constants */
const PHASER_SOLID_DURATION = 1.5;  // seconds solid (hittable)
const PHASER_PHASE_DURATION = 1.5;  // seconds phased (invulnerable)

/** Burrower behavior constants */
const BURROWER_BURROW_TIME = 3;     // seconds underground
const BURROWER_SURFACE_TIME = 2;    // seconds surfaced
const BURROWER_SURFACE_RANGE = 50;  // px: surface when this close to player
const BURROWER_STUN_RADIUS = 30;    // px: stun AoE on surfacing

/** Warper behavior constants */
const WARPER_TELEPORT_INTERVAL = 2.5; // seconds between teleports
const WARPER_POST_FIRE_DURATION = 0.8; // seconds stationary after firing
const WARPER_TELEPORT_MIN_DIST = 80;  // px: minimum distance from player after teleport
const WARPER_TELEPORT_MAX_DIST = 200; // px: maximum distance from player after teleport

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

      case 'mirror': {
        // Orbit the player at MIRROR_ORBIT_RADIUS, always facing the player
        const orbitAngle = Math.atan2(
          enemy.position.y - player.position.y,
          enemy.position.x - player.position.x,
        );
        // Tangential velocity for orbiting (counterclockwise)
        const tangentX = -Math.sin(orbitAngle);
        const tangentY = Math.cos(orbitAngle);
        // Radial correction to maintain orbit distance
        const currentDist = len;
        const radialError = currentDist - MIRROR_ORBIT_RADIUS;
        const radialX = -Math.cos(orbitAngle); // toward player
        const radialY = -Math.sin(orbitAngle);
        const radialWeight = radialError * 0.05; // gentle correction
        enemy.velocity.x = (tangentX + radialX * radialWeight) * enemy.speed;
        enemy.velocity.y = (tangentY + radialY * radialWeight) * enemy.speed;

        // Tick reflect cooldown
        if (enemy.mirrorReflectCooldown !== undefined && enemy.mirrorReflectCooldown > 0) {
          enemy.mirrorReflectCooldown -= dt;
          if (enemy.mirrorReflectCooldown <= 0) {
            enemy.mirrorReflectCooldown = 0;
            enemy.aiState = 'reflecting';
            // Restore bright visual
            if (enemy.sprite) enemy.sprite.alpha = 1;
          }
        }
        break;
      }

      case 'phaser': {
        // Tick phase timer
        if (enemy.phaserPhaseTimer !== undefined) {
          enemy.phaserPhaseTimer -= dt;
          if (enemy.phaserPhaseTimer <= 0) {
            // Toggle phase state
            if (enemy.phaserSolid) {
              // Transition to phased (invulnerable)
              enemy.phaserSolid = false;
              enemy.aiState = 'phased';
              enemy.phaserPhaseTimer = PHASER_PHASE_DURATION;
              enemy.invulnerable = true;
              enemy.damage = 0; // cannot deal damage while phased
            } else {
              // Transition to solid (vulnerable)
              enemy.phaserSolid = true;
              enemy.aiState = 'solid';
              enemy.phaserPhaseTimer = PHASER_SOLID_DURATION;
              enemy.invulnerable = undefined;
              // Restore damage (recalculated from base)
              enemy.damage = enemy.damage; // keep current
            }
          }
        }

        // Visual: alpha based on phase state with smooth fade
        if (enemy.sprite) {
          const targetAlpha = enemy.phaserSolid ? 1 : 0.15;
          const currentAlpha = enemy.sprite.alpha;
          const fadeSpeed = 5; // per second
          if (currentAlpha < targetAlpha) {
            enemy.sprite.alpha = Math.min(targetAlpha, currentAlpha + fadeSpeed * dt);
          } else if (currentAlpha > targetAlpha) {
            enemy.sprite.alpha = Math.max(targetAlpha, currentAlpha - fadeSpeed * dt);
          }
        }

        // Chase via flow field regardless of phase state
        const phaserDir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        enemy.velocity.x = phaserDir.x * enemy.speed;
        enemy.velocity.y = phaserDir.y * enemy.speed;
        break;
      }

      case 'burrower': {
        // Tick surface/burrow timer
        if (enemy.burrowSurfaceTimer !== undefined) {
          enemy.burrowSurfaceTimer -= dt;
        }

        if (enemy.burrowed) {
          // Underground: chase via flow field, invisible + invulnerable
          const burrowDir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = burrowDir.x * enemy.speed;
          enemy.velocity.y = burrowDir.y * enemy.speed;

          // Rumble visual: jitter dust circle position slightly
          if (enemy.sprite && (enemy.sprite as Container).children) {
            const dust = (enemy.sprite as Container).children[1];
            if (dust) {
              dust.position.x = (Math.random() - 0.5) * 2;
              dust.position.y = (Math.random() - 0.5) * 2;
            }
          }

          // Surface when close to player OR timer expired
          const shouldSurface = len <= BURROWER_SURFACE_RANGE || (enemy.burrowSurfaceTimer !== undefined && enemy.burrowSurfaceTimer <= 0);
          if (shouldSurface) {
            // Surface with stun AoE
            enemy.burrowed = false;
            enemy.invulnerable = undefined;
            enemy.aiState = 'surfaced';
            enemy.burrowSurfaceTimer = BURROWER_SURFACE_TIME;

            // Show chevron, hide dust
            if (enemy.sprite && (enemy.sprite as Container).children) {
              const chevron = (enemy.sprite as Container).children[0];
              const dust = (enemy.sprite as Container).children[1];
              if (chevron) chevron.visible = true;
              if (dust) dust.visible = false;
            }

            // Stun AoE on surfacing
            if (len <= BURROWER_STUN_RADIUS && player.health) {
              const rawDmg = enemy.damage ?? 18;
              const dr = getDamageReduction(enemy.level ?? 1);
              const stunDmg = Math.max(1, Math.round(rawDmg * (1 - dr)));
              player.health.current -= stunDmg;
              spawnDamageNumber(player.position.x, player.position.y - 10, stunDmg, 0x886633);
              applyStatus(player, StatusType.Stun, enemy.position);
              sfxPlayer.play('hit_physical');
              if (player.health.current <= 0) player.health.current = 0;
            }

            // Visual: expanding dust ring
            const dustRing = new Graphics();
            dustRing.circle(0, 0, 8).stroke({ color: 0x886633, width: 2, alpha: 0.6 });
            dustRing.position.set(enemy.position.x, enemy.position.y);
            game.effectLayer.addChild(dustRing);
            const ringStart = performance.now();
            const expandDust = () => {
              const elapsed = performance.now() - ringStart;
              const t = Math.min(elapsed / 300, 1);
              const r = 8 + t * (BURROWER_STUN_RADIUS - 8);
              dustRing.clear();
              dustRing.circle(0, 0, r).stroke({ color: 0x886633, width: 2, alpha: 0.6 * (1 - t) });
              if (t >= 1) {
                dustRing.removeFromParent();
                dustRing.destroy();
              } else {
                requestAnimationFrame(expandDust);
              }
            };
            requestAnimationFrame(expandDust);
          }
        } else {
          // Surfaced: chase normally
          const surfaceDir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = surfaceDir.x * enemy.speed;
          enemy.velocity.y = surfaceDir.y * enemy.speed;

          // Re-burrow when timer expires
          if (enemy.burrowSurfaceTimer !== undefined && enemy.burrowSurfaceTimer <= 0) {
            enemy.burrowed = true;
            enemy.invulnerable = true;
            enemy.aiState = 'burrowed';
            enemy.burrowSurfaceTimer = BURROWER_BURROW_TIME;

            // Hide chevron, show dust
            if (enemy.sprite && (enemy.sprite as Container).children) {
              const chevron = (enemy.sprite as Container).children[0];
              const dust = (enemy.sprite as Container).children[1];
              if (chevron) chevron.visible = false;
              if (dust) dust.visible = true;
            }
          }
        }
        break;
      }

      case 'warper': {
        // Tick teleport timer
        if (enemy.warperTeleportTimer !== undefined) {
          enemy.warperTeleportTimer -= dt;
        }

        // Post-fire stationary window
        if (enemy.warperPostFireTimer !== undefined && enemy.warperPostFireTimer > 0) {
          enemy.warperPostFireTimer -= dt;
          enemy.velocity.x = 0;
          enemy.velocity.y = 0;
          if (enemy.warperPostFireTimer <= 0) {
            enemy.warperPostFireTimer = undefined;
            enemy.aiState = 'moving';
          }
          break;
        }

        // Teleport when timer expires
        if (enemy.warperTeleportTimer !== undefined && enemy.warperTeleportTimer <= 0) {
          enemy.warperTeleportTimer = WARPER_TELEPORT_INTERVAL;

          // Find a random walkable tile within range of player
          let teleportPos: { x: number; y: number } | null = null;
          for (let attempt = 0; attempt < 20; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = WARPER_TELEPORT_MIN_DIST + Math.random() * (WARPER_TELEPORT_MAX_DIST - WARPER_TELEPORT_MIN_DIST);
            const tx = player.position.x + Math.cos(angle) * dist;
            const ty = player.position.y + Math.sin(angle) * dist;
            if (game.tileMap) {
              const tile = game.tileMap.worldToTile(tx, ty);
              if (!game.tileMap.blocksMovement(tile.x, tile.y)) {
                teleportPos = game.tileMap.tileToWorld(tile.x, tile.y);
                break;
              }
            }
          }

          if (teleportPos) {
            // Spawn afterimage at old position
            const afterimage = new Graphics();
            afterimage.moveTo(-12, -10).lineTo(12, -10).lineTo(0, 0).closePath().fill({ color: 0x00cccc, alpha: 0.4 });
            afterimage.moveTo(-12, 10).lineTo(12, 10).lineTo(0, 0).closePath().fill({ color: 0x00cccc, alpha: 0.4 });
            afterimage.position.set(enemy.position.x, enemy.position.y);
            game.effectLayer.addChild(afterimage);
            const fadeStart = performance.now();
            const fadeAfterimage = () => {
              const elapsed = performance.now() - fadeStart;
              const t = Math.min(elapsed / 500, 1);
              afterimage.alpha = 0.4 * (1 - t);
              if (t >= 1) {
                afterimage.removeFromParent();
                afterimage.destroy();
              } else {
                requestAnimationFrame(fadeAfterimage);
              }
            };
            requestAnimationFrame(fadeAfterimage);

            // Teleport to new position
            enemy.position.x = teleportPos.x;
            enemy.position.y = teleportPos.y;
            if (enemy.sprite) {
              enemy.sprite.position.set(teleportPos.x, teleportPos.y);
            }

            // Fire projectile at player immediately
            fireEnemyProjectile(
              enemy.position.x,
              enemy.position.y,
              player.position.x,
              player.position.y,
            );

            // Enter post-fire stationary window
            enemy.warperPostFireTimer = WARPER_POST_FIRE_DURATION;
            enemy.aiState = 'firing';
            enemy.velocity.x = 0;
            enemy.velocity.y = 0;
          }
          break;
        }

        // Slow movement between teleports
        const warperDir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        enemy.velocity.x = warperDir.x * enemy.speed;
        enemy.velocity.y = warperDir.y * enemy.speed;
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
