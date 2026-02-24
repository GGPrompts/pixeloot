import { Graphics } from 'pixi.js';
import { game } from '../Game';

const PARTICLE_RADIUS = 1.5;
const PARTICLE_DURATION = 400; // ms

/**
 * Spawns a single ambient particle for burn status effect.
 * Small orange/red particle rises upward from entity position.
 */
export function spawnBurnParticle(x: number, y: number): void {
  const g = new Graphics();
  const color = Math.random() > 0.5 ? 0xff6600 : 0xff3300;
  g.circle(0, 0, PARTICLE_RADIUS).fill({ color });
  g.position.set(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 6);
  game.effectLayer.addChild(g);

  const vx = (Math.random() - 0.5) * 20;
  const vy = -(30 + Math.random() * 20); // rise upward
  const start = performance.now();

  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / PARTICLE_DURATION, 1);
    g.position.x += vx * (1 / 60);
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

/**
 * Spawns a single ambient particle for chill/slow status effect.
 * Small blue/white particle drifts downward.
 */
export function spawnChillParticle(x: number, y: number): void {
  const g = new Graphics();
  const color = Math.random() > 0.5 ? 0x66ccff : 0xccddff;
  g.circle(0, 0, PARTICLE_RADIUS).fill({ color });
  g.position.set(x + (Math.random() - 0.5) * 14, y - 8);
  game.effectLayer.addChild(g);

  const vx = (Math.random() - 0.5) * 15;
  const vy = 15 + Math.random() * 10; // drift downward
  const start = performance.now();

  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / PARTICLE_DURATION, 1);
    g.position.x += vx * (1 / 60);
    g.position.y += vy * (1 / 60);
    g.alpha = 0.8 * (1 - t);

    if (t >= 1) {
      g.removeFromParent();
      g.destroy();
    } else {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}

/**
 * Spawns a quick yellow spark flash for shock status effect.
 * Very short-lived (200ms), random jitter around position.
 */
export function spawnShockParticle(x: number, y: number): void {
  const g = new Graphics();
  g.circle(0, 0, PARTICLE_RADIUS + 0.5).fill({ color: 0xffff44 });
  const offsetX = (Math.random() - 0.5) * 16;
  const offsetY = (Math.random() - 0.5) * 16;
  g.position.set(x + offsetX, y + offsetY);
  game.effectLayer.addChild(g);

  const start = performance.now();
  const duration = 150 + Math.random() * 100;

  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / duration, 1);
    // Flicker effect
    g.alpha = t < 0.5 ? 1 : (1 - t) * 2;

    if (t >= 1) {
      g.removeFromParent();
      g.destroy();
    } else {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}
