import { World } from 'miniplex';
import type { Container, Graphics } from 'pixi.js';

export type Entity = {
  position?: { x: number; y: number };
  velocity?: { x: number; y: number };
  speed?: number;
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
};

export const world = new World<Entity>();
