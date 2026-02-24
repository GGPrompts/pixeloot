import { Graphics } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';
import { scaleHealth, scaleDamage } from '../core/MonsterScaling';

const BOSS_BASE_HP = 500;
const BOSS_BASE_DAMAGE = 25;
const BOSS_SPEED = 60;
const BOSS_RADIUS = 40;

/**
 * Spawns a boss enemy: a large white hexagon with a multi-color glow border.
 */
export function spawnBoss(worldX: number, worldY: number, level = 1): Entity {
  const g = new Graphics();

  // Multi-color glow border (drawn first, behind the fill)
  const glowColors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0xff00ff];
  for (let ring = 3; ring >= 1; ring--) {
    const r = BOSS_RADIUS + ring * 3;
    const color = glowColors[ring % glowColors.length];
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
    const px = Math.cos(angle) * BOSS_RADIUS;
    const py = Math.sin(angle) * BOSS_RADIUS;
    if (i === 0) {
      g.moveTo(px, py);
    } else {
      g.lineTo(px, py);
    }
  }
  g.closePath();
  g.fill({ color: 0xffffff });
  g.stroke({ width: 2, color: 0xcccccc });

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(BOSS_BASE_HP, level);
  const dmg = scaleDamage(BOSS_BASE_DAMAGE, level);

  return world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed: BOSS_SPEED,
    baseSpeed: BOSS_SPEED,
    enemy: true as const,
    boss: true as const,
    bossPhase: 1,
    enemyType: 'boss',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    level,
    aiTimer: 0,
    aiState: 'chase',
  });
}
