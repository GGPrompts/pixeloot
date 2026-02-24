import { Container, Graphics } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { isInTown } from '../core/TownManager';
import { Colors, drawPixelBorder } from './UITheme';
import { SCREEN_W } from '../core/constants';

const MAP_SIZE = 160;
const MAP_X = SCREEN_W - MAP_SIZE - 10;
const MAP_Y = 24;
const BG_COLOR = 0x0D0D1A;
const BG_ALPHA = 0.8;
const WALL_COLOR = 0x444455;
const FLOOR_COLOR = 0x222233;
const PLAYER_COLOR = Colors.accentCyan;
const ENEMY_COLOR = Colors.accentRed;
const BOSS_COLOR = Colors.accentGold;
const UPDATE_INTERVAL = 10;

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

let scaleX = 1;
let scaleY = 1;

function initMinimap(): void {
  container = new Container();
  container.position.set(MAP_X, MAP_Y);

  bgGfx = new Graphics();
  bgGfx.rect(0, 0, MAP_SIZE, MAP_SIZE).fill({ color: BG_COLOR, alpha: BG_ALPHA });
  drawPixelBorder(bgGfx, 0, 0, MAP_SIZE, MAP_SIZE, { borderWidth: 2 });
  container.addChild(bgGfx);

  layoutGfx = new Graphics();
  container.addChild(layoutGfx);

  entityGfx = new Graphics();
  container.addChild(entityGfx);

  game.hudLayer.addChild(container);
  initialized = true;

  renderLayout();
}

function renderLayout(): void {
  layoutGfx.clear();

  const tileMap = game.tileMap;
  const tileW = tileMap.width;
  const tileH = tileMap.height;

  scaleX = MAP_SIZE / (tileW * 32);
  scaleY = MAP_SIZE / (tileH * 32);

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

function renderEntities(): void {
  entityGfx.clear();

  if (players.entities.length > 0) {
    const p = players.entities[0];
    if (p.position) {
      const px = p.position.x * scaleX;
      const py = p.position.y * scaleY;
      entityGfx.circle(px, py, 3).fill({ color: PLAYER_COLOR });
    }
  }

  for (const e of enemies) {
    if (e.dead) continue;
    if (!e.position) continue;

    const ex = e.position.x * scaleX;
    const ey = e.position.y * scaleY;

    if (e.boss) {
      entityGfx.circle(ex, ey, 3.5).fill({ color: BOSS_COLOR });
    } else {
      entityGfx.circle(ex, ey, 2).fill({ color: ENEMY_COLOR });
    }
  }
}

export function refreshMinimapLayout(): void {
  if (!initialized) return;
  renderLayout();
}

export function updateMinimap(): void {
  if (!initialized) initMinimap();

  const nDown = InputManager.instance.isPressed('KeyN');
  if (nDown && !prevNPressed) {
    visible = !visible;
  }
  prevNPressed = nDown;

  if (container) {
    container.visible = visible && !isInTown();
  }

  if (!visible || isInTown()) return;

  frameCounter++;
  if (frameCounter >= UPDATE_INTERVAL) {
    frameCounter = 0;
    renderEntities();
  }
}
