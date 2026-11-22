/**
 * First-run content.
 *
 * These records are created exactly once (guarded by the `seeded` settings key)
 * so a user who deletes everything does not get the starter notes back. The
 * notebook set mirrors the reference screenshots (Personal, Work, Ideas, Study)
 * and the welcome note documents the features that actually exist.
 */
import type { SqlDatabase } from './sql';
import { createId } from '@/utils/id';
import { makeExcerpt, countWords, countChars, htmlToPlainText, readingMinutes } from '@/utils/text';
import { defaultPageSetup } from '@/types/models';

const SEED_KEY = 'seed.version';
const SEED_VERSION = '1';

interface SeedNote {
  notebook: string;
  title: string;
  color: string;
  html: string;
  favorite?: boolean;
  pinned?: boolean;
}

const WELCOME_HTML = `<h1>Welcome to Notely</h1>
<p>A premium space for your thinking — rich documents, sketches, tables and ideas, all stored on this device first.</p>
<h2>What you can do</h2>
<ul>
<li><b>Write richly</b> — headings, bold, italic, underline, strike-through, colors, highlights, lists, quotes and alignment.</li>
<li><b>Insert anything</b> — images, tables, drawings, charts, links, comments, dividers, footnotes, symbols, equations, contents and bookmarks.</li>
<li><b>Stay organized</b> — notebooks, tags, favorites, pinning, archive and trash.</li>
<li><b>Never lose work</b> — autosave, version history, backup and restore.</li>
</ul>
<h2>Try it now</h2>
<p>Tap the <b>+</b> button on the Home screen to start a note, or open the insert sheet from the editor to add a table or a divider.</p>
<blockquote>Notely keeps everything offline. Your notes are saved to a local SQLite database as you type.</blockquote>`;

const ROADMAP_HTML = `<h1>Q4 Product Roadmap</h1>
<p><b>Objectives</b> — ship the new editor, tighten onboarding and prepare the release candidate.</p>
<h2>Workstreams</h2>
<ol>
<li>Editor reliability and offline autosave</li>
<li>Export parity across PDF, DOCX and Markdown</li>
<li>Performance budget for long documents</li>
</ol>
<h2>Milestones</h2>
<table>
<tbody>
<tr><th>Week</th><th>Milestone</th><th>Owner</th></tr>
<tr><td>1-2</td><td>Editor beta</td><td>Design</td></tr>
<tr><td>3-4</td><td>Export QA</td><td>Engineering</td></tr>
<tr><td>5-6</td><td>Release candidate</td><td>Product</td></tr>
</tbody>
</table>`;

const SEED_NOTES: SeedNote[] = [
  {
    notebook: 'Personal',
    title: 'Welcome to Notely',
    color: 'purple',
    html: WELCOME_HTML,
    pinned: true,
  },
  {
    notebook: 'Personal',
    title: 'Reading list',
    color: 'teal',
    html: `<h2>Reading list</h2>
<ul>
<li><i>The Design of Everyday Things</i> — Don Norman</li>
<li><i>Refactoring UI</i> — Adam Wathan &amp; Steve Schoger</li>
<li><i>Deep Work</i> — Cal Newport</li>
</ul>
<p>Add a note next to each book with the one idea worth keeping.</p>`,
  },
  {
    notebook: 'Work',
    title: 'Q4 Product Roadmap',
    color: 'blue',
    html: ROADMAP_HTML,
    pinned: true,
  },
  {
    notebook: 'Work',
    title: 'Sprint 14 — meeting notes',
    color: 'amber',
    html: `<h2>Sprint 14</h2>
<p><b>Attendees:</b> product, design, engineering.</p>
<h3>Decisions</h3>
<ul>
<li>Move the insert sheet to a bottom sheet with a three-column grid.</li>
<li>Autosave debounce stays at 1.2s.</li>
</ul>
<h3>Action items</h3>
<ol>
<li>Prototype the page setup panel.</li>
<li>Verify DOCX export round-trip.</li>
</ol>`,
  },
  {
    notebook: 'Ideas',
    title: 'App ideas worth keeping',
    color: 'pink',
    html: `<h2>Ideas</h2>
<p>A quiet inbox for half-formed thoughts.</p>
<ul>
<li>Voice-first note capture with offline transcription queue.</li>
<li>Handwriting layer for quick sketches.</li>
<li>Weekly digest email built from tags.</li>
</ul>`,
  },
  {
    notebook: 'Study',
    title: 'Design systems — study notes',
    color: 'green',
    html: `<h2>Design systems</h2>
<p>Tokens first, components second, patterns third.</p>
<h3>Key ideas</h3>
<ul>
<li>Spacing and type scales should be shared, not reinvented per screen.</li>
<li>Every component needs an empty, loading and error state.</li>
</ul>
<blockquote>Consistency is a feature.</blockquote>`,
  },
];

const SEED_NOTEBOOKS: Array<{ name: string; color: string; icon: string }> = [
  { name: 'Personal', color: 'purple', icon: 'book' },
  { name: 'Work', color: 'blue', icon: 'briefcase' },
  { name: 'Ideas', color: 'amber', icon: 'bulb' },
  { name: 'Study', color: 'green', icon: 'library' },
];

export async function seedIfEmpty(db: SqlDatabase): Promise<boolean> {
  const existing = await db.get<{ value: string }>('SELECT value FROM user_settings WHERE key = ?', [
    SEED_KEY,
  ]);
  if (existing?.value === SEED_VERSION) return false;

  const notebookCount = await db.get<{ count: number | string }>('SELECT COUNT(*) AS count FROM notebooks');
  if (Number(notebookCount?.count ?? 0) > 0) {
    await db.run(
      'INSERT OR REPLACE INTO user_settings (key, value, updated_at) VALUES (?, ?, ?)',
      [SEED_KEY, SEED_VERSION, new Date().toISOString()],
    );
    return false;
  }

  const now = new Date().toISOString();
  const notebookIds = new Map<string, string>();

  await db.transaction(async () => {
    for (let index = 0; index < SEED_NOTEBOOKS.length; index += 1) {
      const notebook = SEED_NOTEBOOKS[index];
      const id = createId('nb');
      notebookIds.set(notebook.name, id);
      await db.run(
        `INSERT INTO notebooks (id, name, color, icon, sort_order, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, notebook.name, notebook.color, notebook.icon, index, index === 0 ? 1 : 0, now, now],
      );
    }

    for (const note of SEED_NOTES) {
      const notebookId = notebookIds.get(note.notebook);
      if (!notebookId) continue;
      const id = createId('doc');
      const plain = htmlToPlainText(note.html);
      const words = countWords(plain);
      await db.run(
        `INSERT INTO documents (
          id, notebook_id, title, content_html, plain_text, excerpt, card_color,
          is_favorite, is_pinned, is_archived, deleted_at, page_setup_json,
          word_count, char_count, reading_minutes, created_at, updated_at, last_opened_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          notebookId,
          note.title,
          note.html,
          plain,
          makeExcerpt(plain),
          note.color,
          note.favorite ? 1 : 0,
          note.pinned ? 1 : 0,
          JSON.stringify(defaultPageSetup),
          words,
          countChars(plain),
          readingMinutes(words),
          now,
          now,
          now,
        ],
      );
    }

    await db.run(
      'INSERT OR REPLACE INTO user_settings (key, value, updated_at) VALUES (?, ?, ?)',
      [SEED_KEY, SEED_VERSION, now],
    );
  });

  return true;
}
