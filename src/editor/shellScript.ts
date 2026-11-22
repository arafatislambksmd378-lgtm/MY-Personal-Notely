/**
 * Editor runtime embedded in the WebView (Android) / iframe (web).
 *
 * It is plain ES5-compatible JavaScript on purpose: it must run inside the
 * Android WebView without any bundler. Communication with the React Native host
 * uses a JSON message protocol (see `src/types/editor.ts`).
 */
export const EDITOR_SCRIPT = `
(function () {
  'use strict';
  var editor = document.getElementById('editor');
  var page = document.getElementById('page');
  var header = document.getElementById('page-header');
  var footer = document.getElementById('page-footer');
  var footerText = document.getElementById('page-footer-text');
  var pageNumber = document.getElementById('page-number');
  var overlay = document.getElementById('drawing-overlay');
  var HOST = window.ReactNativeWebView ? 'rn' : 'web';
  var changeTimer = null;
  var lastSentHtml = editor.innerHTML;

  function post(message) {
    var payload = JSON.stringify(message);
    if (HOST === 'rn' && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(payload);
    } else if (window.parent) {
      window.parent.postMessage(payload, '*');
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(value) { return escapeHtml(value); }

  function plainText() {
    var text = editor.innerText || '';
    return text.replace(/\\u00a0/g, ' ').replace(/\\n{3,}/g, '\\n\\n').trim();
  }
  function countWords(text) {
    var trimmed = text.replace(/\\s+/g, ' ').trim();
    return trimmed ? trimmed.split(' ').length : 0;
  }

  function emitChange(immediate) {
    if (changeTimer) { clearTimeout(changeTimer); changeTimer = null; }
    var send = function () {
      var html = editor.innerHTML;
      lastSentHtml = html;
      var text = plainText();
      post({
        type: 'change',
        html: html,
        plainText: text,
        wordCount: countWords(text),
        charCount: text.length
      });
    };
    if (immediate) { send(); } else { changeTimer = setTimeout(send, 220); }
  }

  function syncSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var node = sel.focusNode;
    var element = node && node.nodeType === 3 ? node.parentElement : node;
    var blockName = 'p';
    if (element && element.closest) {
      var block = element.closest('h1,h2,h3,blockquote,pre,p');
      if (block) blockName = block.tagName.toLowerCase();
    }
    var state = function (command) {
      try { return document.queryCommandState(command); } catch (e) { return false; }
    };
    var align = 'left';
    if (state('justifyCenter')) align = 'center';
    else if (state('justifyRight')) align = 'right';
    else if (state('justifyFull')) align = 'justify';
    var map = { h1: 'h1', h2: 'h2', h3: 'h3', blockquote: 'quote', pre: 'code', p: 'paragraph' };
    post({
      type: 'selection',
      info: {
        bold: state('bold'), italic: state('italic'), underline: state('underline'),
        strikeThrough: state('strikeThrough'),
        block: map[blockName] || 'paragraph', align: align
      }
    });
  }

  function withStyleCss() { try { document.execCommand('styleWithCSS', false, true); } catch (e) {} }

  function exec(command) {
    editor.focus();
    withStyleCss();
    try { document.execCommand(command, false, null); } catch (e) { post({ type: 'error', message: String(e) }); }
    emitChange(true);
    syncSelection();
  }

  function setBlock(value) {
    editor.focus();
    var tag = value === 'paragraph' ? 'p' : value === 'quote' ? 'blockquote' : value === 'code' ? 'pre' : value;
    try { document.execCommand('formatBlock', false, '<' + tag + '>'); } catch (e) {}
    emitChange(true);
    syncSelection();
  }

  function setAlign(value) {
    var map = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' };
    exec(map[value] || 'justifyLeft');
  }

  function applyInlineStyle(property, value) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { return false; }
    var range = sel.getRangeAt(0);
    var span = document.createElement('span');
    span.style[property] = value;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      var restored = document.createRange();
      restored.selectNodeContents(span);
      sel.addRange(restored);
    } catch (e) { return false; }
    emitChange(true);
    return true;
  }

  function insertHTML(html) {
    editor.focus();
    var sel = window.getSelection();
    var inserted = false;
    if (sel && sel.rangeCount > 0) {
      var range = sel.getRangeAt(0);
      // Never insert outside the editable surface.
      if (editor.contains(range.startContainer) || range.startContainer === editor) {
        var fragment = range.createContextualFragment(html);
        range.deleteContents();
        range.insertNode(fragment);
        inserted = true;
      }
    }
    if (!inserted) { editor.insertAdjacentHTML('beforeend', html); }
    emitChange(true);
  }

  function insertTable(rows, columns, withHeader) {
    rows = Math.max(1, Math.min(30, Number(rows) || 2));
    columns = Math.max(1, Math.min(10, Number(columns) || 2));
    var html = '<table><tbody>';
    for (var r = 0; r < rows; r += 1) {
      html += '<tr>';
      for (var c = 0; c < columns; c += 1) {
        var tag = withHeader && r === 0 ? 'th' : 'td';
        html += '<' + tag + '>' + (withHeader && r === 0 ? 'Column ' + (c + 1) : '&nbsp;') + '</' + tag + '>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    insertHTML(html);
  }

  function insertLink(href, label) {
    if (!href) return;
    var sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      editor.focus();
      try { document.execCommand('createLink', false, href); } catch (e) {}
      var anchors = editor.querySelectorAll('a[href="' + href.replace(/"/g, '') + '"]');
      for (var i = 0; i < anchors.length; i += 1) { anchors[i].setAttribute('title', label || href); }
      emitChange(true);
      return;
    }
    insertHTML('<a href="' + escapeAttr(href) + '" target="_blank" rel="noopener">' + escapeHtml(label || href) + '</a>&nbsp;');
  }

  function insertImage(src, alt) {
    if (!src) return;
    insertHTML('<img src="' + escapeAttr(src) + '" alt="' + escapeAttr(alt || 'Inserted image') + '" />');
  }

  function insertChart(svg, caption) {
    insertHTML('<figure>' + svg + (caption ? '<figcaption>' + escapeHtml(caption) + '</figcaption>' : '') + '</figure>');
  }

  function insertFootnote(marker, text) {
    insertHTML('<sup data-footnote="' + escapeAttr(marker) + '">' + escapeHtml(marker) + '</sup>&nbsp;');
    var section = editor.querySelector('.notely-footnotes');
    if (!section) {
      section = document.createElement('section');
      section.className = 'notely-footnotes';
      editor.appendChild(section);
    }
    var paragraph = document.createElement('p');
    paragraph.innerHTML = '<b>' + escapeHtml(marker) + '</b> ' + escapeHtml(text);
    section.appendChild(paragraph);
    emitChange(true);
  }

  function insertToc() {
    var headings = editor.querySelectorAll('h1,h2,h3');
    if (!headings.length) { post({ type: 'toc-empty' }); return; }
    var items = '';
    for (var i = 0; i < headings.length; i += 1) {
      var heading = headings[i];
      var id = heading.id || ('notely-heading-' + (i + 1));
      heading.id = id;
      var level = Number(heading.tagName.slice(1)) - 1;
      items += '<li style="margin-left:' + (level * 14) + 'px"><a href="#' + escapeAttr(id) + '">' + escapeHtml(heading.textContent || 'Untitled') + '</a></li>';
    }
    insertHTML('<div class="notely-toc"><p>Contents</p><ul>' + items + '</ul></div><p><br></p>');
  }

  function insertBookmark(id, label) {
    insertHTML('<span id="' + escapeAttr(id) + '" data-bookmark="' + escapeAttr(id) + '" class="notely-bookmark-target" style="color:var(--accent);font-weight:600;background:rgba(124,58,237,0.10);border-radius:6px;padding:1px 6px;">' + escapeHtml(label) + '</span>&nbsp;');
    emitChange(true);
  }

  function textNodes() {
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) {
      var parent = walker.currentNode.parentElement;
      if (parent && parent.closest('.notely-footnotes')) continue;
      nodes.push(walker.currentNode);
    }
    return nodes;
  }

  function replaceAll(search, replacement, matchCase, limit) {
    if (!search) return 0;
    var count = 0;
    var max = typeof limit === 'number' && limit > 0 ? limit : Infinity;
    var nodes = textNodes();
    var needle = matchCase ? search : search.toLowerCase();
    for (var n = 0; n < nodes.length; n += 1) {
      var node = nodes[n];
      var text = node.nodeValue || '';
      var haystack = matchCase ? text : text.toLowerCase();
      if (haystack.indexOf(needle) === -1) continue;
      var result = '';
      var cursor = 0;
      while (cursor < text.length) {
        if (count >= max) { result += text.slice(cursor); break; }
        var index = haystack.indexOf(needle, cursor);
        if (index === -1) { result += text.slice(cursor); break; }
        result += text.slice(cursor, index) + replacement;
        cursor = index + search.length;
        count += 1;
      }
      node.nodeValue = result;
      if (count >= max) break;
    }
    if (count > 0) emitChange(true);
    return count;
  }

  function findRanges(search, matchCase) {
    var ranges = [];
    if (!search) return ranges;
    var nodes = textNodes();
    var needle = matchCase ? search : search.toLowerCase();
    for (var n = 0; n < nodes.length; n += 1) {
      var node = nodes[n];
      var text = node.nodeValue || '';
      var haystack = matchCase ? text : text.toLowerCase();
      var index = haystack.indexOf(needle);
      while (index !== -1) {
        var range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + search.length);
        ranges.push(range);
        index = haystack.indexOf(needle, index + search.length);
      }
    }
    return ranges;
  }

  function clearFind() {
    if (window.CSS && CSS.highlights) { try { CSS.highlights.delete('notely-find'); } catch (e) {} }
  }

  function highlightFind(search, matchCase, index) {
    clearFind();
    var ranges = findRanges(search, matchCase);
    if (window.CSS && CSS.highlights && typeof Highlight !== 'undefined') {
      try {
        var highlight = new Highlight();
        for (var i = 0; i < ranges.length; i += 1) highlight.add(ranges[i]);
        CSS.highlights.set('notely-find', highlight);
      } catch (e) {}
    }
    if (ranges[index]) {
      var target = ranges[index].startContainer.parentElement;
      if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return ranges.length;
  }

  function paperDimensions(setup) {
    var sizes = { A4: [794, 1123], A5: [559, 794], Letter: [816, 1056], Legal: [816, 1344] };
    var dimensions = sizes[setup.paperSize] || sizes.A4;
    var landscape = setup.orientation === 'landscape';
    return landscape ? [dimensions[1], dimensions[0]] : dimensions;
  }

  function applyPageSetup(setup) {
    if (!setup) return;
    var dimensions = paperDimensions(setup);
    var root = document.documentElement;
    root.style.setProperty('--paper-width', dimensions[0] + 'px');
    root.style.setProperty('--paper-height', dimensions[1] + 'px');
    var margins = setup.margins || { top: 56, right: 48, bottom: 56, left: 48 };
    root.style.setProperty('--margin-top', (margins.top || 0) + 'px');
    root.style.setProperty('--margin-right', (margins.right || 0) + 'px');
    root.style.setProperty('--margin-bottom', (margins.bottom || 0) + 'px');
    root.style.setProperty('--margin-left', (margins.left || 0) + 'px');
    root.style.setProperty('--page', setup.pageColor || '#FFFFFF');
    root.style.setProperty('--line-height', String(setup.lineHeight || 1.55));
    header.textContent = setup.headerText || '';
    footerText.textContent = setup.footerText || '';
    page.className = (setup.headerText ? 'with-header ' : '') + (setup.footerText || setup.pageNumbers ? 'with-footer' : '');
    pageNumber.style.display = setup.pageNumbers ? 'inline' : 'none';
    pageNumber.textContent = 'Page 1';
  }

  function setTheme(dark) {
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }

  /* ---------------- drawing pad ---------------- */
  var canvas = document.getElementById('drawing-canvas');
  var context = canvas.getContext('2d');
  var drawing = false;
  var brushColor = '#151223';
  var brushSize = 3;
  var strokeStarted = false;

  function sizeCanvas() {
    var ratio = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) {
      var snapshot = canvas.width > 0 ? canvas.toDataURL() : null;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, rect.width, rect.height);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      if (snapshot) {
        var img = new Image();
        img.onload = function () { context.drawImage(img, 0, 0, rect.width, rect.height); };
        img.src = snapshot;
      }
    }
  }

  function pointFrom(event) {
    var rect = canvas.getBoundingClientRect();
    var touch = event.touches && event.touches[0];
    var clientX = touch ? touch.clientX : event.clientX;
    var clientY = touch ? touch.clientY : event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startStroke(event) {
    event.preventDefault();
    sizeCanvas();
    drawing = true;
    strokeStarted = true;
    var point = pointFrom(event);
    context.strokeStyle = brushColor;
    context.lineWidth = brushSize;
    context.beginPath();
    context.moveTo(point.x, point.y);
  }
  function moveStroke(event) {
    if (!drawing) return;
    event.preventDefault();
    var point = pointFrom(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  function endStroke(event) {
    if (!drawing) return;
    if (event && event.preventDefault) event.preventDefault();
    drawing = false;
    context.closePath();
  }

  canvas.addEventListener('mousedown', startStroke);
  canvas.addEventListener('mousemove', moveStroke);
  window.addEventListener('mouseup', endStroke);
  canvas.addEventListener('touchstart', startStroke, { passive: false });
  canvas.addEventListener('touchmove', moveStroke, { passive: false });
  canvas.addEventListener('touchend', endStroke, { passive: false });

  var swatches = document.querySelectorAll('#drawing-colors .swatch');
  for (var s = 0; s < swatches.length; s += 1) {
    swatches[s].addEventListener('click', function (event) {
      brushColor = event.currentTarget.getAttribute('data-color');
      for (var k = 0; k < swatches.length; k += 1) swatches[k].classList.remove('active');
      event.currentTarget.classList.add('active');
    });
  }
  document.getElementById('drawing-clear').addEventListener('click', function () {
    var rect = canvas.getBoundingClientRect();
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, rect.width, rect.height);
  });
  document.getElementById('drawing-cancel').addEventListener('click', function () {
    overlay.classList.remove('open');
  });
  document.getElementById('drawing-insert').addEventListener('click', function () {
    if (!strokeStarted) { overlay.classList.remove('open'); return; }
    var dataUrl = canvas.toDataURL('image/png');
    insertImage(dataUrl, 'Sketch');
    post({ type: 'media', kind: 'drawing', dataUri: dataUrl, bytes: Math.round(dataUrl.length * 0.75) });
    overlay.classList.remove('open');
    strokeStarted = false;
  });

  /* ---------------- host messages ---------------- */
  function handle(message) {
    switch (message.type) {
      case 'set-content': editor.innerHTML = message.html || ''; emitChange(true); break;
      case 'exec': exec(message.command); break;
      case 'block': setBlock(message.value); break;
      case 'align': setAlign(message.value); break;
      case 'foreColor': withStyleCss(); document.execCommand('foreColor', false, message.value); emitChange(true); break;
      case 'hiliteColor':
        withStyleCss();
        if (!document.execCommand('hiliteColor', false, message.value)) {
          applyInlineStyle('backgroundColor', message.value);
        }
        emitChange(true);
        break;
      case 'fontSize': applyInlineStyle('fontSize', message.value); break;
      case 'insertHTML': insertHTML(message.html); break;
      case 'insertText': insertHTML(escapeHtml(message.text)); break;
      case 'insertImage': insertImage(message.src, message.alt); break;
      case 'insertTable': insertTable(message.rows, message.columns, message.withHeader); break;
      case 'insertLink': insertLink(message.href, message.label); break;
      case 'insertChart': insertChart(message.svg, message.caption); break;
      case 'insertFootnote': insertFootnote(message.marker, message.text); break;
      case 'insertToc': insertToc(); break;
      case 'insertBookmark': insertBookmark(message.id, message.label); break;
      case 'replaceAll':
        var replaced = replaceAll(message.search, message.replacement, message.matchCase, message.limit);
        post({ type: 'replace-result', count: replaced });
        break;
      case 'highlightFind':
        var total = highlightFind(message.search, message.matchCase, message.index);
        post({ type: 'find-result', count: total });
        break;
      case 'clearFind': clearFind(); break;
      case 'focus': editor.focus(); break;
      case 'blur': editor.blur(); break;
      case 'set-page-setup':
        applyPageSetup(JSON.parse(message.pageSetup));
        if (message.fontScale) document.documentElement.style.setProperty('--font-scale', String(message.fontScale));
        break;
      case 'set-theme': setTheme(message.dark); break;
      case 'request-selection':
        var selection = window.getSelection();
        post({ type: 'selection-text', text: selection ? String(selection).slice(0, 400) : '' });
        break;
      case 'scroll-to-anchor':
        var anchor = document.getElementById(message.anchor);
        if (anchor && anchor.scrollIntoView) anchor.scrollIntoView({ block: 'center', behavior: 'smooth' });
        break;
      case 'open-drawing':
        overlay.classList.add('open');
        setTimeout(sizeCanvas, 30);
        break;
      default: break;
    }
  }

  if (HOST === 'rn') {
    window.__notelyReceive = function (json) {
      try { handle(typeof json === 'string' ? JSON.parse(json) : json); }
      catch (e) { post({ type: 'error', message: String(e) }); }
    };
  } else {
    window.addEventListener('message', function (event) {
      if (typeof event.data !== 'string') return;
      try {
        var parsed = JSON.parse(event.data);
        if (parsed && parsed.type) handle(parsed);
      } catch (e) {}
    });
  }

  editor.addEventListener('input', function () { emitChange(false); });
  editor.addEventListener('blur', function () { emitChange(true); });
  document.addEventListener('selectionchange', function () { syncSelection(); });
  document.addEventListener('keydown', function (event) {
    var meta = event.ctrlKey || event.metaKey;
    if (meta && (event.key === 's' || event.key === 'S')) {
      event.preventDefault();
      emitChange(true);
      post({ type: 'save-shortcut' });
    }
  });
  // Links inside the editor must not navigate the surface away from the note.
  editor.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (anchor && HOST === 'rn') { event.preventDefault(); post({ type: 'link-click', href: anchor.getAttribute('href') }); }
  });

  post({ type: 'ready' });
  syncSelection();
})();
`;
