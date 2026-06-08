#!/usr/bin/env node
/**
 * Phase 1 CI guard — Koko Bay web services must route through src/core/api,
 * not fetchWithTimeout directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const targetDir = path.join(root, 'services/kokobay-web');

function walkTsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(full, files);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const violations = [];
for (const file of walkTsFiles(targetDir)) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('fetchWithTimeout')) {
    violations.push(path.relative(root, file));
  }
}

if (violations.length > 0) {
  console.error('check-api-migration: fetchWithTimeout is forbidden in services/kokobay-web/');
  for (const file of violations) {
    console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log('check-api-migration: ok');
