import { Graphics } from 'pixi.js';
import { game } from '../Game';
import { skillSystem, type SkillSlot } from '../core/SkillSystem';

const INDICATOR_ALPHA_FILL = 0.15;
const INDICATOR_ALPHA_STROKE = 0.4;

let gfx: Graphics | null = null;

function getOrCreateGfx(): Graphics {
  if (!gfx) {
    gfx = new Graphics();
    game.effectLayer.addChild(gfx);
  }
  return gfx;
}

/**
 * Draw range indicators for any currently held skill input.
 * Called every frame from Game.frameUpdate().
 */
export function updateRangeIndicators(
  playerPos: { x: number; y: number },
  mouseWorldPos: { x: number; y: number },
): void {
  const g = getOrCreateGfx();
  g.clear();

  const inputs = skillSystem.getActiveInputs();

  const slotKeys: { slot: SkillSlot; held: boolean }[] = [
    { slot: 'lmb', held: inputs.lmb },
    { slot: 'rmb', held: inputs.rmb },
    { slot: 'space', held: inputs.space },
    { slot: 'e', held: inputs.e },
  ];

  for (const { slot, held } of slotKeys) {
    if (!held) continue;

    const state = skillSystem.getSlot(slot);
    if (!state) continue;

    const def = state.def;

    switch (def.targetType) {
      case 'projectile': {
        // Thin line from player toward cursor
        const dx = mouseWorldPos.x - playerPos.x;
        const dy = mouseWorldPos.y - playerPos.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const nx = dx / len;
          const ny = dy / len;
          const lineLen = 300;
          g.moveTo(playerPos.x, playerPos.y);
          g.lineTo(playerPos.x + nx * lineLen, playerPos.y + ny * lineLen);
          g.stroke({ width: 2, color: 0xffffff, alpha: INDICATOR_ALPHA_STROKE });
        }
        break;
      }

      case 'self_aoe': {
        // Circle centered on player
        const radius = def.radius ?? 100;
        g.circle(playerPos.x, playerPos.y, radius)
          .fill({ color: 0x66ccff, alpha: INDICATOR_ALPHA_FILL });
        g.circle(playerPos.x, playerPos.y, radius)
          .stroke({ width: 2, color: 0x66ccff, alpha: INDICATOR_ALPHA_STROKE });
        break;
      }

      case 'cursor_aoe': {
        // Circle at cursor position
        const radius = def.radius ?? 96;
        g.circle(mouseWorldPos.x, mouseWorldPos.y, radius)
          .fill({ color: 0xff6600, alpha: INDICATOR_ALPHA_FILL });
        g.circle(mouseWorldPos.x, mouseWorldPos.y, radius)
          .stroke({ width: 2, color: 0xff6600, alpha: INDICATOR_ALPHA_STROKE });
        break;
      }

      case 'cursor_target': {
        // Range circle around player
        const range = def.range ?? 200;
        g.circle(playerPos.x, playerPos.y, range)
          .stroke({ width: 2, color: 0xffff00, alpha: INDICATOR_ALPHA_STROKE });
        break;
      }

      case 'movement': {
        // Ghost marker at cursor/destination
        g.circle(mouseWorldPos.x, mouseWorldPos.y, 8)
          .fill({ color: 0x66eeff, alpha: 0.3 });
        g.circle(mouseWorldPos.x, mouseWorldPos.y, 12)
          .stroke({ width: 2, color: 0x66eeff, alpha: INDICATOR_ALPHA_STROKE });
        break;
      }

      case 'self_place': {
        // Small circle at player feet
        g.circle(playerPos.x, playerPos.y, 24)
          .fill({ color: 0x00ff44, alpha: INDICATOR_ALPHA_FILL });
        g.circle(playerPos.x, playerPos.y, 24)
          .stroke({ width: 2, color: 0x00ff44, alpha: INDICATOR_ALPHA_STROKE });
        break;
      }
    }
  }
}
