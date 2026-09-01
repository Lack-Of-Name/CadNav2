#!/usr/bin/env node
/**
 * Update version everywhere in CadNav2.
 *
 * Usage:
 *   node scripts/update-version.mjs 1.1.0
 *   node scripts/update-version.mjs --version 1.1.0
 *   npm run version:update -- 1.1.0   (if script added to package.json)
 *
 * Updates:
 *   - package.json  -> version
 *   - app.json      -> expo.version
 *   (android/app/build.gradle versionName is derived from expo at prebuild, so not touched)
 *
 * Validates semver (x.y.z with optional -prerelease / +build).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function parseArgs() {
  const raw = process.argv.slice(2);
  let version = null;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '--version' || a === '-v') {
      version = raw[i + 1];
      i++;
    } else if (!a.startsWith('-') && !version) {
      version = a;
    } else if (a.startsWith('--version=')) {
      version = a.split('=')[1];
    }
  }
  return version?.trim() ?? null;
}

function fail(msg) {
  console.error(`\n  ✖ ${msg}\n`);
  console.error('  Usage: node scripts/update-version.mjs 1.1.0\n');
  process.exit(1);
}

const version = parseArgs();
if (!version) fail('No version supplied.');
if (!SEMVER_RE.test(version)) fail(`Invalid semver "${version}". Expected x.y.z (e.g. 1.1.0).`);

console.log(`\n  Updating CadNav2 version → ${version}\n`);

const targets = [];

// --- package.json ---
const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found at project root.');
const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgRaw);
const oldPkg = pkg.version;
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
targets.push({ file: 'package.json',                field: 'version',        old: oldPkg, next: version });

// --- app.json ---
const appPath = path.join(root, 'app.json');
if (fs.existsSync(appPath)) {
  const appRaw = fs.readFileSync(appPath, 'utf8');
  const app = JSON.parse(appRaw);
  const oldApp = app?.expo?.version ?? '(missing)';
  if (!app.expo) app.expo = {};
  app.expo.version = version;
  fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n', 'utf8');
  targets.push({ file: 'app.json',                   field: 'expo.version',   old: oldApp, next: version });
} else {
  const cfgPath = path.join(root, 'app.config.js');
  if (fs.existsSync(cfgPath)) {
    console.warn('  ! app.json not found, but app.config.js exists — update version there manually.');
  }
}

// --- eas.json (if it pins version, keep in sync; otherwise skip) ---
const easPath = path.join(root, 'eas.json');
if (fs.existsSync(easPath)) {
  try {
    const easRaw = fs.readFileSync(easPath, 'utf8');
    // Only touch if file literally contains a version string matching old; avoid JSONC pitfalls.
    // For now just report — don't auto-edit eas.json (usually no version there).
    if (oldPkg && easRaw.includes(oldPkg)) {
      console.warn(`  ! eas.json mentions ${oldPkg} — review manually if it should track app version.`);
    }
  } catch {}
}

console.log('  Updated:');
for (const t of targets) {
  const padFile = t.file.padEnd(16);
  const padField = t.field.padEnd(14);
  console.log(`    ${padFile} ${padField} ${String(t.old).padEnd(10)} → ${t.next}`);
}
console.log('\n  ✔ Done. Commit package.json + app.json together.\n');
