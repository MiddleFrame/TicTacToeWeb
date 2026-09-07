import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

export function loadFrontendModule(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (id) => {
      if (!Object.hasOwn(dependencies, id)) throw new Error(`Missing test dependency: ${id}`);
      const dependency = dependencies[id];
      return typeof dependency === "function" ? dependency() : dependency;
    },
    console,
    ...globals,
  }, { filename: path });
  return exports;
}

export async function flushMicrotasks() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

export function createAnimationClock() {
  const timers = new Map();
  const frames = new Map();
  const intervals = new Map();
  let nextId = 0;
  let now = 0;
  let clears = 0;
  const window = {
    setTimeout(callback, duration) {
      const id = ++nextId;
      timers.set(id, { callback, duration });
      return id;
    },
    clearTimeout(id) { clears += 1; timers.delete(id); },
    setInterval(callback) { const id = ++nextId; intervals.set(id, callback); return id; },
    clearInterval(id) { intervals.delete(id); },
    matchMedia: () => ({ matches: false }),
  };
  const globals = {
    window,
    performance: { now: () => now },
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  return {
    globals, timers, frames, intervals,
    get clears() { return clears; },
    async tickTimer() {
      const [id, timer] = timers.entries().next().value ?? [];
      if (!timer) throw new Error("No scheduled timeout");
      timers.delete(id);
      now += timer.duration;
      timer.callback();
      await flushMicrotasks();
    },
    async tickFrame(duration = 16) {
      const current = [...frames.entries()];
      now += duration;
      for (const [id, callback] of current) {
        frames.delete(id);
        callback(now);
      }
      await flushMicrotasks();
    },
  };
}

export function createHookRuntime() {
  const slots = [];
  const queued = [];
  let cursor = 0;
  let stateWrites = 0;
  const sameDeps = (left, right) => left && right && left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (value) => {
        stateWrites += 1;
        slots[index].value = typeof value === "function" ? value(slots[index].value) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: { current: initial } };
      return slots[index].value;
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      if (slots[index] && sameDeps(slots[index].deps, deps)) return;
      queued.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: effect() };
      });
    },
  };
  return {
    react,
    get stateWrites() { return stateWrites; },
    render(component, props) { cursor = 0; return component(props); },
    commit() { for (const effect of queued.splice(0)) effect(); },
    unmount() { for (const slot of slots) slot.cleanup?.(); },
  };
}

export const jsxRuntime = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
};
