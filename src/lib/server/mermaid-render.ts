/**
 * Server-side Mermaid diagram renderer.
 *
 * Mermaid is fundamentally a browser-oriented library — it lays out diagrams
 * by measuring text and shapes through real DOM/SVG APIs (`document`,
 * `SVGElement.getBBox`, etc.) and there is no dependency-injection seam for a
 * custom document. To render a diagram to SVG on the server we run mermaid
 * against a jsdom document and patch the SVG layout methods jsdom does not
 * implement with fixed-size stand-ins good enough for mermaid's D3-based
 * layout to complete without throwing. Diagram layout is therefore
 * approximate, not pixel-perfect — an accepted tradeoff to avoid a headless
 * browser dependency (Playwright/Puppeteer) for occasional note diagrams.
 *
 * `renderMermaidToSvg` never throws. Invalid Mermaid syntax, or any other
 * renderer failure, resolves `{ ok: false, error }` so callers (see
 * `markdown.ts`) can fall back to a readable source block instead of
 * crashing note page rendering.
 *
 * Because rendering depends on ambient globals (`window`, `document`, ...)
 * that only exist in a real browser, this module installs them onto
 * `globalThis` immediately before each render and restores the previous
 * values immediately after (see `installGlobals`/`restoreGlobals`). Renders
 * are also serialized through a single in-process mutex so concurrent
 * renders never clobber each other's installed globals. This module must
 * never leave browser globals installed outside of an in-flight render —
 * doing so would make unrelated server code (e.g. any library that branches
 * on `typeof window`) incorrectly think it is running in a browser for the
 * rest of the process lifetime.
 *
 * This module is server-only — never import from client components.
 */

import { JSDOM } from 'jsdom';

export type MermaidRenderResult = { ok: true; svg: string } | { ok: false; error: string };

type GlobalPatchKey =
  | 'window'
  | 'document'
  | 'navigator'
  | 'DOMParser'
  | 'SVGElement'
  | 'HTMLElement'
  | 'Element'
  | 'CSSStyleSheet'
  | 'getComputedStyle';

type GlobalSnapshot = Partial<Record<GlobalPatchKey, unknown>>;

const GLOBAL_PATCH_KEYS: GlobalPatchKey[] = [
  'window',
  'document',
  'navigator',
  'DOMParser',
  'SVGElement',
  'HTMLElement',
  'Element',
  'CSSStyleSheet',
  'getComputedStyle',
];

type MutableGlobal = Record<string, unknown>;

function globalRecord(): MutableGlobal {
  return globalThis as unknown as MutableGlobal;
}

let jsdomWindow: JSDOM['window'] | null = null;

/**
 * Lazily builds a single reusable jsdom window with the SVG layout method
 * stand-ins mermaid's D3-based layout needs (jsdom implements neither
 * `getBBox`, `getComputedTextLength`, nor `getScreenCTM`).
 */
function getJsdomWindow(): JSDOM['window'] {
  if (jsdomWindow) return jsdomWindow;

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    pretendToBeVisual: true,
  });
  const svgProto = dom.window.SVGElement.prototype as unknown as {
    getBBox?: () => DOMRect;
    getComputedTextLength?: () => number;
    getScreenCTM?: () => unknown;
  };
  svgProto.getBBox = () =>
    ({ x: 0, y: 0, width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 }) as DOMRect;
  svgProto.getComputedTextLength = () => 80;
  svgProto.getScreenCTM = () => ({ inverse: () => ({}) });

  jsdomWindow = dom.window;
  return jsdomWindow;
}

/** Installs jsdom globals for the duration of a render; returns the prior values to restore. */
function installGlobals(window: JSDOM['window']): GlobalSnapshot {
  const target = globalRecord();
  const previous: GlobalSnapshot = {};
  for (const key of GLOBAL_PATCH_KEYS) {
    previous[key] = target[key];
  }

  target.window = window;
  target.document = window.document;
  target.DOMParser = window.DOMParser;
  target.SVGElement = window.SVGElement;
  target.HTMLElement = window.HTMLElement;
  target.Element = window.Element;
  target.CSSStyleSheet = window.CSSStyleSheet;
  target.getComputedStyle = window.getComputedStyle.bind(window);
  // `navigator` is a getter-only global in some Node versions; define it explicitly.
  Object.defineProperty(target, 'navigator', { value: window.navigator, configurable: true });

  return previous;
}

/** Restores globals captured by `installGlobals`, deleting any that were previously unset. */
function restoreGlobals(previous: GlobalSnapshot): void {
  const target = globalRecord();
  for (const key of GLOBAL_PATCH_KEYS) {
    const value = previous[key];
    if (value === undefined) {
      delete target[key];
    } else if (key === 'navigator') {
      Object.defineProperty(target, 'navigator', { value, configurable: true });
    } else {
      target[key] = value;
    }
  }
}

type MermaidModule = typeof import('mermaid')['default'];

let mermaidModulePromise: Promise<MermaidModule> | null = null;

/** Imports the `mermaid` package once and caches it. Importing it does not require DOM globals. */
function getMermaidModule(): Promise<MermaidModule> {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((module) => module.default);
  }
  return mermaidModulePromise;
}

// Serializes renders so only one render has jsdom globals installed at a time.
let mutex: Promise<void> = Promise.resolve();
let renderCounter = 0;

async function renderOnce(source: string): Promise<string> {
  const window = getJsdomWindow();
  const previous = installGlobals(window);
  try {
    const mermaid = await getMermaidModule();
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    renderCounter += 1;
    const { svg } = await mermaid.render(`mermaid-diagram-${renderCounter}`, source);
    return svg;
  } finally {
    restoreGlobals(previous);
  }
}

/**
 * Renders Mermaid diagram source to an SVG string. Never throws — resolves
 * `{ ok: false, error }` for invalid syntax, empty input, or any renderer
 * failure so callers can fall back to a readable source block.
 */
export async function renderMermaidToSvg(source: string): Promise<MermaidRenderResult> {
  const trimmed = source.trim();
  if (!trimmed) {
    return { ok: false, error: 'Mermaid diagram source is empty.' };
  }

  const run = mutex.then(() => renderOnce(trimmed));
  // Keep the mutex chain alive regardless of outcome, but never let a
  // rejection propagate into the shared chain — that would permanently
  // poison every subsequent render.
  mutex = run.then(
    () => undefined,
    () => undefined,
  );

  try {
    const svg = await run;
    return { ok: true, svg };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
