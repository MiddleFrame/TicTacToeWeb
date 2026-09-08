import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'work/hand-layout-fixture');
const require = createRequire(import.meta.url);
const cache = new Map();
function load(path) {
    if (path.endsWith('/game/localization.tsx'))
        return { useLocalization: () => ({ language: 'ru', t: key => ({ turn: 'Ход', endTurn: 'Конец хода' }[key] ?? key), card: kind => ({ name: kind, description: 'Ставит фигуру в выбранном месте на поле' }) }) };
    if (cache.has(path))
        return cache.get(path);
    const exports = {};
    cache.set(path, exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(code, { exports, console, require: id => {
            if (!id.startsWith('.'))
                return require(id);
            const base = resolve(dirname(path), id).replaceAll('\\', '/');
            const dependency = ['', '.ts', '.tsx'].map(suffix => base + suffix).find(existsSync);
            if (!dependency)
                throw new Error('Missing fixture dependency: ' + id);
            return load(dependency);
        } }, { filename: path });
    return exports;
}
const { GameScene } = load(resolve(root, 'app/components/game/GameScene.tsx').replaceAll('\\', '/'));
const { createGame, endTurn } = load(resolve(root, 'app/game/engine.ts').replaceAll('\\', '/'));
const noop = () => { };
const h = React.createElement;
const css = execFileSync('git', ['show', '2c1a9af:app/globals.css'], { cwd: root, encoding: 'utf8' });
let game = createGame(['place']);
const states = [game];
for (let i = 0; i < 2; i++) {
    game = endTurn(endTurn(game));
    states.push(game);
}
function measureLayout() {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const board = rect('.unity-board');
    const end = rect('.unity-end-turn');
    const cards = [...document.querySelectorAll('.unity-hand-card')].map(el => el.getBoundingClientRect().toJSON());
    const fits = box => box.left >= 0 && box.right <= innerWidth;
    document.documentElement.dataset.layoutResult = JSON.stringify({
        width: innerWidth, height: innerHeight, scale: visualViewport.scale,
        board, end, cards, pass: fits(board) && fits(end) && cards.every(fits)
    });
}
function page(index, fixed, count) {
    const base = states[index];
    const game = count === null ? base : { ...base, hands: { ...base.hands, 1: states[2].hands[1].slice(0, count) } };
    const content = renderToStaticMarkup(h(GameScene, {
        game, mode: 'bot', experience: null, networkIntentPending: false, opponentLeft: false,
        isHumanTurn: true, topPlayer: 2, bottomPlayer: 1, displayedPlayer: 1, visibleMana: game.mana,
        drag: null, damageFlights: [], turnBanner: null, pauseOpen: false, rulesOpen: false,
        status: '', roguelike: null, boardRef: { current: null }, setCellRef: noop, setHealthRef: noop,
        remainingHealth: player => player === 1 ? 7 : 10, canTarget: () => false,
        onCardDown: noop, onCardMove: noop, onCardUp: noop, onCardCancel: noop, onPause: noop,
        onResume: noop, onMenu: noop, onEndTurn: noop, onContinue: noop, onChooseMana: noop,
        onOpenCards: noop, onChooseReward: noop, onReplace: noop, onRestartDraw: noop, onCloseRules: noop,
    }));
    return `<!doctype html><html data-platform="android" lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"><style>${fixed ? readFileSync(resolve(root, 'app/globals.css'), 'utf8') : css}</style></head><body>${content}<script>requestAnimationFrame(${measureLayout.toString()});document.querySelector('.unity-end-turn').onclick=()=>location.href=location.protocol==='file:'?'hand-${fixed ? 'fixed' : 'baseline'}-${Math.min(2, index + 1)}.html':'/?state=${Math.min(2, index + 1)}&fixed=${fixed ? 1 : 0}'</script></body></html>`;
}
if (process.argv.includes('--export')) {
    mkdirSync(output, { recursive: true });
    for (const fixed of [false, true])
        for (let i = 0; i < 3; i++)
            writeFileSync(resolve(output, `hand-${fixed ? 'fixed' : 'baseline'}-${i}.html`), page(i, fixed, null));
    process.exit(0);
}
createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(page(Math.min(2, Math.max(0, Number(url.searchParams.get('state') ?? 0))), url.searchParams.get('fixed') === '1', url.searchParams.has('count') ? Math.max(0, Math.min(5, Number(url.searchParams.get('count')) || 0)) : null));
        return;
    }
    const assetRoot = resolve(root, 'public/game');
    const path = url.pathname.startsWith('/game/') ? resolve(root, 'public', '.' + decodeURIComponent(url.pathname)) : null;
    if (!path || !path.startsWith(assetRoot + '/') && !path.startsWith(assetRoot + '\\') || !existsSync(path)) {
        res.writeHead(404);
        res.end();
        return;
    }
    res.setHeader('Content-Type', ({ '.png': 'image/png', '.woff2': 'font/woff2' })[extname(path)] ?? 'application/octet-stream');
    res.end(readFileSync(path));
}).listen(4173, '127.0.0.1', () => console.log('Version 50 CSS fixture ready: hand counts ' + states.map(x => x.hands[1].length)));
