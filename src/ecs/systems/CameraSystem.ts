import { world } from '../world';
import { game } from '../../Game';

const SCREEN_W = 1280;
const SCREEN_H = 720;

const players = world.with('position', 'player');

/**
 * Offsets the world layer to keep the player centered.
 * Currently a no-op offset for a screen-sized map, but the pattern
 * is ready for larger maps.
 *
 * Called every render frame.
 */
export function cameraSystem(): void {
  for (const entity of players) {
    // When the map is larger than the screen, uncomment:
    // game.worldLayer.position.set(
    //   SCREEN_W / 2 - entity.position.x,
    //   SCREEN_H / 2 - entity.position.y,
    // );
    // game.entityLayer.position.set(
    //   SCREEN_W / 2 - entity.position.x,
    //   SCREEN_H / 2 - entity.position.y,
    // );

    // For now, keep layers at origin (map fits on screen)
    void entity;
    void SCREEN_W;
    void SCREEN_H;
    void game;
    break; // Only follow the first player
  }
}
