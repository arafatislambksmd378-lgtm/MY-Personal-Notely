/**
 * Grid layout helpers.
 *
 * Both grids in the app (the Insert sheet's three-column tool grid and the Home
 * screen's two-column note grid) need widths that account for the flex `gap`.
 * Percentage widths cannot do that — which is exactly how the Insert sheet ended
 * up wrapping to two columns — so the arithmetic lives here, in one tested place.
 */

/**
 * Width of a single tile so that exactly `columns` tiles (plus the gaps between
 * them) fill `containerWidth`.
 *
 * Returns 0 when the container has not been measured yet.
 */
export function tileWidth(containerWidth: number, columns: number, gap: number): number {
  if (containerWidth <= 0 || columns <= 0) return 0;
  const usable = containerWidth - gap * Math.max(0, columns - 1);
  return Math.max(0, Math.floor(usable / columns));
}

/**
 * Splits items into fixed-size rows. The last row may be shorter, which the
 * callers pad with a spacer so a lone card keeps its column width instead of
 * stretching across the whole row.
 */
export function chunkIntoRows<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}
