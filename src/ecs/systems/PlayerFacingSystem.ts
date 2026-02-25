import { world } from '../world';
import { InputManager } from '../../core/InputManager';
import { screenToWorld } from '../../Game';
import { isInTown } from '../../core/TownManager';

const playerSprites = world.with('position', 'sprite', 'player');

/** Track current town scale so we preserve it when flipping. */
const TOWN_SCALE = 1.5;

/**
 * Faces the player sprite toward the mouse cursor.
 * Uses horizontal flip (scale.x) instead of rotation to keep the 2D pixel art upright.
 */
export function playerFacingSystem(): void {
  const mouse = InputManager.instance.getMousePosition();
  const worldMouse = screenToWorld(mouse.x, mouse.y);

  for (const entity of playerSprites) {
    const dx = worldMouse.x - entity.position.x;
    const baseScale = isInTown() ? TOWN_SCALE : 1;
    // Flip horizontally when mouse is to the left
    entity.sprite.scale.x = dx < 0 ? -baseScale : baseScale;
    // No rotation — keep sprite upright
    entity.sprite.rotation = 0;
  }
}
