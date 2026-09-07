import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers') return { url: 'audit:cloudflare', shortCircuit: true };
    if (specifier === '@capacitor/core') return { url: 'audit:capacitor', shortCircuit: true };
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const target = new URL(specifier, context.parentURL);
      for (const suffix of ['.ts', '/index.ts']) {
        const candidate = new URL(target.href + suffix);
        if (existsSync(candidate)) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'audit:cloudflare') return { format: 'module', source: 'export const env = globalThis.__auditEnv;', shortCircuit: true };
    if (url === 'audit:capacitor') return { format: 'module', source: 'export const Capacitor = { getPlatform: () => "android" }; export const registerPlugin = name => globalThis.__auditPlugins[name];', shortCircuit: true };
    return nextLoad(url, context);
  },
});
