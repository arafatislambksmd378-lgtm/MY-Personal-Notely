/**
 * Line-level diff used by "Version history → compare" and document comparison.
 * Classic LCS on lines; output is a flat list of segments so the UI can render
 * additions and removals without extra bookkeeping.
 */
export type DiffKind = 'equal' | 'added' | 'removed';

export interface DiffSegment {
  kind: DiffKind;
  lines: string[];
}

export interface DiffSummary {
  added: number;
  removed: number;
  segments: DiffSegment[];
}

function toLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

export function diffLines(before: string, after: string): DiffSummary {
  const a = toLines(before);
  const b = toLines(after);
  const rows = a.length;
  const cols = b.length;

  // Guard against pathological documents: fall back to a coarse replacement.
  if (rows * cols > 4_000_000) {
    return {
      added: b.length,
      removed: a.length,
      segments: [
        { kind: 'removed', lines: a },
        { kind: 'added', lines: b },
      ],
    };
  }

  const matrix: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      matrix[i][j] =
        a[i] === b[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;

  const push = (kind: DiffKind, line: string) => {
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.lines.push(line);
    else segments.push({ kind, lines: [line] });
    if (kind === 'added') added += 1;
    if (kind === 'removed') removed += 1;
  };

  while (i < rows && j < cols) {
    if (a[i] === b[j]) {
      push('equal', a[i]);
      i += 1;
      j += 1;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      push('removed', a[i]);
      i += 1;
    } else {
      push('added', b[j]);
      j += 1;
    }
  }
  while (i < rows) {
    push('removed', a[i]);
    i += 1;
  }
  while (j < cols) {
    push('added', b[j]);
    j += 1;
  }

  return { added, removed, segments };
}
