import { Graphics } from 'pixi.js';
import type { SkillDef } from '../../core/SkillSystem';
import { fireProjectile } from '../Projectile';
import { world } from '../../ecs/world';
import { game } from '../../Game';
import { spawnDamageNumber } from '../../ui/DamageNumbers';
import { spawnDeathParticles } from '../DeathParticles';
import { applyStatus, StatusType } from '../../core/StatusEffects';

const players = world.with('position', 'velocity', 'speed', 'player');
const enemies = world.with('enemy', 'position', 'health');

// ---------------------------------------------------------------------------
// Skill 1 - Fireball (cooldown 4s)
// Large orange/red projectile that explodes on impact with AoE splash
// ---------------------------------------------------------------------------
const fireball: SkillDef = {
  name: 'Fireball',
  key: '1',
  cooldown: 4,
  execute(playerPos, mousePos) {
    fireProjectile(playerPos.x, playerPos.y, mousePos.x, mousePos.y, {
      speed: 400,
      damage: 30,
      radius: 8,
      color: 0xff4400,
      lifetime: 3,
    });
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
  execute(_playerPos, mousePos) {
    const hitTargets: { x: number; y: number }[] = [];
    const hitSet = new Set<object>();

    // Find the nearest enemy to cursor within range, then bounce
    let currentX = mousePos.x;
    let currentY = mousePos.y;
    let range = CHAIN_INITIAL_RANGE;

    for (let bounce = 0; bounce < CHAIN_MAX_BOUNCES; bounce++) {
      let bestEnemy: (typeof enemies.entities)[number] | null = null;
      let bestDistSq = range * range;

      for (const enemy of enemies) {
        if (hitSet.has(enemy)) continue;
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
      hitTargets.push({ x: bestEnemy.position.x, y: bestEnemy.position.y });

      // Calculate damage with decay
      const dmg = Math.round(CHAIN_BASE_DAMAGE * Math.pow(CHAIN_DECAY, bounce));
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
// Export all Mage skills
// ---------------------------------------------------------------------------
export const mageSkills: SkillDef[] = [fireball, frostNova, lightningChain, teleport];
