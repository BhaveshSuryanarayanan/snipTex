'use strict';

// Keep in sync with host_permissions and content_scripts.matches in manifest.json.
const SITE_PATTERNS = [
  'https://claude.ai/*',
  'https://chatgpt.com/*',
  'https://gemini.google.com/*',
];
const MENU_DEFAULT = 'sniptex-copy';
const MENU_ALT = 'sniptex-copy-alt';
const MENU_LATEX = 'sniptex-copy-latex';

const FORMAT_LABELS = { dollar: '$…$', bracket: '\\(…\\)' };
const otherFormat = (format) => (format === 'bracket' ? 'dollar' : 'bracket');

async function getDefaultFormat() {
  const { mathFormat } = await browser.storage.sync.get({ mathFormat: 'dollar' });
  return FORMAT_LABELS[mathFormat] ? mathFormat : 'dollar';
}

async function updateMenuTitles() {
  const format = await getDefaultFormat();
  await browser.menus.update(MENU_ALT, {
    title: `Copy as Markdown with ${FORMAT_LABELS[otherFormat(format)]}`,
  });
}

// Firefox can keep menu items from an earlier version across reloads and
// updates (e.g. with old documentUrlPatterns), so always rebuild from scratch.
async function setupMenus() {
  await browser.menus.removeAll();
  browser.menus.create({
    id: MENU_DEFAULT,
    title: 'Copy as Markdown',
    contexts: ['selection'],
    documentUrlPatterns: SITE_PATTERNS,
  });
  browser.menus.create({
    id: MENU_ALT,
    title: 'Copy as Markdown (other math format)',
    contexts: ['selection'],
    documentUrlPatterns: SITE_PATTERNS,
  });
  // Shown only over an equation; see onShown.
  browser.menus.create({
    id: MENU_LATEX,
    title: 'Copy LaTeX',
    contexts: ['all'],
    documentUrlPatterns: SITE_PATTERNS,
    visible: false,
  });
  await updateMenuTitles();
}

browser.runtime.onInstalled.addListener(setupMenus);
browser.runtime.onStartup.addListener(setupMenus);

browser.menus.onShown.addListener(async (info, tab) => {
  const pageOrigin = info.pageUrl && new URL(info.pageUrl).origin;
  if (!tab || !SITE_PATTERNS.some((p) => p.startsWith(pageOrigin + '/'))) return;
  let isMath = false;
  try {
    isMath = await browser.tabs.sendMessage(
      tab.id, { type: 'sniptex-target-is-math' }, { frameId: info.frameId });
  } catch (err) {
    // No content script in this frame.
  }
  await browser.menus.update(MENU_LATEX, { visible: !!isMath });
  browser.menus.refresh();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.mathFormat) updateMenuTitles();
});

// Sends a copy request to the tab. If the page can't write the clipboard,
// retries here and tells the tab which toast to show.
async function requestCopy(tab, frameId, message, successToast) {
  if (!tab || tab.id === undefined) return;
  const target = { frameId };
  let result;
  try {
    result = await browser.tabs.sendMessage(tab.id, message, target);
  } catch (err) {
    // No content script here (unsupported site, or the page predates install).
    return;
  }
  if (!result || result.ok || result.reason !== 'clipboard') return;
  // The page refused the write; extension pages with clipboardWrite may not.
  let ok = false;
  try {
    await navigator.clipboard.writeText(result.text);
    ok = true;
  } catch (err) {
    console.error('SnipTeX: clipboard write failed', err);
  }
  browser.tabs.sendMessage(tab.id, { type: 'sniptex-toast', ok, message: successToast }, target)
    .catch(() => {});
}

async function copyInTab(tab, frameId, useAlt) {
  const defaultFormat = await getDefaultFormat();
  const format = useAlt ? otherFormat(defaultFormat) : defaultFormat;
  requestCopy(tab, frameId, { type: 'sniptex-copy', format }, 'Copied as Markdown');
}

browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_DEFAULT) copyInTab(tab, info.frameId, false);
  else if (info.menuItemId === MENU_ALT) copyInTab(tab, info.frameId, true);
  else if (info.menuItemId === MENU_LATEX) {
    requestCopy(tab, info.frameId, { type: 'sniptex-copy-latex' }, 'Copied LaTeX');
  }
});

browser.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'copy-as-markdown' && command !== 'copy-as-markdown-alt') return;
  if (!tab) [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  // Top frame: all supported sites render replies there.
  copyInTab(tab, 0, command === 'copy-as-markdown-alt');
});
