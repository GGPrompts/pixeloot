import { InputManager } from './InputManager';
import { getComputedStats } from './ComputedStats';
import { sfxPlayer } from '../audio/SFXManager';
import { screenToWorld } from '../Game';

export type SlotType = 'primary' | 'movement' | 'assignable';
export type TargetType = 'projectile' | 'self_aoe' | 'cursor_aoe' | 'cursor_target' | 'movement' | 'self_place';
export type SkillSlot = 'lmb' | 'rmb' | 'space' | 'e';

export interface SkillDef {
  name: string;
  key: string;          // legacy key (unused in new system)
  cooldown: number;     // seconds
  slotType: SlotType;
  targetType: TargetType;
  range?: number;       // max cast/search range in px
  radius?: number;      // AoE radius in px
  execute: (playerPos: { x: number; y: number }, mousePos: { x: number; y: number }) => void;
}

export interface SkillState {
  def: SkillDef;
  cooldownRemaining: number;
}

const SLOTS: SkillSlot[] = ['lmb', 'rmb', 'space', 'e'];

class SkillSystem {
  /** Named skill slots: lmb (primary), rmb (assignable), space (movement), e (assignable) */
  private slots: Record<SkillSlot, SkillState | null> = {
    lmb: null,
    rmb: null,
    space: null,
    e: null,
  };

  /** All 6 class skills (for the assignment UI) */
  private _allClassSkills: SkillDef[] = [];

  private _activeClass = '';

  // Rising-edge detection
  private prevLMB = false;
  private prevRMB = false;
  private prevSpace = false;
  private prevE = false;

  /** Set the current class skills. Auto-assigns primary to LMB, movement to Space. */
  setClass(defs: SkillDef[], className?: string): void {
    this._allClassSkills = defs;
    if (className) this._activeClass = className;

    // Reset all slots
    this.slots.lmb = null;
    this.slots.rmb = null;
    this.slots.space = null;
    this.slots.e = null;

    // Auto-assign fixed slots
    for (const def of defs) {
      if (def.slotType === 'primary' && !this.slots.lmb) {
        this.slots.lmb = { def, cooldownRemaining: 0 };
      } else if (def.slotType === 'movement' && !this.slots.space) {
        this.slots.space = { def, cooldownRemaining: 0 };
      }
    }

    // Auto-assign first two assignable skills to RMB and E as defaults
    const assignable = defs.filter(d => d.slotType === 'assignable');
    if (assignable.length >= 1 && !this.slots.rmb) {
      this.slots.rmb = { def: assignable[0], cooldownRemaining: 0 };
    }
    if (assignable.length >= 2 && !this.slots.e) {
      this.slots.e = { def: assignable[1], cooldownRemaining: 0 };
    }
  }

  get activeClass(): string {
    return this._activeClass;
  }

  set activeClass(name: string) {
    this._activeClass = name;
  }

  /** All 6 class skills for the assignment panel. */
  get allClassSkills(): readonly SkillDef[] {
    return this._allClassSkills;
  }

  /** Returns the 4 assignable-type skills for the assignment UI. */
  getAssignableSkills(): SkillDef[] {
    return this._allClassSkills.filter(d => d.slotType === 'assignable');
  }

  /** Assign a skill to RMB or E slot. Swaps if the skill is in the other slot. */
  assignSkill(slot: 'rmb' | 'e', skillDef: SkillDef): void {
    if (skillDef.slotType !== 'assignable') return;

    const otherSlot: 'rmb' | 'e' = slot === 'rmb' ? 'e' : 'rmb';

    // If the skill is already in the other slot, swap
    if (this.slots[otherSlot]?.def.name === skillDef.name) {
      const currentInTarget = this.slots[slot];
      this.slots[otherSlot] = currentInTarget; // may be null
    }

    this.slots[slot] = { def: skillDef, cooldownRemaining: 0 };
  }

  /** Assign a skill by name (used by save/load). */
  assignSkillByName(slot: 'rmb' | 'e', skillName: string): void {
    const def = this._allClassSkills.find(d => d.name === skillName);
    if (def && def.slotType === 'assignable') {
      this.assignSkill(slot, def);
    }
  }

  /** Decrease cooldowns each tick. */
  tickSkills(dt: number): void {
    for (const key of SLOTS) {
      const skill = this.slots[key];
      if (skill && skill.cooldownRemaining > 0) {
        skill.cooldownRemaining -= dt;
        if (skill.cooldownRemaining < 0) skill.cooldownRemaining = 0;
      }
    }
  }

  /** Try to use a skill in a given slot. Returns true if it fired. */
  tryUseSlot(
    slot: SkillSlot,
    playerPos: { x: number; y: number },
    mousePos: { x: number; y: number },
  ): boolean {
    const skill = this.slots[slot];
    if (!skill) return false;
    if (skill.cooldownRemaining > 0) return false;

    skill.def.execute(playerPos, mousePos);
    const castSfx = this._activeClass === 'mage' ? 'cast_mage' : 'cast_ranger';
    sfxPlayer.play(castSfx);
    const cdr = getComputedStats().cooldownReduction;
    skill.cooldownRemaining = skill.def.cooldown * (1 - cdr);
    return true;
  }

  /**
   * Check inputs (LMB, RMB, Space, E) and trigger skills on rising edge.
   * Must be called each tick with player position.
   */
  checkInput(playerPos: { x: number; y: number }): void {
    const input = InputManager.instance;
    const screenMouse = input.getMousePosition();
    const mousePos = screenToWorld(screenMouse.x, screenMouse.y);

    // LMB (mouse button 0)
    const lmb = input.isMouseDown(0);
    if (lmb && !this.prevLMB) {
      this.tryUseSlot('lmb', playerPos, mousePos);
    }
    this.prevLMB = lmb;

    // RMB (mouse button 2)
    const rmb = input.isMouseDown(2);
    if (rmb && !this.prevRMB) {
      this.tryUseSlot('rmb', playerPos, mousePos);
    }
    this.prevRMB = rmb;

    // Space
    const space = input.isPressed('Space');
    if (space && !this.prevSpace) {
      this.tryUseSlot('space', playerPos, mousePos);
    }
    this.prevSpace = space;

    // E
    const e = input.isPressed('KeyE');
    if (e && !this.prevE) {
      this.tryUseSlot('e', playerPos, mousePos);
    }
    this.prevE = e;
  }

  /**
   * Reset previous input state so rising-edge detection works correctly
   * after panels close or returning from town. Call when checkInput is
   * NOT being called (panels open, in town) so stale prev state doesn't
   * eat the next real input.
   */
  resetPrevInput(): void {
    const input = InputManager.instance;
    this.prevLMB = input.isMouseDown(0);
    this.prevRMB = input.isMouseDown(2);
    this.prevSpace = input.isPressed('Space');
    this.prevE = input.isPressed('KeyE');
  }

  /** Get skill states as a 4-element array [lmb, rmb, space, e] for hotbar display. */
  getSkills(): readonly (SkillState | null)[] {
    return [this.slots.lmb, this.slots.rmb, this.slots.space, this.slots.e];
  }

  /** Get the skill state for a specific slot. */
  getSlot(slot: SkillSlot): SkillState | null {
    return this.slots[slot];
  }

  /** Get the current active input state for range indicators. */
  getActiveInputs(): { lmb: boolean; rmb: boolean; space: boolean; e: boolean } {
    const input = InputManager.instance;
    return {
      lmb: input.isMouseDown(0),
      rmb: input.isMouseDown(2),
      space: input.isPressed('Space'),
      e: input.isPressed('KeyE'),
    };
  }
}

export const skillSystem = new SkillSystem();
