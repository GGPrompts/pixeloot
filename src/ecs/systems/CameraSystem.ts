import { world } from '../world';
import { game } from '../../Game';

const SCREEN_W = 1280;
const SCREEN_H = 720;

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
    // When the map is larger than the screen, uncomment:
    // game.worldLayer.position.set(
    //   SCREEN_W / 2 - entity.position.x + offsetX,
    //   SCREEN_H / 2 - entity.position.y + offsetY,
    // );
    // game.entityLayer.position.set(
    //   SCREEN_W / 2 - entity.position.x + offsetX,
    //   SCREEN_H / 2 - entity.position.y + offsetY,
    // );

    // For now, keep layers at origin but apply shake offset
    game.worldLayer.position.set(offsetX, offsetY);
    game.entityLayer.position.set(offsetX, offsetY);
    game.effectLayer.position.set(offsetX, offsetY);

    void entity;
    void SCREEN_W;
    void SCREEN_H;
    break; // Only follow the first player
  }
}
