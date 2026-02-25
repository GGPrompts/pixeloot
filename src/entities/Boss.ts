import { Graphics } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';
import { scaleHealth, scaleDamage } from '../core/MonsterScaling';
import { getBossDesign, GENERIC_BOSS, type BossDesign } from './BossRegistry';

const BOSS_BASE_HP = 500;
const BOSS_BASE_DAMAGE = 25;

// ---------------------------------------------------------------------------
// Boss shape drawing functions
// ---------------------------------------------------------------------------

function drawBossShape(
  g: Graphics, id: string, radius: number,
  primary: number, accent: number,
): void {
  switch (id) {
    case 'sentinel_prime':
      drawSentinelPrime(g, radius, primary, accent);
      break;
    case 'nullpoint':
      drawNullpoint(g, radius, primary, accent);
      break;
    case 'overmind':
      drawOvermind(g, radius, primary, accent);
      break;
    case 'meltdown':
      drawMeltdown(g, radius, primary, accent);
      break;
    case 'dread_hollow':
      drawDreadHollow(g, radius, primary, accent);
      break;
    case 'prism_lord':
      drawPrismLord(g, radius, primary, accent);
      break;
    case 'void_weaver':
      drawVoidWeaver(g, radius, primary, accent);
      break;
    case 'cryo_matrix':
      drawCryoMatrix(g, radius, primary, accent);
      break;
    case 'arc_tyrant':
      drawArcTyrant(g, radius, primary, accent);
      break;
    case 'recursion':
      drawRecursion(g, radius, primary, accent);
      break;
    default:
      drawGenericHexagon(g, radius, primary, accent, id);
      break;
  }
}

/** Sentinel Prime: octagon with inner rotating-style square, cyan wireframe */
function drawSentinelPrime(g: Graphics, radius: number, primary: number, accent: number): void {
  // Glow rings
  for (let ring = 3; ring >= 1; ring--) {
    const r = radius + ring * 3;
    drawRegularPolygon(g, 8, r);
    g.stroke({ width: 1.5, color: accent, alpha: 0.3 + ring * 0.05 });
  }

  // Outer octagon
  drawRegularPolygon(g, 8, radius);
  g.fill({ color: primary, alpha: 0.85 });
  g.stroke({ width: 2, color: accent });

  // Inner square rotated 45 degrees
  const innerR = radius * 0.55;
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    const px = Math.cos(angle) * innerR;
    const py = Math.sin(angle) * innerR;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.stroke({ width: 2, color: accent, alpha: 0.8 });

  // Center dot
  g.circle(0, 0, 4).fill({ color: accent, alpha: 0.9 });
}

/** Nullpoint: black-hole visual with concentric void rings */
function drawNullpoint(g: Graphics, radius: number, primary: number, accent: number): void {
  // Outer particle ring glow
  for (let ring = 3; ring >= 1; ring--) {
    const r = radius + ring * 4;
    g.circle(0, 0, r).stroke({ width: 1.5, color: accent, alpha: 0.2 + ring * 0.05 });
  }

  // Outer ring (event horizon)
  g.circle(0, 0, radius).fill({ color: 0x000000, alpha: 0.9 });
  g.circle(0, 0, radius).stroke({ width: 3, color: accent });

  // Inner void gradient rings
  g.circle(0, 0, radius * 0.7).stroke({ width: 2, color: 0x5522aa, alpha: 0.6 });
  g.circle(0, 0, radius * 0.4).stroke({ width: 2, color: 0x8844cc, alpha: 0.5 });
  g.circle(0, 0, radius * 0.15).fill({ color: 0x110022, alpha: 1.0 });

  // Orbiting dots (static representation)
  const dotCount = 6;
  for (let i = 0; i < dotCount; i++) {
    const angle = (Math.PI * 2 / dotCount) * i;
    const dr = radius * 0.85;
    g.circle(Math.cos(angle) * dr, Math.sin(angle) * dr, 3)
      .fill({ color: 0xffffff, alpha: 0.7 });
  }
}

/** Overmind: pentagon with organic tendrils extending outward */
function drawOvermind(g: Graphics, radius: number, primary: number, accent: number): void {
  // Tendril-like glow extensions
  const tendrilCount = 5;
  for (let i = 0; i < tendrilCount; i++) {
    const angle = (Math.PI * 2 / tendrilCount) * i - Math.PI / 2;
    const tipDist = radius * 1.6;
    const spread = 0.15;

    // Each tendril is a tapered triangle
    g.moveTo(
      Math.cos(angle - spread) * radius * 0.7,
      Math.sin(angle - spread) * radius * 0.7,
    );
    g.lineTo(
      Math.cos(angle) * tipDist,
      Math.sin(angle) * tipDist,
    );
    g.lineTo(
      Math.cos(angle + spread) * radius * 0.7,
      Math.sin(angle + spread) * radius * 0.7,
    );
    g.closePath();
    g.fill({ color: accent, alpha: 0.4 });
    g.stroke({ width: 1, color: accent, alpha: 0.6 });
  }

  // Glow rings
  for (let ring = 2; ring >= 1; ring--) {
    const r = radius + ring * 3;
    drawRegularPolygon(g, 5, r);
    g.stroke({ width: 1.5, color: accent, alpha: 0.25 });
  }

  // Main pentagon body
  drawRegularPolygon(g, 5, radius);
  g.fill({ color: primary });
  g.stroke({ width: 2, color: accent });

  // Inner eye
  g.circle(0, 0, radius * 0.25).fill({ color: 0x000000, alpha: 0.6 });
  g.circle(0, 0, radius * 0.12).fill({ color: accent, alpha: 0.8 });
}

/** Meltdown: thick-bordered circle with inner nuclear triangle, heat wave rings */
function drawMeltdown(g: Graphics, radius: number, primary: number, accent: number): void {
  // Heat wave rings radiating outward
  for (let ring = 3; ring >= 1; ring--) {
    const r = radius + ring * 5;
    g.circle(0, 0, r).stroke({ width: 2, color: accent, alpha: 0.25 + ring * 0.05 });
  }

  // Outer thick circle body
  g.circle(0, 0, radius).fill({ color: primary, alpha: 0.9 });
  g.circle(0, 0, radius).stroke({ width: 4, color: accent });

  // Inner rotating-style nuclear triangle
  const innerR = radius * 0.55;
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
    const px = Math.cos(angle) * innerR;
    const py = Math.sin(angle) * innerR;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill({ color: 0xffcc00, alpha: 0.5 });
  g.stroke({ width: 2, color: accent, alpha: 0.8 });

  // Center core (hot white dot)
  g.circle(0, 0, radius * 0.15).fill({ color: 0xffffaa, alpha: 0.9 });
  g.circle(0, 0, radius * 0.08).fill({ color: 0xffffff, alpha: 1.0 });
}

/** Dread Hollow: amorphous blob with a single glowing eye */
function drawDreadHollow(g: Graphics, radius: number, primary: number, accent: number): void {
  // Faint outer wispy glow
  for (let ring = 3; ring >= 1; ring--) {
    const r = radius + ring * 4;
    g.circle(0, 0, r).stroke({ width: 1, color: accent, alpha: 0.1 + ring * 0.03 });
  }

  // Amorphous blob body (use a wobbly polygon to simulate organic shape)
  const blobPoints = 12;
  for (let i = 0; i < blobPoints; i++) {
    const angle = (Math.PI * 2 / blobPoints) * i;
    // Vary the radius to create an irregular shape
    const wobble = radius * (0.85 + 0.15 * Math.sin(i * 2.7 + 0.5));
    const px = Math.cos(angle) * wobble;
    const py = Math.sin(angle) * wobble;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill({ color: primary, alpha: 0.85 });
  g.stroke({ width: 2, color: 0x333388, alpha: 0.6 });

  // Single glowing eye
  g.circle(0, -radius * 0.1, radius * 0.22).fill({ color: 0x000022, alpha: 0.8 });
  g.circle(0, -radius * 0.1, radius * 0.14).fill({ color: accent, alpha: 0.9 });
  g.circle(0, -radius * 0.1, radius * 0.06).fill({ color: 0xffffff, alpha: 1.0 });
}

/** Prism Lord: dodecahedron (12-sided) with multi-colored neon faces */
function drawPrismLord(g: Graphics, radius: number, _primary: number, accent: number): void {
  const sides = 12;
  const faceColors = [
    0xff4444, 0xff8844, 0xffcc44, 0x88ff44,
    0x44ff88, 0x44ffcc, 0x44ccff, 0x4488ff,
    0x4444ff, 0x8844ff, 0xcc44ff, 0xff44cc,
  ];

  // Outer glow rings
  for (let ring = 3; ring >= 1; ring--) {
    const r = radius + ring * 3;
    drawRegularPolygon(g, sides, r);
    g.stroke({ width: 1.5, color: accent, alpha: 0.2 + ring * 0.05 });
  }

  // Draw each face as a triangle from center to edge
  for (let i = 0; i < sides; i++) {
    const a1 = (Math.PI * 2 / sides) * i - Math.PI / 2;
    const a2 = (Math.PI * 2 / sides) * (i + 1) - Math.PI / 2;
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
    g.lineTo(Math.cos(a2) * radius, Math.sin(a2) * radius);
    g.closePath();
    g.fill({ color: faceColors[i], alpha: 0.7 });
  }

  // Outline
  drawRegularPolygon(g, sides, radius);
  g.stroke({ width: 2, color: accent });

  // Inner prismatic core
  drawRegularPolygon(g, sides, radius * 0.35);
  g.fill({ color: 0xffffff, alpha: 0.4 });
  g.stroke({ width: 1, color: accent, alpha: 0.6 });

  // Center bright dot
  g.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.9 });
}

/** Void Weaver: 8-point pulsating star with magenta/deep purple body */
function drawVoidWeaver(g: Graphics, radius: number, primary: number, accent: number): void {
  // Glow rings
  for (let ring = 3; ring >= 1; ring--) {
    const r = radius + ring * 4;
    g.circle(0, 0, r).stroke({ width: 1.5, color: accent, alpha: 0.2 + ring * 0.05 });
  }

  // 8-point star shape
  const outerR = radius;
  const innerR = radius * 0.5;
  const points = 8;
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * 2 / (points * 2)) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill({ color: primary, alpha: 0.85 });
  g.stroke({ width: 2, color: accent });

  // Inner void core
  g.circle(0, 0, radius * 0.2).fill({ color: 0x220044, alpha: 0.9 });
  g.circle(0, 0, radius * 0.12).fill({ color: accent, alpha: 0.7 });
}

/** Cryo Matrix: hexagonal core with 6 crystal arm extensions */
function drawCryoMatrix(g: Graphics, radius: number, primary: number, accent: number): void {
  // Crystal arm extensions (6 spikes)
  const armCount = 6;
  for (let i = 0; i < armCount; i++) {
    const angle = (Math.PI * 2 / armCount) * i - Math.PI / 2;
    const tipDist = radius * 1.5;
    const baseWidth = 0.12;

    g.moveTo(
      Math.cos(angle - baseWidth) * radius * 0.6,
      Math.sin(angle - baseWidth) * radius * 0.6,
    );
    g.lineTo(Math.cos(angle) * tipDist, Math.sin(angle) * tipDist);
    g.lineTo(
      Math.cos(angle + baseWidth) * radius * 0.6,
      Math.sin(angle + baseWidth) * radius * 0.6,
    );
    g.closePath();
    g.fill({ color: accent, alpha: 0.5 });
    g.stroke({ width: 1, color: accent, alpha: 0.7 });
  }

  // Glow rings
  for (let ring = 2; ring >= 1; ring--) {
    const r = radius + ring * 3;
    drawRegularPolygon(g, 6, r);
    g.stroke({ width: 1.5, color: accent, alpha: 0.25 });
  }

  // Hexagonal core body
  drawRegularPolygon(g, 6, radius);
  g.fill({ color: primary, alpha: 0.85 });
  g.stroke({ width: 2, color: accent });

  // Inner snowflake pattern
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 / 6) * i;
    g.moveTo(0, 0);
    g.lineTo(Math.cos(angle) * radius * 0.6, Math.sin(angle) * radius * 0.6);
    g.stroke({ width: 1, color: accent, alpha: 0.4 });
  }

  // Center crystal
  g.circle(0, 0, radius * 0.15).fill({ color: 0xffffff, alpha: 0.6 });
}

/** Arc Tyrant: jagged zigzag bolt shape with sparks */
function drawArcTyrant(g: Graphics, radius: number, primary: number, accent: number): void {
  // Glow arcs
  for (let ring = 3; ring >= 1; ring--) {
    const r = radius + ring * 3;
    g.circle(0, 0, r).stroke({ width: 1.5, color: primary, alpha: 0.15 + ring * 0.05 });
  }

  // Zigzag bolt body (7-sided irregular polygon)
  const zigPoints = [
    { x: 0, y: -radius },
    { x: radius * 0.6, y: -radius * 0.5 },
    { x: radius * 0.3, y: -radius * 0.1 },
    { x: radius * 0.8, y: radius * 0.3 },
    { x: radius * 0.1, y: radius * 0.5 },
    { x: -radius * 0.4, y: radius * 0.9 },
    { x: -radius * 0.2, y: radius * 0.2 },
    { x: -radius * 0.7, y: -radius * 0.1 },
    { x: -radius * 0.3, y: -radius * 0.5 },
  ];

  g.moveTo(zigPoints[0].x, zigPoints[0].y);
  for (let i = 1; i < zigPoints.length; i++) {
    g.lineTo(zigPoints[i].x, zigPoints[i].y);
  }
  g.closePath();
  g.fill({ color: primary, alpha: 0.9 });
  g.stroke({ width: 2, color: accent });

  // Lightning spark lines from center
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 / 5) * i + 0.3;
    const dist = radius * 0.5;
    const midX = Math.cos(angle + 0.2) * dist * 0.5;
    const midY = Math.sin(angle + 0.2) * dist * 0.5;
    g.moveTo(0, 0);
    g.lineTo(midX, midY);
    g.lineTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
  }

  // Center energy dot
  g.circle(0, 0, 5).fill({ color: 0xffffff, alpha: 0.9 });
}

/** Recursion: Sierpinski fractal triangle */
function drawRecursion(g: Graphics, radius: number, primary: number, accent: number): void {
  // Glow rings
  for (let ring = 2; ring >= 1; ring--) {
    const r = radius + ring * 4;
    drawRegularPolygon(g, 3, r);
    g.stroke({ width: 1.5, color: accent, alpha: 0.2 + ring * 0.05 });
  }

  // Main triangle
  drawRegularPolygon(g, 3, radius);
  g.fill({ color: primary, alpha: 0.85 });
  g.stroke({ width: 2, color: accent });

  // Inner Sierpinski-style triangle cutout (inverted triangle)
  const innerR = radius * 0.45;
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i + Math.PI / 6;
    const px = Math.cos(angle) * innerR;
    const py = Math.sin(angle) * innerR;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill({ color: 0x003322, alpha: 0.6 });
  g.stroke({ width: 1, color: accent, alpha: 0.6 });

  // Three smaller triangles at corners (depth 2 hint)
  const subR = radius * 0.2;
  const subDist = radius * 0.55;
  for (let c = 0; c < 3; c++) {
    const cAngle = (Math.PI * 2 / 3) * c - Math.PI / 2;
    const cx = Math.cos(cAngle) * subDist;
    const cy = Math.sin(cAngle) * subDist;
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
      const px = cx + Math.cos(angle) * subR;
      const py = cy + Math.sin(angle) * subR;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill({ color: accent, alpha: 0.3 });
    g.stroke({ width: 1, color: accent, alpha: 0.5 });
  }

  // Center dot
  g.circle(0, 0, 4).fill({ color: accent, alpha: 0.8 });
}

/** Default hexagon shape for bosses without a custom shape */
function drawGenericHexagon(
  g: Graphics, radius: number,
  primary: number, accent: number, id: string,
): void {
  const glowColors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0xff00ff];
  for (let ring = 3; ring >= 1; ring--) {
    const r = radius + ring * 3;
    const color = id === 'generic' ? glowColors[ring % glowColors.length] : accent;
    drawRegularPolygon(g, 6, r);
    g.stroke({ width: 2, color, alpha: 0.5 });
  }

  drawRegularPolygon(g, 6, radius);
  g.fill({ color: primary });
  g.stroke({ width: 2, color: accent });
}

/** Helper: draws a regular polygon centered at (0,0). Does NOT fill/stroke. */
function drawRegularPolygon(g: Graphics, sides: number, radius: number): void {
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/**
 * Spawns a boss enemy. If a bossType ID is provided the boss uses that
 * design's colors, radius, HP/damage multipliers, and speed. Falls back
 * to the generic boss design when the ID is unknown or omitted.
 */
export function spawnBoss(worldX: number, worldY: number, level = 1, bossType?: string): Entity {
  const design: BossDesign = (bossType ? getBossDesign(bossType) : undefined) ?? GENERIC_BOSS;

  const radius = design.radius;
  const primaryColor = design.primaryColor;
  const accentColor = design.accentColor;
  const speed = design.baseSpeed;

  const g = new Graphics();

  // Delegate to shape-specific draw function based on boss ID
  drawBossShape(g, design.id, radius, primaryColor, accentColor);

  g.position.set(worldX, worldY);
  game.entityLayer.addChild(g);

  const hp = scaleHealth(Math.round(BOSS_BASE_HP * design.hpMultiplier), level);
  const dmg = scaleDamage(Math.round(BOSS_BASE_DAMAGE * design.damageMultiplier), level);

  return world.add({
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    speed,
    baseSpeed: speed,
    enemy: true as const,
    boss: true as const,
    bossPhase: 1,
    bossType: design.id,
    enemyType: 'boss',
    health: { current: hp, max: hp },
    damage: dmg,
    sprite: g,
    level,
    aiTimer: 0,
    aiState: 'chase',
  });
}
