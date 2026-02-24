import { InputManager } from './InputManager';
import { getComputedStats } from './ComputedStats';

export interface SkillDef {
  name: string;
  key: string;          // hotbar key: '1', '2', '3', '4'
  cooldown: number;     // seconds
  execute: (playerPos: { x: number; y: number }, mousePos: { x: number; y: number }) => void;
}

export interface SkillState {
  def: SkillDef;
  cooldownRemaining: number;
}

const KEY_CODES: Record<string, string> = {
  '1': 'Digit1',
  '2': 'Digit2',
  '3': 'Digit3',
  '4': 'Digit4',
  '5': 'Digit5',
  '6': 'Digit6',
};

class SkillSystem {
  private skills: SkillState[] = [];
  private prevPressed = new Set<string>();
  private _activeClass = '';

  /** Set the current class skills (replaces all). */
  setClass(defs: SkillDef[], className?: string): void {
    this.skills = defs.map((def) => ({
      def,
      cooldownRemaining: 0,
    }));
    if (className) this._activeClass = className;
  }

  /** Get the name of the currently active class. */
  get activeClass(): string {
    return this._activeClass;
  }

  /** Set the active class name (used by save/load). */
  set activeClass(name: string) {
    this._activeClass = name;
  }

  /** Decrease cooldowns each tick. */
  tickSkills(dt: number): void {
    for (const skill of this.skills) {
      if (skill.cooldownRemaining > 0) {
        skill.cooldownRemaining -= dt;
        if (skill.cooldownRemaining < 0) skill.cooldownRemaining = 0;
      }
    }
  }

  /** Try to use a skill by index (0-3). Returns true if it fired. */
  tryUseSkill(
    index: number,
    playerPos: { x: number; y: number },
    mousePos: { x: number; y: number },
  ): boolean {
    const skill = this.skills[index];
    if (!skill) return false;
    if (skill.cooldownRemaining > 0) return false;

    skill.def.execute(playerPos, mousePos);
    // Apply cooldown reduction from gear + focus stat (capped at 40%)
    const cdr = getComputedStats().cooldownReduction;
    skill.cooldownRemaining = skill.def.cooldown * (1 - cdr);
    return true;
  }

  /**
   * Check key presses (1-4) and trigger skills.
   * Must be called each tick with player position.
   */
  checkInput(playerPos: { x: number; y: number }): void {
    const input = InputManager.instance;
    const mousePos = input.getMousePosition();

    for (let i = 0; i < this.skills.length; i++) {
      const keyCode = KEY_CODES[this.skills[i].def.key];
      if (!keyCode) continue;

      const isDown = input.isPressed(keyCode);
      const wasDown = this.prevPressed.has(keyCode);

      // Only trigger on key-down edge (not held)
      if (isDown && !wasDown) {
        this.tryUseSkill(i, playerPos, mousePos);
      }

      if (isDown) {
        this.prevPressed.add(keyCode);
      } else {
        this.prevPressed.delete(keyCode);
      }
    }
  }

  /** Get skill states for HUD display. */
  getSkills(): readonly SkillState[] {
    return this.skills;
  }
}

export const skillSystem = new SkillSystem();
