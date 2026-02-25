import { world } from '../world';
import { InputManager } from '../../core/InputManager';
import { game } from '../../Game';
import { trackMovement } from '../../core/ConditionalAffixSystem';
import { isPlayerRooted, hasCryoBarrier } from '../../core/HazardSystem';

const TILE_SIZE = 32;
const SLOW_GROUND_FACTOR = 0.7; // 30% speed reduction on slow ground

const allMovers = world.with('position', 'velocity');
const players = world.with('position', 'velocity', 'speed', 'player');

/**
 * Movement system: reads input for player entities, applies velocity to position,
 * and resolves wall collisions for non-projectile entities.
 *
 * Called from fixedUpdate at 60 Hz.
 */
export function movementSystem(dt: number): void {
  const input = InputManager.instance;
  const move = input.getMovementVector();
  const tileMap = game.tileMap;

  // Set velocity on player entities based on input
  for (const entity of players) {
    if (entity.inputDisabled || isPlayerRooted()) {
      // Vine snare root: can't move but can still use skills (unlike inputDisabled)
      entity.velocity.x = 0;
      entity.velocity.y = 0;
    } else {
      entity.velocity.x = move.x * entity.speed;
      entity.velocity.y = move.y * entity.speed;
    }

    // Apply slow ground speed reduction
    const tile = tileMap.worldToTile(entity.position.x, entity.position.y);
    if (tileMap.isSlowGround(tile.x, tile.y)) {
      entity.velocity.x *= SLOW_GROUND_FACTOR;
      entity.velocity.y *= SLOW_GROUND_FACTOR;
    }

    // Track movement state for conditional affixes
    const velMag = Math.sqrt(entity.velocity.x * entity.velocity.x + entity.velocity.y * entity.velocity.y);
    trackMovement(velMag);
  }

  // Apply velocity to position for all movers
  for (const entity of allMovers) {
    // Projectiles skip wall collision (handled by ProjectileSystem)
    if (entity.projectile || entity.enemyProjectile) {
      entity.position.x += entity.velocity.x * dt;
      entity.position.y += entity.velocity.y * dt;
      continue;
    }

    // Apply slow ground to enemies (player already handled above)
    if (entity.enemy) {
      const eTile = tileMap.worldToTile(entity.position.x, entity.position.y);
      if (tileMap.isSlowGround(eTile.x, eTile.y)) {
        entity.velocity.x *= SLOW_GROUND_FACTOR;
        entity.velocity.y *= SLOW_GROUND_FACTOR;
      }
    }

    const prevX = entity.position.x;
    const prevY = entity.position.y;

    // Try X movement first
    const newX = prevX + entity.velocity.x * dt;
    const tileAtNewX = tileMap.worldToTile(newX, prevY);
    if (!tileMap.blocksMovement(tileAtNewX.x, tileAtNewX.y) && !hasCryoBarrier(tileAtNewX.x, tileAtNewX.y)) {
      entity.position.x = newX;
    } else {
      // Slide against wall: snap to tile edge
      entity.velocity.x = 0;
      if (newX > prevX) {
        entity.position.x = tileAtNewX.x * TILE_SIZE - 1;
      } else {
        entity.position.x = (tileAtNewX.x + 1) * TILE_SIZE + 1;
      }
    }

    // Try Y movement
    const newY = prevY + entity.velocity.y * dt;
    const tileAtNewY = tileMap.worldToTile(entity.position.x, newY);
    if (!tileMap.blocksMovement(tileAtNewY.x, tileAtNewY.y) && !hasCryoBarrier(tileAtNewY.x, tileAtNewY.y)) {
      entity.position.y = newY;
    } else {
      entity.velocity.y = 0;
      if (newY > prevY) {
        entity.position.y = tileAtNewY.y * TILE_SIZE - 1;
      } else {
        entity.position.y = (tileAtNewY.y + 1) * TILE_SIZE + 1;
      }
    }
  }
}
