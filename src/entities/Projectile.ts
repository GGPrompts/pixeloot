import { Graphics } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';
import { Pool } from '../pools/Pool';

const PROJECTILE_SPEED = 500;
const PROJECTILE_RADIUS = 4;
const PROJECTILE_DAMAGE = 10;
const PROJECTILE_LIFETIME = 2;

function createProjectileSprite(): Graphics {
  const g = new Graphics();
  g.circle(0, 0, PROJECTILE_RADIUS).fill({ color: 0x00ffff, alpha: 0.9 });
  g.visible = false;
  return g;
}

const spritePool = new Pool<Graphics>(createProjectileSprite, 10);

export function fireProjectile(fromX: number, fromY: number, targetX: number, targetY: number): Entity {
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Avoid zero-length direction
  const nx = len > 0 ? dx / len : 1;
  const ny = len > 0 ? dy / len : 0;

  const sprite = spritePool.acquire();
  sprite.position.set(fromX, fromY);
  sprite.visible = true;
  game.entityLayer.addChild(sprite);

  return world.add({
    position: { x: fromX, y: fromY },
    velocity: { x: nx * PROJECTILE_SPEED, y: ny * PROJECTILE_SPEED },
    damage: PROJECTILE_DAMAGE,
    projectile: true as const,
    sprite,
    lifetime: PROJECTILE_LIFETIME,
  });
}

export function despawnProjectile(entity: Entity): void {
  if (entity.sprite) {
    entity.sprite.visible = false;
    entity.sprite.removeFromParent();
    spritePool.release(entity.sprite as Graphics);
  }
  world.remove(entity);
}
