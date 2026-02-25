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
import { spawnSwarm, spawnRusher, getCorpsePositions, consumeCorpse } from '../../entities/Enemy';

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

/** Leech behavior constants */
const LEECH_ATTACH_RANGE = 16;        // px: attaches on contact
const LEECH_ATTACH_DURATION = 4;      // seconds attached before auto-detach
const LEECH_DPS_INTERVAL = 1;         // damage tick every 1 second

/** Vortex behavior constants */
const VORTEX_IDLE_DURATION = 3;       // seconds between pulls
const VORTEX_PULL_DURATION = 2;       // seconds of active pull
const VORTEX_PULL_RADIUS = 120;       // px: gravitational range
const VORTEX_PULL_SPEED = 60;         // px/sec: pull strength

/** Healer behavior constants */
const HEALER_HEAL_INTERVAL = 2;       // seconds between heal pulses
const HEALER_HEAL_RADIUS = 100;       // px: heal range
const HEALER_HEAL_PERCENT = 0.1;      // 10% max HP restored
const HEALER_FLEE_DIST = 150;         // px: tries to stay this far from player
const HEALER_LONELY_RANGE = 200;      // px: switches to chase if no allies nearby

/** Lobber behavior constants */
const LOBBER_MIN_RANGE = 200;         // px: minimum distance from player
const LOBBER_MAX_RANGE = 300;         // px: maximum distance from player
const LOBBER_FIRE_INTERVAL = 3;       // seconds between lobs
const LOBBER_ARC_DURATION = 1;        // seconds for projectile to land
const LOBBER_IMPACT_RADIUS = 50;      // px: AoE damage radius on impact

/** Swooper behavior constants */
const SWOOPER_HOVER_RANGE = 225;      // px: preferred hover distance from player
const SWOOPER_SWOOP_INTERVAL = 2.5;   // seconds between swoops
const SWOOPER_SWOOP_SPEED = 300;      // px/sec during swoop
const SWOOPER_SWOOP_OVERSHOOT = 100;  // px past player before decelerating
const SWOOPER_RETURN_TIME = 1.5;      // seconds to drift back to hover range

/** Trapper behavior constants */
const TRAPPER_MIN_RANGE = 120;        // px: minimum kite distance
const TRAPPER_MAX_RANGE = 200;        // px: maximum kite distance
const TRAPPER_PLACE_INTERVAL = 3;     // seconds between trap placements
const TRAPPER_MAX_TRAPS = 3;          // max active traps per trapper
const TRAPPER_TRAP_RADIUS = 40;       // px: trap AoE radius
const TRAPPER_TRAP_LIFETIME = 8;      // seconds before unactivated trap despawns
const TRAPPER_TRAP_ARM_DELAY = 0.5;   // seconds before trap becomes active

/** Linker behavior constants */
const LINKER_ORBIT_RADIUS = 120;         // px: orbit distance from player
const LINKER_BEAM_DAMAGE_PER_SEC = 12;   // base damage per second from beam
const LINKER_ENRAGED_SPEED_MULT = 2;     // speed multiplier when partner dies

/** Mimic behavior constants */
const MIMIC_FIRE_INTERVAL = 2;           // seconds between projectile fires

/** Necromancer behavior constants */
const NECROMANCER_RAISE_INTERVAL = 6;    // seconds between raise attempts
const NECROMANCER_RAISE_RANGE = 300;     // px: max distance to a corpse to raise
const NECROMANCER_MAX_RAISED = 3;        // max active raised enemies
const NECROMANCER_CHANNEL_TIME = 2;      // seconds to channel a raise
const NECROMANCER_FLEE_DIST = 150;       // px: tries to stay this far from player

/** Overcharger behavior constants */
const OVERCHARGER_BUFF_RADIUS = 160;     // px: death buff range (design says 150, slightly increased)
const OVERCHARGER_BUFF_DURATION = 5;     // seconds buff lasts
const OVERCHARGER_BUFF_DAMAGE = 0.25;    // +25% damage buff
const OVERCHARGER_BUFF_SPEED = 0.15;     // +15% speed buff

/** Spawner behavior constants */
const SPAWNER_SPAWN_INTERVAL = 4;     // seconds between spawns
const SPAWNER_MAX_CHILDREN = 6;       // max active spawned Swarm
const SPAWNER_SPAWN_RADIUS = 64;      // px: spawn within this radius
const SPAWNER_CONTACT_RANGE = 50;     // px: melee damage range

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

      case 'leech': {
        if (enemy.leechAttached) {
          // Attached to player: follow player position with offset, deal DPS, apply Slow
          enemy.velocity.x = 0;
          enemy.velocity.y = 0;
          if (enemy.leechOffset) {
            enemy.position.x = player.position.x + enemy.leechOffset.x;
            enemy.position.y = player.position.y + enemy.leechOffset.y;
          }

          // Tick attach timer
          if (enemy.leechAttachTimer !== undefined) {
            enemy.leechAttachTimer -= dt;

            // Damage tick every second
            if (enemy.aiTimer !== undefined) {
              enemy.aiTimer -= dt;
              if (enemy.aiTimer <= 0) {
                enemy.aiTimer = LEECH_DPS_INTERVAL;
                if (player.health) {
                  const rawDmg = enemy.damage ?? 3;
                  const dr = getDamageReduction(enemy.level ?? 1);
                  const leechDmg = Math.max(1, Math.round(rawDmg * (1 - dr)));
                  player.health.current -= leechDmg;
                  spawnDamageNumber(player.position.x, player.position.y - 10, leechDmg, 0x9944cc);
                  if (player.health.current <= 0) player.health.current = 0;
                }
                applyStatus(player, StatusType.Slow, enemy.position);
              }
            }

            // Detach after duration expires
            if (enemy.leechAttachTimer <= 0) {
              enemy.leechAttached = false;
              enemy.aiState = 'chasing';
              enemy.leechAttachTimer = 0;
            }
          }
        } else {
          // Chase via flow field at high speed
          const leechDir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = leechDir.x * enemy.speed;
          enemy.velocity.y = leechDir.y * enemy.speed;

          // Attach on contact
          if (len <= LEECH_ATTACH_RANGE) {
            enemy.leechAttached = true;
            enemy.aiState = 'attached';
            enemy.leechAttachTimer = LEECH_ATTACH_DURATION;
            enemy.aiTimer = LEECH_DPS_INTERVAL;
            // Random small offset so multiple leeches don't stack exactly
            enemy.leechOffset = {
              x: (Math.random() - 0.5) * 20,
              y: (Math.random() - 0.5) * 20,
            };
            // Immediately apply Slow on attach
            applyStatus(player, StatusType.Slow, enemy.position);
          }
        }
        break;
      }

      case 'vortex': {
        // Stationary - no movement
        enemy.velocity.x = 0;
        enemy.velocity.y = 0;

        // Tick pull timer
        if (enemy.vortexPullTimer !== undefined) {
          enemy.vortexPullTimer -= dt;

          if (enemy.vortexPulling) {
            // Active pull phase: drag player toward center
            if (len <= VORTEX_PULL_RADIUS && len > 5) {
              // Pull player toward vortex center
              if (player.velocity) {
                const pullNx = (enemy.position.x - player.position.x) / len;
                const pullNy = (enemy.position.y - player.position.y) / len;
                player.position.x += pullNx * VORTEX_PULL_SPEED * dt;
                player.position.y += pullNy * VORTEX_PULL_SPEED * dt;
              }

              // Contact damage
              if (len <= 20 && player.health) {
                const rawDmg = enemy.damage ?? 8;
                const dr = getDamageReduction(enemy.level ?? 1);
                const vortexDmg = Math.max(1, Math.round(rawDmg * (1 - dr)));
                // Only damage once per second (use aiTimer)
                if (enemy.aiTimer !== undefined) {
                  enemy.aiTimer -= dt;
                  if (enemy.aiTimer <= 0) {
                    enemy.aiTimer = 1;
                    player.health.current -= vortexDmg;
                    spawnDamageNumber(player.position.x, player.position.y - 10, vortexDmg, 0x6644ff);
                    if (player.health.current <= 0) player.health.current = 0;
                  }
                }
              }
            }

            // Visual: speed up rotation during pull
            if (enemy.sprite) {
              enemy.sprite.rotation += dt * 6;
            }

            // End pull phase
            if (enemy.vortexPullTimer <= 0) {
              enemy.vortexPulling = false;
              enemy.vortexPullTimer = VORTEX_IDLE_DURATION;
            }
          } else {
            // Idle phase: slow rotation
            if (enemy.sprite) {
              enemy.sprite.rotation += dt * 1;
            }

            // Start pull phase
            if (enemy.vortexPullTimer <= 0) {
              enemy.vortexPulling = true;
              enemy.vortexPullTimer = VORTEX_PULL_DURATION;
              enemy.aiTimer = 0; // reset contact damage timer

              // Visual: pulse effect to signal pull start
              if (enemy.sprite) {
                enemy.sprite.scale.set(1.3, 1.3);
                setTimeout(() => {
                  if (enemy.sprite) enemy.sprite.scale.set(1, 1);
                }, 200);
              }
            }
          }
        }
        // Skip rotation at end of loop for vortex (handled above)
        continue;
      }

      case 'healer': {
        // Check if any allies are nearby
        const allEnemies = world.with('enemy', 'position', 'health');
        let nearbyAllyCount = 0;
        for (const ally of allEnemies) {
          if (ally === enemy || ally.dead) continue;
          const adx = ally.position.x - enemy.position.x;
          const ady = ally.position.y - enemy.position.y;
          if (Math.sqrt(adx * adx + ady * ady) <= HEALER_LONELY_RANGE) {
            nearbyAllyCount++;
          }
        }

        if (nearbyAllyCount === 0) {
          // Lonely: slow chase toward player
          const lonelyDir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = lonelyDir.x * enemy.speed * 0.5;
          enemy.velocity.y = lonelyDir.y * enemy.speed * 0.5;
        } else {
          // Flee from player: use inverse flow field direction
          const fleeDir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          if (len < HEALER_FLEE_DIST) {
            // Run away
            enemy.velocity.x = -fleeDir.x * enemy.speed;
            enemy.velocity.y = -fleeDir.y * enemy.speed;
          } else {
            // Far enough - strafe slowly
            enemy.velocity.x = -ny * enemy.speed * 0.3;
            enemy.velocity.y = nx * enemy.speed * 0.3;
          }
        }

        // Heal pulse timer
        if (enemy.healerHealTimer !== undefined) {
          enemy.healerHealTimer -= dt;
          if (enemy.healerHealTimer <= 0) {
            enemy.healerHealTimer = HEALER_HEAL_INTERVAL;

            // Heal all nearby enemies (not self)
            let healed = false;
            for (const ally of allEnemies) {
              if (ally === enemy || ally.dead) continue;
              const adx = ally.position.x - enemy.position.x;
              const ady = ally.position.y - enemy.position.y;
              if (Math.sqrt(adx * adx + ady * ady) <= HEALER_HEAL_RADIUS) {
                const healAmount = Math.round(ally.health.max * HEALER_HEAL_PERCENT);
                ally.health.current = Math.min(ally.health.max, ally.health.current + healAmount);
                healed = true;
              }
            }

            // Visual: expanding green heal ring
            if (healed) {
              const ring = new Graphics();
              ring.circle(0, 0, 10).stroke({ color: 0x66ff66, width: 2, alpha: 0.8 });
              ring.position.set(enemy.position.x, enemy.position.y);
              game.effectLayer.addChild(ring);
              const ringStart = performance.now();
              const expandRing = () => {
                const elapsed = performance.now() - ringStart;
                const t = Math.min(elapsed / 400, 1);
                const r = 10 + t * (HEALER_HEAL_RADIUS - 10);
                ring.clear();
                ring.circle(0, 0, r).stroke({ color: 0x66ff66, width: 2, alpha: 0.8 * (1 - t) });
                if (t >= 1) {
                  ring.removeFromParent();
                  ring.destroy();
                } else {
                  requestAnimationFrame(expandRing);
                }
              };
              requestAnimationFrame(expandRing);

              // Pulsing glow on healer sprite
              if (enemy.sprite) {
                enemy.sprite.scale.set(1.2, 1.2);
                setTimeout(() => {
                  if (enemy.sprite) enemy.sprite.scale.set(1, 1);
                }, 200);
              }
            }
          }
        }
        break;
      }

      case 'spawner': {
        // Stationary - no movement
        enemy.velocity.x = 0;
        enemy.velocity.y = 0;

        // Contact damage if player is very close
        if (len <= SPAWNER_CONTACT_RANGE && player.health) {
          if (enemy.aiTimer !== undefined) {
            enemy.aiTimer -= dt;
            if (enemy.aiTimer <= 0) {
              enemy.aiTimer = 1; // damage tick every 1s
              const rawDmg = enemy.damage ?? 5;
              const dr = getDamageReduction(enemy.level ?? 1);
              const contactDmg = Math.max(1, Math.round(rawDmg * (1 - dr)));
              player.health.current -= contactDmg;
              spawnDamageNumber(player.position.x, player.position.y - 10, contactDmg, 0xff8844);
              if (player.health.current <= 0) player.health.current = 0;
            }
          }
        }

        // Count current active children
        const allEnts = world.with('enemy', 'spawnedBySpawner');
        let childCount = 0;
        for (const child of allEnts) {
          if (child.spawnedBySpawner === enemy && !child.dead) {
            childCount++;
          }
        }
        enemy.spawnerChildCount = childCount;

        // Spawn timer
        if (enemy.spawnerSpawnTimer !== undefined) {
          enemy.spawnerSpawnTimer -= dt;
          if (enemy.spawnerSpawnTimer <= 0 && childCount < SPAWNER_MAX_CHILDREN) {
            enemy.spawnerSpawnTimer = SPAWNER_SPAWN_INTERVAL;

            // Spawn a Swarm enemy near the spawner
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnDist = Math.random() * SPAWNER_SPAWN_RADIUS;
            const spawnX = enemy.position.x + Math.cos(spawnAngle) * spawnDist;
            const spawnY = enemy.position.y + Math.sin(spawnAngle) * spawnDist;

            // Check the spawn position is walkable
            let finalX = spawnX;
            let finalY = spawnY;
            if (game.tileMap) {
              const tile = game.tileMap.worldToTile(spawnX, spawnY);
              if (game.tileMap.blocksMovement(tile.x, tile.y)) {
                finalX = enemy.position.x;
                finalY = enemy.position.y;
              }
            }

            const child = spawnSwarm(finalX, finalY, enemy.level ?? 1);
            child.spawnedBySpawner = enemy;

            // Visual: body contracts/expands on spawn
            if (enemy.sprite) {
              enemy.sprite.scale.set(0.8, 0.8);
              setTimeout(() => {
                if (enemy.sprite) enemy.sprite.scale.set(1.1, 1.1);
                setTimeout(() => {
                  if (enemy.sprite) enemy.sprite.scale.set(1, 1);
                }, 100);
              }, 100);
            }
          } else if (enemy.spawnerSpawnTimer <= 0) {
            // At max children, reset timer to check again next interval
            enemy.spawnerSpawnTimer = SPAWNER_SPAWN_INTERVAL;
          }
        }
        // Skip rotation for stationary spawner
        continue;
      }

      case 'lobber': {
        // Kite: maintain LOBBER_MIN_RANGE to LOBBER_MAX_RANGE from player
        if (len < LOBBER_MIN_RANGE) {
          // Back away
          enemy.velocity.x = -nx * enemy.speed;
          enemy.velocity.y = -ny * enemy.speed;
        } else if (len > LOBBER_MAX_RANGE) {
          // Approach via flow field
          const dir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = dir.x * enemy.speed;
          enemy.velocity.y = dir.y * enemy.speed;
        } else {
          // In range: strafe slowly
          enemy.velocity.x = -ny * enemy.speed * 0.3;
          enemy.velocity.y = nx * enemy.speed * 0.3;
        }

        // Fire arcing projectile on cooldown
        if (enemy.lobberFireTimer !== undefined) {
          enemy.lobberFireTimer -= dt;
          if (enemy.lobberFireTimer <= 0) {
            enemy.lobberFireTimer = LOBBER_FIRE_INTERVAL;

            // Target player's current position
            const targetX = player.position.x;
            const targetY = player.position.y;
            const startX = enemy.position.x;
            const startY = enemy.position.y;
            const lobDmg = enemy.damage ?? 15;
            const monsterLvl = enemy.level ?? 1;

            // Spawn growing shadow circle at target location (telegraph)
            const shadow = new Graphics();
            shadow.circle(0, 0, 5).fill({ color: 0x000000, alpha: 0.2 });
            shadow.position.set(targetX, targetY);
            game.effectLayer.addChild(shadow);

            // Spawn arcing projectile (visual only, damage on impact)
            const lobProj = new Graphics();
            lobProj.circle(0, 0, 5).fill({ color: 0x44aaaa, alpha: 0.9 });
            lobProj.position.set(startX, startY);
            game.effectLayer.addChild(lobProj);

            const lobStart = performance.now();
            const lobDuration = LOBBER_ARC_DURATION * 1000; // ms

            const animateLob = () => {
              const elapsed = performance.now() - lobStart;
              const t = Math.min(elapsed / lobDuration, 1);

              // Linear interpolation on X/Y, parabolic arc on "height" (rendered as Y offset + scale)
              const currentX = startX + (targetX - startX) * t;
              const currentY = startY + (targetY - startY) * t;
              // Parabolic arc height: peaks at t=0.5
              const arcHeight = 80 * (4 * t * (1 - t)); // max 80px at midpoint
              lobProj.position.set(currentX, currentY - arcHeight);
              // Scale projectile based on "height" (bigger when higher = visual depth cue)
              const scaleFactor = 1 + arcHeight / 120;
              lobProj.scale.set(scaleFactor, scaleFactor);

              // Grow shadow at target as projectile approaches
              shadow.clear();
              const shadowR = 5 + t * (LOBBER_IMPACT_RADIUS - 5);
              shadow.circle(0, 0, shadowR).fill({ color: 0x000000, alpha: 0.15 + t * 0.15 });

              if (t >= 1) {
                // Impact! Remove projectile and shadow
                lobProj.removeFromParent();
                lobProj.destroy();
                shadow.removeFromParent();
                shadow.destroy();

                // Impact visual: expanding teal ring
                const impactRing = new Graphics();
                impactRing.circle(0, 0, 10).fill({ color: 0x44aaaa, alpha: 0.5 });
                impactRing.position.set(targetX, targetY);
                game.effectLayer.addChild(impactRing);
                const impactStart = performance.now();
                const expandImpact = () => {
                  const ie = performance.now() - impactStart;
                  const it = Math.min(ie / 300, 1);
                  const ir = 10 + it * (LOBBER_IMPACT_RADIUS - 10);
                  impactRing.clear();
                  impactRing.circle(0, 0, ir).fill({ color: 0x44aaaa, alpha: 0.5 * (1 - it) });
                  if (it >= 1) {
                    impactRing.removeFromParent();
                    impactRing.destroy();
                  } else {
                    requestAnimationFrame(expandImpact);
                  }
                };
                requestAnimationFrame(expandImpact);

                // Damage player if within impact radius
                const pq = world.with('player', 'position', 'health');
                if (pq.entities.length > 0) {
                  const pl = pq.entities[0];
                  const pdx = pl.position.x - targetX;
                  const pdy = pl.position.y - targetY;
                  if (pdx * pdx + pdy * pdy < LOBBER_IMPACT_RADIUS * LOBBER_IMPACT_RADIUS) {
                    const dr = getDamageReduction(monsterLvl);
                    const finalDmg = Math.max(1, Math.round(lobDmg * (1 - dr)));
                    pl.health.current -= finalDmg;
                    spawnDamageNumber(pl.position.x, pl.position.y - 10, finalDmg, 0x44aaaa);
                    sfxPlayer.play('hit_magic');
                    applyStatus(pl, StatusType.Burn, { x: targetX, y: targetY });
                    if (pl.health.current <= 0) pl.health.current = 0;
                  }
                }
              } else {
                requestAnimationFrame(animateLob);
              }
            };
            requestAnimationFrame(animateLob);
          }
        }
        break;
      }

      case 'swooper': {
        // Tick swoop timer
        if (enemy.swooperSwoopTimer !== undefined) {
          enemy.swooperSwoopTimer -= dt;
        }

        if (enemy.aiState === 'swooping') {
          // Fast diagonal pass through player position
          if (enemy.swooperDir) {
            enemy.velocity.x = enemy.swooperDir.x * SWOOPER_SWOOP_SPEED;
            enemy.velocity.y = enemy.swooperDir.y * SWOOPER_SWOOP_SPEED;
          }

          // Check if passed the target + overshoot distance
          if (enemy.swooperSwoopTimer !== undefined && enemy.swooperSwoopTimer <= 0) {
            enemy.aiState = 'returning';
            enemy.swooperSwoopTimer = SWOOPER_RETURN_TIME;
            enemy.swooperDir = undefined;
            // Flip side for next swoop
            if (enemy.swooperSide !== undefined) {
              enemy.swooperSide = -enemy.swooperSide;
            }
          }
          break;
        }

        if (enemy.aiState === 'returning') {
          // Drift back to hover range
          if (len < SWOOPER_HOVER_RANGE - 30) {
            // Move away from player
            enemy.velocity.x = -nx * enemy.speed;
            enemy.velocity.y = -ny * enemy.speed;
          } else if (len > SWOOPER_HOVER_RANGE + 30) {
            // Move toward player
            const dir = getChaseDirection(
              enemy.position.x, enemy.position.y,
              player.position.x, player.position.y,
            );
            enemy.velocity.x = dir.x * enemy.speed;
            enemy.velocity.y = dir.y * enemy.speed;
          } else {
            // Drift laterally
            const side = enemy.swooperSide ?? 1;
            enemy.velocity.x = (-ny * side) * enemy.speed * 0.5;
            enemy.velocity.y = (nx * side) * enemy.speed * 0.5;
          }

          if (enemy.swooperSwoopTimer !== undefined && enemy.swooperSwoopTimer <= 0) {
            enemy.aiState = 'hovering';
            enemy.swooperSwoopTimer = SWOOPER_SWOOP_INTERVAL;
          }
          break;
        }

        // Hovering state: drift laterally at hover range
        if (len < SWOOPER_HOVER_RANGE - 30) {
          enemy.velocity.x = -nx * enemy.speed;
          enemy.velocity.y = -ny * enemy.speed;
        } else if (len > SWOOPER_HOVER_RANGE + 30) {
          const dir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = dir.x * enemy.speed;
          enemy.velocity.y = dir.y * enemy.speed;
        } else {
          const side = enemy.swooperSide ?? 1;
          enemy.velocity.x = (-ny * side) * enemy.speed * 0.5;
          enemy.velocity.y = (nx * side) * enemy.speed * 0.5;
        }

        // Start swoop when timer expires
        if (enemy.swooperSwoopTimer !== undefined && enemy.swooperSwoopTimer <= 0) {
          enemy.aiState = 'swooping';
          // Calculate swoop duration based on distance to pass through player + overshoot
          const swoopDist = len + SWOOPER_SWOOP_OVERSHOOT;
          enemy.swooperSwoopTimer = swoopDist / SWOOPER_SWOOP_SPEED;

          // Direction: diagonal toward player, offset by perpendicular component
          const side = enemy.swooperSide ?? 1;
          const diagX = nx + (-ny * side) * 0.3;
          const diagY = ny + (nx * side) * 0.3;
          const diagLen = Math.sqrt(diagX * diagX + diagY * diagY);
          enemy.swooperDir = { x: diagX / diagLen, y: diagY / diagLen };
        }
        break;
      }

      case 'trapper': {
        // Kite: maintain TRAPPER_MIN_RANGE to TRAPPER_MAX_RANGE from player
        if (len < TRAPPER_MIN_RANGE) {
          // Back away
          enemy.velocity.x = -nx * enemy.speed;
          enemy.velocity.y = -ny * enemy.speed;
        } else if (len > TRAPPER_MAX_RANGE) {
          // Approach via flow field
          const dir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = dir.x * enemy.speed;
          enemy.velocity.y = dir.y * enemy.speed;
        } else {
          // In range: strafe slowly
          enemy.velocity.x = -ny * enemy.speed * 0.3;
          enemy.velocity.y = nx * enemy.speed * 0.3;
        }

        // Place trap on cooldown
        if (enemy.trapperPlaceTimer !== undefined) {
          enemy.trapperPlaceTimer -= dt;
          if (enemy.trapperPlaceTimer <= 0 && (enemy.trapperTrapCount ?? 0) < TRAPPER_MAX_TRAPS) {
            enemy.trapperPlaceTimer = TRAPPER_PLACE_INTERVAL;

            // Place trap at player's current position
            const trapX = player.position.x;
            const trapY = player.position.y;
            const trapDmg = enemy.damage ?? 10;
            const trapMonsterLvl = enemy.level ?? 1;

            // Increment trap count
            if (enemy.trapperTrapCount !== undefined) {
              enemy.trapperTrapCount++;
            }

            // Spawn trap visual (faint circle that becomes bright after arm delay)
            const trap = new Graphics();
            trap.circle(0, 0, TRAPPER_TRAP_RADIUS).fill({ color: 0xcc4400, alpha: 0.1 });
            trap.circle(0, 0, TRAPPER_TRAP_RADIUS).stroke({ color: 0xcc4400, width: 1, alpha: 0.2 });
            trap.position.set(trapX, trapY);
            game.effectLayer.addChild(trap);

            let trapElapsed = 0;
            let armed = false;
            let triggered = false;

            const trapTick = (t: { deltaTime: number }) => {
              const tdt = t.deltaTime / 60;
              trapElapsed += tdt;

              // Arm after delay
              if (!armed && trapElapsed >= TRAPPER_TRAP_ARM_DELAY) {
                armed = true;
                trap.clear();
                trap.circle(0, 0, TRAPPER_TRAP_RADIUS).fill({ color: 0xcc4400, alpha: 0.2 });
                trap.circle(0, 0, TRAPPER_TRAP_RADIUS).stroke({ color: 0xff4400, width: 2, alpha: 0.5 });
              }

              // Pulse when armed
              if (armed && !triggered) {
                trap.alpha = 0.6 + 0.2 * Math.sin(trapElapsed * 4);

                // Check player overlap
                const pq = world.with('player', 'position', 'health');
                if (pq.entities.length > 0) {
                  const pl = pq.entities[0];
                  const tdx = pl.position.x - trapX;
                  const tdy = pl.position.y - trapY;
                  if (tdx * tdx + tdy * tdy < TRAPPER_TRAP_RADIUS * TRAPPER_TRAP_RADIUS) {
                    triggered = true;
                    // Deal damage + slow
                    const dr = getDamageReduction(trapMonsterLvl);
                    const finalDmg = Math.max(1, Math.round(trapDmg * (1 - dr)));
                    pl.health.current -= finalDmg;
                    spawnDamageNumber(pl.position.x, pl.position.y - 10, finalDmg, 0xcc4400);
                    sfxPlayer.play('hit_physical');
                    applyStatus(pl, StatusType.Slow, { x: trapX, y: trapY });
                    if (pl.health.current <= 0) pl.health.current = 0;
                  }
                }
              }

              // Despawn on trigger or lifetime expiry
              if (triggered || trapElapsed >= TRAPPER_TRAP_LIFETIME) {
                game.app.ticker.remove(trapTick);
                // Decrement trap count on the trapper (if it still exists)
                if (enemy.trapperTrapCount !== undefined && enemy.trapperTrapCount > 0) {
                  enemy.trapperTrapCount--;
                }
                // Fade out visual
                const fadeStart = performance.now();
                const fadeTrap = () => {
                  const fe = performance.now() - fadeStart;
                  const ft = Math.min(fe / 200, 1);
                  trap.alpha = (1 - ft) * 0.6;
                  if (ft >= 1) {
                    trap.removeFromParent();
                    trap.destroy();
                  } else {
                    requestAnimationFrame(fadeTrap);
                  }
                };
                requestAnimationFrame(fadeTrap);
              }
            };
            game.app.ticker.add(trapTick);
          } else if (enemy.trapperPlaceTimer <= 0) {
            // At max traps, reset timer
            enemy.trapperPlaceTimer = TRAPPER_PLACE_INTERVAL;
          }
        }
        break;
      }

      // ── Linker: pair-bonded enemies with damage beam ──────────────────
      case 'linker': {
        const partner = enemy.linkedPartner as typeof enemy | undefined;
        const partnerAlive = partner && !partner.dead && partner.health && partner.health.current > 0;

        if (enemy.linkerEnraged || !partnerAlive) {
          // Enraged: partner is dead, chase at double speed
          if (!enemy.linkerEnraged) {
            enemy.linkerEnraged = true;
            enemy.speed = (enemy.baseSpeed ?? 70) * LINKER_ENRAGED_SPEED_MULT;
            // Clean up beam sprite
            if (enemy.linkerBeamSprite) {
              enemy.linkerBeamSprite.removeFromParent();
              enemy.linkerBeamSprite.destroy();
              enemy.linkerBeamSprite = undefined;
            }
          }
          const dir = getChaseDirection(
            enemy.position.x, enemy.position.y,
            player.position.x, player.position.y,
          );
          enemy.velocity.x = dir.x * enemy.speed;
          enemy.velocity.y = dir.y * enemy.speed;
        } else {
          // Paired: orbit player on opposite sides
          // Determine which side this linker is on using a consistent ordering
          const isFirst = (enemy as object) < (partner as object);
          const sideAngle = isFirst ? 0 : Math.PI;

          // Compute desired position: orbit at LINKER_ORBIT_RADIUS from player
          const angleToPlayer = Math.atan2(
            enemy.position.y - player.position.y,
            enemy.position.x - player.position.x,
          );
          // Slowly rotate around the player
          if (enemy.aiTimer !== undefined) {
            enemy.aiTimer += dt;
          }
          const orbitAngle = (enemy.aiTimer ?? 0) * 0.8 + sideAngle;
          const targetX = player.position.x + Math.cos(orbitAngle) * LINKER_ORBIT_RADIUS;
          const targetY = player.position.y + Math.sin(orbitAngle) * LINKER_ORBIT_RADIUS;

          const tdx = targetX - enemy.position.x;
          const tdy = targetY - enemy.position.y;
          const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
          if (tlen > 2) {
            enemy.velocity.x = (tdx / tlen) * enemy.speed;
            enemy.velocity.y = (tdy / tlen) * enemy.speed;
          } else {
            enemy.velocity.x = 0;
            enemy.velocity.y = 0;
          }

          // Draw beam between the pair and check for player intersection
          if (enemy.linkerBeamSprite && partner.position) {
            const beam = enemy.linkerBeamSprite as Graphics;
            beam.clear();

            // Draw pulsing electric line
            const pulseAlpha = 0.5 + 0.3 * Math.sin((enemy.aiTimer ?? 0) * 8);
            beam.moveTo(enemy.position.x, enemy.position.y)
              .lineTo(partner.position.x, partner.position.y)
              .stroke({ color: 0xffaa00, width: 3, alpha: pulseAlpha });

            // Check if player crosses the beam (point-to-line-segment distance)
            const ax = enemy.position.x, ay = enemy.position.y;
            const bx = partner.position.x, by = partner.position.y;
            const px = player.position.x, py = player.position.y;

            const abx = bx - ax, aby = by - ay;
            const apx = px - ax, apy = py - ay;
            const abLenSq = abx * abx + aby * aby;
            if (abLenSq > 0) {
              const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
              const closestX = ax + t * abx;
              const closestY = ay + t * aby;
              const distSq = (px - closestX) * (px - closestX) + (py - closestY) * (py - closestY);
              const BEAM_HIT_RADIUS = 12;

              if (distSq < BEAM_HIT_RADIUS * BEAM_HIT_RADIUS && player.health) {
                // Deal beam damage (per second, scaled by dt)
                const rawDmg = (enemy.damage ?? LINKER_BEAM_DAMAGE_PER_SEC) * dt;
                const dr = getDamageReduction(enemy.level ?? 1);
                const beamDmg = Math.max(1, Math.round(rawDmg * (1 - dr)));
                player.health.current -= beamDmg;
                if (beamDmg >= 2) {
                  spawnDamageNumber(player.position.x, player.position.y - 10, beamDmg, 0xffaa00);
                }
                // Apply Shock
                applyStatus(player, StatusType.Shock, { x: closestX, y: closestY });
                if (player.health.current <= 0) player.health.current = 0;
              }
            }
          }
        }
        break;
      }

      // ── Mimic: mirrors player movement inversely ──────────────────────
      case 'mimic': {
        // Initialize anchor and player tracking on first frame
        if (!enemy.mimicAnchor) {
          // Anchor is the midpoint between player and mimic at spawn
          enemy.mimicAnchor = {
            x: (enemy.position.x + player.position.x) / 2,
            y: (enemy.position.y + player.position.y) / 2,
          };
          enemy.mimicPlayerLast = { x: player.position.x, y: player.position.y };
        }

        // Calculate player delta since last frame
        const lastPx = enemy.mimicPlayerLast!.x;
        const lastPy = enemy.mimicPlayerLast!.y;
        const playerDx = player.position.x - lastPx;
        const playerDy = player.position.y - lastPy;

        // Mirror: move in opposite direction
        let newX = enemy.position.x - playerDx;
        let newY = enemy.position.y - playerDy;

        // Wall collision: slide along wall instead of going through
        if (game.tileMap) {
          const tile = game.tileMap.worldToTile(newX, newY);
          if (game.tileMap.blocksMovement(tile.x, tile.y)) {
            // Try horizontal only
            const tileH = game.tileMap.worldToTile(newX, enemy.position.y);
            if (!game.tileMap.blocksMovement(tileH.x, tileH.y)) {
              newY = enemy.position.y; // slide horizontal
            } else {
              // Try vertical only
              const tileV = game.tileMap.worldToTile(enemy.position.x, newY);
              if (!game.tileMap.blocksMovement(tileV.x, tileV.y)) {
                newX = enemy.position.x; // slide vertical
              } else {
                newX = enemy.position.x;
                newY = enemy.position.y; // stuck
              }
            }
          }
        }

        // Set velocity based on computed movement
        enemy.velocity.x = (newX - enemy.position.x) / Math.max(dt, 1 / 60);
        enemy.velocity.y = (newY - enemy.position.y) / Math.max(dt, 1 / 60);

        // Update player tracking
        enemy.mimicPlayerLast = { x: player.position.x, y: player.position.y };

        // Fire projectile at player every 2 seconds
        if (enemy.mimicFireTimer !== undefined) {
          enemy.mimicFireTimer -= dt;
          if (enemy.mimicFireTimer <= 0) {
            enemy.mimicFireTimer = MIMIC_FIRE_INTERVAL;
            const proj = fireEnemyProjectile(
              enemy.position.x, enemy.position.y,
              player.position.x, player.position.y,
            );
            proj.damage = enemy.damage ?? 10;
            proj.level = enemy.level;
          }
        }
        break;
      }

      // ── Necromancer: flee and revive dead enemies ─────────────────────
      case 'necromancer': {
        // Count active raised children
        const raisedQuery = world.with('enemy', 'raisedByNecromancer');
        let raisedCount = 0;
        for (const child of raisedQuery) {
          if (child.raisedByNecromancer === enemy && !child.dead) {
            raisedCount++;
          }
        }
        enemy.necromancerChildCount = raisedCount;

        // Flee from player
        const necFleeDir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        if (len < NECROMANCER_FLEE_DIST) {
          enemy.velocity.x = -necFleeDir.x * enemy.speed;
          enemy.velocity.y = -necFleeDir.y * enemy.speed;
        } else {
          // Far enough - strafe slowly
          enemy.velocity.x = -ny * enemy.speed * 0.3;
          enemy.velocity.y = nx * enemy.speed * 0.3;
        }

        // Channeling a raise
        if (enemy.necromancerChanneling) {
          // Slow down while channeling
          enemy.velocity.x *= 0.2;
          enemy.velocity.y *= 0.2;

          if (enemy.necromancerChannelTimer !== undefined) {
            enemy.necromancerChannelTimer -= dt;
            // Visual: pulsing scale during channel
            if (enemy.sprite) {
              const pulse = 1 + 0.1 * Math.sin((enemy.necromancerChannelTimer ?? 0) * 10);
              enemy.sprite.scale.set(pulse, pulse);
            }

            if (enemy.necromancerChannelTimer <= 0) {
              // Channel complete - raise a Rusher at the nearest corpse
              const corpses = getCorpsePositions();
              let nearest: typeof corpses[0] | null = null;
              let nearestDistSq = Infinity;
              for (const c of corpses) {
                const cdx = c.x - enemy.position.x;
                const cdy = c.y - enemy.position.y;
                const cdSq = cdx * cdx + cdy * cdy;
                if (cdSq < nearestDistSq && cdSq < NECROMANCER_RAISE_RANGE * NECROMANCER_RAISE_RANGE) {
                  nearestDistSq = cdSq;
                  nearest = c;
                }
              }

              if (nearest && raisedCount < NECROMANCER_MAX_RAISED) {
                // Spawn a raised Rusher at the corpse position with 50% HP and purple tint
                const raised = spawnRusher(nearest.x, nearest.y, enemy.level ?? 1);
                raised.raisedByNecromancer = enemy;
                if (raised.health) {
                  raised.health.max = Math.round(raised.health.max * 0.5);
                  raised.health.current = raised.health.max;
                }
                // Purple tint to distinguish from normal
                if (raised.sprite) {
                  raised.sprite.tint = 0xaa66ff;
                }
                consumeCorpse(nearest);

                // Visual: dark purple beam from necromancer to corpse position
                const beamLine = new Graphics();
                beamLine.moveTo(enemy.position.x, enemy.position.y)
                  .lineTo(nearest.x, nearest.y)
                  .stroke({ color: 0x8844aa, width: 3, alpha: 0.8 });
                game.effectLayer.addChild(beamLine);
                const beamStart = performance.now();
                const fadeBeam = () => {
                  const elapsed = performance.now() - beamStart;
                  const t = Math.min(elapsed / 500, 1);
                  beamLine.alpha = 1 - t;
                  if (t >= 1) {
                    beamLine.removeFromParent();
                    beamLine.destroy();
                  } else {
                    requestAnimationFrame(fadeBeam);
                  }
                };
                requestAnimationFrame(fadeBeam);

                sfxPlayer.play('hit_magic');
              }

              enemy.necromancerChanneling = false;
              if (enemy.sprite) enemy.sprite.scale.set(1, 1);
            }
          }
        } else {
          // Raise timer
          if (enemy.necromancerRaiseTimer !== undefined) {
            enemy.necromancerRaiseTimer -= dt;
            if (enemy.necromancerRaiseTimer <= 0 && raisedCount < NECROMANCER_MAX_RAISED) {
              // Check if any corpses are in range
              const corpses = getCorpsePositions();
              let hasCorpse = false;
              for (const c of corpses) {
                const cdx = c.x - enemy.position.x;
                const cdy = c.y - enemy.position.y;
                if (cdx * cdx + cdy * cdy < NECROMANCER_RAISE_RANGE * NECROMANCER_RAISE_RANGE) {
                  hasCorpse = true;
                  break;
                }
              }

              if (hasCorpse) {
                // Start channeling
                enemy.necromancerChanneling = true;
                enemy.necromancerChannelTimer = NECROMANCER_CHANNEL_TIME;
              }
              enemy.necromancerRaiseTimer = NECROMANCER_RAISE_INTERVAL;
            }
          }
        }
        break;
      }

      // ── Overcharger: slow chase, death buff handled in CollisionSystem ─
      case 'overcharger': {
        // Slow chase via flow field
        const ocDir = getChaseDirection(
          enemy.position.x, enemy.position.y,
          player.position.x, player.position.y,
        );
        enemy.velocity.x = ocDir.x * enemy.speed;
        enemy.velocity.y = ocDir.y * enemy.speed;

        // Tick down overcharger buff timer on all enemies that have it
        // (This is done once per frame via the overcharger case to avoid a separate loop,
        //  but only the first overcharger processes it per frame)
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

  // ── Tick overcharger buff timers on all buffed enemies ───────────────
  for (const enemy of enemies) {
    if (enemy.overchargerDeathBuff && enemy.overchargerBuffTimer !== undefined) {
      enemy.overchargerBuffTimer -= dt;
      if (enemy.overchargerBuffTimer <= 0) {
        // Remove buff: restore original stats
        enemy.overchargerDeathBuff = false;
        if (enemy.overchargerOrigSpeed !== undefined) {
          enemy.speed = enemy.overchargerOrigSpeed;
          enemy.overchargerOrigSpeed = undefined;
        }
        if (enemy.overchargerOrigDamage !== undefined) {
          enemy.damage = enemy.overchargerOrigDamage;
          enemy.overchargerOrigDamage = undefined;
        }
        // Remove blue aura tint
        if (enemy.sprite) {
          enemy.sprite.tint = 0xffffff;
        }
        enemy.overchargerBuffTimer = undefined;
      }
    }
  }
}
