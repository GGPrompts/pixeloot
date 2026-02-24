import { world } from '../world';
import { game } from '../../Game';
import { SCREEN_W, SCREEN_H } from '../../core/constants';

const players = world.with('position', 'player');

// ── Screen Shake State ──────────────────────────────────────────────
let shakeDuration = 0;
let shakeTotalDuration = 0;
let shakeMagnitude = 0;

/**
 * Triggers a screen shake effect.
 * @param duration  How long the shake lasts in seconds.
 * @param magnitude Maximum pixel offset during the shake.
 */
export function shake(duration: number, magnitude: number): void {
  // If a stronger shake is requested, override; otherwise extend
  if (magnitude >= shakeMagnitude || shakeDuration <= 0) {
    shakeDuration = duration;
    shakeTotalDuration = duration;
    shakeMagnitude = magnitude;
  }
}

/**
 * Offsets the world layer to keep the player centered.
 * Also applies screen shake offset that decays over time.
 *
 * Called every render frame.
 */
export function cameraSystem(): void {
  let offsetX = 0;
  let offsetY = 0;

  // Calculate shake offset
  if (shakeDuration > 0) {
    const dt = 1 / 60; // approximate frame time
    shakeDuration -= dt;

    if (shakeDuration > 0) {
      const decay = shakeDuration / shakeTotalDuration;
      offsetX = (Math.random() * 2 - 1) * shakeMagnitude * decay;
      offsetY = (Math.random() * 2 - 1) * shakeMagnitude * decay;
    } else {
      shakeDuration = 0;
    }
  }

  for (const entity of players) {
    const camX = SCREEN_W / 2 - entity.position.x + offsetX;
    const camY = SCREEN_H / 2 - entity.position.y + offsetY;

    game.worldLayer.position.set(camX, camY);
    game.entityLayer.position.set(camX, camY);
    game.effectLayer.position.set(camX, camY);

    break; // Only follow the first player
  }
}
