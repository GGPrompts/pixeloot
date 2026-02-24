import { World } from 'miniplex';
import type { Container } from 'pixi.js';

export type Entity = {
  position?: { x: number; y: number };
  velocity?: { x: number; y: number };
  speed?: number;
  sprite?: Container;
  player?: true;
  enemy?: true;
};

export const world = new World<Entity>();
