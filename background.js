'use strict';

const MENU_ID = 'sniptex-copy';
const CLAUDE_PATTERN = 'https://claude.ai/*';

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: MENU_ID,
    title: 'Copy as Markdown',
    contexts: ['selection'],
    documentUrlPatterns: [CLAUDE_PATTERN],
  });
});

async function copyInTab(tab) {
  if (!tab || tab.id === undefined) return;
  let result;
  try {
    result = await browser.tabs.sendMessage(tab.id, { type: 'sniptex-copy' });
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

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) copyInTab(tab);
});

browser.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'copy-as-markdown') return;
  if (!tab) [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  copyInTab(tab);
});
