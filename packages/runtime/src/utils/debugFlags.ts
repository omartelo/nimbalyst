/**
 * Debug flags mirror.
 *
 * The Electron renderer loads debug flags from the main-process app-settings store on
 * startup, then writes the resulting object onto `globalThis.__nimbalystDebugFlags` and
 * keeps it updated when the user toggles a flag in Settings. This module exposes a
 * synchronous read path for code that should not depend on Jotai (notably the Lexical
 * `DiffPlugin` in `@nimbalyst/runtime`, which is consumed both by the Electron renderer
 * and by mobile/web hosts that may not have Jotai).
 *
 * Flags default to `false` everywhere -- no value, no logging.
 */

export interface NimbalystDebugFlags {
  /** Verbose tracing for the diff/AI-edit pipeline. */
  diffTrace?: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __nimbalystDebugFlags: NimbalystDebugFlags | undefined;
}

function readFlags(): NimbalystDebugFlags {
  if (typeof globalThis === 'undefined') return {};
  return globalThis.__nimbalystDebugFlags ?? {};
}

/**
 * Set the active flags. Called by the Electron renderer once at startup and again
 * whenever the user toggles a flag in Settings. Callers outside the renderer should
 * not invoke this -- the flags will simply stay at their defaults.
 */
export function setDebugFlags(flags: NimbalystDebugFlags): void {
  if (typeof globalThis === 'undefined') return;
  globalThis.__nimbalystDebugFlags = { ...flags };
}

export function isDiffTraceEnabled(): boolean {
  return readFlags().diffTrace === true;
}

/**
 * Verbose trace for the diff pipeline. No-op unless `debugFlags.diffTrace` is on.
 *
 * Pattern: `diffTrace('Foo.bar', { someState, t: performance.now() })`. The label is
 * required so grep'ing the resulting log output is straightforward; the data payload is
 * optional and may be omitted for a bare event marker.
 */
export function diffTrace(label: string, data?: unknown): void {
  if (!isDiffTraceEnabled()) return;
  if (data === undefined) {
    console.log(`[diff-trace] ${label}`);
  } else {
    console.log(`[diff-trace] ${label}`, data);
  }
}
