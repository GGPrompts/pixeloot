import { world } from '../world';
import {
  StatusType,
  removeStatus,
  hasStatus,
  STATUS_TINTS,
  STATUS_PRIORITY,
} from '../../core/StatusEffects';
import { spawnDamageNumber } from '../../ui/DamageNumbers';

const BURN_DAMAGE = 5;
const BURN_TICK_INTERVAL = 0.5;

const affected = world.with('statusEffects');

/**
 * Processes all entities with statusEffects each fixed update.
 *
 * - Decreases durations, removes expired effects
 * - Applies speed modifiers (Slow, Chill, Stun)
 * - Ticks DoT (Burn)
 * - Manages stun immunity timers
 * - Applies visual tints to sprites
 *
 * Should be called in fixedUpdate BEFORE movementSystem so that
 * speed changes take effect in the same frame.
 */
export function statusEffectSystem(dt: number): void {
  // Tick stun immunity on all entities that have it
  const stunImmune = world.with('stunImmunity');
  for (const entity of stunImmune) {
    if (entity.stunImmunity !== undefined && entity.stunImmunity > 0) {
      entity.stunImmunity -= dt;
      if (entity.stunImmunity <= 0) {
        entity.stunImmunity = 0;
      }
    }
  }

  for (const entity of affected) {
    const effects = entity.statusEffects;
    if (!effects || effects.length === 0) continue;

    // Track which effects expired this frame
    const expiredTypes: StatusType[] = [];

    // ── Tick durations and DoT ──────────────────────────────────
    for (const effect of effects) {
      effect.duration -= dt;

      // Burn DoT ticking
      if (effect.type === StatusType.Burn && entity.health) {
        if (effect.tickTimer === undefined) effect.tickTimer = BURN_TICK_INTERVAL;
        effect.tickTimer -= dt;

        while (effect.tickTimer !== undefined && effect.tickTimer <= 0) {
          effect.tickTimer += BURN_TICK_INTERVAL;
          entity.health.current -= BURN_DAMAGE;

          // Visual damage number
          if (entity.position) {
            spawnDamageNumber(
              entity.position.x,
              entity.position.y - 10,
              BURN_DAMAGE,
              0xff6600, // orange for burn
            );
          }
        }
      }

      if (effect.duration <= 0) {
        expiredTypes.push(effect.type);
      }
    }

    // ── Remove expired effects ──────────────────────────────────
    for (const type of expiredTypes) {
      removeStatus(entity, type);
    }

    // ── Recalculate speed from baseSpeed + modifiers ────────────
    if (entity.baseSpeed !== undefined && entity.speed !== undefined) {
      let speedMultiplier = 1;

      if (hasStatus(entity, StatusType.Stun)) {
        speedMultiplier = 0;
        // Stun also disables input for players
        if (entity.player && !entity.inputDisabled) {
          world.addComponent(entity, 'inputDisabled', true as const);
        }
      } else {
        // Restore inputDisabled that was set by stun (not by death)
        // Only remove if entity is not dead
        if (entity.player && entity.inputDisabled && !entity.dead) {
          // Check if stun just expired - we need to re-enable input
          if (!hasStatus(entity, StatusType.Stun)) {
            world.removeComponent(entity, 'inputDisabled');
          }
        }

        if (hasStatus(entity, StatusType.Slow)) {
          speedMultiplier *= 0.7; // -30% speed
        }
        if (hasStatus(entity, StatusType.Chill)) {
          speedMultiplier *= 0.8; // -20% speed
        }
      }

      entity.speed = entity.baseSpeed * speedMultiplier;
    }

    // ── Apply visual tint ───────────────────────────────────────
    if (entity.sprite) {
      const currentEffects = entity.statusEffects;
      if (!currentEffects || currentEffects.length === 0) {
        // No effects remaining - reset tint
        entity.sprite.tint = 0xffffff;
      } else {
        // Find highest priority effect that has a tint
        let bestPriority = -1;
        let bestTint = 0xffffff;

        for (const effect of currentEffects) {
          const priority = STATUS_PRIORITY[effect.type] ?? -1;
          const tint = STATUS_TINTS[effect.type];
          if (tint !== undefined && priority > bestPriority) {
            bestPriority = priority;
            bestTint = tint;
          }
        }

        entity.sprite.tint = bestTint;
      }
    }
  }
}
