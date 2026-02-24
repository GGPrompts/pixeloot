import { world } from '../ecs/world';
import { game } from '../Game';
import { spawnRusher } from './Enemy';

const MIN_PLAYER_DIST = 200;

/**
 * Spawns a batch of Rusher enemies at random floor tiles.
 * Ensures each spawn is at least MIN_PLAYER_DIST pixels from the player.
 */
export function spawnInitialEnemies(count: number): void {
  const players = world.with('player', 'position');
  const player = players.entities[0];
  if (!player) return;

  const px = player.position.x;
  const py = player.position.y;

  let spawned = 0;
  let attempts = 0;
  const maxAttempts = count * 20;

  while (spawned < count && attempts < maxAttempts) {
    attempts++;
    const tile = game.tileMap.getRandomFloorTile();
    const pos = game.tileMap.tileToWorld(tile.x, tile.y);

    const dx = pos.x - px;
    const dy = pos.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= MIN_PLAYER_DIST) {
      spawnRusher(pos.x, pos.y);
      spawned++;
    }
  }
}
