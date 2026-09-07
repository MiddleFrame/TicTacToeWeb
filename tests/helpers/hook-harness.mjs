import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

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

export function hookHarness() {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let mounted = true;
  let writesAfterUnmount = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next) => {
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
    render(callback) { cursor = 0; return callback(); },
    effects() { effects.splice(0).forEach((effect) => effect()); },
    unmount() { mounted = false; slots.forEach((slot) => slot?.cleanup?.()); },
    writesAfterUnmount: () => writesAfterUnmount,
  };
}

export function loadHook(file, dependencies, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, crypto, Error, Date, Math, structuredClone, ...globals,
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected hook dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
