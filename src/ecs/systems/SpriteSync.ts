import { world } from '../world';

const spriteEntities = world.with('position', 'sprite');

/**
 * Syncs ECS position data to PixiJS sprite positions.
 * Called every render frame.
 */
export function spriteSyncSystem(): void {
  for (const entity of spriteEntities) {
    entity.sprite.position.set(entity.position.x, entity.position.y);
  }
}
