import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const TARGET_RUNTIME = 'nodejs20.x';
const OUTPUT_DIR = '.vercel/output/functions';

function walkDir(dir, callback) {
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath, callback);
      } else if (entry === '.vc-config.json') {
        callback(fullPath);
      }
    }
  } catch {
    // directory may not exist
  }
}

let patched = 0;

walkDir(OUTPUT_DIR, (configPath) => {
  const raw = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);

  if (config.runtime && config.runtime !== TARGET_RUNTIME) {
    const old = config.runtime;
    config.runtime = TARGET_RUNTIME;
    writeFileSync(configPath, JSON.stringify(config, null, '\t') + '\n');
    console.log(`Patched ${configPath}: ${old} → ${TARGET_RUNTIME}`);
    patched++;
  }
});

if (patched > 0) {
  console.log(`Done: patched ${patched} function(s) to ${TARGET_RUNTIME}`);
} else {
  console.log('No runtime patches needed.');
}
