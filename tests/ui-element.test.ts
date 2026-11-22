/**
 * Tests for the emulator tour's element matcher.
 *
 * A real `uiautomator dump` from the Notely Home screen contains the word
 * "Notebooks" twice: once as a section header and once as the bottom tab. The
 * matcher must pick the tap target, otherwise the tour silently screenshots the
 * same screen instead of navigating.
 */
import { describe, expect, it } from 'vitest';
import { findElement } from '../scripts/android/ui-element.mjs';

const node = (attributes: string) => `<node ${attributes} />`;

const HOME_DUMP = `<hierarchy rotation="0">
  <node index="0" text="" content-desc="" clickable="false" bounds="[0,0][1080,2400]">
    ${node('index="0" text="Notebooks" content-desc="" clickable="false" bounds="[48,556][277,606]"')}
    ${node('index="1" text="See all" content-desc="" clickable="true" bounds="[897,556][1032,606]"')}
    ${node('index="2" text="" content-desc="Create a new note" clickable="true" bounds="[893,120][1035,262]"')}
    ${node('index="3" text="Welcome to Notely" content-desc="" clickable="true" bounds="[48,1090][618,1604]"')}
    ${node('index="4" text="" content-desc="Home" clickable="true" bounds="[0,2110][360,2320]"')}
    ${node('index="5" text="" content-desc="Notebooks" clickable="true" bounds="[360,2110][720,2320]"')}
    ${node('index="6" text="" content-desc="Settings" clickable="true" bounds="[720,2110][1080,2320]"')}
  </node>
</hierarchy>`;

describe('findElement', () => {
  it('returns the centre of an exact accessibility label', () => {
    expect(findElement(HOME_DUMP, 'Create a new note')).toEqual({ x: 964, y: 191 });
  });

  it('prefers the clickable tab over the identically named section header', () => {
    // Header sits at y≈581, the tab at y≈2215.
    expect(findElement(HOME_DUMP, 'Notebooks')).toEqual({ x: 540, y: 2215 });
  });

  it('finds the active tab too', () => {
    expect(findElement(HOME_DUMP, 'Home')).toEqual({ x: 180, y: 2215 });
  });

  it('matches partially typed labels against tappable nodes', () => {
    expect(findElement(HOME_DUMP, 'create a new')).toEqual({ x: 964, y: 191 });
  });

  it('matches visible text when no accessibility label exists', () => {
    expect(findElement(HOME_DUMP, 'Welcome')).toEqual({ x: 333, y: 1347 });
  });

  it('prefers the shorter exact match over a longer clickable substring', () => {
    const dump = `<hierarchy>
      ${node('text="Settings and more" content-desc="" clickable="true" bounds="[0,0][100,100]"')}
      ${node('text="Settings" content-desc="" clickable="true" bounds="[200,200][300,300]"')}
    </hierarchy>`;
    expect(findElement(dump, 'Settings')).toEqual({ x: 250, y: 250 });
  });

  it('falls back to a non-clickable match when nothing is tappable', () => {
    const dump = `<hierarchy>${node('text="Saved" content-desc="" clickable="false" bounds="[10,20][30,40]"')}</hierarchy>`;
    expect(findElement(dump, 'Saved')).toEqual({ x: 20, y: 30 });
  });

  it('matches case-insensitively', () => {
    expect(findElement(HOME_DUMP, 'notebooks')).toEqual({ x: 540, y: 2215 });
  });

  it('returns null when nothing matches', () => {
    expect(findElement(HOME_DUMP, 'Definitely not on screen')).toBeNull();
  });

  it('ignores nodes without bounds', () => {
    const dump = '<hierarchy><node text="Home" content-desc="" clickable="true" /></hierarchy>';
    expect(findElement(dump, 'Home')).toBeNull();
  });
});
