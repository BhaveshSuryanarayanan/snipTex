'use strict';

const CLAUDE_PATTERN = 'https://claude.ai/*';
const MENU_DEFAULT = 'sniptex-copy';
const MENU_ALT = 'sniptex-copy-alt';

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

browser.runtime.onInstalled.addListener(() => {
  browser.menus.create({
    id: MENU_DEFAULT,
    title: 'Copy as Markdown',
    contexts: ['selection'],
    documentUrlPatterns: [CLAUDE_PATTERN],
  });
  browser.menus.create({
    id: MENU_ALT,
    title: 'Copy as Markdown (other math format)',
    contexts: ['selection'],
    documentUrlPatterns: [CLAUDE_PATTERN],
  });
  updateMenuTitles();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.mathFormat) updateMenuTitles();
});

async function copyInTab(tab, useAlt) {
  if (!tab || tab.id === undefined) return;
  const defaultFormat = await getDefaultFormat();
  const format = useAlt ? otherFormat(defaultFormat) : defaultFormat;
  let result;
  try {
    result = await browser.tabs.sendMessage(tab.id, { type: 'sniptex-copy', format });
  } catch (err) {
    // No content script here (not claude.ai, or the page predates install).
    return;
  }
  if (!result || result.ok || result.reason !== 'clipboard') return;
  // The page refused the write; extension pages with clipboardWrite may not.
  let ok = false;
  try {
    await navigator.clipboard.writeText(result.markdown);
    ok = true;
  } catch (err) {
    console.error('SnipTeX: clipboard write failed', err);
  }
  browser.tabs.sendMessage(tab.id, { type: 'sniptex-toast', ok }).catch(() => {});
}

browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_DEFAULT) copyInTab(tab, false);
  else if (info.menuItemId === MENU_ALT) copyInTab(tab, true);
});

browser.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'copy-as-markdown' && command !== 'copy-as-markdown-alt') return;
  if (!tab) [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  copyInTab(tab, command === 'copy-as-markdown-alt');
});
