/** One continuous architectural plan level, below every doorway lintel and roof. */
export const PLAN_DURATION_MS = 500;
export const PLAN_CUT_HEIGHT = 5.0;
export const PLAN_START_HEIGHT = 40;

export function planEase(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}

export function planCutHeight(progress: number) {
  return PLAN_START_HEIGHT + (PLAN_CUT_HEIGHT - PLAN_START_HEIGHT) * planEase(progress);
}

export class PlanTimeline {
  progress = 0;
  target = 0;
  private started = 0;
  private from = 0;
  private duration = PLAN_DURATION_MS;
  animating = false;

  setRevealed(revealed: boolean, now: number, reduced = false) {
    this.update(now);
    const target = revealed ? 1 : 0;
    if (target === this.target) return false;
    this.from = this.progress;
    this.target = target;
    this.started = now;
    this.duration = PLAN_DURATION_MS * Math.abs(this.target - this.from);
    this.animating = !reduced && this.duration > 0;
    if (reduced) this.progress = this.target;
    return true;
  }

  update(now: number) {
    if (!this.animating) return;
    const t = Math.max(0, Math.min(1, (now - this.started) / this.duration));
    this.progress = this.from + (this.target - this.from) * t;
    if (t === 1) this.animating = false;
  }

  finish() { this.progress = this.target; this.animating = false; }
  reset() { this.progress = this.target = 0; this.animating = false; }
}
