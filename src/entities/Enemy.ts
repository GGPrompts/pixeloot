import { Graphics, Container } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';
import { scaleHealth, scaleDamage } from '../core/MonsterScaling';
import { hasModifier } from '../core/MapDevice';

/**
 * Apply active map modifiers to a freshly spawned enemy entity.
 * - hp_boost: +20% HP
 * - speed_boost: +15% speed
 * - fire_enchanted: flag entity so contact/projectile hits apply Burn
 * - resist_first_hit: initialise firstHitTaken so first damage is absorbed
 */
function applyMapModifiers(entity: Entity): void {
  if (hasModifier('hp_boost') && entity.health) {
    const bonus = Math.round(entity.health.max * 0.2);
    entity.health.max += bonus;
    entity.health.current += bonus;
  }
  if (hasModifier('speed_boost') && entity.speed !== undefined && entity.baseSpeed !== undefined) {
    const speedBonus = Math.round(entity.baseSpeed * 0.15);
    entity.speed += speedBonus;
    entity.baseSpeed += speedBonus;
  }
  if (hasModifier('fire_enchanted')) {
    entity.fireEnchanted = true;
  }
  if (hasModifier('resist_first_hit')) {
    // Initialise to false so CollisionSystem knows this enemy has not yet been hit
    entity.firstHitTaken = undefined;
  }
}

/**
 * Spawns a Rusher enemy: a red triangle that chases the player.
 */
export function spawnRusher(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Red triangle pointing right (~16px)
  g.moveTo(-8, -8)
    .lineTo(8, 0)
    .lineTo(-8, 8)
    .closePath()
    .fill({ color: 0xff3333 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(30, monsterLevel);
  const dmg = scaleDamage(10, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 80,
    baseSpeed: 80,
    enemy: true as const,
    enemyType: 'rusher',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Swarm enemy: a small orange circle. Weak individually, dangerous in packs.
 */
export function spawnSwarm(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();
  g.circle(0, 0, 6).fill({ color: 0xff8800 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(10, monsterLevel);
  const dmg = scaleDamage(5, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 100,
    baseSpeed: 100,
    enemy: true as const,
    enemyType: 'swarm',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Tank enemy: a large green hexagon. Slow but very tough.
 */
export function spawnTank(worldX: number, worldY: number, monsterLevel = 1): Entity {
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

  const hp = scaleHealth(120, monsterLevel);
  const dmg = scaleDamage(20, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 40,
    baseSpeed: 40,
    enemy: true as const,
    enemyType: 'tank',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Sniper enemy: a magenta diamond. Stays at range and fires projectiles.
 */
export function spawnSniper(worldX: number, worldY: number, monsterLevel = 1): Entity {
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

  const hp = scaleHealth(25, monsterLevel);
  // Sniper base damage is 0 (projectile carries damage), keep it unscaled
  const dmg = 0;

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 50,
    baseSpeed: 50,
    enemy: true as const,
    enemyType: 'sniper',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Flanker enemy: a yellow crescent/arc shape. Fast, circles then dashes.
 */
export function spawnFlanker(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Crescent/arc shape ~14px
  g.arc(0, 0, 14, -Math.PI * 0.75, Math.PI * 0.75);
  g.arc(0, 4, 10, Math.PI * 0.75, -Math.PI * 0.75, true);
  g.closePath();
  g.fill({ color: 0xffff00 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(20, monsterLevel);
  const dmg = scaleDamage(12, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 130,
    baseSpeed: 130,
    enemy: true as const,
    enemyType: 'flanker',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    aiState: 'circling',
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Splitter enemy: a teal pentagon. On death, splits into 2 mini-Splitters.
 */
export function spawnSplitter(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Pentagon ~12px radius
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = Math.cos(angle) * 12;
    const py = Math.sin(angle) * 12;
    if (i === 0) {
      g.moveTo(px, py);
    } else {
      g.lineTo(px, py);
    }
  }
  g.closePath().fill({ color: 0x44ddaa });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(40, monsterLevel);
  const dmg = scaleDamage(8, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 90,
    baseSpeed: 90,
    enemy: true as const,
    enemyType: 'splitter',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a mini-Splitter: half-size teal pentagon. Does NOT split again on death.
 */
export function spawnMiniSplitter(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Half-size pentagon ~6px radius
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = Math.cos(angle) * 6;
    const py = Math.sin(angle) * 6;
    if (i === 0) {
      g.moveTo(px, py);
    } else {
      g.lineTo(px, py);
    }
  }
  g.closePath().fill({ color: 0x44ddaa });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(10, monsterLevel);
  const dmg = scaleDamage(8, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 90,
    baseSpeed: 90,
    enemy: true as const,
    enemyType: 'splitter',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    level: monsterLevel,
    isMiniSplitter: true as const,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Shielder enemy: a white square with a thick front shield bar.
 * Projectiles hitting the front face are blocked; must be hit from behind or sides.
 */
export function spawnShielder(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const container = new Container();

  // White square body ~12px half-size
  const body = new Graphics();
  body.rect(-12, -12, 24, 24).fill({ color: 0xffffff });
  container.addChild(body);

  // Thick shield bar on the front (right) face
  const shield = new Graphics();
  shield.rect(12, -14, 4, 28).fill({ color: 0x4488ff });
  container.addChild(shield);

  container.position.set(worldX, worldY);
  game.entityLayer.addChild(container);

  const hp = scaleHealth(60, monsterLevel);
  const dmg = scaleDamage(15, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 60,
    baseSpeed: 60,
    enemy: true as const,
    enemyType: 'shielder',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: container,
    shielded: true as const,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Bomber enemy: a pink octagon. Chases player and explodes on proximity.
 */
export function spawnBomber(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Regular octagon ~10px radius
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    const px = Math.cos(angle) * 10;
    const py = Math.sin(angle) * 10;
    if (i === 0) {
      g.moveTo(px, py);
    } else {
      g.lineTo(px, py);
    }
  }
  g.closePath().fill({ color: 0xff6688 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(15, monsterLevel);
  const dmg = scaleDamage(25, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 95,
    baseSpeed: 95,
    enemy: true as const,
    enemyType: 'bomber',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Charger enemy: a deep crimson arrow. Telegraphed bull-rush with stun.
 */
export function spawnCharger(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Large thick arrowhead ~16px long, 12px wide
  g.moveTo(16, 0)
    .lineTo(-8, -12)
    .lineTo(-4, 0)
    .lineTo(-8, 12)
    .closePath()
    .fill({ color: 0xdd2222 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(80, monsterLevel);
  const dmg = scaleDamage(22, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 50,
    baseSpeed: 50,
    enemy: true as const,
    enemyType: 'charger',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 4, // first charge after 4s
    aiState: 'walking',
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Pulsar enemy: a pale yellow starburst. Periodic AoE nova while chasing.
 */
export function spawnPulsar(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // 6-pointed starburst (alternating long/short radii)
  const outerR = 16;
  const innerR = 8;
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) {
      g.moveTo(px, py);
    } else {
      g.lineTo(px, py);
    }
  }
  g.closePath().fill({ color: 0xffff88 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(70, monsterLevel);
  const dmg = scaleDamage(12, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 55,
    baseSpeed: 55,
    enemy: true as const,
    enemyType: 'pulsar',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 3, // first pulse after 3s
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Mirror enemy: a pale lavender rhombus. Orbits player and reflects projectiles.
 */
export function spawnMirror(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Tall thin rhombus (diamond stretched vertically), ~14px tall, 8px wide
  g.moveTo(0, -14)
    .lineTo(8, 0)
    .lineTo(0, 14)
    .lineTo(-8, 0)
    .closePath()
    .fill({ color: 0xccccff });
  // Bright edge highlight for reflective sheen
  g.moveTo(0, -14)
    .lineTo(8, 0)
    .lineTo(0, 14)
    .stroke({ color: 0xeeeeff, width: 2, alpha: 0.8 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(35, monsterLevel);
  const dmg = scaleDamage(0, monsterLevel); // does not deal contact damage

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 55,
    baseSpeed: 55,
    enemy: true as const,
    enemyType: 'mirror',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    aiState: 'reflecting', // 'reflecting' = active, 'cracked' = on cooldown
    mirrorReflectCooldown: 0,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Phaser enemy: a light blue diamond outline. Blinks in and out of existence.
 */
export function spawnPhaser(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Diamond outline (not filled) with a glowing center dot
  g.moveTo(0, -12)
    .lineTo(12, 0)
    .lineTo(0, 12)
    .lineTo(-12, 0)
    .closePath()
    .stroke({ color: 0x88aaff, width: 2 });
  g.circle(0, 0, 3).fill({ color: 0x88aaff });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(28, monsterLevel);
  const dmg = scaleDamage(14, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 85,
    baseSpeed: 85,
    enemy: true as const,
    enemyType: 'phaser',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    aiState: 'solid',
    phaserPhaseTimer: 1.5, // starts solid for 1.5s
    phaserSolid: true,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Burrower enemy: a brown downward chevron. Underground ambush predator.
 */
export function spawnBurrower(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const container = new Container();

  // Surface form: downward-pointing chevron (V shape), ~12px
  const chevron = new Graphics();
  chevron.moveTo(-12, -8)
    .lineTo(0, 8)
    .lineTo(12, -8)
    .lineTo(8, -8)
    .lineTo(0, 4)
    .lineTo(-8, -8)
    .closePath()
    .fill({ color: 0x886633 });
  chevron.visible = false; // starts burrowed
  container.addChild(chevron);

  // Burrowed form: small rumbling dust circle
  const dust = new Graphics();
  dust.circle(0, 0, 6).fill({ color: 0x886633, alpha: 0.4 });
  dust.visible = true; // starts burrowed
  container.addChild(dust);

  container.position.set(worldX, worldY);
  game.entityLayer.addChild(container);

  const hp = scaleHealth(40, monsterLevel);
  const dmg = scaleDamage(18, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 70,
    baseSpeed: 70,
    enemy: true as const,
    enemyType: 'burrower',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: container,
    aiTimer: 0,
    aiState: 'burrowed',
    burrowed: true,
    burrowSurfaceTimer: 3, // surfaces after 3s initially
    invulnerable: true,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Warper enemy: a cyan hourglass/bowtie. Teleports and applies Shock.
 */
export function spawnWarper(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Hourglass / bowtie shape: two triangles meeting at a point
  g.moveTo(-12, -10)
    .lineTo(12, -10)
    .lineTo(0, 0)
    .closePath()
    .fill({ color: 0x00cccc });
  g.moveTo(-12, 10)
    .lineTo(12, 10)
    .lineTo(0, 0)
    .closePath()
    .fill({ color: 0x00cccc });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(20, monsterLevel);
  const dmg = scaleDamage(12, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 40,
    baseSpeed: 40,
    enemy: true as const,
    enemyType: 'warper',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    aiState: 'moving',
    warperTeleportTimer: 2.5,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Leech enemy: a purple teardrop. Fast chaser that attaches to the player.
 */
export function spawnLeech(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Teardrop / rounded triangle ~8px
  g.moveTo(0, -8)
    .bezierCurveTo(-6, -4, -6, 4, 0, 8)
    .bezierCurveTo(6, 4, 6, -4, 0, -8)
    .closePath()
    .fill({ color: 0x9944cc });
  // Thin tail trailing behind
  g.moveTo(0, 8)
    .lineTo(-2, 14)
    .lineTo(2, 14)
    .closePath()
    .fill({ color: 0x7733aa });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(12, monsterLevel);
  const dmg = scaleDamage(3, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 110,
    baseSpeed: 110,
    enemy: true as const,
    enemyType: 'leech',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    aiState: 'chasing',
    leechAttached: false,
    leechAttachTimer: 0,
    leechOffset: { x: 0, y: 0 },
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Vortex enemy: an indigo spiral. Stationary gravitational pull.
 */
export function spawnVortex(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Archimedean spiral with 2 arms, ~18px radius
  const arms = 2;
  for (let arm = 0; arm < arms; arm++) {
    const offset = (Math.PI * 2 * arm) / arms;
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const angle = offset + t * Math.PI * 3;
      const r = t * 18;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) {
        g.moveTo(px, py);
      } else {
        g.lineTo(px, py);
      }
    }
    g.stroke({ color: 0x6644ff, width: 2 });
  }
  // Center glow dot
  g.circle(0, 0, 3).fill({ color: 0x8866ff });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(50, monsterLevel);
  const dmg = scaleDamage(8, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 0,
    baseSpeed: 0,
    enemy: true as const,
    enemyType: 'vortex',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    vortexPullTimer: 3, // 3s idle, then 2s pull
    vortexPulling: false,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Healer enemy: a lime green cross. Flees from player and heals allies.
 */
export function spawnHealer(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Plus/cross shape: two overlapping rectangles (6px wide, 14px long)
  g.rect(-3, -14, 6, 28).fill({ color: 0x66ff66 });
  g.rect(-14, -3, 28, 6).fill({ color: 0x66ff66 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(30, monsterLevel);
  const dmg = scaleDamage(5, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 65,
    baseSpeed: 65,
    enemy: true as const,
    enemyType: 'healer',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    healerHealTimer: 2, // heal pulse every 2s
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Spawner enemy: a warm orange hive. Stationary, produces Swarm enemies.
 */
export function spawnSpawner(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Irregular hexagonal cluster (3 overlapping hexagons, slightly offset), ~20px
  const drawHex = (cx: number, cy: number, r: number) => {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath().fill({ color: 0xff8844, alpha: 0.8 });
  };
  drawHex(-4, -3, 10);
  drawHex(5, -2, 10);
  drawHex(0, 5, 10);

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(100, monsterLevel);
  const dmg = scaleDamage(5, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 0,
    baseSpeed: 0,
    enemy: true as const,
    enemyType: 'spawner',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    spawnerSpawnTimer: 4, // spawn every 4s
    spawnerChildCount: 0,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Lobber enemy: a dark teal dome. Kites and lobs arcing projectiles.
 */
export function spawnLobber(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Half-circle dome (flat on bottom), ~14px radius
  g.arc(0, 0, 14, Math.PI, 0)
    .lineTo(14, 0)
    .lineTo(-14, 0)
    .closePath()
    .fill({ color: 0x44aaaa });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(30, monsterLevel);
  const dmg = scaleDamage(15, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 40,
    baseSpeed: 40,
    enemy: true as const,
    enemyType: 'lobber',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    lobberFireTimer: 3, // fire every 3s
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Swooper enemy: a dull gold wing shape. Fast diagonal strafe runs.
 */
export function spawnSwooper(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Swept-back wing/delta shape, ~14px wide, 8px tall
  g.moveTo(14, 0)
    .lineTo(-10, -8)
    .lineTo(-4, 0)
    .lineTo(-10, 8)
    .closePath()
    .fill({ color: 0xdddd44 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(18, monsterLevel);
  const dmg = scaleDamage(14, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 60,
    baseSpeed: 60,
    enemy: true as const,
    enemyType: 'swooper',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    aiState: 'hovering',
    swooperSwoopTimer: 2.5,
    swooperSide: 1,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}

/**
 * Spawns a Trapper enemy: a burnt orange trapezoid. Kites and places hazard zones.
 */
export function spawnTrapper(worldX: number, worldY: number, monsterLevel = 1): Entity {
  const g = new Graphics();

  // Isosceles trapezoid, wider at bottom (~16px base, ~10px top, 12px tall)
  g.moveTo(-5, -12)
    .lineTo(5, -12)
    .lineTo(8, 0)
    .lineTo(-8, 0)
    .closePath()
    .fill({ color: 0xcc4400 });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(35, monsterLevel);
  const dmg = scaleDamage(10, monsterLevel);

  const entity = world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: 55,
    baseSpeed: 55,
    enemy: true as const,
    enemyType: 'trapper',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    aiTimer: 0,
    trapperPlaceTimer: 3, // place trap every 3s
    trapperTrapCount: 0,
    level: monsterLevel,
  });
  applyMapModifiers(entity);
  return entity;
}
