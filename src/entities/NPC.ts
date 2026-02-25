/**
 * NPC entities for the town hub.
 *
 * Each NPC is a colored shape with a label placed on the entity layer.
 * Clicking within range triggers the corresponding panel.
 */

import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { game } from '../Game';
import { openVendorPanel } from '../ui/VendorPanel';
import { openCraftingPanel } from '../ui/CraftingPanel';
import { toggleClassSelect } from '../ui/ClassSelect';
import { openMapDevicePanel } from '../ui/MapDeviceUI';
import { openStashPanel } from '../ui/StashPanel';
import { Fonts, FontSize } from '../ui/UITheme';

const TILE_SIZE = 32;

export interface NPCDef {
  name: string;
  /** Tile offset from town center (spawn) */
  tileOffsetX: number;
  tileOffsetY: number;
  color: number;
  shape: 'diamond' | 'triangle' | 'circle' | 'hexagon' | 'square';
  action: () => void;
}

export const NPC_DEFS: NPCDef[] = [
  {
    name: 'Vendor',
    tileOffsetX: -8,
    tileOffsetY: 3,
    color: 0x44cc44,
    shape: 'diamond',
    action: () => openVendorPanel(),
  },
  {
    name: 'Salvage',
    tileOffsetX: -4,
    tileOffsetY: 3,
    color: 0xee8833,
    shape: 'triangle',
    action: () => openCraftingPanel(),
  },
  {
    name: 'Skill Trainer',
    tileOffsetX: 0,
    tileOffsetY: 3,
    color: 0x4488ff,
    shape: 'circle',
    action: () => toggleClassSelect(),
  },
  {
    name: 'Map Device',
    tileOffsetX: 4,
    tileOffsetY: 3,
    color: 0xaa44dd,
    shape: 'hexagon',
    action: () => openMapDevicePanel(),
  },
  {
    name: 'Stash',
    tileOffsetX: 8,
    tileOffsetY: 3,
    color: 0xdddddd,
    shape: 'square',
    action: () => openStashPanel(),
  },
];

// ── Active NPC containers ────────────────────────────────────────────

interface ActiveNPC {
  container: Container;
  worldX: number;
  worldY: number;
  action: () => void;
}

let activeNPCs: ActiveNPC[] = [];
let comingSoonText: Text | null = null;
let comingSoonTimer = 0;

function showComingSoon(): void {
  if (!comingSoonText) {
    comingSoonText = new Text({
      text: 'Coming soon!',
      style: new TextStyle({
        fill: 0xffffff,
        fontSize: FontSize.xl,
        fontFamily: Fonts.display,
        stroke: { color: 0x000000, width: 3 },
      }),
    });
    comingSoonText.anchor.set(0.5, 0.5);
    comingSoonText.position.set(640, 300);
    game.hudLayer.addChild(comingSoonText);
  }
  comingSoonText.visible = true;
  comingSoonTimer = 2;
}

/** Call from frameUpdate to fade out the "Coming soon" text. */
export function updateComingSoonText(dt: number): void {
  if (comingSoonTimer > 0) {
    comingSoonTimer -= dt;
    if (comingSoonTimer <= 0 && comingSoonText) {
      comingSoonText.visible = false;
    }
  }
}

// ── Shape drawing helpers ────────────────────────────────────────────

function drawDiamond(g: Graphics, color: number): void {
  g.moveTo(0, -12).lineTo(12, 0).lineTo(0, 12).lineTo(-12, 0).closePath().fill({ color });
}

function drawTriangle(g: Graphics, color: number): void {
  g.moveTo(0, -12).lineTo(12, 10).lineTo(-12, 10).closePath().fill({ color });
}

function drawCircle(g: Graphics, color: number): void {
  g.circle(0, 0, 12).fill({ color });
}

function drawHexagon(g: Graphics, color: number): void {
  const r = 12;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath().fill({ color });
}

function drawSquare(g: Graphics, color: number): void {
  g.rect(-10, -10, 20, 20).fill({ color });
}

const SHAPE_DRAWERS: Record<NPCDef['shape'], (g: Graphics, c: number) => void> = {
  diamond: drawDiamond,
  triangle: drawTriangle,
  circle: drawCircle,
  hexagon: drawHexagon,
  square: drawSquare,
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Spawn all town NPCs onto the entity layer.
 * @param spawnX center X of town in world coords
 * @param spawnY center Y of town in world coords
 */
export function spawnTownNPCs(spawnX: number, spawnY: number): void {
  removeAllNPCs();

  for (const def of NPC_DEFS) {
    const worldX = spawnX + def.tileOffsetX * TILE_SIZE;
    const worldY = spawnY + def.tileOffsetY * TILE_SIZE;

    const npcContainer = new Container();
    npcContainer.position.set(worldX, worldY);

    // Draw shape
    const gfx = new Graphics();
    SHAPE_DRAWERS[def.shape](gfx, def.color);
    npcContainer.addChild(gfx);

    // Label above
    const label = new Text({
      text: def.name,
      style: new TextStyle({
        fill: 0xffffff,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
        stroke: { color: 0x000000, width: 2 },
      }),
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -42);
    npcContainer.addChild(label);

    game.entityLayer.addChild(npcContainer);

    activeNPCs.push({
      container: npcContainer,
      worldX,
      worldY,
      action: def.action,
    });
  }
}

/** Remove all NPC containers from the entity layer. */
export function removeAllNPCs(): void {
  for (const npc of activeNPCs) {
    npc.container.removeFromParent();
    npc.container.destroy({ children: true });
  }
  activeNPCs = [];

  if (comingSoonText) {
    comingSoonText.removeFromParent();
    comingSoonText.destroy();
    comingSoonText = null;
    comingSoonTimer = 0;
  }
}

/**
 * Check if a click at (worldX, worldY) hits an NPC.
 * If so, trigger the NPC action and return true.
 */
export function checkNPCClick(worldX: number, worldY: number): boolean {
  const NPC_CLICK_RADIUS = 40;
  for (const npc of activeNPCs) {
    const dx = worldX - npc.worldX;
    const dy = worldY - npc.worldY;
    if (dx * dx + dy * dy <= NPC_CLICK_RADIUS * NPC_CLICK_RADIUS) {
      npc.action();
      return true;
    }
  }
  return false;
}

/** Returns true if any NPCs are currently placed. */
export function hasActiveNPCs(): boolean {
  return activeNPCs.length > 0;
}
