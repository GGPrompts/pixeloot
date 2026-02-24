import { world } from '../world';
import { InputManager } from '../../core/InputManager';
import { fireProjectile, type ProjectileOptions } from '../../entities/Projectile';
import { isStatPanelOpen } from '../../ui/StatPanel';
import { inventory } from '../../core/Inventory';
import { getWeaponBehavior, DEFAULT_WEAPON_BEHAVIOR, type WeaponBehavior } from '../../core/WeaponBehaviors';
import { getComputedStats } from '../../core/ComputedStats';
import { isInTown } from '../../core/TownManager';
import { screenToWorld } from '../../Game';

const players = world.with('position', 'player');

let cooldownTimer = 0;

/** Build ProjectileOptions from a weapon behavior and computed stats. */
function buildProjectileOptions(
  behavior: WeaponBehavior,
  computedDamage: number,
  computedProjSpeed: number,
): ProjectileOptions {
  const opts: ProjectileOptions = {
    speed: behavior.projectileSpeed * computedProjSpeed,
    damage: Math.round(computedDamage * behavior.projectileDamage),
    radius: behavior.projectileRadius,
    color: behavior.projectileColor,
    // Pass 0 for raw stat multipliers since they are already baked into computed values
    dexterity: 0,
    intelligence: 0,
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
      damage: Math.round(computedDamage * behavior.projectileDamage * 0.6),
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
  if (isInTown()) return;

  const mouse = input.getMousePosition();
  const worldMouse = screenToWorld(mouse.x, mouse.y);

  for (const player of players) {
    if (player.inputDisabled) break;

    const computed = getComputedStats();

    // Resolve weapon behavior from equipped item
    const weapon = inventory.equipped.weapon;
    const behavior = weapon
      ? getWeaponBehavior(weapon.name, weapon.weaponType)
      : DEFAULT_WEAPON_BEHAVIOR;

    const opts = buildProjectileOptions(behavior, computed.damage, computed.projectileSpeed);

    // Apply crit: roll against computed critChance
    if (computed.critChance > 0 && Math.random() < computed.critChance) {
      opts.damage = Math.round((opts.damage ?? 0) * computed.critMultiplier);
    }

    fireProjectile(player.position.x, player.position.y, worldMouse.x, worldMouse.y, opts);

    // Fire rate from weapon behavior, modified by computed attack speed
    // computed.attackSpeed is a multiplier (> 1 = faster)
    const fireCooldown = (1 / behavior.fireRate) / computed.attackSpeed;
    cooldownTimer = fireCooldown;

    break; // Only fire from first player
  }
}
