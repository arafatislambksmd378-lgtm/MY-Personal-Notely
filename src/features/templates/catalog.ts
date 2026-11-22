/** Ready-made note templates. Content uses only the editor's supported markup. */
export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  accent: 'purple' | 'blue' | 'green' | 'amber' | 'pink' | 'teal' | 'red';
  title: string;
  html: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank note',
    description: 'Start from an empty page',
    icon: 'document-outline',
    accent: 'purple',
    title: 'Untitled',
    html: '<p><br /></p>',
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    description: 'Agenda, decisions and actions',
    icon: 'people-outline',
    accent: 'blue',
    title: 'Meeting — ',
    html: `<h1>Meeting notes</h1>
<p><b>Date:</b> <br /><b>Attendees:</b> </p>
<h2>Agenda</h2>
<ol><li>Topic one</li><li>Topic two</li></ol>
<h2>Decisions</h2>
<ul><li>Decision</li></ul>
<h2>Action items</h2>
<table><tbody>
<tr><th>Owner</th><th>Task</th><th>Due</th></tr>
<tr><td></td><td></td><td></td></tr>
</tbody></table>`,
  },
  {
    id: 'daily',
    name: 'Daily journal',
    description: 'Mood, highlights and gratitude',
    icon: 'sunny-outline',
    accent: 'amber',
    title: 'Journal — ',
    html: `<h1>Today</h1>
<p><b>Mood:</b> </p>
<h2>Three highlights</h2>
<ol><li></li><li></li><li></li></ol>
<h2>What I learned</h2>
<p><br /></p>
<h2>Grateful for</h2>
<ul><li></li></ul>`,
  },
  {
    id: 'todo',
    name: 'To-do list',
    description: 'Checklist with priorities',
    icon: 'checkbox-outline',
    accent: 'green',
    title: 'To-do — ',
    html: `<h1>To-do</h1>
<h2>Today</h2>
<ul><li>Task one</li><li>Task two</li></ul>
<h2>This week</h2>
<ul><li>Task three</li></ul>
<h2>Later</h2>
<ul><li>Task four</li></ul>`,
  },
  {
    id: 'lecture',
    name: 'Lecture notes',
    description: 'Key ideas, definitions and questions',
    icon: 'school-outline',
    accent: 'teal',
    title: 'Lecture — ',
    html: `<h1>Lecture notes</h1>
<p><b>Course:</b> <br /><b>Lecturer:</b> </p>
<h2>Key ideas</h2>
<ul><li></li></ul>
<h2>Definitions</h2>
<p></p>
<h2>Questions to follow up</h2>
<ol><li></li></ol>`,
  },
  {
    id: 'project',
    name: 'Project plan',
    description: 'Goals, milestones and risks',
    icon: 'rocket-outline',
    accent: 'pink',
    title: 'Project — ',
    html: `<h1>Project plan</h1>
<p><b>Goal:</b> </p>
<h2>Scope</h2>
<p></p>
<h2>Milestones</h2>
<table><tbody>
<tr><th>Milestone</th><th>Date</th><th>Status</th></tr>
<tr><td></td><td></td><td></td></tr>
</tbody></table>
<h2>Risks</h2>
<ul><li></li></ul>`,
  },
  {
    id: 'recipe',
    name: 'Recipe',
    description: 'Ingredients and steps',
    icon: 'restaurant-outline',
    accent: 'red',
    title: 'Recipe — ',
    html: `<h1>Recipe</h1>
<p><b>Serves:</b> <br /><b>Time:</b> </p>
<h2>Ingredients</h2>
<ul><li></li></ul>
<h2>Method</h2>
<ol><li></li></ol>
<h2>Notes</h2>
<p></p>`,
  },
  {
    id: 'reading',
    name: 'Reading notes',
    description: 'Summary, quotes and takeaways',
    icon: 'book-outline',
    accent: 'purple',
    title: 'Reading — ',
    html: `<h1>Reading notes</h1>
<p><b>Title:</b> <br /><b>Author:</b> </p>
<h2>Summary</h2>
<p></p>
<h2>Quotes</h2>
<blockquote>Quote goes here</blockquote>
<h2>Takeaways</h2>
<ol><li></li></ol>`,
  },
];

export function findTemplate(id: string): NoteTemplate | undefined {
  return NOTE_TEMPLATES.find((template) => template.id === id);
}
