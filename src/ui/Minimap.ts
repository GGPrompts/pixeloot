import { Container, Graphics } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { isInTown } from '../core/TownManager';

const MAP_SIZE = 150;
const MAP_X = 1280 - MAP_SIZE - 10; // 10px padding from right edge
const MAP_Y = 24; // below the mute/volume text
const BG_COLOR = 0x111118;
const BG_ALPHA = 0.75;
const WALL_COLOR = 0x444455;
const FLOOR_COLOR = 0x222233;
const PLAYER_COLOR = 0x00ffff;
const ENEMY_COLOR = 0xff3333;
const BOSS_COLOR = 0xffdd00;
const UPDATE_INTERVAL = 10; // update enemy dots every N frames

const players = world.with('player', 'position');
const enemies = world.with('enemy', 'position');

let container: Container | null = null;
let bgGfx: Graphics;
let layoutGfx: Graphics;
let entityGfx: Graphics;
let visible = true;
let initialized = false;
let prevNPressed = false;
let frameCounter = 0;

// Cached scale factors for tile-to-minimap conversion
let scaleX = 1;
let scaleY = 1;

function initMinimap(): void {
  container = new Container();
  container.position.set(MAP_X, MAP_Y);

  // Semi-transparent background
  bgGfx = new Graphics();
  bgGfx.rect(0, 0, MAP_SIZE, MAP_SIZE).fill({ color: BG_COLOR, alpha: BG_ALPHA });
  // Thin border
  bgGfx.rect(0, 0, MAP_SIZE, MAP_SIZE).stroke({ color: 0x555566, width: 1 });
  container.addChild(bgGfx);

  // Dungeon layout layer (rendered once per map)
  layoutGfx = new Graphics();
  container.addChild(layoutGfx);

  // Entity dots layer (updated periodically)
  entityGfx = new Graphics();
  container.addChild(entityGfx);

  game.hudLayer.addChild(container);
  initialized = true;

  // Render the initial dungeon layout
  renderLayout();
}

/** Render the dungeon tile layout onto the cached layoutGfx. Call once per map load. */
function renderLayout(): void {
  layoutGfx.clear();

  const tileMap = game.tileMap;
  const tileW = tileMap.width;
  const tileH = tileMap.height;

  scaleX = MAP_SIZE / (tileW * 32);
  scaleY = MAP_SIZE / (tileH * 32);

  // Pixel size per tile on the minimap
  const dotW = Math.max(1, MAP_SIZE / tileW);
  const dotH = Math.max(1, MAP_SIZE / tileH);

  for (let ty = 0; ty < tileH; ty++) {
    for (let tx = 0; tx < tileW; tx++) {
      const isWall = tileMap.tiles[ty][tx] === 1;
      const mx = (tx / tileW) * MAP_SIZE;
      const my = (ty / tileH) * MAP_SIZE;

      if (isWall) {
        layoutGfx.rect(mx, my, dotW, dotH).fill({ color: WALL_COLOR, alpha: 0.6 });
      } else {
        layoutGfx.rect(mx, my, dotW, dotH).fill({ color: FLOOR_COLOR, alpha: 0.5 });
      }
    }
  }
}

/** Update entity positions on the minimap. */
function renderEntities(): void {
  entityGfx.clear();

  // Player dot (bright cyan, slightly larger)
  if (players.entities.length > 0) {
    const p = players.entities[0];
    if (p.position) {
      const px = p.position.x * scaleX;
      const py = p.position.y * scaleY;
      entityGfx.circle(px, py, 3).fill({ color: PLAYER_COLOR });
    }
  }

  // Enemy and boss dots
  for (const e of enemies) {
    if (e.dead) continue;
    if (!e.position) continue;

    const ex = e.position.x * scaleX;
    const ey = e.position.y * scaleY;

    if (e.boss) {
      // Boss: larger yellow dot
      entityGfx.circle(ex, ey, 3.5).fill({ color: BOSS_COLOR });
    } else {
      // Regular enemy: small red dot
      entityGfx.circle(ex, ey, 2).fill({ color: ENEMY_COLOR });
    }
  }
}

/** Re-render the dungeon layout (call when map changes, e.g. new dungeon generated). */
export function refreshMinimapLayout(): void {
  if (!initialized) return;
  renderLayout();
}

/** Main update function - call from frameUpdate in Game.ts */
export function updateMinimap(): void {
  if (!initialized) initMinimap();

  // Toggle with N key (edge-detected)
  const nDown = InputManager.instance.isPressed('KeyN');
  if (nDown && !prevNPressed) {
    visible = !visible;
  }
  prevNPressed = nDown;

  // Hide minimap in town
  if (container) {
    container.visible = visible && !isInTown();
  }

  if (!visible || isInTown()) return;

  // Update entity positions periodically for performance
  frameCounter++;
  if (frameCounter >= UPDATE_INTERVAL) {
    frameCounter = 0;
    renderEntities();
  }
}
