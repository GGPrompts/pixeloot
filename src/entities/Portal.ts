/**
 * Portal entity: a glowing swirl that spawns after the final boss wave.
 * The player walks into it to return to town.
 */

import { Container, Graphics } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { sfxPlayer } from '../audio/SFXManager';

const PORTAL_RADIUS = 24;
const PARTICLE_COUNT = 8;
const RING_COUNT = 3;

/** Active portal entities tracked for animation. */
const activePortals: Array<{
  container: Container;
  rings: Graphics[];
  particles: Graphics[];
  startTime: number;
}> = [];

/**
 * Spawn a town portal at the given world position.
 * Draws a blue/cyan rotating swirl with orbiting particles.
 */
export function spawnPortal(x: number, y: number): void {
  const container = new Container();
  container.position.set(x, y);

  // Outer glow circle
  const glow = new Graphics();
  glow.circle(0, 0, PORTAL_RADIUS + 8);
  glow.fill({ color: 0x00ccff, alpha: 0.15 });
  container.addChild(glow);

  // Concentric rotating rings
  const rings: Graphics[] = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const ring = new Graphics();
    const r = PORTAL_RADIUS - i * 6;
    ring.circle(0, 0, r);
    ring.stroke({ width: 2, color: i === 0 ? 0x0066ff : 0x00ccff, alpha: 0.6 + i * 0.15 });
    container.addChild(ring);
    rings.push(ring);
  }

  // Inner filled core
  const core = new Graphics();
  core.circle(0, 0, 6);
  core.fill({ color: 0xffffff, alpha: 0.8 });
  container.addChild(core);

  // Orbiting particles
  const particles: Graphics[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = new Graphics();
    p.circle(0, 0, 2);
    p.fill({ color: i % 2 === 0 ? 0x00ccff : 0x4488ff });
    container.addChild(p);
    particles.push(p);
  }

  game.entityLayer.addChild(container);

  const portalAnim = {
    container,
    rings,
    particles,
    startTime: performance.now(),
  };
  activePortals.push(portalAnim);

  world.add({
    position: { x, y },
    sprite: container,
    portal: true,
  });

  sfxPlayer.play('level_up');
}

/**
 * Update portal animations (rotation, pulse, particle orbits).
 * Call from the frame update loop (not fixed step).
 */
export function updatePortalAnimations(): void {
  const now = performance.now();

  for (const portal of activePortals) {
    if (!portal.container.parent) continue;

    const elapsed = (now - portal.startTime) / 1000;

    // Rotate rings in alternating directions
    for (let i = 0; i < portal.rings.length; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      portal.rings[i].rotation = elapsed * (1.5 + i * 0.5) * dir;
    }

    // Pulse the entire container scale
    const pulse = 1.0 + 0.08 * Math.sin(elapsed * 3);
    portal.container.scale.set(pulse, pulse);

    // Pulse alpha
    portal.container.alpha = 0.8 + 0.2 * Math.sin(elapsed * 2);

    // Orbit particles
    for (let i = 0; i < portal.particles.length; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + elapsed * 2;
      const orbitR = PORTAL_RADIUS - 2 + 4 * Math.sin(elapsed * 4 + i);
      portal.particles[i].position.set(
        Math.cos(angle) * orbitR,
        Math.sin(angle) * orbitR,
      );
      portal.particles[i].alpha = 0.5 + 0.5 * Math.sin(elapsed * 5 + i * 0.8);
    }
  }
}

/**
 * Remove all tracked portal animations. Called when portals are cleaned up
 * (e.g., entering town).
 */
export function clearPortalAnimations(): void {
  activePortals.length = 0;
}
