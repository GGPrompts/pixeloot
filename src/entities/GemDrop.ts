import { Graphics } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { Gem, GEM_COLORS } from '../loot/Gems';

/**
 * Spawn a gem drop entity at the given position.
 * Draws a small hexagonal shape colored by gem type.
 */
export function spawnGemDrop(x: number, y: number, gem: Gem): void {
  const color = GEM_COLORS[gem.type] ?? 0xeeeeff;

  const g = new Graphics();
  // Hexagon shape
  const size = 5;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = Math.cos(angle) * size;
    const py = Math.sin(angle) * size;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill({ color });
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.6 });

  g.position.set(x, y);
  game.entityLayer.addChild(g);

  // Pulsing glow animation
  const start = performance.now();
  const pulse = () => {
    if (!g.parent) return;
    const elapsed = (performance.now() - start) / 1000;
    g.alpha = 0.7 + 0.3 * Math.sin(elapsed * 4);
    requestAnimationFrame(pulse);
  };
  requestAnimationFrame(pulse);

  world.add({
    position: { x, y },
    sprite: g,
    gemDrop: { gem },
    pickup: true,
  });
}
