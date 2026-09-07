export type RewardAttempt = { complete: (rewarded: boolean) => void };

export function createAccountOperationGate() {
  let transitioning = false;
  let attempts = 0;
  return {
    get transitioning() { return transitioning; },
    beginTransition() {
      if (transitioning || attempts > 0) throw new Error("account-operation-pending");
      transitioning = true;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        transitioning = false;
      };
    },
    beginReward(onReward: () => void): RewardAttempt | null {
      if (transitioning || attempts > 0) return null;
      attempts++;
      let completed = false;
      return { complete(rewarded) {
        if (completed) return;
        completed = true;
        try {
          if (rewarded) onReward();
        } finally {
          attempts--;
        }
      } };
    },
    assertMutable() {
      if (transitioning) throw new Error("account-transition-pending");
    },
  };
}
