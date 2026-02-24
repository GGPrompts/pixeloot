import { world } from '../world';

const enemies = world.with('enemy', 'position', 'velocity', 'speed');
const players = world.with('player', 'position');

/**
 * Sets enemy velocity to chase the player each fixed tick.
 * Called before movementSystem so velocity is applied in the same frame.
 */
export function aiSystem(_dt: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  for (const enemy of enemies) {
    const dx = player.position.x - enemy.position.x;
    const dy = player.position.y - enemy.position.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0) {
      enemy.velocity.x = (dx / len) * enemy.speed;
      enemy.velocity.y = (dy / len) * enemy.speed;

      // Rotate sprite to face player
      if (enemy.sprite) {
        enemy.sprite.rotation = Math.atan2(dy, dx);
      }
    }
  }
}
