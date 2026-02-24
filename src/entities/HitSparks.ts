import { Graphics } from 'pixi.js';
import { game } from '../Game';

const SPARK_COUNT = 4;
const SPARK_RADIUS = 2;
const SPARK_SPEED = 120;
const SPARK_DURATION = 250; // ms

/** Damage-type color map. */
export const SPARK_COLORS: Record<string, number> = {
  physical: 0xffffff,
  fire: 0xff8800,
  ice: 0x66ccff,
  lightning: 0xffff44,
};

/**
 * Spawns a small burst of colored sparks at the given position.
 * Uses game.effectLayer; sparks self-remove after ~250ms.
 */
export function spawnHitSparks(
  x: number,
  y: number,
  damageType: string = 'physical',
): void {
  const color = SPARK_COLORS[damageType] ?? SPARK_COLORS.physical;

  for (let i = 0; i < SPARK_COUNT; i++) {
    const g = new Graphics();
    g.circle(0, 0, SPARK_RADIUS).fill({ color });
    g.position.set(x, y);
    game.effectLayer.addChild(g);

    const angle =
      (Math.PI * 2 * i) / SPARK_COUNT + (Math.random() - 0.5) * 1.0;
    const speed = SPARK_SPEED * (0.6 + Math.random() * 0.4);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / SPARK_DURATION, 1);

      g.position.x += vx * (1 / 60);
      g.position.y += vy * (1 / 60);
      g.alpha = 1 - t;
      g.scale.set(1 - t * 0.5); // shrink as they fade

      if (t >= 1) {
        g.removeFromParent();
        g.destroy();
      } else {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }
}
