/**
 * Typography scale for Notely.
 *
 * The reference screens use a rounded geometric sans. Plus Jakarta Sans is
 * bundled with the app (see `src/design/fonts.ts`) and is the closest freely
 * redistributable match for the reference letterforms.
 */
import type { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

type Variant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'subtitle'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'overline'
  | 'button';

export const typeScale: Record<Variant, TextStyle> = {
  display: {
    fontFamily: fontFamily.extrabold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.7,
  },
  title1: {
    fontFamily: fontFamily.extrabold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  title2: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  title3: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  bodyStrong: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  overline: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  button: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
};
