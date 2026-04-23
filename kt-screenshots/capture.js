/**
 * KT Screenshot Capture — Cypress Launchpad
 *
 * Captures step-by-step screenshots of the Launchpad UI at http://localhost:4500
 * Uses Chrome DevTools Protocol (CDP) via Node.js native WebSocket (Node 21+).
 *
 * Usage:
 *   1. Start the app:  node cypress-launchpad/testdata-manager.js
 *   2. Run this script: node kt-screenshots/capture.js
 *
 * Output: kt-screenshots/  (PNG files, one per step)
 */

const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = 'http://localhost:4500';
const OUT_DIR = path.join(__dirname);
const DEBUG_PORT = 9333;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cdpGet(path) {
  return new Promise((resolve, cancel) => {
    http.get({ host: 'localhost', port: DEBUG_PORT, path }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve(JSON.parse(buf)));
    }).on('error', cancel);
  });
}

function connectCDP(wsUrl) {
  return new Promise((resolve, cancel) => {
    const ws = new WebSocket(wsUrl);
    let msgId = 0;
    const pending = new Map();

    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const id = ++msgId;
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      close() { ws.close(); }
    });

    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(msg.error) : res(msg.result);
      }
    };

    ws.onerror = cancel;
    ws.onclose = () => pending.forEach(({ rej }) => rej(new Error('WebSocket closed')));
  });
}

async function screenshot(cdp, filename, label) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(OUT_DIR, filename);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`  ✓ ${label} → ${filename}`);
}

async function clickStep(cdp, stepNumber) {
  // Click the step indicator circle (nth step button)
  await cdp.send('Runtime.evaluate', {
    expression: `
      (function() {
        var btns = document.querySelectorAll('[data-step]');
        if (btns.length >= ${stepNumber}) {
          btns[${stepNumber - 1}].click();
          return 'clicked step ${stepNumber}';
        }
        // fallback: find by text content
        var allBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
        var match = allBtns.find(b => b.textContent.trim() === '${stepNumber}');
        if (match) { match.click(); return 'clicked via text'; }
        return 'not found';
      })()
    `,
    awaitPromise: false
  });
}

async function clickNext(cdp) {
  await cdp.send('Runtime.evaluate', {
    expression: `
      (function() {
        var btns = Array.from(document.querySelectorAll('button'));
        var next = btns.find(b => b.textContent.includes('Next') || b.textContent.includes('→'));
        if (next && !next.disabled) { next.click(); return 'clicked'; }
        return 'not found or disabled';
      })()
    `,
    awaitPromise: false
  });
}

async function getStepLabel(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `
      (function() {
        var active = document.querySelector('.step-active, [aria-current="step"], [data-active="true"]');
        if (active) return active.textContent.trim();
        var h = document.querySelector('h1, h2, h3');
        return h ? h.textContent.trim() : 'unknown';
      })()
    `,
    returnByValue: true
  });
  return result.result.value || 'step';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  Cypress Launchpad — KT Screenshot Capture');
  console.log('  ─────────────────────────────────────────');

  // 1. Check app is running
  try {
    await new Promise((resolve, cancel) => {
      http.get(APP_URL, res => resolve()).on('error', cancel);
    });
    console.log('  ✓ App is running at ' + APP_URL);
  } catch {
    console.error('\n  ✗ App not running. Start it first:\n    node cypress-launchpad/testdata-manager.js\n');
    process.exit(1);
  }

  // 2. Kill any leftover Chrome debug instances
  try { execSync('pkill -f "remote-debugging-port=' + DEBUG_PORT + '"', { stdio: 'ignore' }); } catch {}
  await sleep(500);

  // 3. Launch Chrome headless
  console.log('  → Launching Chrome headless...');
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--window-size=1400,900',
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(2000);

  // 4. Connect to CDP
  let cdp;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const tabs = await cdpGet('/json');
      const tab = tabs.find(t => t.type === 'page') || tabs[0];
      if (!tab) throw new Error('No tab');
      cdp = await connectCDP(tab.webSocketDebuggerUrl);
      break;
    } catch (e) {
      if (attempt === 4) { chrome.kill(); throw e; }
      await sleep(1000);
    }
  }
  console.log('  ✓ Connected to Chrome DevTools\n');

  await cdp.send('Page.enable');

  // 5. Navigate to app
  await cdp.send('Page.navigate', { url: APP_URL });
  await sleep(3000);

  // ─── STEP 1: Entities (default view) ──────────────────────────────────────
  console.log('  Capturing steps...');
  await sleep(1000);
  await screenshot(cdp, '01-entities-test-data.png', 'Step 1 — Entities (Test Data Editor)');

  // ─── Expand one card to show form ──────────────────────────────────────────
  await cdp.send('Runtime.evaluate', {
    expression: `
      (function() {
        var cards = document.querySelectorAll('[data-card], .card, [class*="card"]');
        if (cards.length) cards[0].click();
        var expandBtns = Array.from(document.querySelectorAll('button')).filter(b =>
          b.textContent.includes('Edit') || b.textContent.includes('expand') || b.textContent.includes('+')
        );
        if (expandBtns.length) expandBtns[0].click();
      })()
    `,
    awaitPromise: false
  });
  await sleep(800);
  await screenshot(cdp, '02-entities-expanded.png', 'Step 1 — Entities (card expanded)');

  // ─── STEP 2: Features ─────────────────────────────────────────────────────
  await clickNext(cdp);
  await sleep(1500);
  await screenshot(cdp, '03-features-selector.png', 'Step 2 — Features (file/tag selector)');

  // Show tag search
  await cdp.send('Runtime.evaluate', {
    expression: `
      (function() {
        var inputs = Array.from(document.querySelectorAll('input'));
        var tagInput = inputs.find(i => i.placeholder && i.placeholder.toLowerCase().includes('tag'));
        if (tagInput) { tagInput.focus(); tagInput.value = '@'; tagInput.dispatchEvent(new Event('input', {bubbles:true})); }
      })()
    `,
    awaitPromise: false
  });
  await sleep(800);
  await screenshot(cdp, '04-features-tag-search.png', 'Step 2 — Features (tag search)');

  // ─── STEP 3: Configure ────────────────────────────────────────────────────
  await clickNext(cdp);
  await sleep(1500);
  await screenshot(cdp, '05-configure.png', 'Step 3 — Configure (batch size, browser, mode)');

  // ─── STEP 4: Run Tests ────────────────────────────────────────────────────
  await clickNext(cdp);
  await sleep(1500);
  await screenshot(cdp, '06-run-tests.png', 'Step 4 — Run Tests (Docker panel)');

  // Show docker status section
  await cdp.send('Runtime.evaluate', {
    expression: `window.scrollTo(0, 300);`,
    awaitPromise: false
  });
  await sleep(500);
  await screenshot(cdp, '07-run-docker-status.png', 'Step 4 — Run Tests (Docker status)');

  // ─── STEP 5: Reports ──────────────────────────────────────────────────────
  await clickNext(cdp);
  await sleep(2000);
  await screenshot(cdp, '08-reports.png', 'Step 5 — Reports (report list)');

  // ─── Full page scroll shots ────────────────────────────────────────────────
  // Go back to Step 1 for a full overview
  await clickStep(cdp, 1);
  await sleep(1000);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1400, height: 900, deviceScaleFactor: 1.5, mobile: false
  });
  await sleep(500);
  await screenshot(cdp, '09-overview-hires.png', 'Step 1 — Overview (1.5x HiRes)');

  // Reset scale
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  // ─── Done ─────────────────────────────────────────────────────────────────
  cdp.close();
  chrome.kill();

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
  console.log('\n  ─────────────────────────────────────────');
  console.log('  Done! ' + files.length + ' screenshots saved to kt-screenshots/');
  files.forEach(f => console.log('    ' + f));
  console.log();
}

main().catch(e => {
  console.error('\n  Error:', e.message || e);
  process.exit(1);
});
