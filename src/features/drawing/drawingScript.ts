/**
 * Canvas runtime for the full-screen drawing editor.
 *
 * Design notes:
 *  - Every item is stored in NORMALISED coordinates (0…1 of the canvas), so the
 *    drawing survives orientation changes and resizes without quality loss: on
 *    resize we simply re-render the same vectors at the new size instead of
 *    stretching a bitmap.
 *  - Strokes and shapes are vector objects (not baked pixels), which is what
 *    makes select / move / resize / recolour / delete possible.
 *  - Undo/redo are snapshots of the item list — cheap, and immune to the kind
 *    of bugs that incremental undo stacks produce with gestures.
 *  - Input uses Pointer Events with touch fallback so finger, stylus and mouse
 *    all work; `touch-action: none` stops the WebView from scrolling.
 *
 * This file is a plain string (not a module) because it is injected verbatim
 * into the drawing document. Keep it ES5-friendly and free of backticks.
 */
export const DRAWING_SCRIPT = String.raw`
(function () {
  'use strict';

  var HOST = window.ReactNativeWebView ? 'rn' : 'web';
  var canvas = document.getElementById('notely-drawing');
  var ctx = canvas.getContext('2d');

  var cssW = 0;
  var cssH = 0;

  var items = [];
  var selectionId = null;
  var undoStack = [];
  var redoStack = [];
  var nextId = 1;
  var pendingHistory = false;

  var tool = 'pen';
  var color = '#151223';
  var strokeWidth = 0.012;
  var stabilize = true;
  var armedShape = null;
  var gesture = null;

  /* ------------------------------- helpers ------------------------------- */

  function post(message) {
    var payload = JSON.stringify(message);
    if (HOST === 'rn' && window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
    else window.parent.postMessage(payload, '*');
  }

  function unit() { return Math.min(cssW, cssH) || 1; }
  function px(value) { return value * cssW; }
  function py(value) { return value * cssH; }

  function selected() {
    for (var i = 0; i < items.length; i += 1) if (items[i].id === selectionId) return items[i];
    return null;
  }

  function clamp(value, min, max) { return value < min ? min : value > max ? max : value; }

  /* Shape capabilities: closed shapes can be filled, some need a heavier line. */
  var SPECS = {
    rectangle: { fill: true }, roundedRectangle: { fill: true }, square: { fill: true },
    circle: { fill: true }, oval: { fill: true }, triangle: { fill: true },
    rightTriangle: { fill: true }, diamond: { fill: true }, pentagon: { fill: true },
    hexagon: { fill: true }, octagon: { fill: true },
    line: {}, dashedLine: { dash: [10, 8] }, dottedLine: { dash: [2, 7] },
    arrow: { arrow: 'end' }, doubleArrow: { arrow: 'both' }, curvedArrow: { arrow: 'end' },
    connector: { dots: true }, horizontalLine: {}, verticalLine: {},
    arc: {}, semicircle: { fill: true }, trapezoid: { fill: true },
    parallelogram: { fill: true }, star: { fill: true },
    cross: { scale: 2.6 }, plus: { scale: 2.6 }, minus: { scale: 2.6 },
    bracket: { scale: 1.6 }, brace: { scale: 1.6 },
    process: { fill: true }, decision: { fill: true }, inputOutput: { fill: true },
    startEnd: { fill: true }, document: { fill: true }, database: { fill: true },
    connectorNode: { fill: true }
  };

  function spec(kind) { return SPECS[kind] || {}; }

  /* -------------------------------- sizing ------------------------------- */

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var width = rect.width;
    var height = rect.height;
    if (!width || !height) return;
    var ratio = window.devicePixelRatio || 1;
    var targetW = Math.round(width * ratio);
    var targetH = Math.round(height * ratio);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cssW = width;
    cssH = height;
    render();
  }

  /* ------------------------------- rendering ----------------------------- */

  function render() {
    if (!cssW || !cssH) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cssW, cssH);
    for (var i = 0; i < items.length; i += 1) drawItem(items[i]);
    drawSelection();
  }

  function drawItem(item) {
    if (item.kind === 'stroke') drawStroke(item);
    else drawShape(item);
  }

  function drawStroke(item) {
    var width = Math.max(1, item.width * unit());
    var points = item.points || [];
    ctx.save();
    ctx.globalAlpha = item.alpha == null ? 1 : item.alpha;
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (points.length < 2) {
      var radius = width / 2;
      ctx.arc(px(points[0].x), py(points[0].y), radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(px(points[0].x), py(points[0].y));
      for (var i = 1; i < points.length - 1; i += 1) {
        var midX = (px(points[i].x) + px(points[i + 1].x)) / 2;
        var midY = (py(points[i].y) + py(points[i + 1].y)) / 2;
        ctx.quadraticCurveTo(px(points[i].x), py(points[i].y), midX, midY);
      }
      var last = points[points.length - 1];
      ctx.lineTo(px(last.x), py(last.y));
      ctx.stroke();
    }
    ctx.restore();
  }

  function endPoints(item, x, y, w, h) {
    var x1 = item.flipX ? x + w : x;
    var y1 = item.flipY ? y + h : y;
    var x2 = item.flipX ? x : x + w;
    var y2 = item.flipY ? y : y + h;
    if (item.shape === 'horizontalLine') { y1 = y + h / 2; y2 = y1; }
    if (item.shape === 'verticalLine') { x1 = x + w / 2; x2 = x1; }
    return [x1, y1, x2, y2];
  }

  function drawShape(item) {
    var x = px(item.x);
    var y = py(item.y);
    var w = item.w * cssW;
    var h = item.h * cssH;
    var s = spec(item.shape);
    var scale = s.scale || 1;
    var lineWidth = Math.max(1.2, item.width * unit() * scale);
    var ends = endPoints(item, x, y, w, h);

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = item.color;
    ctx.setLineDash(s.dash || []);
    ctx.beginPath();
    traceShape(item, x, y, w, h, ends);
    if (s.fill && item.fill) { ctx.fillStyle = item.fill; ctx.fill(); }
    ctx.stroke();
    ctx.setLineDash([]);

    if (s.arrow === 'end' || s.arrow === 'both') {
      var headSize = Math.max(8, lineWidth * 2.8);
      var angle = Math.atan2(ends[3] - ends[1], ends[2] - ends[0]);
      arrowHead(ends[2], ends[3], angle, headSize, item.color);
      if (s.arrow === 'both') arrowHead(ends[0], ends[1], angle + Math.PI, headSize, item.color);
    }
    if (s.dots) {
      dot(ends[0], ends[1], Math.max(3, lineWidth * 1.2), item.color);
      dot(ends[2], ends[3], Math.max(3, lineWidth * 1.2), item.color);
    }
    ctx.restore();
  }

  function arrowHead(tipX, tipY, angle, size, fill) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - size * Math.cos(angle - 0.42), tipY - size * Math.sin(angle - 0.42));
    ctx.lineTo(tipX - size * Math.cos(angle + 0.42), tipY - size * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function dot(x, y, radius, fill) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function polygonPath(cx, cy, radius, sides) {
    for (var i = 0; i < sides; i += 1) {
      var angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
      var x = cx + radius * Math.cos(angle);
      var y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function starPath(cx, cy, radius, points, innerRatio) {
    for (var i = 0; i < points * 2; i += 1) {
      var angle = -Math.PI / 2 + (i * Math.PI) / points;
      var r = i % 2 === 0 ? radius : radius * innerRatio;
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function roundedRectPath(x, y, w, h, radius) {
    var r = Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function traceShape(item, x, y, w, h, ends) {
    var cx = x + w / 2;
    var cy = y + h / 2;
    var r = Math.min(w, h) / 2;
    var kind = item.shape;
    var bar;

    switch (kind) {
      case 'rectangle':
      case 'process':
        ctx.rect(x, y, w, h);
        break;
      case 'roundedRectangle':
        roundedRectPath(x, y, w, h, Math.min(w, h) * 0.18);
        break;
      case 'startEnd':
        roundedRectPath(x, y, w, h, Math.min(w, h) / 2);
        break;
      case 'square':
        ctx.rect(x, y, w, h);
        break;
      case 'circle':
      case 'connectorNode':
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
      case 'oval':
        ctx.ellipse(cx, cy, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
        break;
      case 'triangle':
        ctx.moveTo(cx, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      case 'rightTriangle':
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      case 'diamond':
      case 'decision':
        ctx.moveTo(cx, y);
        ctx.lineTo(x + w, cy);
        ctx.lineTo(cx, y + h);
        ctx.lineTo(x, cy);
        ctx.closePath();
        break;
      case 'pentagon':
        polygonPath(cx, cy, r, 5);
        break;
      case 'hexagon':
        polygonPath(cx, cy, r, 6);
        break;
      case 'octagon':
        polygonPath(cx, cy, r, 8);
        break;
      case 'star':
        starPath(cx, cy, r, 5, 0.42);
        break;
      case 'trapezoid':
        ctx.moveTo(x + w * 0.18, y);
        ctx.lineTo(x + w * 0.82, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      case 'parallelogram':
      case 'inputOutput':
        ctx.moveTo(x + w * 0.22, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w * 0.78, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      case 'cross':
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.moveTo(x + w, y);
        ctx.lineTo(x, y + h);
        break;
      case 'plus':
        ctx.moveTo(cx, y);
        ctx.lineTo(cx, y + h);
        ctx.moveTo(x, cy);
        ctx.lineTo(x + w, cy);
        break;
      case 'minus':
        ctx.moveTo(x, cy);
        ctx.lineTo(x + w, cy);
        break;
      case 'bracket':
        bar = Math.min(w, h) * 0.22;
        ctx.moveTo(x + bar, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + bar, y + h);
        break;
      case 'brace':
        bar = Math.min(w, h) * 0.26;
        ctx.moveTo(x + bar, y);
        ctx.quadraticCurveTo(x, y, x, y + bar);
        ctx.lineTo(x, cy - bar);
        ctx.quadraticCurveTo(x, cy, x - bar * 0.7, cy);
        ctx.quadraticCurveTo(x, cy, x, cy + bar);
        ctx.lineTo(x, y + h - bar);
        ctx.quadraticCurveTo(x, y + h, x + bar, y + h);
        break;
      case 'arc':
        ctx.arc(cx, cy, r, Math.PI, 0, true);
        break;
      case 'semicircle':
        ctx.arc(cx, cy, r, Math.PI, 0, true);
        ctx.closePath();
        break;
      case 'document':
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h * 0.8);
        ctx.quadraticCurveTo(x + w * 0.75, y + h * 0.95, x + w * 0.5, y + h * 0.8);
        ctx.quadraticCurveTo(x + w * 0.25, y + h * 0.65, x, y + h * 0.8);
        ctx.closePath();
        break;
      case 'database': {
        var ry = Math.max(2, Math.min(w, h) * 0.14);
        ctx.moveTo(x, y + ry);
        ctx.ellipse(cx, y + ry, Math.max(0.5, w / 2), ry, 0, Math.PI, 0, true);
        ctx.lineTo(x + w, y + h - ry);
        ctx.ellipse(cx, y + h - ry, Math.max(0.5, w / 2), ry, 0, 0, Math.PI, false);
        ctx.closePath();
        break;
      }
      case 'line':
      case 'dashedLine':
      case 'dottedLine':
      case 'horizontalLine':
      case 'verticalLine':
      case 'arrow':
      case 'doubleArrow':
        ctx.moveTo(ends[0], ends[1]);
        ctx.lineTo(ends[2], ends[3]);
        break;
      case 'curvedArrow': {
        var midX = (ends[0] + ends[2]) / 2;
        var midY = (ends[1] + ends[3]) / 2;
        var dx = ends[2] - ends[0];
        var dy = ends[3] - ends[1];
        var length = Math.sqrt(dx * dx + dy * dy) || 1;
        var bend = Math.min(60, length * 0.28);
        ctx.moveTo(ends[0], ends[1]);
        ctx.quadraticCurveTo(midX - (dy / length) * bend, midY + (dx / length) * bend, ends[2], ends[3]);
        break;
      }
      case 'connector': {
        var elbowX = (ends[0] + ends[2]) / 2;
        ctx.moveTo(ends[0], ends[1]);
        ctx.lineTo(elbowX, ends[1]);
        ctx.lineTo(elbowX, ends[3]);
        ctx.lineTo(ends[2], ends[3]);
        break;
      }
      default:
        ctx.rect(x, y, w, h);
        break;
    }
  }

  function drawSelection() {
    var sel = selected();
    if (!sel) return;
    var b = bboxOf(sel);
    ctx.save();
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(b.x, b.y, Math.max(b.w, 1), Math.max(b.h, 1));
    ctx.setLineDash([]);
    var corners = [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x, b.y + b.h],
      [b.x + b.w, b.y + b.h]
    ];
    for (var i = 0; i < corners.length; i += 1) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.rect(corners[i][0] - 5, corners[i][1] - 5, 10, 10);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------ hit testing ---------------------------- */

  function bboxOf(item) {
    if (item.kind === 'stroke') {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      var points = item.points || [];
      for (var i = 0; i < points.length; i += 1) {
        if (points[i].x < minX) minX = points[i].x;
        if (points[i].x > maxX) maxX = points[i].x;
        if (points[i].y < minY) minY = points[i].y;
        if (points[i].y > maxY) maxY = points[i].y;
      }
      var pad = (item.width * unit()) / 2;
      var x = px(minX) - pad;
      var y = py(minY) - pad;
      return {
        x: x,
        y: y,
        w: Math.max(1, px(maxX) - px(minX)) + pad * 2,
        h: Math.max(1, py(maxY) - py(minY)) + pad * 2
      };
    }
    return { x: px(item.x), y: py(item.y), w: Math.max(1, item.w * cssW), h: Math.max(1, item.h * cssH) };
  }

  function hitItem(p) {
    var pad = 8;
    for (var i = items.length - 1; i >= 0; i -= 1) {
      var b = bboxOf(items[i]);
      if (p.px >= b.x - pad && p.px <= b.x + b.w + pad && p.py >= b.y - pad && p.py <= b.y + b.h + pad) {
        return items[i];
      }
    }
    return null;
  }

  function hitHandle(p) {
    var sel = selected();
    if (!sel) return null;
    var b = bboxOf(sel);
    var hs = 18;
    var corners = {
      nw: [b.x, b.y],
      ne: [b.x + b.w, b.y],
      sw: [b.x, b.y + b.h],
      se: [b.x + b.w, b.y + b.h]
    };
    var keys = ['nw', 'ne', 'sw', 'se'];
    for (var i = 0; i < keys.length; i += 1) {
      var c = corners[keys[i]];
      if (Math.abs(p.px - c[0]) <= hs && Math.abs(p.py - c[1]) <= hs) return keys[i];
    }
    return null;
  }

  /* -------------------------------- history ------------------------------ */

  function snapshot() { return JSON.stringify(items); }

  function beginMutation() {
    if (pendingHistory) return;
    undoStack.push(snapshot());
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
    pendingHistory = true;
  }

  function endMutation() { pendingHistory = false; }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    items = JSON.parse(undoStack.pop());
    selectionId = null;
    pendingHistory = false;
    render();
    emitState();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    items = JSON.parse(redoStack.pop());
    selectionId = null;
    pendingHistory = false;
    render();
    emitState();
  }

  /* ------------------------------- gestures ------------------------------ */

  function toPoint(event) {
    var rect = canvas.getBoundingClientRect();
    var width = rect.width || 1;
    var height = rect.height || 1;
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    return { x: x / width, y: y / height, px: x, py: y };
  }

  function needsSquare(kind) { return kind === 'square' || kind === 'circle'; }

  function startStroke(p) {
    beginMutation();
    var item = {
      id: 'i' + (nextId += 1),
      kind: 'stroke',
      tool: tool,
      color: color,
      width: strokeWidth * (tool === 'highlighter' ? 3 : 1),
      alpha: tool === 'highlighter' ? 0.42 : 1,
      points: [{ x: p.x, y: p.y }]
    };
    items.push(item);
    selectionId = null;
    gesture = { type: 'draw', item: item, smooth: { x: p.x, y: p.y } };
    render();
    emitState();
  }

  function startShape(p) {
    beginMutation();
    var item = {
      id: 'i' + (nextId += 1),
      kind: 'shape',
      shape: armedShape,
      x: p.x,
      y: p.y,
      w: 0,
      h: 0,
      flipX: false,
      flipY: false,
      color: color,
      width: strokeWidth,
      fill: null
    };
    items.push(item);
    selectionId = item.id;
    gesture = { type: 'shape', item: item, start: { x: p.x, y: p.y } };
    render();
    emitState();
  }

  function startSelect(p) {
    var handle = hitHandle(p);
    if (handle) {
      gesture = { type: 'resize', handle: handle, orig: JSON.parse(JSON.stringify(selected())), start: { x: p.x, y: p.y } };
      return;
    }
    var hit = hitItem(p);
    if (hit) {
      selectionId = hit.id;
      gesture = { type: 'move', id: hit.id, start: { x: p.x, y: p.y }, orig: JSON.parse(JSON.stringify(hit)) };
    } else {
      selectionId = null;
    }
    render();
    emitState();
  }

  function startErase(p) {
    gesture = { type: 'erase', changed: false };
    eraseAt(p);
  }

  function eraseAt(p) {
    var hit = hitItem(p);
    if (!hit) return;
    if (!gesture.changed) beginMutation();
    gesture.changed = true;
    var index = items.indexOf(hit);
    if (index >= 0) items.splice(index, 1);
    if (selectionId === hit.id) selectionId = null;
    render();
  }

  function moveItem(item, dx, dy) {
    if (item.kind === 'stroke') {
      for (var i = 0; i < item.points.length; i += 1) {
        item.points[i].x = clamp(item.points[i].x + dx, 0, 1);
        item.points[i].y = clamp(item.points[i].y + dy, 0, 1);
      }
    } else {
      item.x = clamp(item.x + dx, 0, Math.max(0, 1 - item.w));
      item.y = clamp(item.y + dy, 0, Math.max(0, 1 - item.h));
    }
  }

  function resizeBox(box, handle, dx, dy) {
    var left = box.x;
    var top = box.y;
    var right = box.x + box.w;
    var bottom = box.y + box.h;
    if (handle.indexOf('w') >= 0) left = clamp(box.x + dx, 0, 1);
    if (handle.indexOf('e') >= 0) right = clamp(box.x + box.w + dx, 0, 1);
    if (handle.indexOf('n') >= 0) top = clamp(box.y + dy, 0, 1);
    if (handle.indexOf('s') >= 0) bottom = clamp(box.y + box.h + dy, 0, 1);
    if (right - left < 0.02) {
      if (handle.indexOf('w') >= 0) left = Math.max(0, right - 0.02);
      else right = Math.min(1, left + 0.02);
    }
    if (bottom - top < 0.02) {
      if (handle.indexOf('n') >= 0) top = Math.max(0, bottom - 0.02);
      else bottom = Math.min(1, top + 0.02);
    }
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  function resizeItem(item, orig, handle, dx, dy) {
    if (item.kind === 'shape') {
      var box = resizeBox({ x: orig.x, y: orig.y, w: orig.w, h: orig.h }, handle, dx, dy);
      item.x = box.x;
      item.y = box.y;
      item.w = box.w;
      item.h = box.h;
      return;
    }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < orig.points.length; i += 1) {
      minX = Math.min(minX, orig.points[i].x);
      minY = Math.min(minY, orig.points[i].y);
      maxX = Math.max(maxX, orig.points[i].x);
      maxY = Math.max(maxY, orig.points[i].y);
    }
    var source = { x: minX, y: minY, w: Math.max(maxX - minX, 0.0001), h: Math.max(maxY - minY, 0.0001) };
    var target = resizeBox(source, handle, dx, dy);
    var sx = target.w / source.w;
    var sy = target.h / source.h;
    item.points = [];
    for (var j = 0; j < orig.points.length; j += 1) {
      item.points.push({
        x: clamp(target.x + (orig.points[j].x - source.x) * sx, 0, 1),
        y: clamp(target.y + (orig.points[j].y - source.y) * sy, 0, 1)
      });
    }
  }

  function onDown(event) {
    if (event.cancelable) event.preventDefault();
    // Defensive: if the first animation frame has not sized the canvas yet
    // (or a resize was missed), size it before interpreting the gesture.
    if (!cssW || !cssH) resize();
    try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* not supported */ }
    var p = toPoint(event);
    if (armedShape) { startShape(p); return; }
    if (tool === 'select') { startSelect(p); return; }
    if (tool === 'eraser') { startErase(p); return; }
    startStroke(p);
  }

  function onMove(event) {
    if (!gesture) return;
    if (event.cancelable) event.preventDefault();
    var p = toPoint(event);

    if (gesture.type === 'draw') {
      var target = { x: p.x, y: p.y };
      if (stabilize) {
        gesture.smooth.x += (target.x - gesture.smooth.x) * 0.45;
        gesture.smooth.y += (target.y - gesture.smooth.y) * 0.45;
        target.x = gesture.smooth.x;
        target.y = gesture.smooth.y;
      } else {
        gesture.smooth.x = target.x;
        gesture.smooth.y = target.y;
      }
      var points = gesture.item.points;
      var last = points[points.length - 1];
      var dx = target.x - last.x;
      var dy = target.y - last.y;
      if (dx * dx + dy * dy < 0.000004) return;
      points.push({ x: target.x, y: target.y });
      render();
      return;
    }

    if (gesture.type === 'shape') {
      var dxs = p.x - gesture.start.x;
      var dys = p.y - gesture.start.y;
      var item = gesture.item;
      item.flipX = dxs < 0;
      item.flipY = dys < 0;
      if (needsSquare(item.shape)) {
        var size = Math.max(Math.abs(dxs), Math.abs(dys));
        item.x = gesture.start.x + (dxs < 0 ? -size : 0);
        item.y = gesture.start.y + (dys < 0 ? -size : 0);
        item.w = size;
        item.h = size;
      } else {
        item.x = Math.min(gesture.start.x, p.x);
        item.y = Math.min(gesture.start.y, p.y);
        item.w = Math.abs(dxs);
        item.h = Math.abs(dys);
      }
      render();
      return;
    }

    if (gesture.type === 'move') {
      var item2 = gesture.id ? items.filter(function (it) { return it.id === gesture.id; })[0] : null;
      if (!item2) return;
      beginMutation();
      moveItem(item2, p.x - gesture.start.x, p.y - gesture.start.y);
      gesture.start = { x: p.x, y: p.y };
      render();
      return;
    }

    if (gesture.type === 'resize') {
      var item3 = items.filter(function (it) { return it.id === gesture.orig.id; })[0];
      if (!item3) return;
      beginMutation();
      resizeItem(item3, gesture.orig, gesture.handle, p.x - gesture.start.x, p.y - gesture.start.y);
      render();
      return;
    }

    if (gesture.type === 'erase') eraseAt(p);
  }

  function onUp(event) {
    if (!gesture) return;
    if (event && event.cancelable) event.preventDefault();

    if (gesture.type === 'shape') {
      var item = gesture.item;
      // Thin shapes (horizontal/vertical lines) legitimately have one near-zero
      // dimension, so only discard when the longer dimension is negligible too.
      if (Math.max(item.w, item.h) < 0.02) {
        // A tap, not a drag: drop the accidental speck and its history entry.
        var index = items.indexOf(item);
        if (index >= 0) items.splice(index, 1);
        if (undoStack.length) undoStack.pop();
        selectionId = null;
        pendingHistory = false;
      } else {
        armedShape = null;
        tool = 'select';
      }
    }
    endMutation();
    gesture = null;
    render();
    emitState();
  }

  /* --------------------------------- state ------------------------------- */

  function emitState() {
    var sel = selected();
    var info = null;
    if (sel) {
      info = {
        id: sel.id,
        kind: sel.kind,
        shape: sel.kind === 'shape' ? sel.shape : null,
        fillable: sel.kind === 'shape' && Boolean(spec(sel.shape).fill),
        filled: Boolean(sel.fill)
      };
    }
    post({
      type: 'state',
      tool: tool,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      hasContent: items.length > 0,
      selection: info,
      armedShape: armedShape
    });
  }

  function applyToSelection(partial) {
    var sel = selected();
    if (!sel) return false;
    beginMutation();
    if (partial.color !== undefined) {
      sel.color = partial.color;
      if (sel.fill) sel.fill = partial.color;
    }
    if (partial.width !== undefined) sel.width = partial.width;
    return true;
  }

  /* --------------------------------- export ------------------------------ */

  function exportPng() {
    var empty = items.length === 0;
    var scale = Math.min(2, 1600 / Math.max(cssW, cssH, 1));
    var out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cssW * scale));
    out.height = Math.max(1, Math.round(cssH * scale));
    var outCtx = out.getContext('2d');
    outCtx.fillStyle = '#FFFFFF';
    outCtx.fillRect(0, 0, out.width, out.height);
    outCtx.save();
    outCtx.setTransform(scale, 0, 0, scale, 0, 0);

    var previous = ctx;
    ctx = outCtx;
    for (var i = 0; i < items.length; i += 1) drawItem(items[i]);
    ctx = previous;

    outCtx.restore();
    var dataUri = out.toDataURL('image/png');
    post({
      type: 'exported',
      dataUri: dataUri,
      empty: empty,
      bytes: Math.round(dataUri.length * 0.75)
    });
  }

  /* ------------------------------- messages ------------------------------ */

  function receive(message) {
    if (!message || !message.type) return;
    switch (message.type) {
      case 'set-tool':
        tool = message.tool;
        armedShape = null;
        if (tool !== 'select') selectionId = null;
        render();
        emitState();
        break;
      case 'set-color':
        color = message.color;
        applyToSelection({ color: color });
        endMutation();
        render();
        emitState();
        break;
      case 'set-width':
        strokeWidth = Math.max(0.5, message.width) / unit();
        applyToSelection({ width: strokeWidth });
        endMutation();
        render();
        emitState();
        break;
      case 'set-stabilization':
        stabilize = Boolean(message.enabled);
        break;
      case 'arm-shape':
        armedShape = message.shape;
        tool = 'select';
        selectionId = null;
        render();
        emitState();
        break;
      case 'disarm-shape':
        armedShape = null;
        emitState();
        break;
      case 'set-fill': {
        var sel = selected();
        if (sel && sel.kind === 'shape' && spec(sel.shape).fill) {
          beginMutation();
          sel.fill = message.fill ? sel.color : null;
          endMutation();
          render();
          emitState();
        }
        break;
      }
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'clear':
        if (!items.length) break;
        beginMutation();
        items = [];
        selectionId = null;
        endMutation();
        render();
        emitState();
        break;
      case 'delete-selected': {
        var target = selected();
        if (!target) break;
        beginMutation();
        var at = items.indexOf(target);
        if (at >= 0) items.splice(at, 1);
        selectionId = null;
        endMutation();
        render();
        emitState();
        break;
      }
      case 'export':
        exportPng();
        break;
      default:
        break;
    }
  }

  /* -------------------------------- wiring ------------------------------- */

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) {
    try { new ResizeObserver(function () { resize(); }).observe(canvas); } catch (e) { /* ignore */ }
  }

  window.__notelyDrawingReceive = function (json) {
    try {
      receive(typeof json === 'string' ? JSON.parse(json) : json);
    } catch (error) {
      post({ type: 'error', message: String(error) });
    }
  };

  if (HOST === 'web') {
    window.addEventListener('message', function (event) {
      if (typeof event.data !== 'string') return;
      try {
        var parsed = JSON.parse(event.data);
        if (parsed && parsed.type) receive(parsed);
      } catch (error) { /* ignore malformed */ }
    });
  }

  // The canvas has no size until the host lays it out; wait one frame.
  requestAnimationFrame(function () {
    resize();
    post({ type: 'ready' });
    emitState();
  });
})();
`;
