import { world } from '../ecs/world';
import { game } from '../Game';
import { spawnRusher, spawnSwarm, spawnTank, spawnSniper, spawnFlanker, spawnSplitter, spawnShielder } from './Enemy';
import { getMonsterLevel, DEFAULT_SCALING_CONFIG } from '../core/MonsterScaling';

const MIN_PLAYER_DIST = 200;

/**
 * Finds a valid spawn position at least MIN_PLAYER_DIST from the player.
 * Returns null if no valid position found within attempt limit.
 */
function findSpawnPosition(px: number, py: number, maxAttempts = 20): { x: number; y: number } | null {
  for (let i = 0; i < maxAttempts; i++) {
    const tile = game.tileMap.getRandomFloorTile();
    const pos = game.tileMap.tileToWorld(tile.x, tile.y);
    const dx = pos.x - px;
    const dy = pos.y - py;
    if (Math.sqrt(dx * dx + dy * dy) >= MIN_PLAYER_DIST) {
      return pos;
    }
  }
  return null;
}

/**
 * Spawns the initial set of enemies: a mix of all enemy types.
 * The count parameter is ignored in favor of the fixed composition.
 * 3 Rushers, 4-6 Swarm (as a pack), 1 Tank, 1 Sniper, 1 Flanker.
 */
export function spawnInitialEnemies(_count?: number): void {
  const players = world.with('player', 'position', 'level');
  const player = players.entities[0];
  if (!player) return;

  const px = player.position.x;
  const py = player.position.y;
  const monsterLevel = getMonsterLevel(player.level, DEFAULT_SCALING_CONFIG);

  // 3 Rushers
  for (let i = 0; i < 3; i++) {
    const pos = findSpawnPosition(px, py);
    if (pos) spawnRusher(pos.x, pos.y, monsterLevel);
  }

  // 4 Swarm in a pack (clustered near one point)
  const swarmCenter = findSpawnPosition(px, py);
  if (swarmCenter) {
    const packSize = 4;
    for (let i = 0; i < packSize; i++) {
      const offsetX = (Math.random() - 0.5) * 40;
      const offsetY = (Math.random() - 0.5) * 40;
      spawnSwarm(swarmCenter.x + offsetX, swarmCenter.y + offsetY, monsterLevel);
    }
  }

  // 1 Tank
  const tankPos = findSpawnPosition(px, py);
  if (tankPos) spawnTank(tankPos.x, tankPos.y, monsterLevel);

  // 1 Sniper
  const sniperPos = findSpawnPosition(px, py);
  if (sniperPos) spawnSniper(sniperPos.x, sniperPos.y, monsterLevel);

  // 1 Flanker
  const flankerPos = findSpawnPosition(px, py);
  if (flankerPos) spawnFlanker(flankerPos.x, flankerPos.y, monsterLevel);

  // 1 Splitter
  const splitterPos = findSpawnPosition(px, py);
  if (splitterPos) spawnSplitter(splitterPos.x, splitterPos.y, monsterLevel);

  // 1 Shielder
  const shielderPos = findSpawnPosition(px, py);
  if (shielderPos) spawnShielder(shielderPos.x, shielderPos.y, monsterLevel);
}
