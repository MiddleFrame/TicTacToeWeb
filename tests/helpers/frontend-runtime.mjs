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
    console, crypto, Error, Date, Math, structuredClone, Response, Request, Headers, URL, TextEncoder, TextDecoder,
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
  const effects = [];
  let cursor = 0;
  let mounted = true;
  let writesAfterUnmount = 0;
  let stateWrites = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next) => {
        stateWrites++;
        if (!mounted) writesAfterUnmount++;
        slots[index].value = typeof next === "function" ? next(slots[index].value) : next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: factory() };
      return slots[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      if (same(slots[index]?.deps, deps)) return;
      const previous = slots[index];
      slots[index] = { deps, cleanup: previous?.cleanup };
      effects.push(() => {
        previous?.cleanup?.();
        slots[index].cleanup = effect();
      });
    },
  };
  return {
    react,
    render(callback, props) { cursor = 0; return callback(props); },
    commit() { effects.splice(0).forEach((effect) => effect()); },
    get stateWrites() { return stateWrites; },
    unmount() {
      if (!mounted) return;
      mounted = false;
      effects.length = 0;
      slots.forEach((slot) => slot?.cleanup?.());
    },
    writesAfterUnmount: () => writesAfterUnmount,
  };
}

export const jsxRuntime = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
};

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}
