'use strict';

const $ = (id) => document.getElementById(id);

const NAMED_KEYS = {
  Comma: 'Comma', Period: 'Period', Space: 'Space',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  Insert: 'Insert', Delete: 'Delete',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
};

let isMac = false;

// Map a keydown event to Firefox's shortcut syntax. Uses event.code so the
// result doesn't depend on the keyboard layout (AltGr+C would otherwise
// report "ć"). Returns { shortcut } or { error }, or null for a lone modifier.
function toShortcut(e) {
  let key = null;
  let m;
  if ((m = /^Key([A-Z])$/.exec(e.code))) key = m[1];
  else if ((m = /^Digit([0-9])$/.exec(e.code))) key = m[1];
  else if (/^F([1-9]|1[0-2])$/.test(e.code)) key = e.code;
  else if (NAMED_KEYS[e.code]) key = NAMED_KEYS[e.code];
  else if (/^(Control|Alt|Shift|Meta|OS)/.test(e.code)) return null;
  else return { error: `The key "${e.key}" can't be used in a shortcut.` };

  const mods = [];
  if (isMac) {
    if (e.metaKey) mods.push('Command');
    if (e.ctrlKey) mods.push('MacCtrl');
  } else if (e.ctrlKey) {
    mods.push('Ctrl');
  }
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  const isFKey = /^F\d+$/.test(key);
  if (mods.length === 0 && !isFKey) return { error: 'Add Ctrl or Alt (letters and digits need a modifier).' };
  if (mods.length > 2) return { error: 'Use at most two modifiers.' };
  if (mods.length === 1 && mods[0] === 'Shift' && !isFKey) return { error: 'Shift can\'t be the only modifier.' };
  return { shortcut: [...mods, key].join('+') };
}

function pretty(shortcut) {
  if (!shortcut) return 'not set';
  if (!isMac) return shortcut;
  return shortcut.replace('Command', '⌘').replace('MacCtrl', '⌃').replace('Alt', '⌥').replace('Shift', '⇧');
}

function setStatus(el, text, kind) {
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

// Math format

async function initFormat() {
  const { mathFormat } = await browser.storage.sync.get({ mathFormat: 'dollar' });
  const radio = document.querySelector(`input[name="mathFormat"][value="${mathFormat}"]`);
  if (radio) radio.checked = true;
  $('formats').addEventListener('change', async (e) => {
    try {
      await browser.storage.sync.set({ mathFormat: e.target.value });
      setStatus($('format-status'), 'Saved.', 'ok');
    } catch (err) {
      setStatus($('format-status'), `Couldn't save: ${err.message}`, 'err');
    }
  });
}

// Shortcuts

function buildShortcutRow(cmd) {
  const row = $('shortcut-row').content.firstElementChild.cloneNode(true);
  const q = (sel) => row.querySelector(sel);
  const recorder = q('.recorder');
  const save = q('.save');
  const status = q('.status');
  let pending = null;
  
  q('.desc').textContent = cmd.description || cmd.name;

  async function refresh() {
    const all = await browser.commands.getAll();
    const current = all.find((c) => c.name === cmd.name);
    q('.current').textContent = pretty(current && current.shortcut);
  }

  recorder.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') return;
    e.preventDefault();
    e.stopPropagation();
    const result = toShortcut(e);
    if (!result) return;
    if (result.error) {
      pending = null;
      recorder.value = '';
      save.disabled = true;
      setStatus(status, result.error, 'err');
      return;
    }
    pending = result.shortcut;
    recorder.value = pretty(pending);
    save.disabled = false;
    setStatus(status, '');
  });

  save.addEventListener('click', async () => {
    if (!pending) return;
    try {
      await browser.commands.update({ name: cmd.name, shortcut: pending });
      setStatus(status, `Saved: ${pretty(pending)}`, 'ok');
      pending = null;
      recorder.value = '';
      save.disabled = true;
    } catch (err) {
      setStatus(status, `Couldn't save: ${err.message}`, 'err');
    }
    refresh();
  });

  q('.reset').addEventListener('click', async () => {
    try {
      await browser.commands.reset(cmd.name);
      setStatus(status, 'Reset to default.', 'ok');
    } catch (err) {
      setStatus(status, `Couldn't reset: ${err.message}`, 'err');
    }
    refresh();
  });

  refresh();
  return row;
}

async function initShortcuts() {
  const commands = await browser.commands.getAll();
  for (const cmd of commands) $('shortcuts').append(buildShortcutRow(cmd));
}

(async () => {
  isMac = (await browser.runtime.getPlatformInfo()).os === 'mac';
  initFormat();
  initShortcuts();
})();
