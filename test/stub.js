// Minimal fake of the WebExtension APIs used by background.js and the
// options page, for the offline checks in this folder.
'use strict';
const ev = () => ({ addListener() {} });
const store = { mathFormat: 'dollar' };
const cmds = [
  { name: 'copy-as-markdown', description: 'Copy selection as Markdown (default math format)', shortcut: 'Ctrl+Alt+C' },
  { name: 'copy-as-markdown-alt', description: 'Copy selection as Markdown (other math format)', shortcut: '' },
];
const defaults = { 'copy-as-markdown': 'Ctrl+Alt+C', 'copy-as-markdown-alt': '' };
window.browser = {
  commands: {
    getAll: async () => cmds.map((c) => ({ ...c })),
    update: async (o) => { cmds.find((c) => c.name === o.name).shortcut = o.shortcut; },
    reset: async (n) => { cmds.find((c) => c.name === n).shortcut = defaults[n]; },
    onCommand: ev(),
  },
  runtime: { getPlatformInfo: async () => ({ os: 'linux' }), onInstalled: ev() },
  storage: {
    sync: { get: async (d) => ({ ...d, ...store }), set: async (o) => Object.assign(store, o) },
    onChanged: ev(),
  },
  menus: { onClicked: ev(), onShown: ev(), create() {}, update: async () => {}, refresh() {} },
  tabs: { sendMessage: async () => undefined, query: async () => [] },
};
window.onerror = (m, src, line) => { document.title = 'ERR ' + m + ' @' + src + ':' + line; };
