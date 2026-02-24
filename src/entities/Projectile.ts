import { Graphics } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';
import { Pool } from '../pools/Pool';
import { getProjectileSpeedMultiplier, getDamageMultiplier } from '../ecs/systems/StatEffects';

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
  };

  if (options?.piercing) {
    entity.piercing = true as const;
    entity.piercingHitIds = new Set<object>();
  }

  return world.add(entity as Entity);
}

export function despawnProjectile(entity: Entity): void {
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
