import { Graphics } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';
import { scaleHealth, scaleDamage } from '../core/MonsterScaling';
import { getBossDesign, GENERIC_BOSS, type BossDesign } from './BossRegistry';

const BOSS_BASE_HP = 500;
const BOSS_BASE_DAMAGE = 25;

/**
 * Spawns a boss enemy. If a bossType ID is provided the boss uses that
 * design's colors, radius, HP/damage multipliers, and speed. Falls back
 * to the generic boss design when the ID is unknown or omitted.
 */
export function spawnBoss(worldX: number, worldY: number, level = 1, bossType?: string): Entity {
  const design: BossDesign = (bossType ? getBossDesign(bossType) : undefined) ?? GENERIC_BOSS;

  const radius = design.radius;
  const primaryColor = design.primaryColor;
  const accentColor = design.accentColor;
  const speed = design.baseSpeed;

  const g = new Graphics();

  // Multi-color glow border (drawn first, behind the fill)
  const glowColors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0xff00ff];
  for (let ring = 3; ring >= 1; ring--) {
    const r = radius + ring * 3;
    const color = design.id === 'generic' ? glowColors[ring % glowColors.length] : accentColor;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) {
        g.moveTo(px, py);
      } else {
        g.lineTo(px, py);
      }
    }
    g.closePath();
    g.stroke({ width: 2, color, alpha: 0.5 });
  }

  // Main hexagonal body
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) {
      g.moveTo(px, py);
    } else {
      g.lineTo(px, py);
    }
  }
  g.closePath();
  g.fill({ color: primaryColor });
  g.stroke({ width: 2, color: accentColor });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(Math.round(BOSS_BASE_HP * design.hpMultiplier), level);
  const dmg = scaleDamage(Math.round(BOSS_BASE_DAMAGE * design.damageMultiplier), level);

  return world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed,
    baseSpeed: speed,
    enemy: true as const,
    boss: true as const,
    bossPhase: 1,
    bossType: design.id,
    enemyType: 'boss',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    level,
    aiTimer: 0,
    aiState: 'chase',
  });
}
