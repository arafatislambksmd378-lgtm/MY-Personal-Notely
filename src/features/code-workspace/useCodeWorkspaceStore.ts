/**
 * Code Workspace state (offline-first, in-memory).
 *
 * Projects and files live in this zustand store while the app is running — no
 * server, no heavy dependency, flat memory footprint on 3 GB RAM devices.
 * Persistence to the device file system can be wired into `load`/`saveFile`
 * later without changing the UI components.
 *
 * Only dependency: `zustand` (already in the project).
 */
import { create } from 'zustand';

export interface CodeFile {
  id: string;
  projectId: string;
  name: string;
  language: string; // 'html' | 'css' | 'js' | 'plain' | …
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodeProject {
  id: string;
  name: string;
  color: string; // accent hex
  createdAt: string;
  updatedAt: string;
}

interface CodeWorkspaceState {
  /* ---- index ---- */
  projects: CodeProject[];
  files: CodeFile[]; /* all files across projects */
  activeProjectId: string | null;
  activeFileId: string | null;

  /* ---- working copy (edited but not yet "saved") ---- */
  contents: Record<string, string>; /* fileId -> source */

  /* ---- version history (newest last) ---- */
  versions: Record<string, Array<{ content: string; at: string }>>;

  /* ---- UI ---- */
  previewOpen: boolean;
  consoleOpen: boolean;
  status: 'idle' | 'loading' | 'saving' | 'error';
  error: string | null;

  /* ---- actions ---- */
  load: () => Promise<void>;
  createProject: (name: string, color?: string) => Promise<CodeProject>;
  openProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  createFile: (projectId: string, name: string, language?: string) => Promise<CodeFile>;
  deleteFile: (fileId: string) => Promise<void>;
  renameFile: (fileId: string, name: string) => Promise<void>;
  setFileContent: (fileId: string, content: string) => void;
  saveFile: (fileId: string) => Promise<void>;
  restoreVersion: (fileId: string, versionIndex: number) => Promise<void>;
  setActiveFile: (fileId: string | null) => void;
  setPreviewOpen: (open: boolean) => void;
  setConsoleOpen: (open: boolean) => void;
}

const nowIso = (): string => new Date().toISOString();
const id = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useCodeWorkspaceStore = create<CodeWorkspaceState>((set, get) => ({
  projects: [],
  files: [],
  activeProjectId: null,
  activeFileId: null,
  contents: {},
  versions: {},
  previewOpen: true,
  consoleOpen: false,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null });
    try {
      /* Seed a default project on first launch so the workspace isn't empty. */
      if (get().projects.length === 0) {
        const project: CodeProject = {
          id: id('project'),
          name: 'My first project',
          color: '#8950F5',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        const welcome: CodeFile = {
          id: id('file'),
          projectId: project.id,
          name: 'index.html',
          language: 'html',
          content: '<h1>Hello, Code Workspace</h1>\n<p>Edit this file and preview it.</p>',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set({
          projects: [project],
          files: [welcome],
          activeProjectId: project.id,
          activeFileId: welcome.id,
          contents: { [welcome.id]: welcome.content },
          status: 'idle',
        });
        return;
      }
      set({ status: 'idle' });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Failed to load workspace' });
    }
  },

  createProject: async (name, color = '#8950F5') => {
    const project: CodeProject = {
      id: id('project'),
      name,
      color,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    set((state) => ({ projects: [...state.projects, project] }));
    return project;
  },

  openProject: async (projectId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Project not found');
    const projectFiles = get().files.filter((f) => f.projectId === projectId);
    const contents: Record<string, string> = {};
    for (const f of projectFiles) contents[f.id] = f.content;
    const activeFileId = projectFiles.length > 0 ? projectFiles[0].id : null;
    set({
      files: get().files, /* unchanged, just re-indexed by filter above */
      activeProjectId: projectId,
      activeFileId,
      contents,
    });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, updatedAt: nowIso() } : p,
      ),
    }));
  },

  deleteProject: async (projectId) => {
    const remainingFileIds = new Set(
      get().files.filter((f) => f.projectId !== projectId).map((f) => f.id),
    );
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      files: state.files.filter((f) => f.projectId !== projectId),
      contents: Object.fromEntries(
        Object.entries(state.contents).filter(([fileId]) => remainingFileIds.has(fileId)),
      ),
      versions: Object.fromEntries(
        Object.entries(state.versions).filter(([fileId]) => remainingFileIds.has(fileId)),
      ),
      activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
      activeFileId:
        state.activeFileId && remainingFileIds.has(state.activeFileId)
          ? state.activeFileId
          : null,
    }));
  },

  createFile: async (projectId, name, language) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Project not found');
    const lang = language ?? languageForFilename(name);
    const file: CodeFile = {
      id: id('file'),
      projectId,
      name,
      language: lang,
      content: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    set((state) => ({
      files: [...state.files, file],
      contents: { ...state.contents, [file.id]: '' },
      activeFileId: file.id,
    }));
    return file;
  },

  deleteFile: async (fileId) => {
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
      contents: Object.fromEntries(
        Object.entries(state.contents).filter(([fid]) => fid !== fileId),
      ),
      versions: Object.fromEntries(
        Object.entries(state.versions).filter(([fid]) => fid !== fileId),
      ),
      activeFileId: state.activeFileId === fileId ? null : state.activeFileId,
    }));
  },

  renameFile: async (fileId, name) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId
          ? { ...f, name, language: languageForFilename(name), updatedAt: nowIso() }
          : f,
      ),
    }));
  },

  setFileContent: (fileId, content) => {
    set((state) => ({ contents: { ...state.contents, [fileId]: content } }));
  },

  saveFile: async (fileId) => {
    const state = get();
    const previous = state.contents[fileId];
    const file = state.files.find((f) => f.id === fileId);
    if (!file) return;
    const content = state.contents[fileId] ?? '';
    const versions = [...(state.versions[fileId] ?? [])];
    if (previous !== undefined && previous !== content) {
      versions.push({ content: previous, at: nowIso() });
      if (versions.length > 10) versions.shift();
    }
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, content, updatedAt: nowIso() } : f,
      ),
      contents: { ...state.contents, [fileId]: content },
      versions: { ...state.versions, [fileId]: versions },
    }));
  },

  restoreVersion: async (fileId, versionIndex) => {
    const state = get();
    const versions = state.versions[fileId];
    if (!versions || versionIndex < 0 || versionIndex >= versions.length) return;
    const { content, at } = versions[versionIndex];
    const file = state.files.find((f) => f.id === fileId);
    if (!file) return;
    set((state) => ({
      contents: { ...state.contents, [fileId]: content },
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, content, updatedAt: at } : f,
      ),
    }));
  },

  setActiveFile: (fileId) => set({ activeFileId: fileId }),

  setPreviewOpen: (open) => set({ previewOpen: open }),

  setConsoleOpen: (open) => set({ consoleOpen: open }),
}));

/* ---- small helpers (not part of the store) ---- */

const EXT_LANGUAGE: Record<string, string> = {
  js: 'js',
  jsx: 'jsx',
  ts: 'ts',
  tsx: 'tsx',
  css: 'css',
  html: 'html',
  htm: 'html',
};

export function languageForFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return EXT_LANGUAGE[ext] ?? 'plain';
}
