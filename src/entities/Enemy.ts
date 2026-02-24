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
    baseSpeed: 80,
    enemy: true as const,
    enemyType: 'rusher',
    health: { current: 30, max: 30 },
    damage: 10,
    sprite: g,
  });
}

/**
 * Spawns a Swarm enemy: a small orange circle. Weak individually, dangerous in packs.
 */
export function spawnSwarm(worldX: number, worldY: number): Entity {
  const g = new Graphics();
  g.circle(0, 0, 6).fill({ color: 0xff8800 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  return world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 100,
    baseSpeed: 100,
    enemy: true as const,
    enemyType: 'swarm',
    health: { current: 10, max: 10 },
    damage: 5,
    sprite: g,
  });
}

/**
 * Spawns a Tank enemy: a large green hexagon. Slow but very tough.
 */
export function spawnTank(worldX: number, worldY: number): Entity {
  const g = new Graphics();

  // Hexagon ~20px radius
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = Math.cos(angle) * 20;
    const py = Math.sin(angle) * 20;
    if (i === 0) {
      g.moveTo(px, py);
    } else {
      g.lineTo(px, py);
    }
  }
  g.closePath().fill({ color: 0x44ff44 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  return world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 40,
    baseSpeed: 40,
    enemy: true as const,
    enemyType: 'tank',
    health: { current: 120, max: 120 },
    damage: 20,
    sprite: g,
  });
}

/**
 * Spawns a Sniper enemy: a magenta diamond. Stays at range and fires projectiles.
 */
export function spawnSniper(worldX: number, worldY: number): Entity {
  const g = new Graphics();

  // Diamond ~12px
  g.moveTo(0, -12)
    .lineTo(12, 0)
    .lineTo(0, 12)
    .lineTo(-12, 0)
    .closePath()
    .fill({ color: 0xff44ff });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  return world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 50,
    baseSpeed: 50,
    enemy: true as const,
    enemyType: 'sniper',
    health: { current: 25, max: 25 },
    damage: 0,
    sprite: g,
    aiTimer: 0,
  });
}

/**
 * Spawns a Flanker enemy: a yellow crescent/arc shape. Fast, circles then dashes.
 */
export function spawnFlanker(worldX: number, worldY: number): Entity {
  const g = new Graphics();

  // Crescent/arc shape ~14px
  g.arc(0, 0, 14, -Math.PI * 0.75, Math.PI * 0.75);
  g.arc(0, 4, 10, Math.PI * 0.75, -Math.PI * 0.75, true);
  g.closePath();
  g.fill({ color: 0xffff00 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  return world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 130,
    baseSpeed: 130,
    enemy: true as const,
    enemyType: 'flanker',
    health: { current: 20, max: 20 },
    damage: 12,
    sprite: g,
    aiTimer: 0,
    aiState: 'circling',
  });
}
