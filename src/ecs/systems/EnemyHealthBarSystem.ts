import { Graphics } from 'pixi.js';
import { world } from '../world';

const BAR_W = 24;
const BAR_H = 3;
const BAR_OFFSET_Y = -14; // above the enemy sprite

const enemies = world.with('enemy', 'health', 'sprite');

/**
 * Renders small health bars above each enemy that has taken damage.
 * Creates a Graphics child on first damage, then updates width each frame.
 * Called from frameUpdate.
 */
export function enemyHealthBarSystem(): void {
  for (const enemy of enemies) {
    const ratio = enemy.health.current / enemy.health.max;

    // Only show bar when damaged
    if (ratio >= 1) {
      if (enemy.enemyHealthBar) {
        enemy.enemyHealthBar.visible = false;
      }
      continue;
    }

    // Create health bar graphics if not yet created
    if (!enemy.enemyHealthBar) {
      const bar = new Graphics();
      enemy.sprite.addChild(bar);
      world.addComponent(enemy, 'enemyHealthBar', bar);
    }

    const bar = enemy.enemyHealthBar!;
    bar.visible = true;
    bar.clear();

    // Background
    bar.rect(-BAR_W / 2, BAR_OFFSET_Y, BAR_W, BAR_H).fill({ color: 0x333333 });

    // Fill
    bar.rect(-BAR_W / 2, BAR_OFFSET_Y, BAR_W * Math.max(0, ratio), BAR_H).fill({
      color: 0xdd3333,
    });
  }
}
