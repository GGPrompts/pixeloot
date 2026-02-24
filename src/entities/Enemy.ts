import { Graphics } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';

/**
 * Spawns a Rusher enemy: a red triangle that chases the player.
 */
export function spawnRusher(worldX: number, worldY: number): Entity {
  const g = new Graphics();

  // Red triangle pointing right (~16px)
  g.moveTo(-8, -8)
    .lineTo(8, 0)
    .lineTo(-8, 8)
    .closePath()
    .fill({ color: 0xff3333 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  return world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 80,
    enemy: true as const,
    health: { current: 30, max: 30 },
    damage: 10,
    sprite: g,
  });
}
