import { world } from '../world';
import { InputManager } from '../../core/InputManager';
import { fireProjectile, type ProjectileOptions } from '../../entities/Projectile';
import { getAttackSpeedMultiplier } from './StatEffects';
import { isStatPanelOpen } from '../../ui/StatPanel';
import { inventory } from '../../core/Inventory';
import { getWeaponBehavior, DEFAULT_WEAPON_BEHAVIOR, type WeaponBehavior } from '../../core/WeaponBehaviors';

const players = world.with('position', 'player');

let cooldownTimer = 0;

/** Build ProjectileOptions from a weapon behavior and player stats. */
function buildProjectileOptions(
  behavior: WeaponBehavior,
  dex: number,
  int: number,
  baseDamage: number,
): ProjectileOptions {
  const opts: ProjectileOptions = {
    speed: behavior.projectileSpeed,
    damage: Math.round(baseDamage * behavior.projectileDamage),
    radius: behavior.projectileRadius,
    color: behavior.projectileColor,
    dexterity: dex,
    intelligence: int,
  };

  if (behavior.special === 'piercing') {
    opts.piercing = true;
  }

  if (behavior.special === 'knockback') {
    opts.knockbackOnHit = true;
  }

  if (behavior.special === 'explodeOnDeath') {
    opts.explodeOnDeath = {
      radius: behavior.projectileRadius * 6,
      damage: Math.round(baseDamage * behavior.projectileDamage * 0.6),
    };
  }

  if (behavior.special === 'homing') {
    opts.homing = true;
  }

  return opts;
}

/**
 * Checks for mouse input and fires projectiles from the player toward the cursor.
 * Applies weapon-specific behavior from the equipped weapon.
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

    // Resolve weapon behavior from equipped item
    const weapon = inventory.equipped.weapon;
    const behavior = weapon
      ? getWeaponBehavior(weapon.name, weapon.weaponType)
      : DEFAULT_WEAPON_BEHAVIOR;

    const baseDamage = weapon?.baseStats.damage ?? 10;
    const opts = buildProjectileOptions(behavior, dex, int, baseDamage);

    fireProjectile(player.position.x, player.position.y, mouse.x, mouse.y, opts);

    // Fire rate from weapon behavior, modified by dexterity attack speed
    const fireCooldown = (1 / behavior.fireRate) * getAttackSpeedMultiplier(dex);
    cooldownTimer = fireCooldown;

    break; // Only fire from first player
  }
}
