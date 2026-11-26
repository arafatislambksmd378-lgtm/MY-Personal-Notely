/**
 * Code Workspace screen — the "Code Workspace" bottom tab.
 *
 * Independent dashboard for project/file management, a syntax-highlighting code
 * editor, a sandboxed HTML/CSS/JS preview, an output console and version
 * history. Offline-first: projects and files live in the app document directory
 * via `expo-file-system` (zustand store `useCodeWorkspaceStore`).
 *
 * Lazy-loaded: this module is only evaluated when the user opens the Code
 * Workspace tab, so it adds nothing to the Home/Notebooks/Settings startup.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PromptDialog } from '@/components/PromptDialog';
import { useColors } from '@/store/useSettingsStore';
import { useCodeWorkspaceStore, type CodeFile, type CodeProject } from '@/features/code-workspace/useCodeWorkspaceStore';
import { CodeEditor } from '@/features/code-workspace/CodeEditor';
import { PreviewPane } from '@/features/code-workspace/PreviewPane';
import { OutputConsole } from '@/features/code-workspace/OutputConsole';
import { VersionHistory } from '@/features/code-workspace/VersionHistory';
import { languageForFilename, isExecutable } from '@/features/code-workspace/codeTokenizer';
import { spacing } from '@/design/tokens';
import { toast } from '@/store/useToastStore';

type ViewMode = 'files' | 'editor' | 'preview';

export default function CodeWorkspaceScreen() {
  const router = useRouter();
  const colors = useColors();
  const store = useCodeWorkspaceStore((state) => state);
  const { projects, files, activeProjectId, activeFileId, contents, versions, status, error } = store;

  const [viewMode, setViewMode] = useState<ViewMode>('files');
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [versionVisible, setVersionVisible] = useState(false);
  const [switchProjectOpen, setSwitchProjectOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState<string[]>([]);

  const activeProject = useMemo(() => projects.find((p) => p.id === activeProjectId), [projects, activeProjectId]);
  const activeFile = useMemo(() => files.find((f) => f.id === activeFileId), [files, activeFileId]);
  const activeContent = contents[activeFileId ?? ''] ?? '';
  const executable = activeFile ? isExecutable(activeFile.language) : false;

  useFocusEffect(
    useCallback(() => {
      void store.load();
    }, [store.load]),
  );

  const reload = useCallback(async () => {
    setRefreshing(true);
    await store.load();
    setRefreshing(false);
  }, [store.load]);

  const handleNewProject = useCallback(() => {
    setNewProjectName('');
    setNewProjectOpen(true);
  }, []);

  const handleNewFile = useCallback(() => {
    if (!activeProjectId) return;
    setNewFileName('');
    setNewFileOpen(true);
  }, [activeProjectId]);

  const handleCreateProject = useCallback(async (name: string) => {
    const project = await store.createProject(name);
    await store.openProject(project.id);
    setViewMode('files');
    toast.success(`Project “${name}” created`);
  }, [store]);

  const handleCreateFile = useCallback(async (name: string) => {
    if (!activeProjectId) return;
    await store.createFile(activeProjectId, name);
    setViewMode('editor');
    toast.success(`File “${name}” created`);
  }, [activeProjectId, store]);

  const handleSave = useCallback(async () => {
    if (!activeFileId) return;
    await store.saveFile(activeFileId);
    await store.load();
    toast.success('Saved');
  }, [activeFileId, store]);

  const handleSwitchProject = useCallback((id: string) => {
    void store.openProject(id);
    setViewMode('files');
  }, [store]);

  const handleDeleteFile = useCallback((fileId: string) => {
    void store.deleteFile(fileId);
    if (activeFileId === fileId) setViewMode('files');
    toast.success('File deleted');
  }, [activeFileId, store]);

  const selectFile = useCallback((fileId: string) => {
    store.setActiveFile(fileId);
    setViewMode('editor');
  }, [store]);

  const fileLanguageName = activeFile ? activeFile.language.toUpperCase() : '—';

  return (
    <Screen scroll={false}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Project: ${activeProject?.name ?? 'None'}`}
            onPress={() => setSwitchProjectOpen(true)}
            hitSlop={10}
          >
            <Ionicons name="folder-open-outline" size={18} color={colors.textSecondary} />
            <AppText variant="bodyStrong" style={{ marginLeft: 6 }}>
              {activeProject?.name ?? 'No project'}
            </AppText>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
          {activeProject ? (
            <AppText variant="caption" tone="muted">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </AppText>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <Pressable accessibilityRole="button" accessibilityLabel="New project" onPress={handleNewProject} hitSlop={10}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="New file" onPress={handleNewFile} hitSlop={10} disabled={!activeProjectId}>
            <Ionicons name="document-outline" size={20} color={activeProjectId ? colors.primary : colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.bar, { borderBottomColor: colors.border }]}>
        {(['files', 'editor', 'preview'] as ViewMode[]).map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={mode}
            accessibilityState={{ selected: viewMode === mode }}
            onPress={() => setViewMode(mode)}
            style={[
              styles.tab,
              { borderColor: colors.border },
              viewMode === mode && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
            ]}
          >
            <AppText
              variant="caption"
              tone={viewMode === mode ? 'primary' : 'muted'}
              style={{ fontWeight: '700', textAlign: 'center', flex: 1 }}
            >
              {mode === 'files' ? 'Files' : mode === 'editor' ? 'Editor' : 'Preview'}
            </AppText>
          </Pressable>
        ))}
      </View>

      {viewMode === 'files' ? (
        <FileList
          files={files.filter((f) => f.projectId === activeProjectId)}
          activeFileId={activeFileId}
          onSelect={selectFile}
          onDelete={handleDeleteFile}
        />
      ) : viewMode === 'editor' ? (
        <EditorView
          activeFile={activeFile ?? null}
          activeContent={activeContent}
          language={activeFile?.language ?? 'plain'}
          onChange={store.setFileContent}
          executable={executable}
          onSave={handleSave}
          onRun={() => setViewMode('preview')}
        />
      ) : (
        <PreviewView
          html={activeFile?.language === 'html' ? activeContent : ''}
          css={activeFile?.language === 'css' ? activeContent : ''}
          js={activeFile?.language === 'js' ? activeContent : ''}
          enabled={executable && activeFile ? (activeFile.language === 'html' || activeFile.language === 'js') : false}
        />
      )}

      <OutputConsole
        visible={consoleVisible}
        onClose={() => setConsoleVisible(false)}
        messages={consoleMessages}
        onMessage={(message) => setConsoleMessages((prev) => [...prev, message])}
        onClear={() => setConsoleMessages([])}
      />
      <VersionHistory visible={versionVisible} onClose={() => setVersionVisible(false)} fileId={activeFileId ?? null} />

      <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.canvas }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Save" onPress={handleSave} hitSlop={10} disabled={!activeFileId}>
          <Ionicons name="save" size={20} color={activeFileId ? colors.primary : colors.textMuted} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Console" onPress={() => setConsoleVisible(true)} hitSlop={10}>
          <Ionicons name="terminal-outline" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Versions" onPress={() => setVersionVisible(true)} hitSlop={10} disabled={!activeFileId}>
          <Ionicons name="time-outline" size={20} color={activeFileId ? colors.textSecondary : colors.textMuted} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Preview" onPress={() => setViewMode('preview')} hitSlop={10} disabled={!executable}>
          <Ionicons name="eye-outline" size={20} color={executable ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>

      {switchProjectOpen && (
        <View style={styles.switcherOverlay}>
        <View style={[styles.switcherSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="caption" style={{ color: colors.textSecondary, fontWeight: '700' }}>
            Switch project
          </AppText>
            <FlatList
              data={projects}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  onPress={() => {
                    void store.openProject(item.id);
                    setSwitchProjectOpen(false);
                    setViewMode('files');
                  }}
                  style={({ pressed }) => [
                    styles.switcherRow,
                    {
                      borderColor: activeProjectId === item.id ? colors.primary : colors.border,
                      backgroundColor: activeProjectId === item.id ? colors.primarySoft : pressed ? colors.surfaceMuted : colors.surface,
                    },
                  ]}
                >
                  <AppText variant="bodyStrong">{item.name}</AppText>
                  <View style={styles.spacer} />
                  <AppText variant="caption" tone="muted">
                    {activeProjectId === item.id ? 'Active' : 'Open'}
                  </AppText>
                </Pressable>
              )}
              contentContainerStyle={styles.switcherList}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="New project" onPress={handleNewProject} hitSlop={10} style={styles.switcherNew}>
              <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                + New project
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setSwitchProjectOpen(false)} hitSlop={10} style={styles.switcherClose}>
              <AppText variant="caption" tone="muted">Close</AppText>
            </Pressable>
          </View>
        </View>
      )}

      <PromptDialog
        visible={newProjectOpen}
        title="New project"
        placeholder="e.g. My website"
        submitLabel="Create"
        onSubmit={handleCreateProject}
        onClose={() => setNewProjectOpen(false)}
      />
      <PromptDialog
        visible={newFileOpen}
        title="New file"
        placeholder="e.g. index.html"
        submitLabel="Create"
        onSubmit={handleCreateFile}
        onClose={() => setNewFileOpen(false)}
      />
    </Screen>
  );
}

/**
 * File list within the active project.
 */
function FileList({
  files,
  activeFileId,
  onSelect,
  onDelete,
}: {
  files: CodeFile[];
  activeFileId: string | null;
  onSelect: (fileId: string) => void;
  onDelete: (fileId: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.listContainer}>
      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => {}} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              styles.row,
              {
                borderColor: activeFileId === item.id ? colors.primary : colors.border,
                backgroundColor: activeFileId === item.id ? colors.primarySoft : pressed ? colors.surfaceMuted : colors.surface,
              },
            ]}
          >
            <Ionicons name="document-outline" size={18} color={colors.textSecondary} />
            <View style={styles.rowTexts}>
              <AppText variant="bodyStrong" numberOfLines={1}>{item.name}</AppText>
              <AppText variant="caption" tone="muted">{item.language}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
        )}
      />
      {files.length === 0 && activeFileId === null ? (
        <View style={styles.empty}>
          <AppText variant="caption" tone="muted">No project open. Create or open a project to add files.</AppText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Editor view for the active file.
 */
function EditorView({
  activeFile,
  activeContent,
  language,
  onChange,
  executable,
  onSave,
  onRun,
}: {
  activeFile: CodeFile | null;
  activeContent: string;
  language: string;
  onChange: (fileId: string, content: string) => void;
  executable: boolean;
  onSave: () => void;
  onRun: () => void;
}) {
  const colors = useColors();
  const store = useCodeWorkspaceStore((state) => state);
  return (
    <View style={styles.editorContainer}>
      <View style={[styles.editorHeader, { borderBottomColor: colors.border }]}>
        <AppText variant="caption" tone="muted">
          {activeFile?.name ?? 'Untitled'}
        </AppText>
        <View style={styles.spacer} />
        <AppText variant="caption" tone="muted">{language}</AppText>
      </View>
      <CodeEditor
        value={activeContent}
        language={language}
        onChange={(content) => onChange(activeFile?.id ?? '', content)}
        minHeight={300}
      />
      <View style={styles.editorFooter}>
        <Pressable accessibilityRole="button" accessibilityLabel="Save" onPress={onSave} hitSlop={10}>
          <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
            Save
          </AppText>
        </Pressable>
        <View style={styles.spacer} />
        {executable ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Run / Preview" onPress={onRun} hitSlop={10}>
            <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
              Preview
            </AppText>
          </Pressable>
        ) : (
          <AppText variant="caption" tone="muted">Edit-only ({language})</AppText>
        )}
      </View>
    </View>
  );
}

/**
 * Preview view: sandboxed HTML/CSS/JS rendered in a WebView.
 */
function PreviewView({ html, css, js, enabled }: { html: string; css: string; js: string; enabled: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.editorContainer}>
      <View style={[styles.editorHeader, { borderBottomColor: colors.border }]}>
        <AppText variant="caption" tone="muted">Live preview</AppText>
        <View style={styles.spacer} />
        <AppText variant="caption" tone="muted">Sandboxed WebView</AppText>
      </View>
      <PreviewPane html={html} css={css} js={js} enabled={enabled} />
      {!enabled && (
        <View style={styles.emptyState}>
          <AppText variant="caption" tone="muted">Preview is available for HTML and JavaScript files.</AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: { flexDirection: 'row', gap: 10 },
  bar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowTexts: { flex: 1, marginHorizontal: spacing.md },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  editorContainer: { flex: 1, padding: spacing.md },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  editorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  spacer: { flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: spacing.lg },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  switcherOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(18,16,24,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switcherSheet: {
    width: '88%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    maxHeight: '75%',
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  switcherList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  switcherNew: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  switcherClose: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
