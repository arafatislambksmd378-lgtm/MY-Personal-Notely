/**
 * Element matching for `uiautomator dump` XML.
 *
 * The first version returned the first node whose text or content-desc
 * contained the needle in document order. On the Home screen "Notebooks" is
 * both a section header and a tab, so the tour tapped the header, never
 * navigated, and captured the same screen twice. Matching now prefers a node
 * that can actually be tapped (`clickable="true"`), then an exact
 * accessibility description, then an exact label, and only then a substring.
 */

/**
 * @typedef {object} UiNode
 * @property {string} text
 * @property {string} desc
 * @property {boolean} clickable
 * @property {number} x
 * @property {number} y
 *
 * @typedef {object} UiPoint
 * @property {number} x
 * @property {number} y
 */

const NODE_RE = /<node\b[^>]*>/g;
const ATTR = (name) => new RegExp(`\\s${name}="([^"]*)"`);
const BOUNDS_RE = /\sbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/;

/**
 * @param {string} xml
 * @returns {UiNode[]}
 */
export function parseNodes(xml) {
  /** @type {UiNode[]} */
  const nodes = [];
  for (const raw of xml.match(NODE_RE) ?? []) {
    const bounds = BOUNDS_RE.exec(raw);
    if (!bounds) continue;
    const [, x1, y1, x2, y2] = bounds.map(Number);
    nodes.push({
      text: ATTR('text').exec(raw)?.[1] ?? '',
      desc: ATTR('content-desc').exec(raw)?.[1] ?? '',
      clickable: (ATTR('clickable').exec(raw)?.[1] ?? 'false') === 'true',
      x: Math.round((x1 + x2) / 2),
      y: Math.round((y1 + y2) / 2),
    });
  }
  return nodes;
}

/**
 * Higher scores win. 0 means "no match".
 * 8 exact content-desc + clickable, 7 exact text + clickable,
 * 6 exact content-desc,        5 exact text,
 * 4 desc contains + clickable, 3 text contains + clickable,
 * 2 desc contains,             1 text contains.
 */
/**
 * @param {UiNode} node
 * @param {string} needle
 * @returns {number}
 */
function score(node, needle) {
  const wanted = needle.trim().toLowerCase();
  const desc = node.desc.toLowerCase();
  const text = node.text.toLowerCase();
  if (desc === wanted) return node.clickable ? 8 : 6;
  if (text === wanted) return node.clickable ? 7 : 5;
  if (desc.includes(wanted)) return node.clickable ? 4 : 2;
  if (text.includes(wanted)) return node.clickable ? 3 : 1;
  return 0;
}

/**
 * @param {string} xml
 * @param {string} needle
 * @returns {UiPoint | null}
 */
export function findElement(xml, needle) {
  /** @type {{ node: UiNode, score: number } | null} */
  let best = null;
  for (const node of parseNodes(xml)) {
    const value = score(node, needle);
    if (value === 0) continue;
    // Ties keep the first match so layout order still decides between equals.
    if (!best || value > best.score) best = { node, score: value };
  }
  return best ? { x: best.node.x, y: best.node.y } : null;
}
