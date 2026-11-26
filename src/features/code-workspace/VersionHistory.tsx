/**
 * Version history for a code file.
 *
 * Lists previously saved versions (newest first) and lets the user restore one.
 * Empty when the file has never changed.
 */
import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { spacing } from '@/design/tokens';
import { useCodeWorkspaceStore } from './useCodeWorkspaceStore';

interface VersionHistoryProps {
  visible: boolean;
  onClose: () => void;
  fileId: string | null;
}

export function VersionHistory({ visible, onClose, fileId }: VersionHistoryProps) {
  const colors = useColors();
  const store = useCodeWorkspaceStore((state) => state);
  const versions = fileId ? (store.versions[fileId] ?? []) : [];

  if (!visible) return null;

  const restore = (index: number) => {
    void store.restoreVersion(fileId!, index);
    onClose();
  };

  return (
    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <AppText variant="caption" style={{ color: colors.textSecondary, fontWeight: '700' }}>
          Version history
        </AppText>
      </View>
      {versions.length === 0 ? (
        <AppText variant="caption" tone="muted" style={styles.empty}>
          No saved versions yet.
        </AppText>
      ) : (
        <FlatList
          data={versions.slice().reverse()}
          renderItem={({ item, index }) => {
            const realIndex = versions.length - 1 - index;
            return (
              <View style={styles.row} key={String(realIndex)}>
                <AppText variant="caption" style={{ color: colors.text }}>
                  {new Date(item.at).toLocaleString()}
                </AppText>
                <View style={styles.spacer} />
                <Pressable onPress={() => restore(realIndex)}>
                  <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                    Restore
                  </AppText>
                </Pressable>
              </View>
            );
          }}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: '#00000000',
    padding: spacing.md,
    maxHeight: 300,
    width: '100%',
  },
  header: { paddingBottom: spacing.sm },
  list: { paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000000',
  },
  spacer: { flex: 1 },
  empty: { textAlign: 'center', paddingVertical: spacing.md },
});
