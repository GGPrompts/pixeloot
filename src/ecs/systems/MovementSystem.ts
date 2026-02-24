import { world } from '../world';
import { InputManager } from '../../core/InputManager';

const SCREEN_W = 1280;
const SCREEN_H = 720;
const MARGIN = 12;

const allMovers = world.with('position', 'velocity');
const players = world.with('position', 'velocity', 'speed', 'player');

/**
 * Movement system: reads input for player entities, applies velocity to position,
 * and clamps to screen bounds.
 *
 * Called from fixedUpdate at 60 Hz.
 */
export function movementSystem(dt: number): void {
  const input = InputManager.instance;
  const move = input.getMovementVector();

  // Set velocity on player entities based on input
  for (const entity of players) {
    if (entity.inputDisabled) {
      entity.velocity.x = 0;
      entity.velocity.y = 0;
    } else {
      entity.velocity.x = move.x * entity.speed;
      entity.velocity.y = move.y * entity.speed;
    }
  }

  // Apply velocity to position for all movers
  for (const entity of allMovers) {
    entity.position.x += entity.velocity.x * dt;
    entity.position.y += entity.velocity.y * dt;

    // Clamp non-projectile entities to screen bounds
    if (!entity.projectile) {
      entity.position.x = Math.max(MARGIN, Math.min(SCREEN_W - MARGIN, entity.position.x));
      entity.position.y = Math.max(MARGIN, Math.min(SCREEN_H - MARGIN, entity.position.y));
    }
  }
}
