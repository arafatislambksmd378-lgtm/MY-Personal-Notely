import { describe, expect, it } from 'vitest';
import { chunkIntoRows, tileWidth } from '@/utils/grid';

/**
 * Regression tests for the two layout defects reported against the Home and
 * Insert screens:
 *  1. the Insert grid wrapped to two columns because 3 × 31.2% + 2 × 12pt
 *     overflowed the sheet content box;
 *  2. Recent Notes were a clipped horizontal carousel.
 */
describe('tileWidth', () => {
  it('fits exactly three tiles plus two gaps in a phone-width container', () => {
    for (const containerWidth of [280, 300, 320, 360, 393, 411, 480]) {
      const width = tileWidth(containerWidth, 3, 12);
      expect(width).toBeGreaterThan(0);
      // Three tiles and the two gaps between them must never exceed the row.
      expect(width * 3 + 12 * 2).toBeLessThanOrEqual(containerWidth);
      // The leftover must be smaller than one tile, so a fourth cannot fit.
      expect(containerWidth - (width * 3 + 24)).toBeLessThan(width);
    }
  });

  it('is the reason a 31.2% tile could never fit three across', () => {
    const containerWidth = 320;
    const percentageTile = Math.floor(containerWidth * 0.312);
    expect(percentageTile * 3 + 24).toBeGreaterThan(containerWidth);
    expect(tileWidth(containerWidth, 3, 12) * 3 + 24).toBeLessThanOrEqual(containerWidth);
  });

  it('returns zero before the container is measured', () => {
    expect(tileWidth(0, 3, 12)).toBe(0);
  });

  it('scales for two columns', () => {
    const width = tileWidth(320, 2, 12);
    expect(width * 2 + 12).toBeLessThanOrEqual(320);
    expect(width).toBe(154);
  });
});

describe('chunkIntoRows', () => {
  it('produces pairs for the two-column note grid', () => {
    expect(chunkIntoRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('keeps every item exactly once', () => {
    const items = Array.from({ length: 13 }, (_, index) => index);
    const rows = chunkIntoRows(items, 4);
    expect(rows.flat()).toEqual(items);
    expect(rows.every((row) => row.length <= 4)).toBe(true);
  });

  it('handles empty input and single items', () => {
    expect(chunkIntoRows([], 2)).toEqual([]);
    expect(chunkIntoRows(['a'], 2)).toEqual([['a']]);
  });
});
