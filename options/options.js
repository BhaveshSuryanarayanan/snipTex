'use strict';

const COMMAND = 'copy-as-markdown';
const $ = (id) => document.getElementById(id);

const NAMED_KEYS = {
  Comma: 'Comma', Period: 'Period', Space: 'Space',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  Insert: 'Insert', Delete: 'Delete',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
};

let isMac = false;
let pending = null;

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
  if (!shortcut) return 'none';
  if (!isMac) return shortcut;
  return shortcut.replace('Command', '⌘').replace('MacCtrl', '⌃').replace('Alt', '⌥').replace('Shift', '⇧');
}

function setStatus(text, kind) {
  const el = $('status');
  el.textContent = text;
  el.className = kind || '';
}

async function refresh() {
  const commands = await browser.commands.getAll();
  const cmd = commands.find((c) => c.name === COMMAND);
  $('current').textContent = pretty(cmd && cmd.shortcut);
}

$('recorder').addEventListener('keydown', (e) => {
  if (e.key === 'Tab') return;
  e.preventDefault();
  e.stopPropagation();
  const result = toShortcut(e);
  if (!result) return;
  if (result.error) {
    pending = null;
    $('recorder').value = '';
    $('save').disabled = true;
    setStatus(result.error, 'err');
    return;
  }
  pending = result.shortcut;
  $('recorder').value = pretty(pending);
  $('save').disabled = false;
  setStatus('');
});

$('save').addEventListener('click', async () => {
  if (!pending) return;
  try {
    await browser.commands.update({ name: COMMAND, shortcut: pending });
    setStatus(`Saved: ${pretty(pending)}`, 'ok');
    pending = null;
    $('recorder').value = '';
    $('save').disabled = true;
  } catch (err) {
    setStatus(`Couldn't save: ${err.message}`, 'err');
  }
  refresh();
});

$('reset').addEventListener('click', async () => {
  try {
    await browser.commands.reset(COMMAND);
    setStatus('Reset to default.', 'ok');
  } catch (err) {
    setStatus(`Couldn't reset: ${err.message}`, 'err');
  }
  refresh();
});

(async () => {
  isMac = (await browser.runtime.getPlatformInfo()).os === 'mac';
  refresh();
})();
