import { Graphics } from 'pixi.js';
import { game } from '../Game';

const PARTICLE_COUNT = 6;
const PARTICLE_RADIUS = 3;
const PARTICLE_SPEED = 80;
const PARTICLE_DURATION = 500; // ms
const PARTICLE_COLOR = 0xff3333;

/**
 * Spawns a burst of small red circles at the given position that fly outward and fade.
 * Uses game.effectLayer; particles self-remove after ~500ms.
 */
export function spawnDeathParticles(x: number, y: number): void {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const g = new Graphics();
    g.circle(0, 0, PARTICLE_RADIUS).fill({ color: PARTICLE_COLOR });
    g.position.set(x, y);
    game.effectLayer.addChild(g);

    // Random outward direction
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
    const vx = Math.cos(angle) * PARTICLE_SPEED;
    const vy = Math.sin(angle) * PARTICLE_SPEED;

    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / PARTICLE_DURATION, 1);

      g.position.x += vx * (1 / 60); // approximate per-frame step
      g.position.y += vy * (1 / 60);
      g.alpha = 1 - t;

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
