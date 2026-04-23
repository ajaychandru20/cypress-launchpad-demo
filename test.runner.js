#!/usr/bin/env node
/**
 * Cypress Parallel Test Runner
 * Runs feature files matching a given @tag in parallel batches.
 *
 * Usage: node test.runner.js <region> <tag> [batchSize] [--headless]
 * Example: node test.runner.js demo1 auth 2
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const PROJECT_ROOT = __dirname;

function isFile(f) {
  try { return fs.statSync(f).isFile(); } catch (e) { return false; }
}

/**
 * Return all .feature spec paths that contain the given @tag.
 */
function getSpecsByTag(tag) {
  var pattern = path.join(PROJECT_ROOT, 'cypress', 'e2e', 'features', '**', '*.feature');
  var files = glob.sync(pattern).filter(isFile);
  if (!tag) return files;

  var tagPattern = new RegExp('@' + tag + '\\b');
  return files.filter(function (f) {
    try {
      var content = fs.readFileSync(f, 'utf8');
      return tagPattern.test(content);
    } catch (e) {
      return false;
    }
  });
}

/**
 * All feature files in the project (for Launchpad feature tree).
 */
var platformFeatures = glob.sync(
  path.join(PROJECT_ROOT, 'cypress', 'e2e', 'features', '**', '*.feature')
).filter(isFile);

if (require.main === module) {
  var args = process.argv.slice(2);
  var Headed = !args.includes('--headless');
  args = args.filter(function (a) { return a !== '--headless'; });

  var region = args[0];
  var tag = args[1];
  var batchSize = parseInt(args[2]) || 2;

  if (!region || !tag) {
    console.error('Usage: node test.runner.js <region> <tag> [batchSize] [--headless]');
    console.error('Example: node test.runner.js demo1 auth 2');
    process.exit(1);
  }

  console.log('[runner] Region:', region, '| Tag:', tag, '| Batch:', batchSize, '| Headed:', Headed);

  // Write .env for the region
  try {
    execSync('node env.js ' + region, { cwd: PROJECT_ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('[runner] Failed to set env:', e.message);
    process.exit(1);
  }

  var specs = getSpecsByTag(tag);
  if (specs.length === 0) {
    console.warn('[runner] No feature files found for tag @' + tag);
    process.exit(0);
  }

  console.log('[runner] Found', specs.length, 'spec(s) for tag @' + tag);

  // Run in batches
  var pending = specs.slice();
  var running = 0;
  var failed = 0;

  function runNext() {
    while (running < batchSize && pending.length > 0) {
      var spec = pending.shift();
      running++;
      console.log('[runner] Starting:', path.relative(PROJECT_ROOT, spec));
      var child = spawn(
        'npx',
        [
          'cypress', 'run',
          '--spec', spec,
          '--browser', 'chrome',
          Headed ? '--headed' : '--headless',
        ],
        { cwd: PROJECT_ROOT, stdio: 'inherit', shell: true }
      );
      child.on('close', function (code) {
        running--;
        if (code !== 0) failed++;
        runNext();
        if (running === 0 && pending.length === 0) {
          console.log('[runner] All done. Failed:', failed);
          process.exit(failed > 0 ? 1 : 0);
        }
      });
    }
  }

  runNext();
}

module.exports = { getSpecsByTag, platformFeatures };
