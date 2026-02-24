import type { Entity } from '../ecs/world';

// ── Status Types ───────────────────────────────────────────────────
export enum StatusType {
  Slow,      // -30% move speed, 2s
  Chill,     // -20% move / -15% attack, 3s
  Burn,      // DoT 5 dmg/tick, 3s (tick every 0.5s)
  Shock,     // next hit +25% dmg, 4s
  Stun,      // can't move/attack, 0.5s (3s immunity after)
  Knockback, // instant push away from source
  Mark,      // +15% dmg taken, 5s
}

export interface StatusEffect {
  type: StatusType;
  duration: number;     // remaining seconds
  tickTimer?: number;   // for DoT effects (Burn)
}

// ── Default Durations ──────────────────────────────────────────────
const DEFAULT_DURATION: Record<StatusType, number> = {
  [StatusType.Slow]: 2,
  [StatusType.Chill]: 3,
  [StatusType.Burn]: 3,
  [StatusType.Shock]: 4,
  [StatusType.Stun]: 0.5,
  [StatusType.Knockback]: 0, // instant
  [StatusType.Mark]: 5,
};

// ── Visual Tint Colors (priority order: higher index = higher priority) ──
export const STATUS_TINTS: Partial<Record<StatusType, number>> = {
  [StatusType.Slow]: 0x6666ff,
  [StatusType.Chill]: 0x6666ff,
  [StatusType.Burn]: 0xff6600,
  [StatusType.Shock]: 0xffff00,
  [StatusType.Stun]: 0x888888,
  [StatusType.Mark]: 0xff00ff,
};

// Priority for choosing which tint to display (higher = takes precedence)
export const STATUS_PRIORITY: Partial<Record<StatusType, number>> = {
  [StatusType.Stun]: 5,
  [StatusType.Burn]: 4,
  [StatusType.Shock]: 3,
  [StatusType.Mark]: 2,
  [StatusType.Chill]: 1,
  [StatusType.Slow]: 0,
};

// ── Knockback Config ───────────────────────────────────────────────
const KNOCKBACK_FORCE = 300;

// ── Public API ─────────────────────────────────────────────────────

/**
 * Applies a status effect to an entity.
 * - Knockback needs sourcePos to calculate push direction.
 * - Stun checks stunImmunity before applying; grants 3s immunity on expiry.
 * - Bosses (future): check entity.boss flag for immunity/half-effect.
 */
export function applyStatus(
  entity: Entity,
  type: StatusType,
  sourcePos?: { x: number; y: number },
): void {
  if (!entity.statusEffects) {
    entity.statusEffects = [];
  }

  // Bosses: immune to stun, half-duration knockback
  if (entity.boss) {
    if (type === StatusType.Stun) return;
  }

  // Stun: respect immunity window
  if (type === StatusType.Stun) {
    if (entity.stunImmunity !== undefined && entity.stunImmunity > 0) {
      return;
    }
  }

  // Knockback is instant: apply velocity push and return (no duration effect)
  if (type === StatusType.Knockback) {
    if (sourcePos && entity.position && entity.velocity) {
      const dx = entity.position.x - sourcePos.x;
      const dy = entity.position.y - sourcePos.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        entity.velocity.x += (dx / len) * KNOCKBACK_FORCE;
        entity.velocity.y += (dy / len) * KNOCKBACK_FORCE;
      }
    }
    return;
  }

  // If effect already exists, refresh duration instead of stacking
  const existing = entity.statusEffects.find((e) => e.type === type);
  if (existing) {
    existing.duration = DEFAULT_DURATION[type];
    if (type === StatusType.Burn) {
      existing.tickTimer = 0.5;
    }
    return;
  }

  // Add new effect
  const effect: StatusEffect = {
    type,
    duration: DEFAULT_DURATION[type],
  };

  if (type === StatusType.Burn) {
    effect.tickTimer = 0.5; // first tick after 0.5s
  }

  entity.statusEffects.push(effect);
}

/**
 * Removes a specific status effect from an entity.
 */
export function removeStatus(entity: Entity, type: StatusType): void {
  if (!entity.statusEffects) return;
  entity.statusEffects = entity.statusEffects.filter((e) => e.type !== type);

  // If stun is being removed, grant immunity
  if (type === StatusType.Stun) {
    entity.stunImmunity = 3;
  }
}

/**
 * Checks whether an entity currently has a given status effect.
 */
export function hasStatus(entity: Entity, type: StatusType): boolean {
  if (!entity.statusEffects) return false;
  return entity.statusEffects.some((e) => e.type === type);
}

/**
 * Consumes (removes) a Shock effect and returns true if one was present.
 * Used by CollisionSystem to apply the +25% damage bonus.
 */
export function consumeShock(entity: Entity): boolean {
  if (!hasStatus(entity, StatusType.Shock)) return false;
  removeStatus(entity, StatusType.Shock);
  return true;
}
