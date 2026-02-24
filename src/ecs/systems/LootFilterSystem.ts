import { world } from '../world';
import { lootFilter } from '../../core/LootFilter';

const lootDrops = world.with('lootDrop', 'sprite');

/**
 * Applies the loot filter to all loot drop entities each frame.
 * Hidden items have their sprite hidden and pickup component removed
 * so they cannot be collected. When the filter changes and an item
 * should be shown again, sprite visibility and pickup are restored.
 */
export function lootFilterSystem(): void {
  for (const entity of lootDrops) {
    const shouldShow = lootFilter.shouldShowItem(entity.lootDrop.item);

    if (shouldShow) {
      // Ensure visible and pickable
      entity.sprite.visible = true;
      if (!entity.pickup) {
        world.addComponent(entity, 'pickup', true);
      }
    } else {
      // Hide and prevent pickup
      entity.sprite.visible = false;
      if (entity.pickup) {
        world.removeComponent(entity, 'pickup');
      }
    }
  }
}
