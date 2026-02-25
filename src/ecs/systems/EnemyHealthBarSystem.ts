import { Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../world';
import { Fonts, FontSize } from '../../ui/UITheme';

const BAR_W = 24;
const BAR_H = 3;
const BAR_OFFSET_Y = -14; // above the enemy sprite

const LEVEL_STYLE = new TextStyle({
  fill: 0xcccccc,
  fontSize: FontSize.xs,
  fontFamily: Fonts.body,
  stroke: { color: 0x000000, width: 2 },
});

const enemies = world.with('enemy', 'health', 'sprite');

/** Cache for level text children keyed by entity reference. */
const levelTexts = new WeakMap<object, Text>();

/**
 * Renders small health bars above each enemy that has taken damage.
 * Shows "Lv.X" next to the health bar when the enemy is damaged.
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
      const lvText = levelTexts.get(enemy);
      if (lvText) lvText.visible = false;
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

    // Counter-rotate so the bar stays horizontal regardless of sprite rotation
    bar.rotation = -enemy.sprite.rotation;

    // Background
    bar.rect(-BAR_W / 2, BAR_OFFSET_Y, BAR_W, BAR_H).fill({ color: 0x333333 });

    // Fill
    bar.rect(-BAR_W / 2, BAR_OFFSET_Y, BAR_W * Math.max(0, ratio), BAR_H).fill({
      color: 0xdd3333,
    });

    // Level text
    const monsterLevel = enemy.level ?? 1;
    let lvText = levelTexts.get(enemy);
    if (!lvText) {
      lvText = new Text({ text: `Lv.${monsterLevel}`, style: LEVEL_STYLE });
      lvText.anchor.set(0, 0.5);
      enemy.sprite.addChild(lvText);
      levelTexts.set(enemy, lvText);
    }
    lvText.text = `Lv.${monsterLevel}`;
    lvText.position.set(BAR_W / 2 + 2, BAR_OFFSET_Y + BAR_H / 2);
    lvText.visible = true;
    // Counter-rotate so level text stays horizontal
    lvText.rotation = -enemy.sprite.rotation;
  }
}
