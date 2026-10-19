import { createAnimationClock, createHookRuntime, loadFrontendModule } from "./frontend-runtime.mjs";

export function dragFixture(file = "app/components/game/hooks/useCardDrag.ts") {
  const clock = createAnimationClock();
  const hooks = createHookRuntime();
  let hitTests = 0;
  const played = [];
  const board = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 300, bottom: 300 }) };
  const document = { elementFromPoint(x) { hitTests++; return { closest: () => ({ dataset: { cellIndex: String(Math.floor(x / 100)) } }) }; } };
  const game = { hands: { 1: [{ id: "card", kind: "place" }, { id: "other", kind: "place" }] }, turn: 1, mana: 10 };
  const interaction = loadFrontendModule("app/game/card-interaction.ts", {});
  const { useCardDrag } = loadFrontendModule(file, {
    react: hooks.react,
    "../../../game/cards": { CARD_DEFINITIONS: { place: { target: "empty" } } },
    "../../../game/card-interaction": interaction,
    "../../../game/engine": { cardCost: () => 1 },
  }, { ...clock.globals, document });
  const render = () => hooks.render(() => useCardDrag(game, true, { current: board }, () => true, (...args) => played.push(args), () => {}));
  const event = (x, y = 20) => ({ clientX: x, clientY: y, pointerId: 1, currentTarget: {
    setPointerCapture() {}, dataset: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 20, height: 20 }),
  } });
  render();
  hooks.commit();
  return { clock, hooks, render, event, played, hitTests: () => hitTests };
}
