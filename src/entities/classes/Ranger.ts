import { Graphics } from 'pixi.js';
import type { SkillDef } from '../../core/SkillSystem';
import { fireProjectile } from '../Projectile';
import { world } from '../../ecs/world';
import { game } from '../../Game';
import { spawnDamageNumber } from '../../ui/DamageNumbers';
import { spawnDeathParticles } from '../DeathParticles';

const players = world.with('position', 'velocity', 'speed', 'player');
const enemies = world.with('enemy', 'position', 'health');

// ---------------------------------------------------------------------------
// Skill 1 - Power Shot (cooldown 3s)
// Large, fast, piercing projectile
// ---------------------------------------------------------------------------
const powerShot: SkillDef = {
  name: 'Power Shot',
  key: '1',
  cooldown: 3,
  execute(playerPos, mousePos) {
    fireProjectile(playerPos.x, playerPos.y, mousePos.x, mousePos.y, {
      speed: 800,
      damage: 40,
      radius: 8,
      color: 0xffff00,
      piercing: true,
      lifetime: 3,
    });
  },
};

// ---------------------------------------------------------------------------
// Skill 2 - Multi Shot (cooldown 5s)
// Fan of 5 arrows in a ~30-degree spread
// ---------------------------------------------------------------------------
const MULTI_SHOT_COUNT = 5;
const MULTI_SHOT_SPREAD = (30 * Math.PI) / 180; // 30 degrees total spread

const multiShot: SkillDef = {
  name: 'Multi Shot',
  key: '2',
  cooldown: 5,
  execute(playerPos, mousePos) {
    const dx = mousePos.x - playerPos.x;
    const dy = mousePos.y - playerPos.y;
    const baseAngle = Math.atan2(dy, dx);
    const halfSpread = MULTI_SHOT_SPREAD / 2;
    const step = MULTI_SHOT_COUNT > 1 ? MULTI_SHOT_SPREAD / (MULTI_SHOT_COUNT - 1) : 0;

    for (let i = 0; i < MULTI_SHOT_COUNT; i++) {
      const angle = baseAngle - halfSpread + step * i;
      // Target far away along that angle
      const targetX = playerPos.x + Math.cos(angle) * 500;
      const targetY = playerPos.y + Math.sin(angle) * 500;
      fireProjectile(playerPos.x, playerPos.y, targetX, targetY);
    }
  },
};

// ---------------------------------------------------------------------------
// Skill 3 - Rain of Arrows (cooldown 8s)
// AoE at mouse position after 0.5s delay, 96px radius, 25 damage
// ---------------------------------------------------------------------------
const RAIN_RADIUS = 96;
const RAIN_DELAY = 0.5;
const RAIN_DAMAGE = 25;

const rainOfArrows: SkillDef = {
  name: 'Rain of Arrows',
  key: '3',
  cooldown: 8,
  execute(_playerPos, mousePos) {
    const tx = mousePos.x;
    const ty = mousePos.y;

    // Draw targeting circle on effect layer
    const circle = new Graphics();
    circle.circle(0, 0, RAIN_RADIUS).stroke({ width: 2, color: 0xff8800, alpha: 0.6 });
    circle.circle(0, 0, RAIN_RADIUS).fill({ color: 0xff8800, alpha: 0.15 });
    circle.position.set(tx, ty);
    game.effectLayer.addChild(circle);

    // Animate the circle pulsing until detonation
    let elapsed = 0;
    const onTick = (t: { deltaTime: number }) => {
      elapsed += t.deltaTime / 60;
      circle.alpha = 0.5 + 0.5 * Math.sin(elapsed * 12);

      if (elapsed >= RAIN_DELAY) {
        game.app.ticker.remove(onTick);

        // Deal damage to all enemies in radius
        for (const enemy of enemies) {
          const edx = enemy.position.x - tx;
          const edy = enemy.position.y - ty;
          const distSq = edx * edx + edy * edy;

          if (distSq < RAIN_RADIUS * RAIN_RADIUS) {
            enemy.health.current -= RAIN_DAMAGE;
            spawnDamageNumber(enemy.position.x, enemy.position.y - 10, RAIN_DAMAGE, 0xff8800);

            // Flash effect
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

        // Impact flash
        const impact = new Graphics();
        impact.circle(0, 0, RAIN_RADIUS).fill({ color: 0xff8800, alpha: 0.4 });
        impact.position.set(tx, ty);
        game.effectLayer.addChild(impact);

        // Fade and remove both
        let fadeTime = 0;
        const onFade = (ft: { deltaTime: number }) => {
          fadeTime += ft.deltaTime / 60;
          impact.alpha = Math.max(0, 0.4 - fadeTime * 2);
          circle.alpha = Math.max(0, 1 - fadeTime * 4);
          if (fadeTime >= 0.3) {
            game.app.ticker.remove(onFade);
            impact.removeFromParent();
            impact.destroy();
            circle.removeFromParent();
            circle.destroy();
          }
        };
        game.app.ticker.add(onFade);
      }
    };
    game.app.ticker.add(onTick);
  },
};

// ---------------------------------------------------------------------------
// Skill 4 - Evasive Roll (cooldown 4s)
// Dash ~200px in movement direction (or toward mouse), brief invulnerability
// ---------------------------------------------------------------------------
const ROLL_DISTANCE = 200;
const ROLL_INVULN = 0.3;

const evasiveRoll: SkillDef = {
  name: 'Evasive Roll',
  key: '4',
  cooldown: 4,
  execute(playerPos, mousePos) {
    if (players.entities.length === 0) return;
    const player = players.entities[0];

    // Direction: use movement velocity if moving, otherwise toward mouse
    let dirX: number;
    let dirY: number;

    if (
      player.velocity.x !== 0 ||
      player.velocity.y !== 0
    ) {
      dirX = player.velocity.x;
      dirY = player.velocity.y;
    } else {
      dirX = mousePos.x - playerPos.x;
      dirY = mousePos.y - playerPos.y;
    }

    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len === 0) return;

    const nx = dirX / len;
    const ny = dirY / len;

    // Teleport player
    const newX = playerPos.x + nx * ROLL_DISTANCE;
    const newY = playerPos.y + ny * ROLL_DISTANCE;

    // Clamp to non-solid tile (step along the direction and find last valid position)
    const steps = 10;
    let finalX = playerPos.x;
    let finalY = playerPos.y;
    for (let i = 1; i <= steps; i++) {
      const testX = playerPos.x + (nx * ROLL_DISTANCE * i) / steps;
      const testY = playerPos.y + (ny * ROLL_DISTANCE * i) / steps;
      const tile = game.tileMap.worldToTile(testX, testY);
      if (game.tileMap.isSolid(tile.x, tile.y)) break;
      finalX = testX;
      finalY = testY;
    }

    player.position.x = finalX;
    player.position.y = finalY;

    // Grant invulnerability
    world.addComponent(player, 'invulnTimer', ROLL_INVULN);
  },
};

// ---------------------------------------------------------------------------
// Export all Ranger skills
// ---------------------------------------------------------------------------
export const rangerSkills: SkillDef[] = [powerShot, multiShot, rainOfArrows, evasiveRoll];
