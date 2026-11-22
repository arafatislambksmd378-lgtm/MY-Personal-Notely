/**
 * Offline spelling + grammar review.
 *
 * Notely ships a compact English dictionary plus rule-based grammar checks. The
 * checks are deterministic and run entirely on-device; there is no cloud
 * dependency and no silent network call. Suggestions come from edit-distance
 * matches inside the dictionary.
 */
import { normalizeWhitespace } from '@/utils/text';

/** ~1,000 of the most common English words; the fallback list when a word is unknown. */
const COMMON_WORDS = `
a able about above accept access account across act action active actually add address admit adult advance affect after again against age agency agent ago agree ahead air all allow almost alone along already also although always amazing among amount analysis and animal another answer any anyone anything apart appear apply approach april area argue arm around arrive art article artist as ask assume at attack attention audience author available avoid away baby back bad bag ball bank bar base be beat beautiful because become bed before begin behavior behind believe benefit best better between beyond big bill billion bit black blood blue board body book born both box boy break bring brother budget build building business but buy by call camera campaign can candidate capital car card care career carry case catch cause cell center central century certain certainly chair challenge chance change character charge check child choice choose church citizen city civil claim class clear clearly close coach cold collection college color come commercial common community company compare computer concern condition conference consider consumer contain continue control cost could country couple course court cover create crime cultural culture cup current customer cut dark data daughter day dead deal death debate decade decide decision deep defense degree democratic describe design despite detail determine develop development die difference different difficult dinner direction director discover discuss discussion do doctor dog door down draw dream drive drop drug during each early east easy eat economic economy edge education effect effort eight either election else employee end energy enjoy enough enter entire environment especially establish even evening event ever every everyone everything evidence exactly example executive exist expect experience expert explain face fact factor fail fall family far fast father fear federal feel feeling few field fight figure fill film final finally financial find fine finger finish fire firm first fish five floor fly focus follow food foot for force foreign forget form former forward four free friend from front full fund future game garden general generation get girl give glass go goal good government great green ground group grow growth guess gun guy hair half hand hang happen happy hard have he head health hear heart heat heavy help her here herself high him himself his history hit hold home hope hospital hot hotel hour house how however huge human hundred husband idea identify if image imagine impact important improve in include including increase indeed indicate individual industry information inside instead institution interest interesting international interview into investment involve issue it item its itself job join just keep key kid kill kind kitchen know knowledge land language large last late later laugh law lawyer lay lead leader learn least leave left leg legal less let letter level lie life light like likely line list listen little live local long look lose loss lot love low machine magazine main maintain major majority make man manage management manager many market marriage material matter may maybe me mean measure media medical meet meeting member memory mention message method middle might military million mind minute miss mission model modern moment money month more morning most mother mouth move movement movie much music must my myself name nation national natural nature near nearly necessary need network never new news newspaper next nice night no none nor north not note nothing notice now number occur off offer office officer official often oh oil ok old on once one only open operation opportunity option or order organization other others our out outside over own owner page pain painting paper parent part participant particular particularly partner party pass past patient pattern pay peace people per perform performance perhaps period person personal phone physical pick picture piece place plan plant play player point police policy political politics poor popular population position positive possible power practice prepare present president pressure pretty prevent price private probably problem process produce product production professional professor program project property protect prove provide public pull purpose push put quality question quickly quite race radio raise range rate rather reach read ready real reality realize really reason receive recent recently recognize record red region relate relationship religious remain remember remove report represent require research resource respond response rest result return reveal rich right rise risk road rock role room rule run safe same save say scene school science score sea season seat second section security see seek seem sell send senior sense series serious serve service set seven several shake share she shoot short should shoulder show side sign significant similar simple simply since sing single sister sit site situation six size skill small smile so social society soldier some somebody someone something sometimes son song soon sort sound source south space speak special specific speech spend sport spring staff stage stand standard star start state statement station stay step still stock stop store story strategy street strong structure student study stuff style subject success such suddenly suffer suggest summer support sure surface system table take talk task tax teach teacher team technology television tell ten tend term test than thank that the their them themselves then theory there these they thing think third this those though thought thousand threat three through throughout throw thus time to today together tonight too top total tough toward town trade traditional training travel treat treatment tree trial trip trouble true truth try turn two type under understand unit until up upon us use usually value various very victim view violence visit voice vote wait walk wall want war watch water way weapon wear week weight well west what whatever when where whether which while white who whole whom whose why wide wife will win wind window wish with within without woman wonder word work worker world worry would write writer wrong yard year yes yet you young your yourself
`
  .trim()
  .split(/\s+/);

const SUPPLEMENT = `fox lazy jumps quick brown over the dog cat sun moon star tree house car phone book desk chair
  window door table floor wall ceiling water coffee tea bread rice apple orange banana mango milk
  morning afternoon evening night today tomorrow yesterday week month year hour minute second
  family friend friends people person child children parent mother father sister brother
  school student teacher class lesson homework exam study learn learning teach education
  office meeting project team client deadline report email message meeting schedule calendar
  health doctor hospital medicine exercise sleep energy food diet water walk run swim
  travel train flight hotel ticket luggage passport city town village street road bridge river
  mountain beach forest garden park weather rain snow wind cloud sunny storm temperature
  money price cost budget invoice payment bank account salary tax profit revenue growth
  computer laptop keyboard screen mouse internet network website software hardware program
  design designer product user research data analysis result report summary document note
  happy sad angry calm tired excited nervous proud grateful curious focused creative
  begin started finished continue stop wait listen speak read write think know understand
  remember forget explain describe compare decide choose change improve increase reduce
  create build test check review update delete open close start finish send receive
  morning afternoon hello goodbye please thanks thank sorry welcome name number address
  because although however therefore maybe perhaps already always never often sometimes
  very really quite enough almost exactly maybe probably actually usually finally
  quick quickly slow slowly easy easily hard difficult simple complex important possible
  different similar better best worse worst good great excellent bad terrible nice fine
  first second third last next previous final initial main extra whole full empty`
  .trim()
  .split(/\s+/);

const DICTIONARY = new Set([...COMMON_WORDS, ...SUPPLEMENT]);

/** Words the reviewer should never flag (product vocabulary + common plurals handled separately). */
const ALLOWED = new Set([
  'notely',
  'notebook',
  'notebooks',
  'screenshot',
  'roadmap',
  'supabase',
  'docx',
  'pdf',
  'markdown',
  'sqlite',
  'webview',
  'onboarding',
  'workstream',
  'workstreams',
  'autosave',
  'todo',
  'ok',
  'app',
  'apps',
]);

export type IssueKind = 'spelling' | 'grammar';

export interface ReviewIssue {
  kind: IssueKind;
  /** The offending text exactly as it appears in the document. */
  text: string;
  message: string;
  suggestions: string[];
  /** Character offset in the plain text (used to order findings). */
  index: number;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  checkedWords: number;
  dictionarySize: number;
}

function isLikelyWord(token: string): boolean {
  return /^[A-Za-z][A-Za-z'’-]*$/.test(token);
}

function isProbablyProperNoun(token: string, index: number): boolean {
  if (index === 0) return true;
  const first = token[0];
  const rest = token.slice(1);
  return first === first.toUpperCase() && rest === rest.toLowerCase() && token.length > 1;
}

/** Damerau–Levenshtein distance capped for short dictionary words. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }
  return matrix[a.length][b.length];
}

export function suggestCorrectionsScored(
  word: string,
  limit = 3,
): Array<{ candidate: string; distance: number }> {
  const lower = word.toLowerCase();
  const scored: Array<{ candidate: string; distance: number }> = [];
  const maxDistance = lower.length <= 4 ? 1 : lower.length <= 7 ? 2 : 3;
  for (const candidate of DICTIONARY) {
    if (Math.abs(candidate.length - lower.length) > maxDistance) continue;
    if (candidate[0] !== lower[0] && maxDistance < 2) continue;
    const distance = editDistance(lower, candidate);
    if (distance <= maxDistance) scored.push({ candidate, distance });
  }
  scored.sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate));
  return scored.slice(0, limit);
}

export function suggestCorrections(word: string, limit = 3): string[] {
  return suggestCorrectionsScored(word, limit).map((entry) => entry.candidate);
}

function isKnownWord(word: string): boolean {
  const lower = word.toLowerCase();
  if (DICTIONARY.has(lower) || ALLOWED.has(lower)) return true;
  // Simple morphology: plurals, -ed, -ing, -ly, -s.
  const stems = [
    lower.replace(/ies$/, 'y'),
    lower.replace(/es$/, ''),
    lower.replace(/s$/, ''),
    lower.replace(/ed$/, ''),
    lower.replace(/ing$/, ''),
    lower.replace(/ly$/, ''),
  ];
  if (stems.some((stem) => stem !== lower && (DICTIONARY.has(stem) || ALLOWED.has(stem)))) return true;
  // Acronyms and hyphenated/compound words are accepted.
  if (/^[A-Z]{2,5}$/.test(word)) return true;
  if (word.includes('-')) return word.split('-').every((part) => isKnownWord(part));
  return false;
}

const GRAMMAR_RULES: Array<{
  pattern: RegExp;
  message: string;
  suggest: (match: RegExpExecArray) => string[];
}> = [
  {
    pattern: /\b(\w+)\s+\1\b/gi,
    message: 'Repeated word',
    suggest: (match) => [match[1]],
  },
  {
    pattern: / {2,}/g,
    message: 'Double space',
    suggest: () => [' '],
  },
  {
    pattern: /\s+([,.;:!?])/g,
    message: 'Space before punctuation',
    suggest: (match) => [match[1]],
  },
  {
    pattern: /([,;:])(?=\S)/g,
    message: 'Missing space after punctuation',
    suggest: (match) => [`${match[1]} `],
  },
  {
    pattern: /\b(alot)\b/gi,
    message: '“alot” is not a word',
    suggest: () => ['a lot'],
  },
  {
    pattern: /\b(recieve|seperate|definately|occured|teh|adn|wich|thier)\b/gi,
    message: 'Common misspelling',
    suggest: (match) => {
      const map: Record<string, string> = {
        recieve: 'receive',
        seperate: 'separate',
        definately: 'definitely',
        occured: 'occurred',
        teh: 'the',
        adn: 'and',
        wich: 'which',
        thier: 'their',
      };
      return [map[match[1].toLowerCase()] ?? match[1]];
    },
  },
];

export function reviewText(input: string, options: { spelling?: boolean; grammar?: boolean } = {}): ReviewResult {
  const text = normalizeWhitespace(input.replace(/\n+/g, ' '));
  const issues: ReviewIssue[] = [];
  const seen = new Set<string>();
  let checkedWords = 0;

  if (options.spelling !== false) {
    const wordRegex = /[A-Za-z][A-Za-z'’-]*/g;
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(text))) {
      const raw = match[0];
      if (!isLikelyWord(raw)) continue;
      checkedWords += 1;
      if (isKnownWord(raw)) continue;
      if (isProbablyProperNoun(raw, match.index)) continue;
      const key = `spelling:${raw.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const scored = suggestCorrectionsScored(raw);
      if (scored.length === 0) continue;
      // Only report confident findings: distance 1, or distance 2 for long words.
      const confidenceThreshold = raw.length >= 8 ? 2 : 1;
      if (scored[0].distance > confidenceThreshold) continue;
      const suggestions = scored.map((entry) => entry.candidate);
      issues.push({
        kind: 'spelling',
        text: raw,
        message: 'Possible spelling mistake',
        suggestions,
        index: match.index,
      });
    }
  }

  if (options.grammar !== false) {
    for (const rule of GRAMMAR_RULES) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text))) {
        const matched = match[0];
        const key = `grammar:${rule.message}:${matched.trim().toLowerCase()}`;
        if (seen.has(key) || !matched.trim()) continue;
        seen.add(key);
        issues.push({
          kind: 'grammar',
          text: matched,
          message: rule.message,
          suggestions: rule.suggest(match),
          index: match.index,
        });
      }
    }
  }

  issues.sort((a, b) => a.index - b.index);
  return { issues, checkedWords, dictionarySize: DICTIONARY.size };
}

export function dictionarySize(): number {
  return DICTIONARY.size;
}
