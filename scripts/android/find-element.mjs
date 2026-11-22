#!/usr/bin/env node
/**
 * Finds a UI element in a `uiautomator dump` XML file by visible text or
 * content-desc and prints "x y" (the centre) for `adb shell input tap`.
 */
import { readFileSync } from 'node:fs';

const [, , xmlPath, needle] = process.argv;
if (!xmlPath || !needle) {
  console.error('usage: find-element.mjs <ui.xml> <text-or-desc>');
  process.exit(2);
}

const xml = readFileSync(xmlPath, 'utf8');
const nodes = xml.match(/<node\b[^>]*>/g) ?? [];
const wanted = needle.toLowerCase();

for (const node of nodes) {
  const text = (/\stext="([^"]*)"/.exec(node)?.[1] ?? '').toLowerCase();
  const desc = (/\scontent-desc="([^"]*)"/.exec(node)?.[1] ?? '').toLowerCase();
  if (!text.includes(wanted) && !desc.includes(wanted)) continue;
  const bounds = /\sbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
  if (!bounds) continue;
  const [, x1, y1, x2, y2] = bounds.map(Number);
  console.log(`${Math.round((x1 + x2) / 2)} ${Math.round((y1 + y2) / 2)}`);
  process.exit(0);
}

process.exit(1);
