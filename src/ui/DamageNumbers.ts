import { Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { Fonts, FontSize } from './UITheme';

const RISE_PX = 40;
const DURATION_MS = 800;

/**
 * Spawns a floating damage number at the given world position.
 * Rises 40px over 0.8s, fades out, then self-removes from effectLayer.
 */
/**
 * Spawns a floating text message at the given screen position (hudLayer).
 * Rises and fades out over 1.2s.
 */
export function spawnFloatingText(
  screenX: number,
  screenY: number,
  message: string,
  color: number = 0xff4444,
): void {
  const text = new Text({
    text: message,
    style: new TextStyle({
      fill: color,
      fontSize: FontSize.base,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 3 },
    }),
  });

  text.anchor.set(0.5, 0.5);
  text.position.set(screenX, screenY);
  game.hudLayer.addChild(text);

  const startY = screenY;
  const start = performance.now();
  const duration = 1200;

  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / duration, 1);
    text.position.y = startY - 30 * t;
    text.alpha = 1 - t * t;
    if (t >= 1) {
      text.removeFromParent();
      text.destroy();
    } else {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}

export function spawnDamageNumber(
  x: number,
  y: number,
  amount: number,
  color: number = 0xff3333,
): void {
  const text = new Text({
    text: `-${amount}`,
    style: new TextStyle({
      fill: color,
      fontSize: FontSize.lg,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2 },
    }),
  });

  text.anchor.set(0.5, 0.5);
  text.position.set(x, y);
  game.effectLayer.addChild(text);

  const startY = y;
  const start = performance.now();

  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / DURATION_MS, 1);

    text.position.y = startY - RISE_PX * t;
    text.alpha = 1 - t;

    if (t >= 1) {
      text.removeFromParent();
      text.destroy();
    } else {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}
