## Resolution Upgrade: 1280x720 → 1920x1080

The canvas currently renders at 1280x720 and CSS-scales to fill the browser window, causing blurry text on larger monitors. Upgrade the internal resolution to 1920x1080.

### What needs to change:

1. **Game.ts** - Update `SCREEN_W` to 1920, `SCREEN_H` to 1080. Update `app.init()` width/height. Update mute text position (currently `SCREEN_W - 120`).

2. **UI Panel positions** - All panels use hardcoded `PANEL_X`, `PANEL_Y`, `PANEL_W`, `PANEL_H` constants. These need to be repositioned for the larger canvas. Key files:
   - `src/ui/VendorPanel.ts`
   - `src/ui/CraftingPanel.ts`
   - `src/ui/MapDeviceUI.ts`
   - `src/ui/InventoryPanel.ts`
   - `src/ui/StashPanel.ts`
   - `src/ui/SaveLoadPanel.ts`
   - `src/ui/StatPanel.ts`
   - `src/ui/ClassSelect.ts`
   - `src/ui/SkillHotbar.ts`
   - `src/ui/HUD.ts`
   - `src/ui/BossHealthBar.ts`
   - `src/ui/Minimap.ts`
   - `src/ui/DamageNumbers.ts`
   - `src/ui/LootFilterPanel.ts`

3. **Other hardcoded 1280/720 references** - grep for `1280` and `720` across the codebase. Known spots:
   - `src/ecs/systems/CameraSystem.ts` (SCREEN_W/H constants)
   - `src/ecs/systems/HealthSystem.ts` (death overlay rect)
   - `src/entities/NPC.ts` (coming soon text position)
   - `src/core/MapDevice.ts` (TILE_SIZE, grid drawing)
   - `src/map/TownMap.ts` (if it has hardcoded sizes)

4. **Consider making panels use relative positions** (e.g., `SCREEN_W / 2 - PANEL_W / 2` for centering) rather than absolute pixel values, to make future resolution changes easier.

### Approach:
- Change SCREEN_W/SCREEN_H constants
- Grep for all `1280` and `720` references and update
- Test each UI panel to verify positioning
- The CSS scaling in index.html + Game.ts should continue working as-is for monitors larger/smaller than 1080p
