/**
 * Stroke-width slider.
 *
 * Built on plain touch events rather than a dependency: the track reports
 * `locationX` relative to itself, so no measuring or `measureInWindow` is
 * needed and the control works on Android and web alike.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { radii, spacing } from '@/design/tokens';
import { MAX_STROKE, MIN_STROKE } from './types';

interface StrokeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function StrokeSlider({ value, onChange }: StrokeSliderProps) {
  const colors = useColors();
  const [trackWidth, setTrackWidth] = useState(0);

  const ratio = Math.min(1, Math.max(0, (value - MIN_STROKE) / (MAX_STROKE - MIN_STROKE)));

  const update = useCallback(
    (locationX: number) => {
      if (trackWidth <= 0) return;
      const next = Math.min(1, Math.max(0, locationX / trackWidth));
      onChange(Math.round(MIN_STROKE + next * (MAX_STROKE - MIN_STROKE)));
    },
    [onChange, trackWidth],
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <AppText variant="label" tone="muted">
          Stroke size
        </AppText>
        <View style={styles.previewRow}>
          <View
            style={[
              styles.previewDot,
              {
                width: 6 + ratio * 14,
                height: 6 + ratio * 14,
                borderRadius: (6 + ratio * 14) / 2,
                backgroundColor: colors.primary,
              },
            ]}
          />
          <AppText variant="label" style={{ color: colors.textSecondary, minWidth: 20, textAlign: 'right' }}>
            {value}
          </AppText>
        </View>
      </View>

      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Stroke size"
        accessibilityValue={{ min: MIN_STROKE, max: MAX_STROKE, now: value }}
        style={styles.trackHit}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        // The responder system handles touch *and* mouse, so the slider also
        // works with a pointer on the web build.
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) => update(event.nativeEvent.locationX)}
        onResponderMove={(event) => update(event.nativeEvent.locationX)}
      >
        <View style={[styles.track, { backgroundColor: colors.borderStrong }]}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: colors.primary }]} />
        </View>
        <View
          style={[
            styles.thumb,
            {
              left: `${ratio * 100}%`,
              width: 18 + ratio * 8,
              height: 18 + ratio * 8,
              borderRadius: (18 + ratio * 8) / 2,
              backgroundColor: colors.surface,
              borderColor: colors.primary,
            },
          ]}
        />
      </View>

      <View style={styles.scaleRow}>
        <AppText variant="label" tone="muted">
          {MIN_STROKE}
        </AppText>
        <AppText variant="label" tone="muted">
          {MAX_STROKE}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewDot: { backgroundColor: '#7C3AED' },
  // 32pt tall hit target around a 4pt visual track.
  trackHit: { height: 32, justifyContent: 'center' },
  track: { height: 4, borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill },
  thumb: {
    position: 'absolute',
    borderWidth: 2,
    marginLeft: -9,
    shadowColor: '#2A1B4A',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
