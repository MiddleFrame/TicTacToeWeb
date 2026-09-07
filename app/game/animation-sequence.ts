export class AnimationSequence {
  private pending = new Set<() => void>();
  private animations = new Set<Animation>();
  cancelled = false;

  private schedule(start: (finish: () => void) => () => void): Promise<boolean> {
    if (this.cancelled) return Promise.resolve(false);
    return new Promise((resolve) => {
      const finish = () => {
        this.pending.delete(cancel);
        resolve(!this.cancelled);
      };
      const stop = start(finish);
      const cancel = () => {
        stop();
        finish();
      };
      this.pending.add(cancel);
    });
  }

  wait(duration: number): Promise<boolean> {
    return this.schedule((finish) => {
      const timer = window.setTimeout(finish, duration);
      return () => window.clearTimeout(timer);
    });
  }

  frame(update: (now: number) => void): Promise<boolean> {
    return this.schedule((finish) => {
      const frame = requestAnimationFrame((now) => {
        if (!this.cancelled) update(now);
        finish();
      });
      return () => cancelAnimationFrame(frame);
    });
  }

  async animate(animation: Animation): Promise<boolean> {
    if (this.cancelled) {
      animation.cancel();
      return false;
    }
    this.animations.add(animation);
    try {
      await animation.finished;
      return !this.cancelled;
    } catch {
      return false;
    }
  }

  cancel(): void {
    this.cancelled = true;
    for (const stop of this.pending) stop();
    this.pending.clear();
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
  }
}
