/**
 * Lightweight, dependency-free syntax tokenizer for HTML, CSS and JavaScript.
 *
 * Splits a single line of source into annotated tokens so the code editor can
 * colour them with plain AppText views (no heavy parser, no extra native dep).
 * Each token: { type, value } where type is one of the TokenKind values below.
 *
 * Designed for speed and low memory (3 GB RAM devices): single pass per line,
 * small allocations, no recursion, no regex backtracking loops.
 */
export type TokenKind =
  | 'keyword'
  | 'tag'
  | 'attribute'
  | 'string'
  | 'comment'
  | 'number'
  | 'operator'
  | 'selector'
  | 'property'
  | 'value'
  | 'builtin'
  | 'plain';

export interface Token {
  kind: TokenKind;
  value: string;
}

/* Reserved words coloured specially in JavaScript. */
const JS_KEYWORDS = new Set([
  'let',
  'const',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'try',
  'catch',
  'finally',
  'throw',
  'class',
  'extends',
  'import',
  'export',
  'default',
  'new',
  'this',
  'super',
  'typeof',
  'instanceof',
  'in',
  'of',
  'void',
  'delete',
  'async',
  'await',
  'yield',
  'static',
  'get',
  'set',
  'true',
  'false',
  'null',
  'undefined',
]);

/* Common browser globals / built-ins. */
const JS_BUILTINS = new Set([
  'document',
  'window',
  'console',
  'location',
  'navigator',
  'localStorage',
  'fetch',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'JSON',
  'Math',
  'Array',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Date',
  'RegExp',
  'Map',
  'Set',
  'Promise',
  'Error',
  'parseInt',
  'parseFloat',
  'isNaN',
  'encodeURIComponent',
  'decodeURIComponent',
  'HTMLElement',
  'Event',
  'addEventListener',
  'querySelector',
  'querySelectorAll',
  'getElementById',
  'createElement',
  'appendChild',
  'innerHTML',
  'textContent',
  'style',
  'classList',
]);

const CSS_PROPERTIES = new Set([
  'color',
  'background',
  'background-color',
  'font-size',
  'font-family',
  'font-weight',
  'margin',
  'padding',
  'border',
  'border-radius',
  'width',
  'height',
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'float',
  'align-items',
  'justify-content',
  'flex',
  'flex-direction',
  'text-align',
  'text-decoration',
  'opacity',
  'z-index',
  'overflow',
]);

function isWordChar(ch: string): boolean {
  return /[a-zA-Z0-9_$]/.test(ch);
}

/**
 * Tokenize one line of JavaScript source.
 */
function tokenizeJS(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = line.length;

  while (i < n) {
    const ch = line[i];

    /* Whitespace. */
    if (ch === ' ' || ch === '\t') {
      tokens.push({ kind: 'plain', value: ch });
      i++;
      continue;
    }

    /* Line comment. */
    if (ch === '/' && line[i + 1] === '/') {
      tokens.push({ kind: 'comment', value: line.slice(i) });
      break;
    }

    /* Block comment (start). */
    if (ch === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      tokens.push({
        kind: 'comment',
        value: end === -1 ? line.slice(i) : line.slice(i, end + 2),
      });
      i = end === -1 ? n : end + 2;
      continue;
    }

    /* String (single or double quoted). */
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let value = quote;
      while (j < n) {
        const c = line[j];
        value += c;
        j++;
        if (c === '\\') {
          if (j < n) { value += line[j]; j++; }
          continue;
        }
        if (c === quote) break;
      }
      tokens.push({ kind: 'string', value });
      i = j;
      continue;
    }

    /* Number. */
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(line[i + 1] ?? ''))) {
      let j = i;
      while (j < n && (/[0-9.eE+-]/.test(line[j]) || line[j] === '.')) j++;
      tokens.push({ kind: 'number', value: line.slice(i, j) });
      i = j;
      continue;
    }

    /* Word (keyword / builtin / identifier). */
    if (isWordChar(ch)) {
      let j = i;
      while (j < n && isWordChar(line[j])) j++;
      const word = line.slice(i, j);
      if (JS_KEYWORDS.has(word)) tokens.push({ kind: 'keyword', value: word });
      else if (JS_BUILTINS.has(word)) tokens.push({ kind: 'builtin', value: word });
      else tokens.push({ kind: 'plain', value: word });
      i = j;
      continue;
    }

    /* Punctuation / operator. */
    tokens.push({ kind: 'operator', value: ch });
    i++;
  }

  return tokens;
}

/* Simple CSS tokeniser for a rule line. */
function tokenizeCSS(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = line.length;

  while (i < n) {
    const ch = line[i];

    if (ch === ' ' || ch === '\t') {
      tokens.push({ kind: 'plain', value: ch });
      i++;
      continue;
    }

    if (ch === '/' && line[i + 1] === '/') {
      tokens.push({ kind: 'comment', value: line.slice(i) });
      break;
    }
    if (ch === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      tokens.push({
        kind: 'comment',
        value: end === -1 ? line.slice(i) : line.slice(i, end + 2),
      });
      i = end === -1 ? n : end + 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let value = quote;
      while (j < n) {
        const c = line[j];
        value += c;
        j++;
        if (c === '\\') { if (j < n) { value += line[j]; j++; } continue; }
        if (c === quote) break;
      }
      tokens.push({ kind: 'string', value });
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch) || ch === '.') {
      let j = i;
      while (j < n && /[0-9.eE]/.test(line[j])) j++;
      const raw = line.slice(i, j);
      const unitMatch = line.slice(j).match(/^[a-z%]+/);
      const unit = unitMatch ? unitMatch[0] : '';
      tokens.push({ kind: 'value', value: raw + unit });
      i = j + unit.length;
      continue;
    }

    if (isWordChar(ch) || ch === '-' || ch === '#' || ch === '.' || ch === '*') {
      let j = i;
      while (j < n && (isWordChar(line[j]) || line[j] === '-' || line[j] === '_')) j++;
      const word = line.slice(i, j);
      const nextWs = line.slice(j).match(/^\s*[:{]/);
      if (word.startsWith('#')) tokens.push({ kind: 'selector', value: word });
      else if (word.startsWith('.')) tokens.push({ kind: 'selector', value: word });
      else if (CSS_PROPERTIES.has(word) && nextWs && nextWs[0].includes(':')) tokens.push({ kind: 'property', value: word });
      else tokens.push({ kind: 'plain', value: word });
      i = j;
      continue;
    }

    tokens.push({ kind: 'operator', value: ch });
    i++;
  }

  return tokens;
}

/* Very small HTML tag tokeniser (best effort, single line). */
function tokenizeHTML(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = line.length;

  while (i < n) {
    const ch = line[i];

    if (ch === '<') {
      const close = line.indexOf('>', i + 1);
      if (close === -1) {
        tokens.push({ kind: 'plain', value: line.slice(i) });
        break;
      }
      const tag = line.slice(i, close + 1);
      const inner = tag.slice(1, -1).trim();
      const isClosing = inner.startsWith('/');
      const nameMatch = inner.match(/^\/?\s*([a-zA-Z][a-zA-Z0-9]*)/);
      const tagName = nameMatch ? nameMatch[1] : '';
      tokens.push({
        kind: isClosing ? 'tag' : 'tag',
        value: tag,
      });
      /* Crude attribute colouring inside the tag. */
      const rest = inner.slice(tagName.length).trim();
      if (rest) {
        tokens.pop(); /* replace whole tag token with pieces below */
        tokens.push({ kind: 'tag', value: `<${isClosing ? '/' : ''}${tagName}` });
        let k = 0;
        while (k < rest.length) {
          if (rest[k] === ' ' || rest[k] === '\t') { tokens.push({ kind: 'plain', value: rest[k] }); k++; continue; }
          const eq = rest.indexOf('=', k);
          const spMatch = rest.slice(k).match(/\s/);
          const sp = spMatch === null ? -1 : k + (spMatch.index ?? 0);
          const end = eq === -1 ? (sp === -1 ? rest.length : sp) : Math.min(eq, sp === -1 ? Infinity : sp);
          const attr = rest.slice(k, end).trim();
          if (attr) tokens.push({ kind: 'attribute', value: attr });
          k = end;
          if (k < rest.length && rest[k] === '=') {
            tokens.push({ kind: 'operator', value: '=' });
            k++;
            if (k < rest.length && (rest[k] === '"' || rest[k] === "'")) {
              const quote = rest[k];
              let j = k + 1;
              let val = quote;
              while (j < rest.length) { val += rest[j]; j++; if (rest[j] === quote) { j++; break; } if (rest[j] === '\\') { if (j + 1 < rest.length) { val += rest[j + 1]; j += 2; continue; } } }
              tokens.push({ kind: 'string', value: val });
              k = j;
            } else {
              let j = k;
              while (j < rest.length && !/\s/.test(rest[j])) j++;
              tokens.push({ kind: 'string', value: rest.slice(k, j) });
              k = j;
            }
          }
        }
        tokens.push({ kind: 'tag', value: '>' });
      }
      i = close + 1;
      continue;
    }

    if (ch === '&') {
      const semi = line.indexOf(';', i + 1);
      if (semi !== -1) {
        tokens.push({ kind: 'plain', value: line.slice(i, semi + 1) });
        i = semi + 1;
        continue;
      }
    }

    tokens.push({ kind: 'plain', value: ch });
    i++;
  }

  return tokens;
}

/**
 * Tokenize a single line of source for the given language.
 */
export function tokenizeLine(language: string, line: string): Token[] {
  const lang = (language ?? '').toLowerCase();
  if (lang === 'js' || lang === 'javascript' || lang === 'jsx' || lang === 'ts' || lang === 'tsx') {
    return tokenizeJS(line);
  }
  if (lang === 'css') return tokenizeCSS(line);
  if (lang === 'html' || lang === 'htm') return tokenizeHTML(line);
  return [{ kind: 'plain', value: line }];
}

/**
 * Detect the language from a file extension.
 */
export function languageForFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.js': return 'js';
    case '.jsx': return 'jsx';
    case '.ts': return 'ts';
    case '.tsx': return 'tsx';
    case '.css': return 'css';
    case '.html':
    case '.htm': return 'html';
    default: return 'plain';
  }
}

/**
 * Languages the Code Workspace can execute / preview natively (client-side,
 * sandboxed in an iframe). Anything else is edit-only.
 */
export const EXECUTABLE_LANGUAGES = new Set(['html', 'htm', 'js', 'javascript', 'css']);

export function isExecutable(language: string): boolean {
  return EXECUTABLE_LANGUAGES.has(language.toLowerCase());
}
