/**
 * TownVisualizer -- Bazaar-style ambient renderer for the town hub.
 *
 * Draws sky gradient, sun, stars, tent canopies over NPCs, lanterns, and
 * drifting spice-dust particles. All effects react to audio energy from
 * ChipPlayer via musicPlayer.getEnergy().
 *
 * Manages its own Graphics/Container objects on worldLayer and entityLayer.
 */

import { Container, Graphics } from 'pixi.js';
import { game } from '@/Game';
import { TILE_SIZE } from '@/core/constants';

// ── Palette constants ──────────────────────────────────────────────

const SKY_TOP = [25, 12, 50];
const SKY_MID = [60, 20, 40];
const SKY_BOT = [200, 100, 30];
const SUN_COLOR = 0xf5a623;

const LANTERN_COLORS = [0xf5a623, 0xff6b35, 0xe74c3c, 0xffea00, 0xff8c42, 0xffd700];
const SPICE_COLORS = [0xf5a623, 0xe74c3c, 0xc0392b, 0xd4a017, 0x8b4513, 0xff6347, 0xdaa520];

const NUM_LANTERNS = 14;
const NUM_PARTICLES = 100;
const NUM_STARS = 60;

// ── Helpers ────────────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

function lerpRGB(a: number[], b: number[], t: number): number[] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// ── Internal state types ───────────────────────────────────────────

interface StarState {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
}

interface LanternState {
  x: number;
  baseY: number;
  ropeLen: number;
  size: number;
  color: number;
  phase: number;
  swingSpeed: number;
}

interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  alpha: number;
}

interface TentDef {
  worldX: number;
  worldY: number;
  color: number;
}

// ── TownVisualizer class ──────────────────────────────────────────

export class TownVisualizer {
  private skyGfx: Graphics;
  private starsGfx: Graphics;
  private sunGfx: Graphics;
  private tentsGfx: Graphics;
  private lanternsGfx: Graphics;
  private particlesGfx: Graphics;

  private skyContainer: Container;

  private stars: StarState[] = [];
  private lanterns: LanternState[] = [];
  private particles: ParticleState[] = [];
  private tents: TentDef[] = [];

  private time = 0;

  /** Map pixel dimensions for positioning. */
  private mapW: number;
  private mapH: number;
  private horizonY: number;

  constructor(mapW: number, mapH: number) {
    this.mapW = mapW;
    this.mapH = mapH;
    this.horizonY = mapH * 0.55;

    // All bazaar visuals go into a single container on the world layer,
    // rendered below the tile map and entities.
    this.skyContainer = new Container();

    this.skyGfx = new Graphics();
    this.starsGfx = new Graphics();
    this.sunGfx = new Graphics();
    this.tentsGfx = new Graphics();
    this.lanternsGfx = new Graphics();
    this.particlesGfx = new Graphics();

    this.skyContainer.addChild(this.skyGfx);
    this.skyContainer.addChild(this.starsGfx);
    this.skyContainer.addChild(this.sunGfx);
    this.skyContainer.addChild(this.lanternsGfx);
    this.skyContainer.addChild(this.particlesGfx);

    // Insert sky behind everything else on world layer (at index 0)
    game.worldLayer.addChildAt(this.skyContainer, 0);

    // Tents go on entity layer so they render with NPCs
    game.entityLayer.addChildAt(this.tentsGfx, 0);

    this.initStars();
    this.initLanterns();
    this.initParticles();
  }

  // ── Init helpers ──────────────────────────────────────────────

  private initStars(): void {
    for (let i = 0; i < NUM_STARS; i++) {
      this.stars.push({
        x: Math.random() * this.mapW,
        y: Math.random() * this.horizonY * 0.7,
        size: 1 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      });
    }
  }

  private initLanterns(): void {
    for (let i = 0; i < NUM_LANTERNS; i++) {
      this.lanterns.push({
        x: (this.mapW * (i + 0.5)) / NUM_LANTERNS,
        baseY: this.horizonY - 20 - Math.random() * 60,
        ropeLen: 15 + Math.random() * 25,
        size: 4 + Math.random() * 4,
        color: LANTERN_COLORS[i % LANTERN_COLORS.length],
        phase: Math.random() * Math.PI * 2,
        swingSpeed: 0.8 + Math.random() * 0.6,
      });
    }
  }

  private initParticles(): void {
    for (let i = 0; i < NUM_PARTICLES; i++) {
      this.particles.push(this.spawnParticle());
    }
  }

  private spawnParticle(): ParticleState {
    return {
      x: Math.random() * this.mapW,
      y: Math.random() * this.mapH,
      vx: (Math.random() - 0.5) * 8,
      vy: -(5 + Math.random() * 15),
      size: 1 + Math.random() * 2,
      color: SPICE_COLORS[Math.floor(Math.random() * SPICE_COLORS.length)],
      alpha: 0.2 + Math.random() * 0.4,
    };
  }

  // ── Set tent positions (called after NPCs are spawned) ─────────

  setTents(tents: TentDef[]): void {
    this.tents = tents;
  }

  // ── Per-frame update ──────────────────────────────────────────

  update(dt: number, energy: number): void {
    this.time += dt;

    this.drawSky();
    this.drawStars(energy);
    this.drawSun(energy);
    this.drawTents();
    this.drawLanterns(energy);
    this.updateAndDrawParticles(dt, energy);
  }

  // ── Sky gradient ──────────────────────────────────────────────

  private drawSky(): void {
    const g = this.skyGfx;
    g.clear();

    // Draw sky as a series of horizontal bands for gradient effect
    const bands = 20;
    const bandH = this.mapH / bands;
    for (let i = 0; i < bands; i++) {
      const t = i / bands;
      const y = i * bandH;
      let rgb: number[];
      if (t < 0.55) {
        // top to mid
        const lt = t / 0.55;
        rgb = lerpRGB(SKY_TOP, SKY_MID, lt);
      } else {
        // mid to bottom
        const lt = (t - 0.55) / 0.45;
        rgb = lerpRGB(SKY_MID, SKY_BOT, lt);
      }
      const color = rgbToHex(Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2]));
      g.rect(0, y, this.mapW, bandH + 1).fill({ color });
    }
  }

  // ── Stars ─────────────────────────────────────────────────────

  private drawStars(energy: number): void {
    const g = this.starsGfx;
    g.clear();

    for (const s of this.stars) {
      const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.time * s.speed + s.phase));
      const alpha = twinkle * (1 - energy * 0.3); // dim slightly with energy
      g.circle(s.x, s.y, s.size).fill({ color: 0xffffff, alpha });
    }
  }

  // ── Sun at horizon ────────────────────────────────────────────

  private drawSun(energy: number): void {
    const g = this.sunGfx;
    g.clear();

    const sunX = this.mapW * 0.5;
    const sunY = this.horizonY;
    const baseRadius = 25;

    // Outer glow rings (pulse with energy)
    const glowLayers = 4;
    for (let i = glowLayers; i >= 0; i--) {
      const r = baseRadius + i * 12 + energy * 8;
      const alpha = (0.05 + energy * 0.04) * (1 - i / (glowLayers + 1));
      g.circle(sunX, sunY, r).fill({ color: SUN_COLOR, alpha });
    }

    // Sun body
    g.circle(sunX, sunY, baseRadius).fill({ color: SUN_COLOR, alpha: 0.7 + energy * 0.2 });
  }

  // ── Tents over NPCs ──────────────────────────────────────────

  private drawTents(): void {
    const g = this.tentsGfx;
    g.clear();

    for (const tent of this.tents) {
      this.drawSingleTent(g, tent.worldX, tent.worldY, tent.color);
    }
  }

  private drawSingleTent(g: Graphics, cx: number, cy: number, color: number): void {
    const postH = 36;
    const canopyW = 56;
    const canopyH = 12;

    // Posts (dark brown)
    const postColor = 0x4a3020;
    g.rect(cx - canopyW / 2, cy - postH, 3, postH).fill({ color: postColor });
    g.rect(cx + canopyW / 2 - 3, cy - postH, 3, postH).fill({ color: postColor });

    // Canopy: filled path with quadratic curve for drape
    const cTop = cy - postH;
    const cMid = cTop + canopyH;
    g.moveTo(cx - canopyW / 2, cTop)
      .quadraticCurveTo(cx, cMid, cx + canopyW / 2, cTop)
      .lineTo(cx + canopyW / 2, cTop + 4)
      .quadraticCurveTo(cx, cMid + 4, cx - canopyW / 2, cTop + 4)
      .closePath()
      .fill({ color, alpha: 0.85 });

    // Canopy top edge highlight
    g.moveTo(cx - canopyW / 2, cTop)
      .quadraticCurveTo(cx, cMid, cx + canopyW / 2, cTop)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.2 });

    // Counter/table
    const counterY = cy - 2;
    const counterW = canopyW - 8;
    g.rect(cx - counterW / 2, counterY, counterW, 6).fill({ color: 0x5a4030 });
    g.rect(cx - counterW / 2, counterY, counterW, 2).fill({ color: 0x7a5a40 });

    // Small goods on counter (3 little boxes/items)
    const goodsY = counterY - 4;
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i * 12;
      const gColor = i === 0 ? color : (i < 0 ? 0xddaa44 : 0xaa6633);
      g.rect(gx - 3, goodsY, 6, 4).fill({ color: gColor, alpha: 0.8 });
    }
  }

  // ── Lanterns ──────────────────────────────────────────────────

  private drawLanterns(energy: number): void {
    const g = this.lanternsGfx;
    g.clear();

    for (const l of this.lanterns) {
      const swing = Math.sin(this.time * l.swingSpeed + l.phase) * 8;
      const lx = l.x + swing;
      const ly = l.baseY + l.ropeLen;

      // Rope
      g.moveTo(l.x, l.baseY)
        .lineTo(lx, ly)
        .stroke({ width: 1, color: 0x5a4030, alpha: 0.6 });

      // Glow (pulses with energy)
      const glowRadius = l.size * (2.5 + energy * 2);
      const flickerAlpha = 0.08 + energy * 0.06;

      // Beat flash: when energy spikes above 0.5, add extra brightness
      const beatBoost = energy > 0.5 ? (energy - 0.5) * 0.15 : 0;

      g.circle(lx, ly, glowRadius).fill({ color: l.color, alpha: flickerAlpha + beatBoost });
      g.circle(lx, ly, glowRadius * 0.5).fill({ color: l.color, alpha: 0.12 + beatBoost });

      // Lantern body
      g.circle(lx, ly, l.size).fill({ color: l.color, alpha: 0.8 + energy * 0.15 });
      g.circle(lx, ly, l.size * 0.5).fill({ color: 0xffffff, alpha: 0.3 });
    }
  }

  // ── Particles ─────────────────────────────────────────────────

  private updateAndDrawParticles(dt: number, energy: number): void {
    const g = this.particlesGfx;
    g.clear();

    const speedMult = 1 + energy * 1.5;

    for (const p of this.particles) {
      p.x += p.vx * dt * speedMult;
      p.y += p.vy * dt * speedMult;

      // Wrap around
      if (p.y < -10) {
        p.y = this.mapH + 5;
        p.x = Math.random() * this.mapW;
      }
      if (p.x < -10) p.x = this.mapW + 5;
      if (p.x > this.mapW + 10) p.x = -5;

      const alpha = p.alpha * (0.7 + energy * 0.3);
      g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha });
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────

  destroy(): void {
    this.skyContainer.removeFromParent();
    this.skyContainer.destroy({ children: true });
    this.tentsGfx.removeFromParent();
    this.tentsGfx.destroy();
  }
}

/**
 * Build tent definitions from NPC positions.
 * Called after spawnTownNPCs to map NPC world positions to tent colors.
 */
export function buildTentDefs(
  spawnX: number,
  spawnY: number,
  npcDefs: { tileOffsetX: number; tileOffsetY: number; color: number }[],
): TentDef[] {
  return npcDefs.map((def) => ({
    worldX: spawnX + def.tileOffsetX * TILE_SIZE,
    worldY: spawnY + def.tileOffsetY * TILE_SIZE,
    color: def.color,
  }));
}
