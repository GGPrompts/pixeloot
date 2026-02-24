import { world } from '../world';
import { InputManager } from '../../core/InputManager';
import { screenToWorld } from '../../Game';

const playerSprites = world.with('position', 'sprite', 'player');

/**
 * Rotates the player sprite to face the mouse cursor.
 * Called every render frame.
 */
export function playerFacingSystem(): void {
  const mouse = InputManager.instance.getMousePosition();
  const worldMouse = screenToWorld(mouse.x, mouse.y);

  for (const entity of playerSprites) {
    const dx = worldMouse.x - entity.position.x;
    const dy = worldMouse.y - entity.position.y;
    entity.sprite.rotation = Math.atan2(dy, dx);
  }
}
