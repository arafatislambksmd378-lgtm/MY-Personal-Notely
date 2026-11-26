/**
 * Pure SVG chart generators used by the "Insert → Chart" tool.
 *
 * Charts are inserted as inline SVG, which keeps them crisp in the editor and in
 * PDF/HTML exports without any runtime charting dependency.
 */
export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartInput {
  type: ChartType;
  title: string;
  labels: string[];
  values: number[];
  color?: string;
}

const DEFAULT_COLORS = ['#8950F5', '#438CEB', '#39B980', '#F2C94C', '#EC4899', '#14B8A6', '#F97316'];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function parseChartValues(raw: string): number[] {
  return raw
    .split(/[,;\n]/)
    .map((entry) => Number(entry.trim()))
    .filter((value) => Number.isFinite(value));
}

export function buildChartSvg(input: ChartInput): string {
  const width = 520;
  const height = 300;
  const padding = { top: 44, right: 24, bottom: 44, left: 48 };
  const values = input.values.length ? input.values : [0];
  const labels = input.labels.length ? input.labels : values.map((_, index) => `Item ${index + 1}`);
  const max = Math.max(...values, 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const title = input.title ? `<text x="${padding.left}" y="26" font-family="sans-serif" font-size="16" font-weight="700" fill="#24232B">${escapeXml(input.title)}</text>` : '';

  if (input.type === 'pie') {
    const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
    const radius = Math.min(plotWidth, plotHeight) / 2 - 6;
    const centerX = padding.left + plotWidth / 2;
    const centerY = padding.top + plotHeight / 2;
    let angle = -Math.PI / 2;
    const slices = values
      .map((value, index) => {
        const share = Math.max(0, value) / total;
        const sweep = share * Math.PI * 2;
        const x1 = centerX + radius * Math.cos(angle);
        const y1 = centerY + radius * Math.sin(angle);
        const x2 = centerX + radius * Math.cos(angle + sweep);
        const y2 = centerY + radius * Math.sin(angle + sweep);
        const largeArc = sweep > Math.PI ? 1 : 0;
        const color = DEFAULT_COLORS[index % DEFAULT_COLORS.length];
        const path =
          share >= 0.999
            ? `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${color}" />`
            : `<path d="M ${centerX} ${centerY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}" />`;
        angle += sweep;
        return path;
      })
      .join('');
    const legend = labels
      .map(
        (label, index) =>
          `<rect x="${padding.left + 4}" y="${height - 18 - index * 0}" width="0" height="0" />` +
          `<text x="${padding.left + 6 + index * 78}" y="${height - 10}" font-family="sans-serif" font-size="10" fill="#92909D">${escapeXml(String(label).slice(0, 10))}</text>`,
      )
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(input.title || 'Pie chart')}"><rect width="${width}" height="${height}" fill="#FFFFFF" rx="12" />${title}${slices}${legend}</svg>`;
  }

  const stepX = plotWidth / Math.max(1, values.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = padding.top + plotHeight - plotHeight * ratio;
      return `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width - padding.right}" y2="${y.toFixed(1)}" stroke="#ECEAF1" stroke-width="1" />` +
        `<text x="${padding.left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="sans-serif" font-size="9" fill="#9C99AC">${Math.round(max * ratio)}</text>`;
    })
    .join('');

  const xLabels = labels
    .map((label, index) => {
      const x = padding.left + stepX * index + stepX / 2;
      return `<text x="${x.toFixed(1)}" y="${height - 14}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#92909D">${escapeXml(String(label).slice(0, 10))}</text>`;
    })
    .join('');

  const accent = input.color ?? DEFAULT_COLORS[0];
  let marks: string;
  if (input.type === 'line') {
    const points = values.map((value, index) => {
      const x = padding.left + stepX * index + stepX / 2;
      const y = padding.top + plotHeight - (value / max) * plotHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    marks =
      `<polyline points="${points.join(' ')}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />` +
      points
        .map((point) => {
          const [x, y] = point.split(',');
          return `<circle cx="${x}" cy="${y}" r="3.5" fill="${accent}" />`;
        })
        .join('');
  } else {
    marks = values
      .map((value, index) => {
        const barWidth = Math.max(6, stepX * 0.55);
        const x = padding.left + stepX * index + (stepX - barWidth) / 2;
        const barHeight = Math.max(1, (value / max) * plotHeight);
        const y = padding.top + plotHeight - barHeight;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="5" fill="${DEFAULT_COLORS[index % DEFAULT_COLORS.length]}" />`;
      })
      .join('');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(input.title || 'Chart')}"><rect width="${width}" height="${height}" fill="#FFFFFF" rx="12" />${title}${ticks}${marks}${xLabels}</svg>`;
}
