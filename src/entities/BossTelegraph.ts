import { Graphics } from 'pixi.js';
import { game } from '../Game';

const TELEGRAPH_DURATION = 0.75; // seconds before attack lands
const TELEGRAPH_RADIUS = 48;

/**
 * Shows a pulsing red warning circle on the ground before a boss attack.
 * The circle grows and pulses for the duration, then fades out.
 * Returns a promise that resolves when the telegraph finishes (attack should land).
 */
export function spawnBossTelegraph(
  x: number,
  y: number,
  radius: number = TELEGRAPH_RADIUS,
  duration: number = TELEGRAPH_DURATION,
): Promise<void> {
  return new Promise((resolve) => {
    const g = new Graphics();
    g.position.set(x, y);
    game.effectLayer.addChild(g);

    let elapsed = 0;
    let resolved = false;

    const onTick = (t: { deltaTime: number }) => {
      elapsed += t.deltaTime / 60;
      const progress = Math.min(elapsed / duration, 1);

      g.clear();

      // Growing fill
      const currentRadius = radius * (0.3 + 0.7 * progress);
      const pulseAlpha = 0.1 + 0.15 * Math.sin(elapsed * 14);
      g.circle(0, 0, currentRadius).fill({ color: 0xff2200, alpha: pulseAlpha });

      // Pulsing outer ring
      const ringAlpha = 0.4 + 0.4 * Math.sin(elapsed * 14);
      g.circle(0, 0, currentRadius).stroke({
        width: 2,
        color: 0xff4400,
        alpha: ringAlpha,
      });

      // Inner crosshair at higher progress
      if (progress > 0.5) {
        g.circle(0, 0, currentRadius * 0.3).fill({
          color: 0xff0000,
          alpha: 0.2 * progress,
        });
      }

      if (progress >= 1) {
        if (!resolved) {
          resolved = true;
          resolve();
        }
        // Quick fade out over 0.2s
        const fadeElapsed = elapsed - duration;
        const fadeT = Math.min(fadeElapsed / 0.2, 1);

        g.clear();
        g.circle(0, 0, radius).fill({ color: 0xff4400, alpha: 0.3 * (1 - fadeT) });

        if (fadeT >= 1) {
          game.app.ticker.remove(onTick);
          g.removeFromParent();
          g.destroy();
        }
      }
    };

    game.app.ticker.add(onTick);
  });
}
