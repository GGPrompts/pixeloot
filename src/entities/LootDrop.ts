import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { BaseItem, Rarity } from '../loot/ItemTypes';
import { RARITY_COLORS, Fonts, FontSize } from '../ui/UITheme';

/**
 * Spawn an item drop entity at the given position.
 * Draws a small diamond shape colored by rarity with a pulsing glow.
 */
export function spawnItemDrop(x: number, y: number, item: BaseItem): void {
  const color = RARITY_COLORS[item.rarity] ?? 0xcccccc;

  const g = new Graphics();
  // Diamond shape
  g.moveTo(0, -6);
  g.lineTo(5, 0);
  g.lineTo(0, 6);
  g.lineTo(-5, 0);
  g.closePath();
  g.fill({ color });
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.5 });

  g.position.set(x, y);
  game.entityLayer.addChild(g);

  // Pulsing glow animation
  const start = performance.now();
  const pulse = () => {
    // If the graphics was removed from the scene, stop pulsing
    if (!g.parent) return;
    const elapsed = (performance.now() - start) / 1000;
    g.alpha = 0.7 + 0.3 * Math.sin(elapsed * 3);
    requestAnimationFrame(pulse);
  };
  requestAnimationFrame(pulse);

  world.add({
    position: { x, y },
    sprite: g,
    lootDrop: { item },
    pickup: true,
  });
}

/**
 * Spawn a gold drop entity at the given position.
 * Draws a small yellow circle with the gold amount as text.
 */
export function spawnGoldDrop(x: number, y: number, amount: number): void {
  const container = new Container();

  const g = new Graphics();
  g.circle(0, 0, 4);
  g.fill({ color: 0xffd700 });
  container.addChild(g);

  const label = new Text({
    text: `${amount}`,
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2 },
    }),
  });
  label.anchor.set(0.5, 1);
  label.position.set(0, -6);
  container.addChild(label);

  container.position.set(x, y);
  game.entityLayer.addChild(container);

  world.add({
    position: { x, y },
    sprite: container,
    goldDrop: amount,
    pickup: true,
  });
}
