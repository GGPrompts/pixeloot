import { Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import type { MapItem } from '../loot/MapItem';
import { Colors, Fonts, FontSize } from '../ui/UITheme';

/** Tier colors for map drops */
const TIER_COLORS: Record<number, number> = {
  1: 0xBCBCBC,
  2: 0x4488FF,
  3: 0xFCBF00,
  4: 0xFF7700,
  5: Colors.accentRed,
};

/**
 * Spawn a map item drop on the ground.
 * Draws a scroll/map icon colored by tier.
 */
export function spawnMapDrop(x: number, y: number, mapItem: MapItem): void {
  const color = TIER_COLORS[mapItem.tier] ?? 0xcccccc;

  const g = new Graphics();
  // Draw a small scroll/rectangle shape
  g.roundRect(-6, -8, 12, 16, 2);
  g.fill({ color, alpha: 0.9 });
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.6 });

  // Horizontal lines to suggest text on a scroll
  g.moveTo(-3, -4).lineTo(3, -4).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
  g.moveTo(-3, 0).lineTo(3, 0).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
  g.moveTo(-3, 4).lineTo(3, 4).stroke({ width: 1, color: 0x000000, alpha: 0.4 });

  // Tier label
  const label = new Text({
    text: `T${mapItem.tier}`,
    style: new TextStyle({
      fill: color,
      fontSize: FontSize.xs,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2 },
    }),
  });
  label.anchor.set(0.5, 1);
  label.position.set(0, -10);
  g.addChild(label);

  g.position.set(x, y);
  game.entityLayer.addChild(g);

  // Pulsing animation
  const start = performance.now();
  const pulse = () => {
    if (!g.parent) return;
    const elapsed = (performance.now() - start) / 1000;
    g.alpha = 0.7 + 0.3 * Math.sin(elapsed * 3);
    requestAnimationFrame(pulse);
  };
  requestAnimationFrame(pulse);

  world.add({
    position: { x, y },
    sprite: g,
    mapDrop: { mapItem },
    pickup: true,
  });
}
