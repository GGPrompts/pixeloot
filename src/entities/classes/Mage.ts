import { Graphics } from 'pixi.js';
import type { SkillDef } from '../../core/SkillSystem';
import { fireProjectile } from '../Projectile';
import { world } from '../../ecs/world';
import { game } from '../../Game';
import { spawnDamageNumber } from '../../ui/DamageNumbers';
import { spawnDeathParticles } from '../DeathParticles';
import { applyStatus, StatusType } from '../../core/StatusEffects';
import { shake } from '../../ecs/systems/CameraSystem';
import { spawnHitSparks } from '../HitSparks';
import { hasEffect } from '../../core/UniqueEffects';
import { hasExtraProjectileConditional } from '../../core/ConditionalAffixSystem';

const players = world.with('position', 'velocity', 'speed', 'player');
const enemies = world.with('enemy', 'position', 'health');

// ---------------------------------------------------------------------------
// Skill 1 - Fireball (cooldown 4s)
// Large orange/red projectile that explodes on impact with AoE splash
// ---------------------------------------------------------------------------
const fireball: SkillDef = {
  name: 'Fireball',
  key: '1',
  cooldown: 0.5,
  slotType: 'primary',
  targetType: 'projectile',
  execute(playerPos, mousePos) {
    const proj = fireProjectile(playerPos.x, playerPos.y, mousePos.x, mousePos.y, {
      speed: 400,
      damage: 30,
      radius: 8,
      color: 0xff4400,
      lifetime: 3,
    });
    // Inferno Staff: mark projectile to spawn burning ground on impact
    if (hasEffect('inferno_burning_ground')) {
      (proj as import('../../ecs/world').Entity).burningGround = true;
    }
    // Heart of the Grid or 25+ Dex conditional: +1 projectile
    if (hasEffect('grid_extra_projectile') || hasExtraProjectileConditional()) {
      const dx = mousePos.x - playerPos.x;
      const dy = mousePos.y - playerPos.y;
      const baseAngle = Math.atan2(dy, dx);
      const offsetAngle = baseAngle + (8 * Math.PI) / 180;
      const tx = playerPos.x + Math.cos(offsetAngle) * 500;
      const ty = playerPos.y + Math.sin(offsetAngle) * 500;
      const proj2 = fireProjectile(playerPos.x, playerPos.y, tx, ty, {
        speed: 400,
        damage: 30,
        radius: 8,
        color: 0xff4400,
        lifetime: 3,
      });
      if (hasEffect('inferno_burning_ground')) {
        (proj2 as import('../../ecs/world').Entity).burningGround = true;
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Skill 2 - Frost Nova (cooldown 6s)
// AoE ring expanding from player, applies Slow to nearby enemies
// ---------------------------------------------------------------------------
const FROST_NOVA_RADIUS = 128;
const FROST_NOVA_DAMAGE = 15;

const frostNova: SkillDef = {
  name: 'Frost Nova',
  key: '2',
  cooldown: 6,
  slotType: 'assignable',
  targetType: 'self_aoe',
  radius: 128,
  execute(playerPos) {
    const px = playerPos.x;
    const py = playerPos.y;

    // Deal damage and apply Slow to all enemies in radius
    for (const enemy of enemies) {
      const dx = enemy.position.x - px;
      const dy = enemy.position.y - py;
      if (dx * dx + dy * dy < FROST_NOVA_RADIUS * FROST_NOVA_RADIUS) {
        enemy.health.current -= FROST_NOVA_DAMAGE;
        spawnDamageNumber(enemy.position.x, enemy.position.y - 10, FROST_NOVA_DAMAGE, 0x66ccff);
        applyStatus(enemy, StatusType.Slow, playerPos);

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

    // Visual: expanding cyan/white ring
    const ring = new Graphics();
    ring.position.set(px, py);
    game.effectLayer.addChild(ring);

    let elapsed = 0;
    const onTick = (t: { deltaTime: number }) => {
      elapsed += t.deltaTime / 60;
      const progress = Math.min(elapsed / 0.3, 1);
      const currentRadius = FROST_NOVA_RADIUS * progress;

      ring.clear();
      ring.circle(0, 0, currentRadius).stroke({ width: 3, color: 0x88eeff, alpha: 0.8 * (1 - progress) });
      ring.circle(0, 0, currentRadius).fill({ color: 0x66ccff, alpha: 0.15 * (1 - progress) });

      if (progress >= 1) {
        game.app.ticker.remove(onTick);
        ring.removeFromParent();
        ring.destroy();
      }
    };
    game.app.ticker.add(onTick);
  },
};

// ---------------------------------------------------------------------------
// Skill 3 - Lightning Chain (cooldown 7s)
// Bounces between up to 4 enemies, dealing decreasing damage + Shock
// ---------------------------------------------------------------------------
const CHAIN_BASE_DAMAGE = 35;
const CHAIN_DECAY = 0.8; // 20% reduction per bounce
const CHAIN_MAX_BOUNCES = 4; // total targets (initial + 3 bounces)
const CHAIN_INITIAL_RANGE = 200;
const CHAIN_BOUNCE_RANGE = 150;

const lightningChain: SkillDef = {
  name: 'Lightning Chain',
  key: '3',
  cooldown: 7,
  slotType: 'assignable',
  targetType: 'cursor_target',
  range: 200,
  execute(_playerPos, mousePos) {
    const hitTargets: { x: number; y: number }[] = [];
    const hitSet = new Set<object>();
    // Stormcaller Wand: track hit counts per enemy to allow up to 2 hits each
    const allowDoubleBounce = hasEffect('stormcaller_double_bounce');
    const hitCountMap = new Map<object, number>();

    // Cascade Orb: +3 max bounces but steeper decay (0.7 instead of 0.8)
    const maxBounces = hasEffect('cascade_extra_bounces') ? CHAIN_MAX_BOUNCES + 3 : CHAIN_MAX_BOUNCES;
    const decay = hasEffect('cascade_extra_bounces') ? 0.7 : CHAIN_DECAY;

    // Find the nearest enemy to cursor within range, then bounce
    let currentX = mousePos.x;
    let currentY = mousePos.y;
    let range = CHAIN_INITIAL_RANGE;

    for (let bounce = 0; bounce < maxBounces; bounce++) {
      let bestEnemy: (typeof enemies.entities)[number] | null = null;
      let bestDistSq = range * range;

      for (const enemy of enemies) {
        const count = hitCountMap.get(enemy) ?? 0;
        if (allowDoubleBounce) {
          if (count >= 2) continue;
        } else {
          if (hitSet.has(enemy)) continue;
        }
        const dx = enemy.position.x - currentX;
        const dy = enemy.position.y - currentY;
        const distSq = dx * dx + dy * dy;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestEnemy = enemy;
        }
      }

      if (!bestEnemy) break;

      hitSet.add(bestEnemy);
      hitCountMap.set(bestEnemy, (hitCountMap.get(bestEnemy) ?? 0) + 1);
      hitTargets.push({ x: bestEnemy.position.x, y: bestEnemy.position.y });

      // Calculate damage with decay (Cascade Orb uses steeper 0.7 decay)
      const dmg = Math.round(CHAIN_BASE_DAMAGE * Math.pow(decay, bounce));
      bestEnemy.health.current -= dmg;
      spawnDamageNumber(bestEnemy.position.x, bestEnemy.position.y - 10, dmg, 0xffff00);
      applyStatus(bestEnemy, StatusType.Shock);

      if (bestEnemy.sprite) {
        bestEnemy.sprite.alpha = 0.3;
        setTimeout(() => {
          if (bestEnemy.sprite) bestEnemy.sprite.alpha = 1;
        }, 100);
      }

      if (bestEnemy.health.current <= 0) {
        spawnDeathParticles(bestEnemy.position.x, bestEnemy.position.y);
        if (bestEnemy.sprite) bestEnemy.sprite.removeFromParent();
        world.remove(bestEnemy);
      }

      currentX = bestEnemy.position.x;
      currentY = bestEnemy.position.y;
      range = CHAIN_BOUNCE_RANGE;
    }

    // Visual: draw lightning lines between targets
    if (hitTargets.length > 0) {
      const lightning = new Graphics();
      game.effectLayer.addChild(lightning);

      // Draw line from cursor to first target, then between targets
      const points = [{ x: mousePos.x, y: mousePos.y }, ...hitTargets];
      for (let i = 0; i < points.length - 1; i++) {
        drawLightningSegment(lightning, points[i], points[i + 1]);
      }

      // Flash and fade
      let elapsed = 0;
      const onTick = (t: { deltaTime: number }) => {
        elapsed += t.deltaTime / 60;
        lightning.alpha = Math.max(0, 1 - elapsed * 5);
        if (elapsed >= 0.3) {
          game.app.ticker.remove(onTick);
          lightning.removeFromParent();
          lightning.destroy();
        }
      };
      game.app.ticker.add(onTick);
    }
  },
};

/** Draws a jagged lightning line between two points. */
function drawLightningSegment(
  g: Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  const segments = 6;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const perpX = -dy;
  const perpY = dx;
  const len = Math.sqrt(perpX * perpX + perpY * perpY);
  const npx = len > 0 ? perpX / len : 0;
  const npy = len > 0 ? perpY / len : 0;

  // Outer glow
  g.moveTo(from.x, from.y);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const midX = from.x + dx * t + npx * (Math.random() - 0.5) * 16;
    const midY = from.y + dy * t + npy * (Math.random() - 0.5) * 16;
    g.lineTo(midX, midY);
  }
  g.lineTo(to.x, to.y);
  g.stroke({ width: 3, color: 0xffff88, alpha: 0.9 });

  // Thinner bright core
  g.moveTo(from.x, from.y);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const midX = from.x + dx * t + npx * (Math.random() - 0.5) * 8;
    const midY = from.y + dy * t + npy * (Math.random() - 0.5) * 8;
    g.lineTo(midX, midY);
  }
  g.lineTo(to.x, to.y);
  g.stroke({ width: 1, color: 0xffffff, alpha: 1 });
}

// ---------------------------------------------------------------------------
// Skill 4 - Teleport (cooldown 5s)
// Blink to mouse position with invulnerability and particle effects
// ---------------------------------------------------------------------------
const TELEPORT_INVULN = 0.3;

const teleport: SkillDef = {
  name: 'Teleport',
  key: '4',
  cooldown: 5,
  slotType: 'movement',
  targetType: 'movement',
  execute(playerPos, mousePos) {
    if (players.entities.length === 0) return;
    const player = players.entities[0];

    let destX = mousePos.x;
    let destY = mousePos.y;

    // Validate destination is not inside a wall
    const tile = game.tileMap.worldToTile(destX, destY);
    if (game.tileMap.isSolid(tile.x, tile.y)) {
      // Find nearest valid tile by searching outward
      const found = findNearestValidPosition(destX, destY);
      if (found) {
        destX = found.x;
        destY = found.y;
      } else {
        return; // No valid destination found
      }
    }

    const originX = playerPos.x;
    const originY = playerPos.y;

    // Move player instantly
    player.position.x = destX;
    player.position.y = destY;

    // Grant brief invulnerability
    world.addComponent(player, 'invulnTimer', TELEPORT_INVULN);

    // Voidcaster Orb: leave a Frost Nova at departure point
    if (hasEffect('voidcaster_frost_nova')) {
      frostNova.execute({ x: originX, y: originY }, { x: originX, y: originY });
    }

    // Visual: particle burst at origin and destination
    spawnTeleportParticles(originX, originY);
    spawnTeleportParticles(destX, destY);
  },
};

/** Search in expanding rings for a non-solid tile near (x, y). */
function findNearestValidPosition(x: number, y: number): { x: number; y: number } | null {
  const step = 16;
  for (let dist = 1; dist <= 8; dist++) {
    for (let angle = 0; angle < 8; angle++) {
      const a = (angle / 8) * Math.PI * 2;
      const testX = x + Math.cos(a) * dist * step;
      const testY = y + Math.sin(a) * dist * step;
      const tile = game.tileMap.worldToTile(testX, testY);
      if (!game.tileMap.isSolid(tile.x, tile.y)) {
        return { x: testX, y: testY };
      }
    }
  }
  return null;
}

/** Spawn small cyan circles that burst outward and fade. */
function spawnTeleportParticles(cx: number, cy: number): void {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 60 + Math.random() * 40;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const p = new Graphics();
    p.circle(0, 0, 3).fill({ color: 0x66eeff, alpha: 0.9 });
    p.position.set(cx, cy);
    game.effectLayer.addChild(p);

    let elapsed = 0;
    const onTick = (t: { deltaTime: number }) => {
      elapsed += t.deltaTime / 60;
      p.position.x += vx * (t.deltaTime / 60);
      p.position.y += vy * (t.deltaTime / 60);
      p.alpha = Math.max(0, 1 - elapsed * 3);
      if (elapsed >= 0.4) {
        game.app.ticker.remove(onTick);
        p.removeFromParent();
        p.destroy();
      }
    };
    game.app.ticker.add(onTick);
  }
}

// ---------------------------------------------------------------------------
// Skill 5 - Arcane Wall (cooldown 15s)
// Places a barrier perpendicular to player-mouse direction at cursor position
// Blocks enemy movement for 5s, does NOT block projectiles
// ---------------------------------------------------------------------------
const WALL_WIDTH = 160;
const WALL_THICKNESS = 16;
const WALL_DURATION = 5;
const WALL_FADE_TIME = 1; // fade out over last 1s
const TILE_SIZE = 32;

const arcaneWall: SkillDef = {
  name: 'Arcane Wall',
  key: '5',
  cooldown: 15,
  slotType: 'assignable',
  targetType: 'cursor_target',
  execute(playerPos, mousePos) {
    const cx = mousePos.x;
    const cy = mousePos.y;

    // Direction from player to mouse
    const dx = mousePos.x - playerPos.x;
    const dy = mousePos.y - playerPos.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    // Perpendicular direction for the wall orientation
    const perpX = -dy / len;
    const perpY = dx / len;

    // Normal direction (along player-mouse line) for thickness
    const normX = dx / len;
    const normY = dy / len;

    // Collect tiles that the wall covers and mark them solid
    const tileMap = game.tileMap;
    const wallTiles: { tx: number; ty: number; prevValue: number }[] = [];
    const halfWidth = WALL_WIDTH / 2;
    const halfThick = WALL_THICKNESS / 2;

    // Sample points along the wall rectangle and mark tiles
    for (let w = -halfWidth; w <= halfWidth; w += TILE_SIZE / 2) {
      for (let t = -halfThick; t <= halfThick; t += TILE_SIZE / 2) {
        const wx = cx + perpX * w + normX * t;
        const wy = cy + perpY * w + normY * t;
        const tile = tileMap.worldToTile(wx, wy);

        // Only mark tiles that are in bounds and not already solid
        if (tile.x >= 0 && tile.y >= 0 && tile.x < tileMap.width && tile.y < tileMap.height) {
          if (tileMap.tiles[tile.y][tile.x] !== 1) {
            // Check if we already recorded this tile
            const alreadyRecorded = wallTiles.some((wt) => wt.tx === tile.x && wt.ty === tile.y);
            if (!alreadyRecorded) {
              wallTiles.push({ tx: tile.x, ty: tile.y, prevValue: tileMap.tiles[tile.y][tile.x] });
              tileMap.tiles[tile.y][tile.x] = 2;
            }
          }
        }
      }
    }

    // Visual: glowing purple/blue rectangular barrier
    const wallGfx = new Graphics();
    const angle = Math.atan2(perpY, perpX);
    wallGfx.position.set(cx, cy);
    wallGfx.rotation = angle;

    // Draw the wall rectangle (centered at origin, rotated)
    wallGfx.rect(-halfWidth, -halfThick, WALL_WIDTH, WALL_THICKNESS)
      .fill({ color: 0x8844ff, alpha: 0.5 });
    wallGfx.rect(-halfWidth, -halfThick, WALL_WIDTH, WALL_THICKNESS)
      .stroke({ width: 2, color: 0xaa66ff, alpha: 0.8 });
    // Inner glow line
    wallGfx.rect(-halfWidth + 4, -halfThick + 4, WALL_WIDTH - 8, WALL_THICKNESS - 8)
      .fill({ color: 0xbb88ff, alpha: 0.3 });

    game.effectLayer.addChild(wallGfx);

    // Animate shimmer and fade, then clean up tiles
    let elapsed = 0;
    const onTick = (t: { deltaTime: number }) => {
      elapsed += t.deltaTime / 60;

      // Shimmer effect: oscillate alpha slightly
      const shimmer = 0.4 + 0.2 * Math.sin(elapsed * 8);

      if (elapsed > WALL_DURATION - WALL_FADE_TIME) {
        // Fade out over last 1s
        const fadeProgress = (elapsed - (WALL_DURATION - WALL_FADE_TIME)) / WALL_FADE_TIME;
        wallGfx.alpha = Math.max(0, (1 - fadeProgress) * shimmer * 2);
      } else {
        wallGfx.alpha = shimmer + 0.4;
      }

      if (elapsed >= WALL_DURATION) {
        // Restore tiles to original values
        for (const wt of wallTiles) {
          if (wt.tx >= 0 && wt.ty >= 0 && wt.tx < tileMap.width && wt.ty < tileMap.height) {
            tileMap.tiles[wt.ty][wt.tx] = wt.prevValue;
          }
        }

        game.app.ticker.remove(onTick);
        wallGfx.removeFromParent();
        wallGfx.destroy();
      }
    };
    game.app.ticker.add(onTick);
  },
};

// ---------------------------------------------------------------------------
// Skill 6 - Meteor (cooldown 14s)
// Target location at mouse cursor, 1.5s telegraph, then 200 dmg AoE + Burn
// ---------------------------------------------------------------------------
const METEOR_RADIUS = 96;
const METEOR_DAMAGE = 200;
const METEOR_DELAY = 1.5;

const meteor: SkillDef = {
  name: 'Meteor',
  key: '6',
  cooldown: 14,
  slotType: 'assignable',
  targetType: 'cursor_aoe',
  radius: 96,
  execute(_playerPos, mousePos) {
    const tx = mousePos.x;
    const ty = mousePos.y;

    // Telegraph phase: growing red/orange circle on ground
    const telegraph = new Graphics();
    telegraph.position.set(tx, ty);
    game.effectLayer.addChild(telegraph);

    let elapsed = 0;
    let impacted = false;

    const onTick = (t: { deltaTime: number }) => {
      elapsed += t.deltaTime / 60;

      if (!impacted) {
        // Telegraph: growing warning circle
        const progress = Math.min(elapsed / METEOR_DELAY, 1);
        const currentRadius = METEOR_RADIUS * progress;

        telegraph.clear();
        // Outer warning ring
        telegraph.circle(0, 0, currentRadius)
          .stroke({ width: 2, color: 0xff4400, alpha: 0.6 + 0.3 * Math.sin(elapsed * 12) });
        // Fill with semi-transparent red/orange
        telegraph.circle(0, 0, currentRadius)
          .fill({ color: 0xff2200, alpha: 0.1 + 0.1 * progress });
        // Inner crosshair for visual clarity
        if (progress > 0.3) {
          telegraph.circle(0, 0, currentRadius * 0.3)
            .fill({ color: 0xff6600, alpha: 0.15 * progress });
        }

        if (elapsed >= METEOR_DELAY) {
          impacted = true;

          // Screen shake on meteor impact
          shake(0.5, 10);
          spawnHitSparks(tx, ty, 'fire');

          // Deal damage to all enemies in radius
          for (const enemy of enemies) {
            const dx = enemy.position.x - tx;
            const dy = enemy.position.y - ty;
            if (dx * dx + dy * dy < METEOR_RADIUS * METEOR_RADIUS) {
              enemy.health.current -= METEOR_DAMAGE;
              spawnDamageNumber(enemy.position.x, enemy.position.y - 10, METEOR_DAMAGE, 0xff6600);
              applyStatus(enemy, StatusType.Burn, { x: tx, y: ty });

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

          // Impact visual: bright orange flash expanding outward
          telegraph.clear();
          elapsed = 0; // Reset for fade phase
        }
      } else {
        // Impact flash: expanding bright ring that fades
        const fadeProgress = Math.min(elapsed / 0.5, 1);
        const flashRadius = METEOR_RADIUS + METEOR_RADIUS * 0.3 * fadeProgress;

        telegraph.clear();
        // Bright core flash
        telegraph.circle(0, 0, METEOR_RADIUS * (1 - fadeProgress * 0.5))
          .fill({ color: 0xff8800, alpha: 0.6 * (1 - fadeProgress) });
        // Expanding outer ring
        telegraph.circle(0, 0, flashRadius)
          .stroke({ width: 4 * (1 - fadeProgress), color: 0xffaa22, alpha: 0.8 * (1 - fadeProgress) });
        // Secondary inner ring
        telegraph.circle(0, 0, flashRadius * 0.6)
          .stroke({ width: 2 * (1 - fadeProgress), color: 0xffffff, alpha: 0.5 * (1 - fadeProgress) });

        if (fadeProgress >= 1) {
          game.app.ticker.remove(onTick);
          telegraph.removeFromParent();
          telegraph.destroy();
        }
      }
    };
    game.app.ticker.add(onTick);
  },
};

// ---------------------------------------------------------------------------
// Export all Mage skills
// ---------------------------------------------------------------------------
export const mageSkills: SkillDef[] = [fireball, frostNova, lightningChain, teleport, arcaneWall, meteor];
