import { World } from 'miniplex';
import type { Container, Graphics } from 'pixi.js';
import type { StatusEffect } from '../core/StatusEffects';

export type Entity = {
  position?: { x: number; y: number };
  velocity?: { x: number; y: number };
  speed?: number;
  baseSpeed?: number;           // original speed before status modifiers
  sprite?: Container;
  player?: true;
  enemy?: true;
  projectile?: true;
  damage?: number;
  health?: { current: number; max: number };
  lifetime?: number;
  invulnTimer?: number;
  gold?: number;
  potionCooldown?: number;
  hotTimer?: number; // heal-over-time remaining seconds
  dead?: true;
  inputDisabled?: true;
  enemyHealthBar?: Graphics;
  piercing?: true;
  piercingHitIds?: Set<object>;
  aoe?: { x: number; y: number; radius: number; delay: number; damage: number };
  xp?: number;
  level?: number;
  statPoints?: number;
  stats?: { dexterity: number; intelligence: number; vitality: number; focus: number };
  statusEffects?: StatusEffect[]; // active status effects on this entity
  stunImmunity?: number;         // seconds of stun immunity remaining
};

export const world = new World<Entity>();
