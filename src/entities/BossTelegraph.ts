import { Graphics } from 'pixi.js';
import { game } from '../Game';

const TELEGRAPH_DURATION = 0.75; // seconds before attack lands
const TELEGRAPH_RADIUS = 48;

export type TelegraphShape = 'circle_aoe' | 'line' | 'cone' | 'ring' | 'pulse' | 'none' | 'ground_marker' | 'screen_flash';

// ---------------------------------------------------------------------------
// Internal drawing helpers
// ---------------------------------------------------------------------------

function drawCircleTelegraph(g: Graphics, radius: number, progress: number, elapsed: number): void {
  const currentRadius = radius * (0.3 + 0.7 * progress);
  const pulseAlpha = 0.1 + 0.15 * Math.sin(elapsed * 14);
  g.circle(0, 0, currentRadius).fill({ color: 0xff2200, alpha: pulseAlpha });

  const ringAlpha = 0.4 + 0.4 * Math.sin(elapsed * 14);
  g.circle(0, 0, currentRadius).stroke({ width: 2, color: 0xff4400, alpha: ringAlpha });

  if (progress > 0.5) {
    g.circle(0, 0, currentRadius * 0.3).fill({ color: 0xff0000, alpha: 0.2 * progress });
  }
}

function drawConeTelegraph(g: Graphics, radius: number, progress: number, elapsed: number, angle: number): void {
  const coneHalf = Math.PI / 5; // ~36 degree half-angle
  const currentRadius = radius * (0.3 + 0.7 * progress);
  const pulseAlpha = 0.12 + 0.12 * Math.sin(elapsed * 14);

  g.moveTo(0, 0);
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const a = angle - coneHalf + (coneHalf * 2 * i) / steps;
    g.lineTo(Math.cos(a) * currentRadius, Math.sin(a) * currentRadius);
  }
  g.closePath();
  g.fill({ color: 0xff4400, alpha: pulseAlpha });

  const ringAlpha = 0.3 + 0.3 * Math.sin(elapsed * 14);
  g.moveTo(0, 0);
  for (let i = 0; i <= steps; i++) {
    const a = angle - coneHalf + (coneHalf * 2 * i) / steps;
    g.lineTo(Math.cos(a) * currentRadius, Math.sin(a) * currentRadius);
  }
  g.closePath();
  g.stroke({ width: 2, color: 0xff6600, alpha: ringAlpha });
}

function drawLineTelegraph(g: Graphics, radius: number, progress: number, elapsed: number, angle: number): void {
  const length = radius * (0.3 + 0.7 * progress);
  const width = 16;
  const pulseAlpha = 0.1 + 0.15 * Math.sin(elapsed * 14);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const perpX = -sin * width * 0.5;
  const perpY = cos * width * 0.5;

  g.moveTo(perpX, perpY);
  g.lineTo(cos * length + perpX, sin * length + perpY);
  g.lineTo(cos * length - perpX, sin * length - perpY);
  g.lineTo(-perpX, -perpY);
  g.closePath();
  g.fill({ color: 0xff2200, alpha: pulseAlpha });

  const ringAlpha = 0.4 + 0.3 * Math.sin(elapsed * 14);
  g.moveTo(perpX, perpY);
  g.lineTo(cos * length + perpX, sin * length + perpY);
  g.lineTo(cos * length - perpX, sin * length - perpY);
  g.lineTo(-perpX, -perpY);
  g.closePath();
  g.stroke({ width: 2, color: 0xff4400, alpha: ringAlpha });
}

function drawRingTelegraph(g: Graphics, radius: number, progress: number, elapsed: number): void {
  const innerRadius = radius * 0.6 * (0.3 + 0.7 * progress);
  const outerRadius = radius * (0.3 + 0.7 * progress);
  const pulseAlpha = 0.1 + 0.12 * Math.sin(elapsed * 14);

  // Outer circle
  g.circle(0, 0, outerRadius).fill({ color: 0xff2200, alpha: pulseAlpha });
  // Inner clear zone
  g.circle(0, 0, innerRadius).fill({ color: 0x000000, alpha: pulseAlpha * 1.5 });

  const ringAlpha = 0.4 + 0.3 * Math.sin(elapsed * 14);
  g.circle(0, 0, outerRadius).stroke({ width: 2, color: 0xff4400, alpha: ringAlpha });
  g.circle(0, 0, innerRadius).stroke({ width: 1.5, color: 0xff6600, alpha: ringAlpha * 0.8 });
}

function drawPulseTelegraph(g: Graphics, radius: number, progress: number, elapsed: number): void {
  // Expanding concentric rings
  const waves = 3;
  for (let i = 0; i < waves; i++) {
    const waveProgress = ((progress + i / waves) % 1);
    const r = radius * waveProgress;
    const alpha = 0.3 * (1 - waveProgress) * (0.7 + 0.3 * Math.sin(elapsed * 10));
    g.circle(0, 0, r).stroke({ width: 2, color: 0xff4400, alpha });
  }
  // Center dot
  g.circle(0, 0, 4).fill({ color: 0xff2200, alpha: 0.4 + 0.2 * Math.sin(elapsed * 14) });
}

function drawGroundMarker(g: Graphics, radius: number, progress: number, elapsed: number): void {
  // Similar to circle but with crosshair markers
  const currentRadius = radius * (0.3 + 0.7 * progress);
  const pulseAlpha = 0.08 + 0.1 * Math.sin(elapsed * 14);
  g.circle(0, 0, currentRadius).fill({ color: 0xffaa00, alpha: pulseAlpha });

  const ringAlpha = 0.4 + 0.3 * Math.sin(elapsed * 14);
  g.circle(0, 0, currentRadius).stroke({ width: 2, color: 0xffcc00, alpha: ringAlpha });

  // Cross markers
  const lineLen = currentRadius * 0.4;
  const lineAlpha = 0.5 * progress;
  g.moveTo(-lineLen, 0).lineTo(lineLen, 0).stroke({ width: 1, color: 0xffcc00, alpha: lineAlpha });
  g.moveTo(0, -lineLen).lineTo(0, lineLen).stroke({ width: 1, color: 0xffcc00, alpha: lineAlpha });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Shows a telegraphed warning before a boss attack.
 * Supports multiple shape types: circle_aoe, cone, line, ring, pulse, ground_marker.
 * Returns a promise that resolves when the telegraph finishes (attack should land).
 *
 * @param x       World X position
 * @param y       World Y position
 * @param radius  Size of the telegraph area
 * @param duration Seconds of warning
 * @param shape   Telegraph shape type (defaults to 'circle_aoe')
 * @param angle   Direction angle in radians (for cone/line shapes)
 */
export function spawnBossTelegraph(
  x: number,
  y: number,
  radius: number = TELEGRAPH_RADIUS,
  duration: number = TELEGRAPH_DURATION,
  shape: TelegraphShape = 'circle_aoe',
  angle: number = 0,
): Promise<void> {
  // 'none' telegraph resolves immediately
  if (shape === 'none') return Promise.resolve();
  // 'screen_flash' is a brief full-screen flash, no positional marker
  if (shape === 'screen_flash') return spawnScreenFlash(duration);

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

      switch (shape) {
        case 'cone':
          drawConeTelegraph(g, radius, progress, elapsed, angle);
          break;
        case 'line':
          drawLineTelegraph(g, radius, progress, elapsed, angle);
          break;
        case 'ring':
          drawRingTelegraph(g, radius, progress, elapsed);
          break;
        case 'pulse':
          drawPulseTelegraph(g, radius, progress, elapsed);
          break;
        case 'ground_marker':
          drawGroundMarker(g, radius, progress, elapsed);
          break;
        case 'circle_aoe':
        default:
          drawCircleTelegraph(g, radius, progress, elapsed);
          break;
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

/**
 * Brief full-screen flash effect for screen_flash telegraph type.
 */
function spawnScreenFlash(duration: number): Promise<void> {
  return new Promise((resolve) => {
    const g = new Graphics();
    g.rect(0, 0, 1280, 720).fill({ color: 0xff2200, alpha: 0 });
    game.hudLayer.addChild(g);

    let elapsed = 0;
    let resolved = false;

    const onTick = (t: { deltaTime: number }) => {
      elapsed += t.deltaTime / 60;
      const progress = Math.min(elapsed / duration, 1);

      g.clear();
      const alpha = 0.15 * Math.sin(progress * Math.PI);
      g.rect(0, 0, 1280, 720).fill({ color: 0xff2200, alpha });

      if (progress >= 1) {
        if (!resolved) {
          resolved = true;
          resolve();
        }
        game.app.ticker.remove(onTick);
        g.removeFromParent();
        g.destroy();
      }
    };

    game.app.ticker.add(onTick);
  });
}
