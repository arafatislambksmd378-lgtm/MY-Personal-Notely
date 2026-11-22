#!/usr/bin/env node
/**
 * Optional release signing for the prebuilt Android project.
 *
 * Expo's template signs release builds with the debug keystore, so an APK/AAB
 * always exists and installs on a device. When CI provides a real keystore
 * (ANDROID_KEYSTORE_BASE64 + passwords), this script injects it into
 * `android/app/build.gradle(.kts)` before Gradle runs.
 *
 * The script never blocks a build: if the generated project uses an unexpected
 * layout it reports what it found and exits successfully.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const candidates = ['android/app/build.gradle', 'android/app/build.gradle.kts'];
const gradlePath = candidates.find((path) => existsSync(resolve(path)));

if (!gradlePath) {
  console.log('⚠ No android/app/build.gradle(.kts) found after prebuild. Contents of android/:');
  try {
    console.log(readdirSync(resolve('android')).join('\n'));
  } catch {
    console.log('  (android/ does not exist)');
  }
  process.exit(0);
}

console.log(`ℹ Using ${gradlePath}`);

const keystoreBase64 = process.env.ANDROID_KEYSTORE_BASE64;
const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD;
const keyAlias = process.env.ANDROID_KEY_ALIAS;
const keyPassword = process.env.ANDROID_KEY_PASSWORD;

if (!keystoreBase64 || !storePassword || !keyAlias || !keyPassword) {
  console.log('ℹ No keystore secrets provided — release builds keep the template debug signing config.');
  console.log('  Artifacts are installable and testable, but not suitable for Play upload.');
  process.exit(0);
}

writeFileSync(resolve('android/app/release.keystore'), Buffer.from(keystoreBase64, 'base64'));

const groovy = gradlePath.endsWith('.kts') === false;
let gradle = readFileSync(resolve(gradlePath), 'utf8');

const signingBlock = groovy
  ? `signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword '${storePassword}'
            keyAlias '${keyAlias}'
            keyPassword '${keyPassword}'
        }`
  : `signingConfigs {
        create("release") {
            storeFile = file("release.keystore")
            storePassword = "${storePassword}"
            keyAlias = "${keyAlias}"
            keyPassword = "${keyPassword}"
        }`;

if (!/signingConfigs\s*\{/.test(gradle)) {
  console.log('⚠ No signingConfigs block found; keeping template signing.');
  process.exit(0);
}

gradle = gradle.replace(/signingConfigs\s*\{/, signingBlock);

if (groovy) {
  gradle = gradle.replace(
    /release\s*\{([\s\S]*?)signingConfig signingConfigs\.debug/,
    'release {$1signingConfig signingConfigs.release',
  );
} else {
  gradle = gradle.replace(
    /getByName\("release"\)\s*\{([\s\S]*?)signingConfig\s*=\s*signingConfigs\.getByName\("debug"\)/,
    'getByName("release") {$1signingConfig = signingConfigs.getByName("release")',
  );
}

writeFileSync(resolve(gradlePath), gradle);
console.log('✓ Release signing config applied from ANDROID_KEYSTORE_* secrets');
