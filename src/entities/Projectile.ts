import { Graphics } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';
import { Pool } from '../pools/Pool';
import { getProjectileSpeedMultiplier, getDamageMultiplier } from '../ecs/systems/StatEffects';
import { spawnDamageNumber } from '../ui/DamageNumbers';
import { spawnDeathParticles } from './DeathParticles';
import { hasEffect, incrementProjectileCount } from '../core/UniqueEffects';

const PROJECTILE_SPEED = 500;
const PROJECTILE_RADIUS = 4;
const PROJECTILE_DAMAGE = 10;
const PROJECTILE_LIFETIME = 2;

export interface ProjectileOptions {
  speed?: number;
  damage?: number;
  radius?: number;
  color?: number;
  piercing?: true;
  lifetime?: number;
  /** Player dexterity stat — increases projectile speed. */
  dexterity?: number;
  /** Player intelligence stat — increases damage. */
  intelligence?: number;
  /** AoE explosion on projectile death (hit or wall). */
  explodeOnDeath?: { radius: number; damage: number };
  /** Projectile gently homes toward nearest enemy (Orb weapon). */
  homing?: true;
  /** Projectile applies knockback on hit (Crossbow weapon). */
  knockbackOnHit?: true;
}

function createProjectileSprite(): Graphics {
  const g = new Graphics();
  g.circle(0, 0, PROJECTILE_RADIUS).fill({ color: 0x00ffff, alpha: 0.9 });
  g.visible = false;
  return g;
}

const spritePool = new Pool<Graphics>(createProjectileSprite, 10);

/** Set of custom (non-pooled) sprites so despawn knows not to return them to the pool. */
const customSprites = new WeakSet<Graphics>();

export function fireProjectile(
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
  options?: ProjectileOptions,
): Entity {
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Avoid zero-length direction
  const nx = len > 0 ? dx / len : 1;
  const ny = len > 0 ? dy / len : 0;

  const dex = options?.dexterity ?? 0;
  const int = options?.intelligence ?? 0;
  const speed = (options?.speed ?? PROJECTILE_SPEED) * getProjectileSpeedMultiplier(dex);
  const damage = Math.round((options?.damage ?? PROJECTILE_DAMAGE) * getDamageMultiplier(int));
  const lifetime = options?.lifetime ?? PROJECTILE_LIFETIME;

  let sprite: Graphics;
  if (options?.radius || options?.color) {
    // Create a custom sprite (not pooled)
    const r = options.radius ?? PROJECTILE_RADIUS;
    const c = options.color ?? 0x00ffff;
    sprite = new Graphics();
    sprite.circle(0, 0, r).fill({ color: c, alpha: 0.9 });
    customSprites.add(sprite);
  } else {
    sprite = spritePool.acquire();
  }

  sprite.position.set(fromX, fromY);
  sprite.visible = true;
  game.entityLayer.addChild(sprite);

  const entity: Partial<Entity> = {
    position: { x: fromX, y: fromY },
    velocity: { x: nx * speed, y: ny * speed },
    damage,
    projectile: true as const,
    sprite,
    lifetime,
    spawnPosition: { x: fromX, y: fromY },
  };

  if (options?.piercing) {
    entity.piercing = true as const;
    entity.piercingHitIds = new Set<object>();
  }

  if (options?.explodeOnDeath) {
    entity.explodeOnDeath = { ...options.explodeOnDeath };
  }

  if (options?.homing) {
    entity.homing = true as const;
  }

  if (options?.knockbackOnHit) {
    entity.knockbackOnHit = true as const;
  }

  // Kinetic Band: every 4th player projectile deals double damage + knockback
  if (hasEffect('kinetic_fourth_shot')) {
    const count = incrementProjectileCount();
    if (count % 4 === 0) {
      entity.damage = (entity.damage ?? 0) * 2;
      entity.knockbackOnHit = true as const;
    }
  }

  return world.add(entity as Entity);
}

const ENEMY_PROJECTILE_SPEED = 300;
const ENEMY_PROJECTILE_RADIUS = 3;
const ENEMY_PROJECTILE_DAMAGE = 8;
const ENEMY_PROJECTILE_LIFETIME = 3;

/**
 * Fires a projectile from an enemy toward a target position.
 * Tagged with enemyProjectile so CollisionSystem can handle player hits.
 */
export function fireEnemyProjectile(
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
): Entity {
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);

  const nx = len > 0 ? dx / len : 1;
  const ny = len > 0 ? dy / len : 0;

  const sprite = new Graphics();
  sprite.circle(0, 0, ENEMY_PROJECTILE_RADIUS).fill({ color: 0xff44ff, alpha: 0.9 });
  customSprites.add(sprite);

  sprite.position.set(fromX, fromY);
  sprite.visible = true;
  game.entityLayer.addChild(sprite);

  return world.add({
    position: { x: fromX, y: fromY },
    velocity: { x: nx * ENEMY_PROJECTILE_SPEED, y: ny * ENEMY_PROJECTILE_SPEED },
    damage: ENEMY_PROJECTILE_DAMAGE,
    enemyProjectile: true as const,
    sprite,
    lifetime: ENEMY_PROJECTILE_LIFETIME,
  } as Entity);
}

const enemiesQuery = world.with('enemy', 'position', 'health');

export function despawnProjectile(entity: Entity): void {
  // Handle AoE explosion before removing
  if (entity.explodeOnDeath && entity.position) {
    const { radius, damage } = entity.explodeOnDeath;
    const ex = entity.position.x;
    const ey = entity.position.y;

    // Deal AoE damage to all enemies in radius
    for (const enemy of enemiesQuery) {
      const dx = enemy.position.x - ex;
      const dy = enemy.position.y - ey;
      if (dx * dx + dy * dy < radius * radius) {
        enemy.health.current -= damage;
        spawnDamageNumber(enemy.position.x, enemy.position.y - 10, damage, 0xff6600);

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

    // Visual: expanding orange circle on effectLayer
    const explosion = new Graphics();
    explosion.circle(0, 0, radius).fill({ color: 0xff6600, alpha: 0.5 });
    explosion.position.set(ex, ey);
    explosion.scale.set(0.2);
    game.effectLayer.addChild(explosion);

    let elapsed = 0;
    const onTick = (t: { deltaTime: number }) => {
      elapsed += t.deltaTime / 60;
      const progress = Math.min(elapsed / 0.3, 1);
      explosion.scale.set(0.2 + 0.8 * progress);
      explosion.alpha = 0.5 * (1 - progress);
      if (progress >= 1) {
        game.app.ticker.remove(onTick);
        explosion.removeFromParent();
        explosion.destroy();
      }
    };
    game.app.ticker.add(onTick);
  }

  // Inferno Staff: burning ground AoE at impact position
  if (entity.burningGround && entity.position) {
    spawnBurningGround(entity.position.x, entity.position.y);
  }

  if (entity.sprite) {
    entity.sprite.visible = false;
    entity.sprite.removeFromParent();
    if (customSprites.has(entity.sprite as Graphics)) {
      (entity.sprite as Graphics).destroy();
    } else {
      spritePool.release(entity.sprite as Graphics);
    }
  }
  world.remove(entity);
}

/** Spawns a burning ground AoE that deals fire damage over 3 seconds. */
function spawnBurningGround(cx: number, cy: number): void {
  const BURNING_RADIUS = 64;
  const BURNING_DURATION = 3;
  const BURNING_TICK_INTERVAL = 0.5;
  const BURNING_TICK_DAMAGE = 8;

  const gfx = new Graphics();
  gfx.circle(0, 0, BURNING_RADIUS).fill({ color: 0xff4400, alpha: 0.25 });
  gfx.circle(0, 0, BURNING_RADIUS).stroke({ width: 2, color: 0xff6600, alpha: 0.5 });
  gfx.position.set(cx, cy);
  game.effectLayer.addChild(gfx);

  let elapsed = 0;
  let tickAcc = 0;

  const onTick = (t: { deltaTime: number }) => {
    const dt = t.deltaTime / 60;
    elapsed += dt;
    tickAcc += dt;

    // Pulse visual
    gfx.alpha = 0.5 + 0.2 * Math.sin(elapsed * 6);

    // Tick damage to enemies in radius
    while (tickAcc >= BURNING_TICK_INTERVAL) {
      tickAcc -= BURNING_TICK_INTERVAL;
      for (const enemy of enemiesQuery) {
        const dx = enemy.position.x - cx;
        const dy = enemy.position.y - cy;
        if (dx * dx + dy * dy < BURNING_RADIUS * BURNING_RADIUS) {
          enemy.health.current -= BURNING_TICK_DAMAGE;
          spawnDamageNumber(enemy.position.x, enemy.position.y - 10, BURNING_TICK_DAMAGE, 0xff6600);
          if (enemy.health.current <= 0) {
            spawnDeathParticles(enemy.position.x, enemy.position.y);
            if (enemy.sprite) enemy.sprite.removeFromParent();
            world.remove(enemy);
          }
        }
      }
    }

    // Fade out in last 0.5s
    if (elapsed > BURNING_DURATION - 0.5) {
      const fade = (BURNING_DURATION - elapsed) / 0.5;
      gfx.alpha = Math.max(0, fade * 0.5);
    }

    if (elapsed >= BURNING_DURATION) {
      game.app.ticker.remove(onTick);
      gfx.removeFromParent();
      gfx.destroy();
    }
  };
  game.app.ticker.add(onTick);
}
