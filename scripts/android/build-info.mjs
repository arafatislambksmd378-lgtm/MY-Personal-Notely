#!/usr/bin/env node
/**
 * Collects facts about the Android artifacts Gradle produced so the report can
 * quote real sizes, hashes and build identifiers.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const outDir = resolve('artifacts/android');
mkdirSync(outDir, { recursive: true });

const keep = [];

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const apkDir = resolve('android/app/build/outputs/apk/release');
const aabDir = resolve('android/app/build/outputs/bundle/release');

const apks = existsSync(apkDir) ? readdirSync(apkDir).filter((name) => name.endsWith('.apk')) : [];
const aabs = existsSync(aabDir) ? readdirSync(aabDir).filter((name) => name.endsWith('.aab')) : [];

const artifacts = [];
for (const name of apks) {
  const source = resolve(apkDir, name);
  const target = resolve(outDir, `notely-${name}`);
  writeFileSync(target, readFileSync(source));
  artifacts.push({ kind: 'APK', file: target, bytes: statSync(source).size, sha256: hashFile(source) });
  keep.push(target);
}
for (const name of aabs) {
  const source = resolve(aabDir, name);
  const target = resolve(outDir, `notely-${name}`);
  writeFileSync(target, readFileSync(source));
  artifacts.push({ kind: 'AAB', file: target, bytes: statSync(source).size, sha256: hashFile(source) });
  keep.push(target);
}

function tool(command, fallback = 'unknown') {
  try {
    return execSync(command, { encoding: 'utf8' }).trim().split('\n')[0];
  } catch {
    return fallback;
  }
}

const keystore = existsSync(resolve('android/app/release.keystore')) ? 'release keystore' : 'debug keystore (Expo template default)';

const info = {
  generatedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? tool('git rev-parse HEAD'),
  runId: process.env.GITHUB_RUN_ID ?? null,
  runUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
  signing: keystore,
  java: process.env.JAVA_VERSION ?? tool('java -version 2>&1'),
  node: process.version,
  expo: JSON.parse(readFileSync('package.json', 'utf8')).dependencies.expo,
  sdk: process.env.ANDROID_COMPILE_SDK ?? null,
  artifacts,
};

writeFileSync(resolve(outDir, 'build-info.json'), JSON.stringify(info, null, 2));

const lines = [
  '# Android build',
  '',
  `- Generated: ${info.generatedAt}`,
  `- Commit: \`${info.commit}\``,
  `- Workflow run: ${info.runUrl ?? 'local'}`,
  `- Signing: ${info.signing}`,
  `- Java: ${info.java}`,
  `- Node: ${info.node}`,
  `- Expo: ${info.expo}`,
  '',
  '| Artifact | Size | SHA-256 |',
  '| --- | --- | --- |',
  ...artifacts.map(
    (artifact) =>
      `| ${artifact.kind} \`${artifact.file.split('/').pop()}\` | ${(artifact.bytes / 1024 / 1024).toFixed(1)} MB | \`${artifact.sha256}\` |`,
  ),
  '',
];

writeFileSync(resolve(outDir, 'build-info.md'), lines.join('\n'));
console.log(lines.join('\n'));
if (artifacts.length === 0) {
  console.error('✖ No APK or AAB was produced.');
  process.exit(1);
}
