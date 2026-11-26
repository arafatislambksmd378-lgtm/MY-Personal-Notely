/**
 * Notely design tokens.
 *
 * Every value in this file was derived from the supplied UI/UX reference
 * screenshots (Home, Notebooks, Settings, Editor, Insert sheet, Note options).
 * Screens must consume these tokens rather than hard-coded literals so that the
 * visual language stays consistent across the whole application.
 */

export type AccentName =
  | 'purple'
  | 'blue'
  | 'green'
  | 'amber'
  | 'pink'
  | 'teal'
  | 'orange'
  | 'red';

/** Accent palette used by notebook cards, note card colors and icon tiles. */
export const accents: Record<AccentName, string> = {
  purple: '#8950F5',
  blue: '#438CEB',
  green: '#39B980',
  amber: '#F2C94C',
  pink: '#EC4899',
  teal: '#14B8A6',
  orange: '#F97316',
  red: '#EF4444',
};

/** Ordered palette shown in the "Card color" swatch row of the note options sheet. */
export const cardColorOrder: AccentName[] = [
  'purple',
  'blue',
  'green',
  'amber',
  'pink',
  'red',
  'teal',
  'orange',
];

/** Soft tinted backgrounds used behind icons (reference: 8-14% accent alpha). */
export const accentSoft: Record<AccentName, string> = {
  purple: '#F0E9FF',
  blue: '#E4EEFF',
  green: '#E1F8EE',
  amber: '#FEF1D8',
  pink: '#FCE6F1',
  teal: '#DEF7F4',
  orange: '#FFEBDC',
  red: '#FEE7E7',
};

/** Gradient pairs used by the settings hero card and recent-note headers. */
export const accentGradient: Record<AccentName, [string, string]> = {
  purple: ['#8950F5', '#7040E8'],
  blue: ['#60A5FA', '#2563EB'],
  green: ['#34D399', '#059669'],
  amber: ['#FBBF24', '#D97706'],
  pink: ['#F472B6', '#DB2777'],
  teal: ['#2DD4BF', '#0D9488'],
  orange: ['#FB923C', '#EA580C'],
  red: ['#F87171', '#DC2626'],
};

export const lightColors = {
  scheme: 'light' as const,
  canvas: '#FFFFFF',
  canvasElevated: '#F8F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F1EFF8',
  surfaceSunken: '#EDEAF6',
  border: '#ECEAF1',
  borderStrong: '#DFDBEC',
  text: '#24232B',
  textSecondary: '#92909D',
  textMuted: '#9C99AC',
  textInverse: '#FFFFFF',
  primary: '#8950F5',
  primaryPressed: '#7040E8',
  primarySoft: '#F0E9FF',
  onPrimary: '#FFFFFF',
  danger: '#EF4444',
  dangerSoft: '#FEE7E7',
  success: '#39B980',
  warning: '#F2C94C',
  info: '#438CEB',
  overlay: 'rgba(20, 16, 35, 0.45)',
  switchTrack: '#D9D5E8',
  switchTrackOn: '#8950F5',
  switchThumb: '#FFFFFF',
  editorSurface: '#FFFFFF',
  tabBar: '#FFFFFF',
  shadow: '#2A1B4A',
};

export const darkColors: AppColors = {
  scheme: 'dark',
  canvas: '#100D18',
  canvasElevated: '#181424',
  surface: '#181424',
  surfaceMuted: '#211C31',
  surfaceSunken: '#2A2440',
  border: '#2B2540',
  borderStrong: '#3A3352',
  text: '#F6F4FF',
  textSecondary: '#AFABC2',
  textMuted: '#807C93',
  textInverse: '#151223',
  primary: '#A98BFF',
  primaryPressed: '#8B5CF6',
  primarySoft: '#2A2046',
  onPrimary: '#151223',
  danger: '#FF6B6B',
  dangerSoft: '#3A2029',
  success: '#34D399',
  warning: '#FBBF24',
  info: '#60A5FA',
  overlay: 'rgba(0, 0, 0, 0.6)',
  switchTrack: '#3A3352',
  switchTrackOn: '#A98BFF',
  switchThumb: '#FFFFFF',
  editorSurface: '#181424',
  tabBar: '#141020',
  shadow: '#000000',
};

export type AppColors = Omit<typeof lightColors, 'scheme'> & { scheme: 'light' | 'dark' };

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  pill: 999,
} as const;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export const layout = {
  screenPadding: 20,
  cardPadding: 16,
  tabBarHeight: 64,
  notebookCardWidth: 120,
  recentCardWidth: 220,
  maxContentWidth: 720,
} as const;

/** Soft elevation used by the reference cards (very subtle, purple-tinted). */
export const shadows = {
  card: {
    shadowColor: '#2A1B4A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#4C1D95',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sheet: {
    shadowColor: '#1B1230',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
} as const;
