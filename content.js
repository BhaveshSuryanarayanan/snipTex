/* global TurndownService, turndownPluginGfm */
'use strict';

// Converts the current selection on claude.ai to Markdown, replacing KaTeX
// output with its original LaTeX source.
var SnipTeX = (() => {
  const TEX_ANNOTATION = 'annotation[encoding="application/x-tex"]';
  // Alphanumeric so Turndown never escapes it.
  const TOKEN_RE = /SNIPTEX(\d+)MATH/g;
  // Math delimiters per format: [open, close].
  const FORMATS = {
    dollar: { inline: ['$', '$'], display: ['$$\n', '\n$$'] },
    bracket: { inline: ['\\(', '\\)'], display: ['\\[\n', '\n\\]'] },
  };

  function elementOf(node) {
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  }

  // Outermost math wrapper: display math is a .katex inside a .katex-display.
  function mathAncestor(node) {
    const el = elementOf(node);
    if (!el) return null;
    return el.closest('.katex-display') || el.closest('.katex');
  }

  // Widen the range so it never cuts through an equation or a table.
  function expandRange(range) {
    const startMath = mathAncestor(range.startContainer);
    if (startMath) range.setStartBefore(startMath);
    const endMath = mathAncestor(range.endContainer);
    if (endMath) range.setEndAfter(endMath);

    // A partial table has no header row and would come out as raw HTML.
    // Selecting inside a single cell is left alone.
    const startEl = elementOf(range.startContainer);
    const endEl = elementOf(range.endContainer);
    const startCell = startEl && startEl.closest('td, th');
    if (startCell && startCell === (endEl && endEl.closest('td, th'))) return;
    const startTable = startEl && startEl.closest('table');
    if (startTable) range.setStartBefore(startTable);
    const endTable = endEl && endEl.closest('table');
    if (endTable) range.setEndAfter(endTable);
  }

  // Swap every KaTeX element for a placeholder token; return the TeX sources.
  function extractMath(root) {
    const math = [];
    const replace = (el, display) => {
      const tex = texOf(el);
      if (tex === null) return;
      const token = 'SNIPTEX' + math.length + 'MATH';
      math.push({ tex, display });
      let placeholder;
      if (display) {
        placeholder = document.createElement('div');
        placeholder.textContent = token;
      } else {
        placeholder = document.createTextNode(token);
      }
      el.replaceWith(placeholder);
    };
    root.querySelectorAll('.katex-display').forEach((el) => replace(el, true));
    root.querySelectorAll('.katex').forEach((el) => replace(el, false));
    return math;
  }

  function restoreMath(markdown, math, format) {
    const delims = FORMATS[format] || FORMATS.dollar;
    return markdown.replace(TOKEN_RE, (whole, i) => {
      const m = math[Number(i)];
      if (!m) return whole;
      const [open, close] = m.display ? delims.display : delims.inline;
      return open + m.tex + close;
    });
  }

  function codeLanguage(pre, code) {
    for (const el of [code, pre]) {
      const match = el && /(?:^|\s)language-(\S+)/.exec(el.getAttribute('class') || '');
      if (match) return match[1];
    }
    return '';
  }

  let turndown = null;
  function getTurndown() {
    if (turndown) return turndown;
    turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    });
    turndown.use(turndownPluginGfm.gfm);
    turndown.remove(['button', 'script', 'style', 'svg']);
    // Same as Turndown's list item rule, but with one space after the marker.
    turndown.addRule('snipTexListItem', {
      filter: 'li',
      replacement(content, node, options) {
        let prefix = options.bulletListMarker + ' ';
        const parent = node.parentNode;
        if (parent && parent.nodeName === 'OL') {
          const start = parent.getAttribute('start');
          const index = Array.prototype.indexOf.call(parent.children, node);
          prefix = (start ? Number(start) + index : index + 1) + '. ';
        }
        const isParagraph = /\n$/.test(content);
        content = content.replace(/^\n+|\n+$/g, '') + (isParagraph ? '\n' : '');
        content = content.replace(/\n/gm, '\n' + ' '.repeat(prefix.length));
        return prefix + content + (node.nextSibling ? '\n' : '');
      },
    });
    // Handles <pre> whether or not <code> is its direct child, which
    // syntax-highlighter wrappers often break.
    turndown.addRule('snipTexCodeBlock', {
      filter: 'pre',
      replacement(content, node) {
        const code = node.querySelector('code');
        const text = (code || node).textContent.replace(/\n$/, '');
        const lang = codeLanguage(node, code);
        const longestRun = Math.max(0, ...(text.match(/`+/g) || []).map((r) => r.length));
        const fence = '`'.repeat(Math.max(3, longestRun + 1));
        return '\n\n' + fence + lang + '\n' + text + '\n' + fence + '\n\n';
      },
    });
    return turndown;
  }

  function rangeToMarkdown(range, format) {
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    const math = extractMath(container);
    const markdown = getTurndown().turndown(container);
    return restoreMath(markdown, math, format).trim();
  }

  function selectionToMarkdown(format) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const parts = [];
    for (let i = 0; i < sel.rangeCount; i++) {
      const range = sel.getRangeAt(i).cloneRange();
      expandRange(range);
      parts.push(rangeToMarkdown(range, format));
    }
    return parts.filter(Boolean).join('\n\n');
  }

  // Fallback for when the async clipboard API is refused.
  function copyViaExecCommand(text) {
    const onCopy = (e) => {
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
    };
    document.addEventListener('copy', onCopy, true);
    try {
      return document.execCommand('copy');
    } finally {
      document.removeEventListener('copy', onCopy, true);
    }
  }

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      return copyViaExecCommand(text);
    }
  }

  function texOf(mathEl) {
    const ann = mathEl && mathEl.querySelector(TEX_ANNOTATION);
    return ann ? ann.textContent.trim() : null;
  }

  // The element under the last right-click, for "Copy LaTeX".
  let contextTarget = null;
  document.addEventListener('contextmenu', (e) => { contextTarget = e.target; }, true);

  function contextTex() {
    return contextTarget ? texOf(mathAncestor(contextTarget)) : null;
  }

  async function copySelection(format) {
    const markdown = selectionToMarkdown(format);
    if (!markdown) return { ok: false, reason: 'empty' };
    const ok = await writeClipboard(markdown);
    // On failure the background page retries with the returned text.
    return ok ? { ok } : { ok, reason: 'clipboard', text: markdown };
  }

  let toastTimer = null;
  function showToast(message, isError) {
    let host = document.getElementById('sniptex-toast');
    if (!host) {
      host = document.createElement('div');
      host.id = 'sniptex-toast';
      // Shadow DOM keeps the page's CSS out. Built without innerHTML so
      // web-ext lint stays quiet.
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        div {
          position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
          padding: 8px 14px; border-radius: 8px;
          font: 500 13px/1.4 system-ui, sans-serif;
          color: #fff; background: #1f7a4d; box-shadow: 0 4px 14px rgba(0,0,0,.25);
          opacity: 0; transform: translateY(6px); transition: opacity .15s, transform .15s;
          pointer-events: none;
        }
        div.error { background: #b3261e; }
        div.show { opacity: 1; transform: none; }`;
      const box = document.createElement('div');
      box.setAttribute('role', 'status');
      shadow.append(style, box);
      document.documentElement.appendChild(host);
    }
    const box = host.shadowRoot.querySelector('div');
    box.textContent = message;
    box.classList.toggle('error', !!isError);
    requestAnimationFrame(() => box.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 1600);
  }

  function toastFor(result) {
    if (result.ok) showToast('Copied as Markdown');
    else if (result.reason === 'empty') showToast('Nothing selected', true);
    // 'clipboard' failures wait for the background retry's verdict.
  }

  if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((msg) => {
      if (!msg) return undefined;
      if (msg.type === 'sniptex-copy') {
        return copySelection(msg.format).then((result) => {
          toastFor(result);
          return result;
        });
      }
      if (msg.type === 'sniptex-target-is-math') {
        return Promise.resolve(contextTex() !== null);
      }
      if (msg.type === 'sniptex-copy-latex') {
        const tex = contextTex();
        if (tex === null) return Promise.resolve({ ok: false, reason: 'empty' });
        return writeClipboard(tex).then((ok) => {
          if (ok) showToast('Copied LaTeX');
          return ok ? { ok } : { ok, reason: 'clipboard', text: tex };
        });
      }
      if (msg.type === 'sniptex-toast') {
        showToast(msg.ok ? msg.message || 'Copied as Markdown' : 'Copy failed', !msg.ok);
      }
      return undefined;
    });
  }

  return { copySelection, selectionToMarkdown, rangeToMarkdown, expandRange, texOf, mathAncestor };
})();
