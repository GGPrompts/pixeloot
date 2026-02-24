import { Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { Fonts } from './UITheme';

const RISE_PX = 40;
const DURATION_MS = 800;

/**
 * Spawns a floating damage number at the given world position.
 * Rises 40px over 0.8s, fades out, then self-removes from effectLayer.
 */
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
      fontSize: 22,
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
