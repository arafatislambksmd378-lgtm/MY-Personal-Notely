#!/usr/bin/env node
/**
 * Finds a tappable element in a `uiautomator dump` XML file and prints "x y"
 * (its centre) for `adb shell input tap`. Matching rules live in
 * `ui-element.mjs` so they can be unit-tested.
 */
import { readFileSync } from 'node:fs';
import { findElement } from './ui-element.mjs';

const [, , xmlPath, needle] = process.argv;
if (!xmlPath || !needle) {
  console.error('usage: find-element.mjs <ui.xml> <text-or-desc>');
  process.exit(2);
}

let xml = '';
try {
  xml = readFileSync(xmlPath, 'utf8');
} catch (error) {
  console.error(`could not read ${xmlPath}: ${error.message}`);
  process.exit(2);
}

const point = findElement(xml, needle);
if (!point) process.exit(1);
console.log(`${point.x} ${point.y}`);
