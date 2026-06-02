/**
 * Vim mode toggle E2E.
 *
 * Verifies the wiring between the `vim-mode` app setting and the Monaco
 * status bar element rendered by `MonacoCodeEditor`. monaco-vim's own
 * keybinding semantics (motions, operators, ex commands) are the library's
 * responsibility and are not asserted here — this test only covers that
 * toggling the setting attaches/detaches the wrapper and the status bar.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  launchElectronApp,
  createTempWorkspace,
  waitForAppReady,
  dismissProjectTrustToast,
  TEST_TIMEOUTS,
} from '../helpers';
import {
  openFileFromTree,
  closeTabByFileName,
} from '../utils/testHelpers';

test.describe.configure({ mode: 'serial' });

const VISIBLE_MONACO_SELECTOR =
  '.file-tabs-container .tab-editor-wrapper:not([style*="display: none"]) .monaco-code-editor';
const STATUS_BAR_SELECTOR = `${VISIBLE_MONACO_SELECTOR} [data-testid="monaco-vim-status-bar"]`;

let electronApp: ElectronApplication;
let page: Page;
let workspaceDir: string;

async function setVimMode(p: Page, enabled: boolean): Promise<void> {
  await p.evaluate(async (value) => {
    await window.electronAPI.invoke('vim-mode:set', value);
  }, enabled);
  // Atom hydration happens in initAdvancedSettings at app startup, so a
  // reload is required for the renderer to pick up the new value.
  await p.reload();
  await p.waitForLoadState('domcontentloaded');
  await waitForAppReady(p);
}

test.beforeAll(async () => {
  workspaceDir = await createTempWorkspace();
  await fs.writeFile(
    path.join(workspaceDir, 'vim-test.ts'),
    'const x = 1;\nconst y = 2;\nconst z = 3;\n',
    'utf8',
  );

  electronApp = await launchElectronApp({ workspace: workspaceDir });
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await waitForAppReady(page);
  await dismissProjectTrustToast(page);

  // Start each run with vim mode off so the first assertion is meaningful
  // even if a previous run left the persisted setting on.
  await setVimMode(page, false);
});

test.afterAll(async () => {
  // Leave the persisted setting off so unrelated suites aren't affected.
  if (page) {
    await page.evaluate(async () => {
      await window.electronAPI.invoke('vim-mode:set', false);
    }).catch(() => undefined);
  }
  await electronApp?.close();
  if (workspaceDir) {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  }
});

test('vim mode is off by default and the status bar is absent', async () => {
  await openFileFromTree(page, 'vim-test.ts');
  await page.waitForSelector(VISIBLE_MONACO_SELECTOR, {
    timeout: TEST_TIMEOUTS.EDITOR_LOAD,
  });

  await expect(page.locator(STATUS_BAR_SELECTOR)).toHaveCount(0);

  await closeTabByFileName(page, 'vim-test.ts');
});

test('enabling vim mode attaches the status bar to the visible Monaco editor', async () => {
  await setVimMode(page, true);

  await openFileFromTree(page, 'vim-test.ts');
  await page.waitForSelector(VISIBLE_MONACO_SELECTOR, {
    timeout: TEST_TIMEOUTS.EDITOR_LOAD,
  });

  await expect(page.locator(STATUS_BAR_SELECTOR)).toBeVisible({ timeout: 2000 });

  await closeTabByFileName(page, 'vim-test.ts');
});

test('disabling vim mode removes the status bar', async () => {
  await setVimMode(page, false);

  await openFileFromTree(page, 'vim-test.ts');
  await page.waitForSelector(VISIBLE_MONACO_SELECTOR, {
    timeout: TEST_TIMEOUTS.EDITOR_LOAD,
  });

  await expect(page.locator(STATUS_BAR_SELECTOR)).toHaveCount(0);

  await closeTabByFileName(page, 'vim-test.ts');
});
