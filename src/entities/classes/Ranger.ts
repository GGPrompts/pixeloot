import { Graphics } from 'pixi.js';
import type { SkillDef } from '../../core/SkillSystem';
import { fireProjectile } from '../Projectile';
import { world } from '../../ecs/world';
import { game } from '../../Game';
import { spawnDamageNumber } from '../../ui/DamageNumbers';
import { spawnDeathParticles } from '../DeathParticles';
import { applyStatus, hasStatus, StatusType } from '../../core/StatusEffects';
import {
  hasEffect,
  consumeSteadyAim,
  activateFlickerstep,
  activatePhasewalkInvisibility,
} from '../../core/UniqueEffects';
import { hasExtraProjectileConditional } from '../../core/ConditionalAffixSystem';

const players = world.with('position', 'velocity', 'speed', 'player');
const enemies = world.with('enemy', 'position', 'health');

/** Fire a Ranger projectile tagged for Ember Quiver + Steady Aim wall-pierce. */
function fireRangerProjectile(
  fromX: number, fromY: number, targetX: number, targetY: number,
  options?: Parameters<typeof fireProjectile>[4],
  wallPierce = false,
): ReturnType<typeof fireProjectile> {
  const proj = fireProjectile(fromX, fromY, targetX, targetY, options);
  (proj as import('../../ecs/world').Entity).isRangerProjectile = true;
  if (wallPierce) {
    (proj as import('../../ecs/world').Entity).wallPiercing = true;
  }
  return proj;
}

// ---------------------------------------------------------------------------
// Skill 1 - Power Shot (cooldown 3s)
// Large, fast, piercing projectile
// ---------------------------------------------------------------------------
const powerShot: SkillDef = {
  name: 'Power Shot',
  key: '1',
  cooldown: 0.4,
  slotType: 'primary',
  targetType: 'projectile',
  execute(playerPos, mousePos) {
    // Whisperstring Steady Aim: +40% damage + wall-piercing on next shot
    const steadyAim = consumeSteadyAim();
    const baseDmg = steadyAim ? Math.round(40 * 1.4) : 40;

    const opts = {
      speed: 800,
      damage: baseDmg,
      radius: 8,
      color: steadyAim ? 0xffffff : 0xffff00,
      piercing: true as const,
      lifetime: 3,
    };

    // Splinterbow: fire 3 arrows in a narrow spread instead of 1
    if (hasEffect('splinterbow_spread')) {
      const dx = mousePos.x - playerPos.x;
      const dy = mousePos.y - playerPos.y;
      const baseAngle = Math.atan2(dy, dx);
      const spreadAngle = (15 * Math.PI) / 180; // 15 degrees total
      const count = 3 + (hasEffect('grid_extra_projectile') ? 1 : 0) + (hasExtraProjectileConditional() ? 1 : 0);
      const step = count > 1 ? spreadAngle / (count - 1) : 0;
      const halfSpread = spreadAngle / 2;

      for (let i = 0; i < count; i++) {
        const angle = baseAngle - halfSpread + step * i;
        const tx = playerPos.x + Math.cos(angle) * 500;
        const ty = playerPos.y + Math.sin(angle) * 500;
        fireRangerProjectile(playerPos.x, playerPos.y, tx, ty, opts, steadyAim);
      }
    } else {
      fireRangerProjectile(playerPos.x, playerPos.y, mousePos.x, mousePos.y, opts, steadyAim);
      // Heart of the Grid or 25+ Dex conditional: +1 projectile (slight offset)
      if (hasEffect('grid_extra_projectile') || hasExtraProjectileConditional()) {
        const dx = mousePos.x - playerPos.x;
        const dy = mousePos.y - playerPos.y;
        const baseAngle = Math.atan2(dy, dx);
        const offsetAngle = baseAngle + (8 * Math.PI) / 180;
        const tx = playerPos.x + Math.cos(offsetAngle) * 500;
        const ty = playerPos.y + Math.sin(offsetAngle) * 500;
        fireRangerProjectile(playerPos.x, playerPos.y, tx, ty, opts, steadyAim);
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Skill 2 - Multi Shot (cooldown 5s)
// Fan of 5 arrows in a ~30-degree spread
// ---------------------------------------------------------------------------
const MULTI_SHOT_COUNT = 5;
const MULTI_SHOT_SPREAD = (30 * Math.PI) / 180; // 30 degrees total spread

const multiShot: SkillDef = {
  name: 'Multi Shot',
  key: '2',
  cooldown: 5,
  slotType: 'assignable',
  targetType: 'projectile',
  execute(playerPos, mousePos) {
    const dx = mousePos.x - playerPos.x;
    const dy = mousePos.y - playerPos.y;
    const baseAngle = Math.atan2(dy, dx);
    // Heart of the Grid: +1 projectile
    const count = MULTI_SHOT_COUNT + (hasEffect('grid_extra_projectile') ? 1 : 0) + (hasExtraProjectileConditional() ? 1 : 0);
    // Threadcutter: fire in full 360-degree ring instead of forward arc
    const spread = hasEffect('threadcutter_ring') ? Math.PI * 2 : MULTI_SHOT_SPREAD;
    const halfSpread = spread / 2;
    const step = count > 1 ? spread / (hasEffect('threadcutter_ring') ? count : count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle - halfSpread + step * i;
      // Target far away along that angle
      const targetX = playerPos.x + Math.cos(angle) * 500;
      const targetY = playerPos.y + Math.sin(angle) * 500;
      fireRangerProjectile(playerPos.x, playerPos.y, targetX, targetY);
    }
  },
};

// ---------------------------------------------------------------------------
// Skill 3 - Rain of Arrows (cooldown 8s)
// AoE at mouse position after 0.5s delay, 96px radius, 25 damage
// ---------------------------------------------------------------------------
const RAIN_RADIUS = 96;
const RAIN_DELAY = 0.5;
const RAIN_DAMAGE = 25;

const rainOfArrows: SkillDef = {
  name: 'Rain of Arrows',
  key: '3',
  cooldown: 8,
  slotType: 'assignable',
  targetType: 'cursor_aoe',
  radius: 96,
  execute(_playerPos, mousePos) {
    const tx = mousePos.x;
    const ty = mousePos.y;

    // Draw targeting circle on effect layer
    const circle = new Graphics();
    circle.circle(0, 0, RAIN_RADIUS).stroke({ width: 2, color: 0xff8800, alpha: 0.6 });
    circle.circle(0, 0, RAIN_RADIUS).fill({ color: 0xff8800, alpha: 0.15 });
    circle.position.set(tx, ty);
    game.effectLayer.addChild(circle);

    // Animate the circle pulsing until detonation
    let elapsed = 0;
    const onTick = (t: { deltaTime: number }) => {
      elapsed += t.deltaTime / 60;
      circle.alpha = 0.5 + 0.5 * Math.sin(elapsed * 12);

      if (elapsed >= RAIN_DELAY) {
        game.app.ticker.remove(onTick);

        // Deal damage to all enemies in radius
        for (const enemy of enemies) {
          const edx = enemy.position.x - tx;
          const edy = enemy.position.y - ty;
          const distSq = edx * edx + edy * edy;

          if (distSq < RAIN_RADIUS * RAIN_RADIUS) {
            enemy.health.current -= RAIN_DAMAGE;
            spawnDamageNumber(enemy.position.x, enemy.position.y - 10, RAIN_DAMAGE, 0xff8800);

            // Flash effect
            if (enemy.sprite) {
              enemy.sprite.alpha = 0.3;
              setTimeout(() => {
                if (enemy.sprite) enemy.sprite.alpha = 1;
              }, 100);
            }

            if (enemy.health.current <= 0) {
              spawnDeathParticles(enemy.position.x, enemy.position.y);
              if (enemy.sprite) enemy.sprite.removeFromParent();
              world.remove(enemy);
            }
          }
        }

        // Impact flash
        const impact = new Graphics();
        impact.circle(0, 0, RAIN_RADIUS).fill({ color: 0xff8800, alpha: 0.4 });
        impact.position.set(tx, ty);
        game.effectLayer.addChild(impact);

        // Fade and remove both
        let fadeTime = 0;
        const onFade = (ft: { deltaTime: number }) => {
          fadeTime += ft.deltaTime / 60;
          impact.alpha = Math.max(0, 0.4 - fadeTime * 2);
          circle.alpha = Math.max(0, 1 - fadeTime * 4);
          if (fadeTime >= 0.3) {
            game.app.ticker.remove(onFade);
            impact.removeFromParent();
            impact.destroy();
            circle.removeFromParent();
            circle.destroy();
          }
        };
        game.app.ticker.add(onFade);
      }
    };
    game.app.ticker.add(onTick);
  },
};

// ---------------------------------------------------------------------------
// Skill 4 - Evasive Roll (cooldown 4s)
// Dash ~200px in movement direction (or toward mouse), brief invulnerability
// ---------------------------------------------------------------------------
const ROLL_DISTANCE = 200;
const ROLL_INVULN = 0.3;

const evasiveRoll: SkillDef = {
  name: 'Evasive Roll',
  key: '4',
  cooldown: 4,
  slotType: 'movement',
  targetType: 'movement',
  execute(playerPos, mousePos) {
    if (players.entities.length === 0) return;
    const player = players.entities[0];

    // Direction: use movement velocity if moving, otherwise toward mouse
    let dirX: number;
    let dirY: number;

    if (
      player.velocity.x !== 0 ||
      player.velocity.y !== 0
    ) {
      dirX = player.velocity.x;
      dirY = player.velocity.y;
    } else {
      dirX = mousePos.x - playerPos.x;
      dirY = mousePos.y - playerPos.y;
    }

    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len === 0) return;

    const nx = dirX / len;
    const ny = dirY / len;

    // Phasewalk Boots: +50% roll distance
    const rollDist = hasEffect('phasewalk_enhanced_mobility') ? ROLL_DISTANCE * 1.5 : ROLL_DISTANCE;

    // Clamp to non-solid tile (step along the direction and find last valid position)
    const steps = 10;
    let finalX = playerPos.x;
    let finalY = playerPos.y;
    for (let i = 1; i <= steps; i++) {
      const testX = playerPos.x + (nx * rollDist * i) / steps;
      const testY = playerPos.y + (ny * rollDist * i) / steps;
      const tile = game.tileMap.worldToTile(testX, testY);
      if (game.tileMap.isSolid(tile.x, tile.y)) break;
      finalX = testX;
      finalY = testY;
    }

    // Phasewalker Cloak: drop a trap at the starting position
    if (hasEffect('phasewalker_trap')) {
      trap.execute(playerPos, playerPos);
    }

    player.position.x = finalX;
    player.position.y = finalY;

    // Grant invulnerability
    world.addComponent(player, 'invulnTimer', ROLL_INVULN);

    // Flickerstep Shroud: +30% attack speed for 2s after movement skill
    activateFlickerstep();

    // Phasewalk Boots: grant 1s invisibility after movement skill
    activatePhasewalkInvisibility();
  },
};

// ---------------------------------------------------------------------------
// Skill 5 - Trap (cooldown 10s)
// Place an invisible trap at player position; arms after 0.5s.
// When an enemy enters 48px radius, explodes for 80 damage in 64px AoE.
// Persists 15s if not triggered. Max 3 active traps.
// ---------------------------------------------------------------------------
const TRAP_ARM_DELAY = 0.5;
const TRAP_TRIGGER_RADIUS = 48;
const TRAP_EXPLOSION_RADIUS = 64;
const TRAP_DAMAGE = 80;
const TRAP_LIFETIME = 15;
const TRAP_MAX_ACTIVE = 3;

interface ActiveTrap {
  x: number;
  y: number;
  armed: boolean;
  elapsed: number;
  graphic: Graphics;
  destroyed: boolean;
}

const activeTraps: ActiveTrap[] = [];

function cleanupTrap(trap: ActiveTrap): void {
  trap.destroyed = true;
  trap.graphic.removeFromParent();
  trap.graphic.destroy();
  const idx = activeTraps.indexOf(trap);
  if (idx >= 0) activeTraps.splice(idx, 1);
}

function detonateTrap(trap: ActiveTrap): void {
  // Deal AoE damage to all enemies in explosion radius
  for (const enemy of enemies) {
    const dx = enemy.position.x - trap.x;
    const dy = enemy.position.y - trap.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < TRAP_EXPLOSION_RADIUS * TRAP_EXPLOSION_RADIUS) {
      let dmg = TRAP_DAMAGE;

      // Mark: +15% damage taken
      if (hasStatus(enemy, StatusType.Mark)) {
        dmg = Math.round(dmg * 1.15);
      }

      enemy.health.current -= dmg;
      spawnDamageNumber(enemy.position.x, enemy.position.y - 10, dmg, 0x44ff44);

      if (enemy.sprite) {
        enemy.sprite.alpha = 0.3;
        setTimeout(() => {
          if (enemy.sprite) enemy.sprite.alpha = 1;
        }, 100);
      }

      if (enemy.health.current <= 0) {
        spawnDeathParticles(enemy.position.x, enemy.position.y);
        if (enemy.sprite) enemy.sprite.removeFromParent();
        world.remove(enemy);
      }
    }
  }

  // Bright flash on detonation
  const flash = new Graphics();
  flash.circle(0, 0, TRAP_EXPLOSION_RADIUS).fill({ color: 0x44ff44, alpha: 0.5 });
  flash.position.set(trap.x, trap.y);
  game.effectLayer.addChild(flash);

  let fadeTime = 0;
  const onFade = (ft: { deltaTime: number }) => {
    fadeTime += ft.deltaTime / 60;
    flash.alpha = Math.max(0, 0.5 - fadeTime * 2.5);
    if (fadeTime >= 0.3) {
      game.app.ticker.remove(onFade);
      flash.removeFromParent();
      flash.destroy();
    }
  };
  game.app.ticker.add(onFade);

  cleanupTrap(trap);
}

const trap: SkillDef = {
  name: 'Trap',
  key: '5',
  cooldown: 10,
  slotType: 'assignable',
  targetType: 'self_place',
  execute(playerPos, _mousePos) {
    // Warden's Sigil: increase trap max from 3 to 6
    const maxTraps = hasEffect('warden_enhanced_traps') ? 6 : TRAP_MAX_ACTIVE;

    // Enforce max active traps - remove oldest if at limit
    while (activeTraps.length >= maxTraps) {
      cleanupTrap(activeTraps[0]);
    }

    const tx = playerPos.x;
    const ty = playerPos.y;

    // Create trap visual on world layer (dim green pulsing circle)
    const trapGraphic = new Graphics();
    trapGraphic.circle(0, 0, TRAP_TRIGGER_RADIUS * 0.4).fill({ color: 0x00ff44, alpha: 0.15 });
    trapGraphic.circle(0, 0, TRAP_TRIGGER_RADIUS * 0.4).stroke({ width: 1, color: 0x00ff44, alpha: 0.25 });
    trapGraphic.position.set(tx, ty);
    trapGraphic.alpha = 0.4;
    game.worldLayer.addChild(trapGraphic);

    // Warden's Sigil: traps arm instantly instead of after 0.5s delay
    const armDelay = hasEffect('warden_enhanced_traps') ? 0 : TRAP_ARM_DELAY;

    const activeTrap: ActiveTrap = {
      x: tx,
      y: ty,
      armed: armDelay === 0,
      elapsed: 0,
      graphic: trapGraphic,
      destroyed: false,
    };
    activeTraps.push(activeTrap);

    // Tick: arm after delay, check for enemy proximity, expire after lifetime
    const onTick = (t: { deltaTime: number }) => {
      if (activeTrap.destroyed) {
        game.app.ticker.remove(onTick);
        return;
      }

      activeTrap.elapsed += t.deltaTime / 60;

      // Arm after delay
      if (!activeTrap.armed && activeTrap.elapsed >= armDelay) {
        activeTrap.armed = true;
      }

      // Pulsing glow effect
      const pulse = 0.25 + 0.15 * Math.sin(activeTrap.elapsed * 4);
      trapGraphic.alpha = activeTrap.armed ? pulse : 0.15;

      // Check for enemy trigger if armed
      if (activeTrap.armed) {
        for (const enemy of enemies) {
          const dx = enemy.position.x - activeTrap.x;
          const dy = enemy.position.y - activeTrap.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < TRAP_TRIGGER_RADIUS * TRAP_TRIGGER_RADIUS) {
            game.app.ticker.remove(onTick);
            detonateTrap(activeTrap);
            return;
          }
        }
      }

      // Expire after lifetime
      if (activeTrap.elapsed >= TRAP_LIFETIME) {
        game.app.ticker.remove(onTick);
        cleanupTrap(activeTrap);
      }
    };
    game.app.ticker.add(onTick);
  },
};

// ---------------------------------------------------------------------------
// Skill 6 - Mark Target (cooldown 12s)
// Mark nearest enemy within 200px of cursor. Marked enemy takes +15% damage
// from all sources for 5s. Only one mark active at a time.
// Visual: spinning diamond marker above enemy head.
// ---------------------------------------------------------------------------
const MARK_RANGE = 200;

let activeMarkGraphic: Graphics | null = null;
let activeMarkTickRemover: (() => void) | null = null;

const markTarget: SkillDef = {
  name: 'Mark Target',
  key: '6',
  cooldown: 12,
  slotType: 'assignable',
  targetType: 'cursor_target',
  range: 200,
  execute(_playerPos, mousePos) {
    // Find nearest enemy within range of cursor
    let nearest: (typeof enemies.entities)[number] | null = null;
    let nearestDistSq = MARK_RANGE * MARK_RANGE;

    for (const enemy of enemies) {
      const dx = enemy.position.x - mousePos.x;
      const dy = enemy.position.y - mousePos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = enemy;
      }
    }

    if (!nearest) return;

    // Remove previous mark visual if any
    if (activeMarkGraphic) {
      activeMarkGraphic.removeFromParent();
      activeMarkGraphic.destroy();
      activeMarkGraphic = null;
    }
    if (activeMarkTickRemover) {
      activeMarkTickRemover();
      activeMarkTickRemover = null;
    }

    // Apply Mark status effect to the enemy
    applyStatus(nearest, StatusType.Mark);

    // Tracker's Hood: also mark all enemies within 64px of the primary target
    if (hasEffect('tracker_aoe_mark')) {
      for (const other of enemies) {
        if (other === nearest) continue;
        const mdx = other.position.x - nearest.position.x;
        const mdy = other.position.y - nearest.position.y;
        if (mdx * mdx + mdy * mdy < 64 * 64) {
          applyStatus(other, StatusType.Mark);
        }
      }
    }

    // Create spinning diamond marker above enemy
    const marker = new Graphics();
    const markerSize = 8;
    // Draw diamond shape
    marker.moveTo(0, -markerSize);
    marker.lineTo(markerSize, 0);
    marker.lineTo(0, markerSize);
    marker.lineTo(-markerSize, 0);
    marker.closePath();
    marker.stroke({ width: 2, color: 0xff00ff, alpha: 0.9 });
    marker.fill({ color: 0xff00ff, alpha: 0.25 });
    game.effectLayer.addChild(marker);
    activeMarkGraphic = marker;

    const markedEnemy = nearest;
    let markElapsed = 0;
    const MARK_DURATION = 5;

    const onTick = (t: { deltaTime: number }) => {
      markElapsed += t.deltaTime / 60;

      // If enemy is dead or mark expired, clean up
      if (markElapsed >= MARK_DURATION || !markedEnemy.position || markedEnemy.health.current <= 0) {
        game.app.ticker.remove(onTick);
        marker.removeFromParent();
        marker.destroy();
        if (activeMarkGraphic === marker) activeMarkGraphic = null;
        activeMarkTickRemover = null;
        return;
      }

      // Follow enemy position, hover above head
      marker.position.set(markedEnemy.position.x, markedEnemy.position.y - 28);

      // Spinning rotation
      marker.rotation = markElapsed * 3;

      // Subtle pulse
      marker.alpha = 0.6 + 0.4 * Math.sin(markElapsed * 6);
    };

    game.app.ticker.add(onTick);
    activeMarkTickRemover = () => game.app.ticker.remove(onTick);
  },
};

// ---------------------------------------------------------------------------
// Export all Ranger skills
// ---------------------------------------------------------------------------
export const rangerSkills: SkillDef[] = [powerShot, multiShot, rainOfArrows, evasiveRoll, trap, markTarget];
