import { world } from '../world';
import { InputManager } from '../../core/InputManager';
import { fireProjectile } from '../../entities/Projectile';
import { getAttackSpeedMultiplier } from './StatEffects';
import { isStatPanelOpen } from '../../ui/StatPanel';

const BASE_FIRE_COOLDOWN = 0.25; // seconds between shots (4 shots/sec)

const players = world.with('position', 'player');

let cooldownTimer = 0;

/**
 * Checks for mouse input and fires projectiles from the player toward the cursor.
 * Called from fixedUpdate at 60 Hz.
 */
export function firingSystem(dt: number): void {
  cooldownTimer -= dt;

  const input = InputManager.instance;
  if (!input.isMouseDown(0)) return;
  if (cooldownTimer > 0) return;
  if (isStatPanelOpen()) return;

  const mouse = input.getMousePosition();

  for (const player of players) {
    if (player.inputDisabled) break;
    const dex = player.stats?.dexterity ?? 0;
    const int = player.stats?.intelligence ?? 0;
    fireProjectile(player.position.x, player.position.y, mouse.x, mouse.y, { dexterity: dex, intelligence: int });
    cooldownTimer = BASE_FIRE_COOLDOWN * getAttackSpeedMultiplier(dex);
    break; // Only fire from first player
  }
}
