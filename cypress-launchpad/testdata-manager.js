#!/usr/bin/env node
/**
 * Cypress Launchpad
 * -----------------------------------------------------------------
 * UI to manage entity names directly in {env}TestData.json files
 * that Cypress reads. No intermediate usersData layer.
 *
 * Data flow:
 *   Edit in UI  -->  testData/{env}TestData.json
 *   (products & transactions are never touched)
 *
 * Linked Autocomplete:
 *   Category (standalone) -> Product (linked to category via product_set)
 *   -> Variant (linked to product via platform.service product-variant)
 *   -> User (linked to variant via platform.service user-variant)
 *   -> Carts (linked to variant via swag.product)
 *
 * Usage:  node tools/testdata-manager.js
 * Open:   http://localhost:4500
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const glob = require('glob');
const { spawn, execSync } = require('child_process');
const { getEnvContent } = require('../env');
const docker = require('./docker-runner');

// Reuse getSpecsByTag from test.runner.js
const { getSpecsByTag } = require('../test.runner');

// -- In-memory TTL cache for feature files, tags, and spec lookups -------------
// Avoids re-globbing 474+ feature files on every API call.
var _cache = {};
var CACHE_TTL_MS = 60 * 1000; // 60 seconds

function cacheGet(key) {
  var entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { delete _cache[key]; return null; }
  return entry.val;
}

function cacheSet(key, val) { _cache[key] = { val: val, ts: Date.now() }; }
function cacheDel(key) { delete _cache[key]; }
function clearAllCaches() { _cache = {}; }

// Helper function to kill process tree (important for Windows)
function killProcessTree(childProcess) {
  if (process.platform === 'win32') {
    // Windows: taskkill /t kills the full process tree (cmd.exe + npx + cypress + browser)
    try {
      execSync('taskkill /pid ' + childProcess.pid + ' /t /f', { stdio: 'pipe', timeout: 5000 });
    } catch (e) {
      try { childProcess.kill('SIGKILL'); } catch (err) { }
    }
  } else {
    // Unix: use negative PID to kill the entire process group at once.
    // This works because the child was spawned with detached:true, giving it
    // its own process group (PGID = child PID). process.kill(-pid) sends the
    // signal to every process in that group: shell + cypress + browser children.
    try { process.kill(-childProcess.pid, 'SIGTERM'); } catch (e) { }
    setTimeout(function () {
      try { process.kill(-childProcess.pid, 'SIGKILL'); } catch (e) { }
    }, 300);
  }
}

// -- Mock entity search (demo mode — no real database) -------------------------
// Returns sample values filtered by the typed query string.
var MOCK_SEARCH_DATA = {
  adminUser:       ['admin@demo.com', 'superadmin@demo.com', 'ops-admin@demo.com'],
  standardUser:    ['standard_user', 'visual_user', 'performance_glitch_user'],
  guestUser:       ['guest@demo.com', 'trial@demo.com'],
  lockedUser:      ['locked_out_user', 'error_user'],
  featuredProduct: ['Sauce Labs Backpack', 'Sauce Labs Bolt T-Shirt', 'Sauce Labs Onesie'],
  saleProduct:     ['Sauce Labs Fleece Jacket', 'Test.allTheThings() T-Shirt (Red)'],
  newArrival:      ['Sauce Labs Bike Light', 'Sauce Labs Backpack'],
  budgetItem:      ['Sauce Labs Bike Light', 'Sauce Labs Onesie'],
  firstName:       ['John', 'Jane', 'Alice', 'Bob'],
  lastName:        ['Doe', 'Smith', 'Johnson', 'Williams'],
  postalCode:      ['10001', '90210', 'SW1A 1AA', 'EC1A 1BB'],
  baseUrl:         ['https://www.saucedemo.com', 'http://localhost:3000'],
  apiKey:          ['demo-api-key-001', 'demo-api-key-002'],
};

async function searchEntities(env, fieldKey, query) {
  var items = MOCK_SEARCH_DATA[fieldKey] || [];
  var q = (query || '').toLowerCase();
  var matched = items.filter(function (n) { return n.toLowerCase().indexOf(q) !== -1; });
  return matched.map(function (n) { return { name: n, humanId: '' }; });
}

async function searchLinkedEntities(env, fieldKey, query, context) {
  return searchEntities(env, fieldKey, query);
}

// -- DB environments (demo: no real DB envs) -----------------------------------
function getDbEnvs() { return []; }

const PORT = 4500;
const FIXTURE_DIR = path.resolve(__dirname, '..', 'cypress', 'fixtures', 'testData');

// Maps env name -> TestData filename stem (for envs that don't follow {env}TestData pattern)
const TESTDATA_OVERRIDES = {
  skeleton: 'skeleton',   // skeleton.json  (no "TestData" suffix)
};

// -- Data helpers -------------------------------------------------------------

function getEnvs() {
  // List all {env}TestData.json files + overrides
  var envs = [];
  var files = fs.readdirSync(FIXTURE_DIR);
  files.forEach(function (f) {
    if (f.endsWith('TestData.json') && !f.startsWith('_tmp_')) {
      envs.push(f.replace('TestData.json', ''));
    }
  });
  // Add overrides
  Object.keys(TESTDATA_OVERRIDES).forEach(function (env) {
    var stem = TESTDATA_OVERRIDES[env];
    if (fs.existsSync(path.join(FIXTURE_DIR, stem + '.json')) && envs.indexOf(env) === -1) {
      envs.push(env);
    }
  });
  return envs.sort();
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('File not found: ' + filePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
}

/**
 * Returns the path to the TestData file for a given env,
 * or null if no matching file exists.
 */
function testDataFilePath(env) {
  var primary = path.join(FIXTURE_DIR, env + 'TestData.json');
  if (fs.existsSync(primary)) return primary;

  var stem = TESTDATA_OVERRIDES[env];
  if (stem) {
    var fallback = path.join(FIXTURE_DIR, stem + '.json');
    if (fs.existsSync(fallback)) return fallback;
  }
  return null;
}

// -- Entity-name extraction / application -------------------------------------

function extractSection(s) {
  return {
    paymentMethods: {
      amexCards: s && s.paymentMethods && s.paymentMethods[0] ? (s.paymentMethods[0].amexCards || '') : '',
      mastercards: s && s.paymentMethods && s.paymentMethods[0] ? (s.paymentMethods[0].mastercards || '') : '',
    },
    direct: {
      businesses: {
        categories: s && s.direct && s.direct[0] && s.direct[0].businesses ? (s.direct[0].businesses.categories || '') : '',
        products: s && s.direct && s.direct[0] && s.direct[0].businesses ? (s.direct[0].businesses.products || '') : '',
        variants: s && s.direct && s.direct[0] && s.direct[0].businesses ? (s.direct[0].businesses.variants || '') : '',
        users: s && s.direct && s.direct[0] && s.direct[0].businesses ? (s.direct[0].businesses.users || '') : '',
      },
      carts: {
        mastercard: s && s.direct && s.direct[0] && s.direct[0].individual && s.direct[0].individual.carts ? (s.direct[0].individual.carts.mastercard || '') : '',
        amex: s && s.direct && s.direct[0] && s.direct[0].individual && s.direct[0].individual.carts ? (s.direct[0].individual.carts.amex || '') : '',
        paypal: s && s.direct && s.direct[0] && s.direct[0].individual && s.direct[0].individual.carts ? (s.direct[0].individual.carts.paypal || '') : '',
        visa: s && s.direct && s.direct[0] && s.direct[0].individual && s.direct[0].individual.carts ? (s.direct[0].individual.carts.visa || '') : '',
      },
    },
    indirect: {
      businesses: {
        categories: s && s.indirect && s.indirect[0] && s.indirect[0].businesses ? (s.indirect[0].businesses.categories || '') : '',
        products: s && s.indirect && s.indirect[0] && s.indirect[0].businesses ? (s.indirect[0].businesses.products || '') : '',
        variants: s && s.indirect && s.indirect[0] && s.indirect[0].businesses ? (s.indirect[0].businesses.variants || '') : '',
        users: s && s.indirect && s.indirect[0] && s.indirect[0].businesses ? (s.indirect[0].businesses.users || '') : '',
      },
      carts: {
        mastercard: s && s.indirect && s.indirect[0] && s.indirect[0].individual && s.indirect[0].individual.carts ? (s.indirect[0].individual.carts.mastercard || '') : '',
        amex: s && s.indirect && s.indirect[0] && s.indirect[0].individual && s.indirect[0].individual.carts ? (s.indirect[0].individual.carts.amex || '') : '',
        paypal: s && s.indirect && s.indirect[0] && s.indirect[0].individual && s.indirect[0].individual.carts ? (s.indirect[0].individual.carts.paypal || '') : '',
        visa: s && s.indirect && s.indirect[0] && s.indirect[0].individual && s.indirect[0].individual.carts ? (s.indirect[0].individual.carts.visa || '') : '',
      },
    },
  };
}

function applySection(data, isNew, values) {
  var target = isNew ? data.new : data;
  if (!target) return;

  if (target.paymentMethods && target.paymentMethods[0]) {
    target.paymentMethods[0].amexCards = values.paymentMethods.amexCards;
    target.paymentMethods[0].mastercards = values.paymentMethods.mastercards;
  }
  if (target.direct && target.direct[0] && target.direct[0].businesses) {
    Object.assign(target.direct[0].businesses, values.direct.businesses);
  }
  if (target.direct && target.direct[0] && target.direct[0].individual && target.direct[0].individual.carts) {
    Object.assign(target.direct[0].individual.carts, values.direct.carts);
  }
  if (target.indirect && target.indirect[0] && target.indirect[0].businesses) {
    Object.assign(target.indirect[0].businesses, values.indirect.businesses);
  }
  if (target.indirect && target.indirect[0] && target.indirect[0].individual && target.indirect[0].individual.carts) {
    Object.assign(target.indirect[0].individual.carts, values.indirect.carts);
  }
}

// -- HTML ---------------------------------------------------------------------

var HTML = '<!DOCTYPE html>\n' +
  '<html lang="en">\n' +
  '<head>\n' +
  '<meta charset="UTF-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
  '<title>Cypress Launchpad | Demo</title>\n' +
  '<link rel="icon" type="image/x-icon" href="/favicon.ico">\n' +
  '<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>\n' +
  '<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>\n' +
  '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n' +
  '</head>\n' +
  '<body style="margin:0;background:#F7F3EE">\n' +
  '<div id="root"></div>\n' +
  '<script type="text/babel" src="/app.js" data-presets="react"></script>\n' +
  '</body>\n' +
  '</html>';

// -- Feature tree builder ------------------------------------------------------

function buildFeatureTree(files) {
  var root = { name: 'features', type: 'dir', children: [] };

  files.forEach(function (filePath) {
    // filePath looks like: cypress/e2e/features/product/purchaseLedger/solo/create.feature
    var relative = filePath.replace('cypress/e2e/features/', '');
    var parts = relative.split('/');
    var current = root;

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var isFile = i === parts.length - 1;

      if (isFile) {
        current.children.push({
          name: part,
          type: 'file',
          path: filePath,
        });
      } else {
        var existing = current.children.find(function (c) { return c.name === part && c.type === 'dir'; });
        if (!existing) {
          existing = { name: part, type: 'dir', children: [] };
          current.children.push(existing);
        }
        current = existing;
      }
    }
  });

  // Sort: directories first, then files, alphabetically
  sortTree(root);
  return root;
}

function sortTree(node) {
  if (!node.children) return;
  node.children.sort(function (a, b) {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}

// -- Tag extraction ------------------------------------------------------------

function extractAllTags() {
  var featureFiles = glob.sync('cypress/e2e/features/**/*.feature', { cwd: path.resolve(__dirname, '..') });
  var tagMap = {};

  featureFiles.forEach(function (file) {
    var fullPath = path.resolve(__dirname, '..', file);
    // Skip directories that happen to end with .feature
    try { if (!fs.statSync(fullPath).isFile()) return; } catch (e) { return; }
    var content = fs.readFileSync(fullPath, 'utf8');
    var lines = content.split('\n');

    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (trimmed.startsWith('@')) {
        var tags = trimmed.split(/\s+/);
        tags.forEach(function (tag) {
          if (tag.startsWith('@')) {
            var tagName = tag.substring(1); // remove @
            if (!tagMap[tagName]) tagMap[tagName] = 0;
            tagMap[tagName]++;
          }
        });
      }
    });
  });

  // Convert to sorted array
  return Object.keys(tagMap).sort().map(function (tag) {
    return { tag: tag, count: tagMap[tag] };
  });
}

// -- Data set mode filter -------------------------------------------------------
// Filters TestData JSON to only include direct, indirect, or both entity sets

function filterTestDataByMode(tdPath, mode) {
  var data = readJson(tdPath);

  if (mode === 'direct') {
    // Clear indirect entities
    if (data.indirect && data.indirect[0]) {
      if (data.indirect[0].businesses) {
        Object.keys(data.indirect[0].businesses).forEach(function (k) { data.indirect[0].businesses[k] = ''; });
      }
      if (data.indirect[0].individual && data.indirect[0].individual.carts) {
        Object.keys(data.indirect[0].individual.carts).forEach(function (k) { data.indirect[0].individual.carts[k] = ''; });
      }
    }
    if (data.new && data.new.indirect && data.new.indirect[0]) {
      if (data.new.indirect[0].businesses) {
        Object.keys(data.new.indirect[0].businesses).forEach(function (k) { data.new.indirect[0].businesses[k] = ''; });
      }
      if (data.new.indirect[0].individual && data.new.indirect[0].individual.carts) {
        Object.keys(data.new.indirect[0].individual.carts).forEach(function (k) { data.new.indirect[0].individual.carts[k] = ''; });
      }
    }
  } else if (mode === 'indirect') {
    // Clear direct entities
    if (data.direct && data.direct[0]) {
      if (data.direct[0].businesses) {
        Object.keys(data.direct[0].businesses).forEach(function (k) { data.direct[0].businesses[k] = ''; });
      }
      if (data.direct[0].individual && data.direct[0].individual.carts) {
        Object.keys(data.direct[0].individual.carts).forEach(function (k) { data.direct[0].individual.carts[k] = ''; });
      }
    }
    if (data.new && data.new.direct && data.new.direct[0]) {
      if (data.new.direct[0].businesses) {
        Object.keys(data.new.direct[0].businesses).forEach(function (k) { data.new.direct[0].businesses[k] = ''; });
      }
      if (data.new.direct[0].individual && data.new.direct[0].individual.carts) {
        Object.keys(data.new.direct[0].individual.carts).forEach(function (k) { data.new.direct[0].individual.carts[k] = ''; });
      }
    }
  }
  // 'both' — no filtering needed

  return data;
}

// -- Issue Logger helpers -------------------------------------------------------
var ISSUE_LOGS_DIR = path.join(__dirname, 'issue-logs');
var ISSUE_FILE = path.join(ISSUE_LOGS_DIR, 'issues.json');

function ensureIssueDir() {
  if (!fs.existsSync(ISSUE_LOGS_DIR)) fs.mkdirSync(ISSUE_LOGS_DIR, { recursive: true });
}

function readIssues() {
  ensureIssueDir();
  if (!fs.existsSync(ISSUE_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(ISSUE_FILE, 'utf8')); } catch (e) { return []; }
}

function writeIssues(issues) {
  ensureIssueDir();
  fs.writeFileSync(ISSUE_FILE, JSON.stringify(issues, null, 2), 'utf8');
}

function getDeviceInfo() {
  var platform = process.platform;
  var platformLabel = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : platform;
  var cpus = os.cpus();
  return {
    platform: platformLabel,
    totalMemGb: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10,
    freeMemGb: Math.round(os.freemem() / (1024 * 1024 * 1024) * 10) / 10,
    cpu: cpus && cpus[0] ? cpus[0].model : 'Unknown',
    hostname: os.hostname(),
    nodeVersion: process.version,
  };
}

// -- Active runs management ----------------------------------------------------

var activeRuns = new Map();

// -- HTTP server --------------------------------------------------------------

function parseBody(req) {
  return new Promise(function (resolve, cancel) {
    var body = '';
    req.on('data', function (chunk) { body += chunk; });
    req.on('end', function () {
      try { resolve(JSON.parse(body)); } catch (e) { cancel(e); }
    });
    req.on('error', cancel);
  });
}

function getQuery(reqUrl) {
  var u = new URL(reqUrl, 'http://localhost');
  var q = {};
  u.searchParams.forEach(function (v, k) { q[k] = v; });
  return q;
}

function sendJson(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

http.createServer(function (req, res) {
  var parsed = new URL(req.url, 'http://localhost');
  var pathname = parsed.pathname;
  var q = getQuery(req.url);

  // GET /
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(HTML);
  }

  // GET /api/envs — list available environments from TestData files
  if (pathname === '/api/envs' && req.method === 'GET') {
    try { return sendJson(res, getEnvs()); }
    catch (e) { return sendJson(res, { ok: false, error: e.message }, 500); }
  }

  // GET /api/device-capacity — device memory info for batch size recommendation
  if (pathname === '/api/device-capacity' && req.method === 'GET') {
    try {
      var os = require('os');
      var totalMemory = Math.round(os.totalmem() / 1024 / 1024 / 1024);
      var freeMemory = Math.round(os.freemem() / 1024 / 1024 / 1024);

      // Recommend batch size based on available memory
      var recommendedBatchSize;
      if (freeMemory > 10) {
        recommendedBatchSize = 3;
      } else if (freeMemory > 8) {
        recommendedBatchSize = 2;
      } else {
        recommendedBatchSize = 1;
      }

      return sendJson(res, {
        ok: true,
        totalMemory: totalMemory,
        freeMemory: freeMemory,
        recommendedBatchSize: recommendedBatchSize,
        platform: process.platform,
      });
    } catch (e) {
      return sendJson(res, { ok: false, error: e.message }, 500);
    }
  }

  // GET /api/data?env=env3 — load data directly from TestData file
  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      var tdPath = testDataFilePath(q.env);
      if (!tdPath) {
        return sendJson(res, { ok: false, error: 'No TestData file for env: ' + q.env }, 404);
      }
      // Auto-update .env file to match selected region
      var envContent = getEnvContent(q.env);
      if (envContent) {
        fs.writeFileSync(path.resolve(__dirname, '..', '.env'), envContent);
        console.log('[env] Updated .env for ' + q.env);
      }
      var data = readJson(tdPath);
      return sendJson(res, {
        ok: true,
        fields: {
          existing: extractSection(data),
          new: extractSection(data.new || {}),
        },
        testDataFile: path.basename(tdPath),
      });
    } catch (e) {
      return sendJson(res, { ok: false, error: e.message }, 500);
    }
  }

  // POST /api/save  { env, fields } — save directly to TestData file
  if (pathname === '/api/save' && req.method === 'POST') {
    parseBody(req).then(function (body) {
      try {
        var tdPath = testDataFilePath(body.env);
        if (!tdPath) throw new Error('No TestData file for env: ' + body.env);
        var data = readJson(tdPath);
        applySection(data, false, body.fields.existing);
        applySection(data, true, body.fields.new);
        writeJson(tdPath, data);
        console.log('[save] ' + path.basename(tdPath));
        sendJson(res, { ok: true, file: path.basename(tdPath) });
      } catch (e) { sendJson(res, { ok: false, error: e.message }, 500); }
    }).catch(function (e) {
      sendJson(res, { ok: false, error: 'Bad request: ' + e.message }, 400);
    });
    return;
  }

  // GET /api/search?env=env3&field=products&q=sta — simple (unlinked) search
  if (pathname === '/api/search' && req.method === 'GET') {
    var env = q.env;
    var field = q.field;
    var query = q.q || '';
    if (!env || !field || !query) {
      return sendJson(res, { ok: false, error: 'Missing env, field, or q parameter' }, 400);
    }
    searchEntities(env, field, query)
      .then(function (names) { sendJson(res, { ok: true, results: names }); })
      .catch(function (e) {
        console.error('[search] Error:', e.message);
        sendJson(res, { ok: false, error: e.message }, 500);
      });
    return;
  }

  // GET /api/search-linked?env=demo1&field=featuredProduct&q=sauce
  // Linked autocomplete: uses sibling entity values as context
  if (pathname === '/api/search-linked' && req.method === 'GET') {
    var env2 = q.env;
    var field2 = q.field;
    var query2 = q.q || '';
    if (!env2 || !field2 || !query2) {
      return sendJson(res, { ok: false, error: 'Missing env, field, or q parameter' }, 400);
    }
    var context = {
      categories: q.categories || '',
      products: q.products || '',
      variants: q.variants || '',
      users: q.users || '',
      fundingModel: q.fundingModel || '',
    };
    var hasContext = context.categories || context.products || context.variants || context.users;
    searchLinkedEntities(env2, field2, query2, context)
      .then(function (results) {
        // If linked search returned results, send them
        if (results.length > 0) {
          return sendJson(res, { ok: true, results: results, linked: !!hasContext });
        }
        // If 0 linked results but had context, fallback to all entities
        if (hasContext) {
          return searchEntities(env2, field2, query2).then(function (allResults) {
            sendJson(res, { ok: true, results: allResults, linked: false, fallback: true });
          });
        }
        // No context and no results
        sendJson(res, { ok: true, results: [], linked: false });
      })
      .catch(function (e) {
        console.error('[search-linked] Error:', e.message);
        sendJson(res, { ok: false, error: e.message }, 500);
      });
    return;
  }

  // GET /api/db-envs — which environments have DB credentials (demo: none)
  if (pathname === '/api/db-envs' && req.method === 'GET') {
    return sendJson(res, getDbEnvs());
  }


  // GET /api/browsers — detect locally installed browsers
  if (pathname === '/api/browsers' && req.method === 'GET') {
    var browsers = [{ name: 'electron', displayName: 'Electron', installed: true }]; // Electron is always available via Cypress
    var platform = process.platform;
    var homeDir = require('os').homedir();

    function checkBrowserExists(paths) {
      return paths.some(function (p) {
        try { return fs.existsSync(p); } catch (e) { return false; }
      });
    }

    function checkCommand(cmd) {
      try { execSync(cmd, { stdio: 'pipe', timeout: 3000 }); return true; } catch (e) { return false; }
    }

    // Define browsers with platform-specific paths and commands
    var browserChecks = [
      {
        name: 'chrome',
        displayName: 'Chrome',
        windows: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
        linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
        darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/local/bin/google-chrome'],
        commands: ['google-chrome --version', 'google-chrome-stable --version', 'chromium --version', 'chromium-browser --version', 'chrome --version']
      },
      {
        name: 'firefox',
        displayName: 'Firefox',
        windows: ['C:\\Program Files\\Mozilla Firefox\\firefox.exe', 'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'],
        linux: ['/usr/bin/firefox', '/snap/bin/firefox'],
        darwin: ['/Applications/Firefox.app/Contents/MacOS/firefox', '/usr/local/bin/firefox'],
        commands: ['firefox --version']
      },
      {
        name: 'edge',
        displayName: 'Edge',
        windows: ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'],
        linux: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/snap/bin/microsoft-edge'],
        darwin: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/usr/local/bin/microsoft-edge'],
        commands: ['microsoft-edge --version', 'microsoft-edge-stable --version']
      }
    ];

    browserChecks.forEach(function (b) {
      var found = false;

      // Try platform-specific file paths first
      if (platform === 'win32' && b.windows) {
        found = checkBrowserExists(b.windows);
      } else if (platform === 'linux' && b.linux) {
        found = checkBrowserExists(b.linux);
      } else if (platform === 'darwin' && b.darwin) {
        found = checkBrowserExists(b.darwin);
      }

      // If not found by path, try commands (fallback for all platforms)
      if (!found && b.commands) {
        found = b.commands.some(checkCommand);
      }

      if (found) {
        browsers.push({ name: b.name, displayName: b.displayName, installed: true });
      }
    });

    return sendJson(res, browsers);
  }

  // GET /favicon.ico
  if (pathname === '/favicon.ico' && req.method === 'GET') {
    var faviconPath = path.resolve(__dirname, '..', 'cypress', 'Data', 'favicon.ico');
    try {
      var favData = fs.readFileSync(faviconPath);
      res.writeHead(200, { 'Content-Type': 'image/x-icon', 'Cache-Control': 'public, max-age=86400' });
      return res.end(favData);
    } catch (e) {
      res.writeHead(404);
      return res.end('favicon not found');
    }
  }

  // GET /app.js
  if (pathname === '/app.js' && req.method === 'GET') {
    var appPath = path.join(__dirname, 'app.js');
    try {
      var appData = fs.readFileSync(appPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      return res.end(appData);
    } catch (e) {
      res.writeHead(404);
      return res.end('app.js not found');
    }
  }

  // ============================================================================
  //  NEW ROUTES — Test Runner Integration
  // ============================================================================

  // GET /api/features — feature file tree as nested JSON
  if (pathname === '/api/features' && req.method === 'GET') {
    try {
      var forceRefresh = q.refresh === '1';
      if (forceRefresh) { cacheDel('featureTree'); cacheDel('allTags'); clearAllCaches(); }
      var cachedTree = cacheGet('featureTree');
      if (cachedTree) return sendJson(res, { ok: true, tree: cachedTree, cached: true });
      var featuresDir = path.resolve(__dirname, '..', 'cypress', 'e2e', 'features');
      var files = glob.sync('cypress/e2e/features/**/*.feature', { cwd: path.resolve(__dirname, '..') })
        .filter(function (f) { try { return fs.statSync(path.resolve(__dirname, '..', f)).isFile(); } catch (e) { return false; } });
      var tree = buildFeatureTree(files, featuresDir);
      cacheSet('featureTree', tree);
      return sendJson(res, { ok: true, tree: tree });
    } catch (e) {
      return sendJson(res, { ok: false, error: e.message }, 500);
    }
  }

  // GET /api/tags — all unique tags with scenario counts
  if (pathname === '/api/tags' && req.method === 'GET') {
    try {
      var forceRefreshTags = q.refresh === '1';
      if (forceRefreshTags) clearAllCaches();
      var cachedTags = cacheGet('allTags');
      if (cachedTags) return sendJson(res, { ok: true, tags: cachedTags, cached: true });
      var allTags = extractAllTags();
      cacheSet('allTags', allTags);
      return sendJson(res, { ok: true, tags: allTags });
    } catch (e) {
      return sendJson(res, { ok: false, error: e.message }, 500);
    }
  }

  // GET /api/specs-by-tag?tag=checkout — matching specs + scenario count
  if (pathname === '/api/specs-by-tag' && req.method === 'GET') {
    try {
      var tag = q.tag;
      if (!tag) return sendJson(res, { ok: false, error: 'Missing tag parameter' }, 400);
      var cacheKey = 'specs:' + tag;
      var cachedSpecs = cacheGet(cacheKey);
      if (cachedSpecs) return sendJson(res, { ok: true, specs: cachedSpecs.specs, scenarioCount: cachedSpecs.scenarioCount, cached: true });
      var specsArray = getSpecsByTag(tag);
      
      // Calculate approximate scenario count by reading the files
      var scenarioCount = 0;
      specsArray.forEach(function(specPath) {
        try {
          var content = fs.readFileSync(specPath, 'utf8');
          var matches = content.match(/Scenario:|Scenario Outline:/g);
          if (matches) scenarioCount += matches.length;
        } catch (e) {}
      });

      var result = { specs: specsArray, scenarioCount: scenarioCount };
      cacheSet(cacheKey, result);
      return sendJson(res, { ok: true, specs: result.specs, scenarioCount: result.scenarioCount });
    } catch (e) {
      return sendJson(res, { ok: false, error: e.message }, 500);
    }
  }

  // GET /api/docker/status — check Docker availability and image existence
  if (pathname === '/api/docker/status' && req.method === 'GET') {
    var dockerAvailable = docker.checkDocker();
    var daemonRunning = dockerAvailable ? docker.checkDockerDaemon() : false;
    var imageExists = daemonRunning ? docker.checkImage() : false;
    var baseExists = daemonRunning ? docker.baseImageExists() : false;
    return sendJson(res, { ok: true, docker: dockerAvailable, daemonRunning: daemonRunning, imageExists: imageExists, baseImageExists: baseExists });
  }

  // GET /api/docker/stats/<runId> — live container CPU/memory stats (one entry per active container)
  if (pathname.startsWith('/api/docker/stats/') && req.method === 'GET') {
    var statsRunId = pathname.split('/').pop();
    var statsRun = activeRuns.get(statsRunId);
    var ids = (statsRun && statsRun._handle && statsRun._handle.getActiveContainerIds)
      ? statsRun._handle.getActiveContainerIds()
      : [];
    if (ids.length === 0) {
      return sendJson(res, { ok: false, error: 'No active containers' }, 404);
    }
    var allStats = ids.map(function (cid) {
      return { containerId: cid.substring(0, 12), stats: docker.getContainerStats(cid) };
    }).filter(function (s) { return s.stats !== null; });
    return sendJson(res, { ok: true, stats: allStats });
  }

  // POST /api/docker/build — build Docker image with SSE progress
  if (pathname === '/api/docker/build' && req.method === 'POST') {
    parseBody(req).then(function (body) {
      var noCache = body.noCache || false;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      function sendSSE(data) {
        res.write('data: ' + JSON.stringify(data) + '\n\n');
      }

      var buildOpts = {
        onProgress: function (current, total) {
          sendSSE({ type: 'progress', current: current, total: total });
        }
      };
      function logLine(line) { sendSSE({ type: 'log', message: line }); }

      var buildFn;
      if (noCache) {
        sendSSE({ type: 'log', message: 'Starting full rebuild (base + npm install + code)...' });
        buildFn = docker.buildBaseImage(logLine, buildOpts);
      } else {
        sendSSE({ type: 'log', message: 'Starting quick rebuild (code only, no npm install)...' });
        buildFn = docker.buildImage(logLine, buildOpts);
      }

      buildFn.then(function () {
        sendSSE({ type: 'done', success: true, message: 'Image built successfully.' });
        res.end();
      }).catch(function (e) {
        sendSSE({ type: 'done', success: false, message: e.message });
        res.end();
      });
    });
    return;
  }

  // POST /api/run/start — start a test run (local or Docker)
  if (pathname === '/api/run/start' && req.method === 'POST') {
    parseBody(req).then(function (body) {
      try {
        var runEnv = body.env || 'env3';
        var envContent = getEnvContent(runEnv);
        if (!envContent) throw new Error('Unknown environment: ' + runEnv);

        var tdPath = testDataFilePath(runEnv);
        if (!tdPath) throw new Error('No TestData file for env: ' + runEnv);

        var runId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        var runMode = body.runMode || 'local';

        var dataSetMode = body.dataSetMode || 'both';

        // If dataSetMode is not 'both', create a filtered temp file
        var actualTdPath = tdPath;
        var tempTdPath = null;
        if (dataSetMode !== 'both') {
          var filtered = filterTestDataByMode(tdPath, dataSetMode);
          tempTdPath = path.join(path.dirname(tdPath), '_tmp_' + runId + '_' + path.basename(tdPath));
          writeJson(tempTdPath, filtered);
          actualTdPath = tempTdPath;
        }

        var run = {
          id: runId,
          env: runEnv,
          runMode: runMode,
          tag: body.tag || null,
          specs: body.specs || [],
          batchSize: body.batchSize || 1,
          browser: body.browser || 'chrome',
          dataSetMode: dataSetMode,
          status: 'running',
          logs: [],
          reportDir: null,
          exitCode: null,
          startTime: new Date().toISOString(),
          sseClients: [],
          _tempTdPath: tempTdPath,
        };

        activeRuns.set(runId, run);

        // Shared log/done callbacks
        function onLog(line) {
          run.logs.push(line);
          run.sseClients.forEach(function (user) {
            try { user.write('data: ' + JSON.stringify({ type: 'log', message: line }) + '\n\n'); }
            catch (e) { /* user disconnected */ }
          });
        }

        function onDone(result) {
          run.status = result.code === 0 ? 'passed' : 'failed';
          run.exitCode = result.code;
          run.reportDir = result.reportDir;
          run.endTime = new Date().toISOString();
          if (run._tempTdPath) {
            try { fs.unlinkSync(run._tempTdPath); } catch (e) { /* ignore */ }
          }
          // Persist full log to disk so it can be viewed later from the Reports drawer
          if (result.reportDir && run.logs.length > 0) {
            try {
              fs.writeFileSync(path.join(result.reportDir, 'run.log'), run.logs.join('\n'), 'utf8');
            } catch (e) { /* non-fatal */ }
          }
          run.sseClients.forEach(function (user) {
            try {
              user.write('data: ' + JSON.stringify({
                type: 'done',
                status: run.status,
                exitCode: result.code,
                reportDir: result.reportDir ? path.basename(result.reportDir) : null,
              }) + '\n\n');
              user.end();
            } catch (e) { /* ignore */ }
          });
          run.sseClients = [];
        }

        if (runMode === 'local' || runMode === 'debug') {
          // -- LOCAL / DEBUG RUN: spawn Cypress directly on the host --
          var projectRoot = path.resolve(__dirname, '..');

          // Write .env file for the environment
          fs.writeFileSync(path.join(projectRoot, '.env'), envContent);
          onLog('[local] Environment set to ' + runEnv);

          // If filtered test data, copy it over the real file temporarily
          if (tempTdPath) {
            var realTdPath = tdPath;
            var backupTdPath = tdPath + '.bak-' + runId;
            fs.copyFileSync(realTdPath, backupTdPath);
            fs.copyFileSync(tempTdPath, realTdPath);
            run._backupTdPath = backupTdPath;
            run._realTdPath = realTdPath;
            onLog('[local] Filtered test data applied (' + dataSetMode + ' mode)');
          }

          // Build the command
          var cmd, args;
          var headed = body.headed === true;
          var debugMode = body.debugMode === true; // cypress open (interactive GUI)
          var headedFlag = headed ? '--headed' : '--headless';
          var modeLabel = headed ? 'headed' : 'headless';

          // Report mode label — shown in folder name and HTML report metadata
          var reportMode = debugMode ? 'debug' : (headed ? 'local-headed' : 'local-headless');
          var tagOrMode = body.tag || (body.specs && body.specs.length > 0 ? 'custom' : 'all');
          var localReportDir = docker.buildReportDir(runEnv, tagOrMode, reportMode);
          var runStartTime = Date.now();
          onLog('[local] Report will be saved to: reports/' + require('path').basename(localReportDir));

          if (debugMode) {
            // cypress open — interactive Test Runner; no --browser flag so Cypress
            // shows its own browser picker where the user can choose at runtime.
            cmd = 'npx';
            args = ['cypress', 'open', '--e2e'];
            onLog('[local] Debug mode — environment set to ' + runEnv);
            onLog('[local] Opening Cypress interactive Test Runner — choose your browser inside Cypress');
            if (body.specs && body.specs.length > 0) {
              onLog('[local] Tip: Select "' + body.specs[0].split('/').pop() + '" in the spec list to start debugging');
            } else if (body.tag) {
              onLog('[local] Tip: Search for "@' + body.tag + '" in the Cypress spec search box');
            }
            onLog('[local] Use time-travel, command log & DevTools in the browser. Click Stop here when done.');
          } else if (body.tag) {
            cmd = 'node';
            // Batch size is always 1 for local runs (sequential — avoids multiple browser windows).
            // test.runner.js reads argv[4] as batchSize; --headed is not used (test.runner.js has headed:true hardcoded).
            args = ['test.runner.js', runEnv, body.tag, '1'];
            if (!headed) args.push('--headless');
            onLog('[local] Running by tag: @' + body.tag + ' (' + modeLabel + ', 1 spec at a time)');
          } else if (body.specs && body.specs.length > 0) {
            cmd = 'npx';
            args = ['cypress', 'run', headedFlag, '--browser', body.browser || 'chrome', '--spec', body.specs.join(',')];
            onLog('[local] Running ' + body.specs.length + ' spec(s) with ' + (body.browser || 'chrome') + ' (' + modeLabel + ')');
          } else {
            cmd = 'npx';
            args = ['cypress', 'run', headedFlag, '--browser', body.browser || 'chrome'];
            onLog('[local] Running all specs with ' + (body.browser || 'chrome') + ' (' + modeLabel + ')');
          }

          onLog('[local] Command: ' + cmd + ' ' + args.join(' '));

          // Build command string to avoid DEP0190: passing args array with shell:true
          // quotes any arg that contains whitespace so paths with spaces work correctly.
          var fullCmd = [cmd].concat(args.map(function(a) {
            return /\s/.test(a) ? '"' + a + '"' : a;
          })).join(' ');

          var child = spawn(fullCmd, [], {
            cwd: projectRoot,
            env: Object.assign({}, process.env, { FORCE_COLOR: '1' }),
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
            // Unix: detached creates a new process group (PGID = child.pid)
            // so killProcessTree can kill the entire tree (shell + cypress + browser)
            // with process.kill(-pid). Not needed on Windows (taskkill /t handles it).
            detached: process.platform !== 'win32',
          });

          run._childProcess = child;

          child.stdout.on('data', function (data) {
            data.toString().split('\n').forEach(function (line) {
              if (line.trim()) onLog(line);
            });
          });

          child.stderr.on('data', function (data) {
            data.toString().split('\n').forEach(function (line) {
              if (line.trim()) onLog(line);
            });
          });

          child.on('close', function (code) {
            // Restore original test data if we backed it up
            if (run._backupTdPath && run._realTdPath) {
              try {
                fs.copyFileSync(run._backupTdPath, run._realTdPath);
                fs.unlinkSync(run._backupTdPath);
              } catch (e) { /* ignore */ }
            }
            onLog('[local] Process exited with code ' + code);

            // Collect cucumber JSON files produced during this run and generate HTML report
            // (skipped for debug/cypress open — it produces no JSON)
            if (!debugMode) {
              try {
                var cucumberSrc = path.join(projectRoot, 'cypress', 'cucumber-json');
                var cucumberDest = path.join(localReportDir, 'cucumber-json');
                if (fs.existsSync(cucumberSrc)) {
                  var newJsonFiles = fs.readdirSync(cucumberSrc).filter(function (f) {
                    if (!f.endsWith('.json')) return false;
                    try { return fs.statSync(path.join(cucumberSrc, f)).mtimeMs >= runStartTime; }
                    catch (e) { return false; }
                  });
                  newJsonFiles.forEach(function (f) {
                    fs.copyFileSync(path.join(cucumberSrc, f), path.join(cucumberDest, f));
                  });
                  if (newJsonFiles.length > 0) {
                    onLog('[local] Collected ' + newJsonFiles.length + ' result file(s) — generating HTML report...');
                    docker.generateHtmlReport(localReportDir, cucumberDest, runEnv, tagOrMode, body.browser || 'chrome', reportMode, onLog);
                  } else {
                    onLog('[local] No result files found for this run (tests may have been stopped early)');
                  }
                }
              } catch (e) {
                onLog('[local] Warning: could not collect report files: ' + e.message);
              }
            }

            onDone({ code: code || 0, reportDir: localReportDir });
          });

          child.on('error', function (err) {
            onLog('[local] Failed to start: ' + err.message);
            onDone({ code: 1, reportDir: localReportDir });
          });

        } else {
          // -- DOCKER RUN --
          var handle = docker.startRun({
            runId: runId,
            env: runEnv,
            envContent: envContent,
            testDataPath: actualTdPath,
            testDataFile: path.basename(tdPath),
            tag: body.tag || null,
            specs: body.specs || [],
            batchSize: body.batchSize || 1,
            browser: body.browser || 'chrome',
            debugMode: body.debugMode === true,
            onLog: onLog,
            onDone: onDone,
          });

          run._handle = handle;
        }

        sendJson(res, { ok: true, runId: runId });
      } catch (e) {
        sendJson(res, { ok: false, error: e.message }, 500);
      }
    }).catch(function (e) {
      sendJson(res, { ok: false, error: 'Bad request: ' + e.message }, 400);
    });
    return;
  }

  // GET /api/run/logs/<runId> — SSE endpoint for live log streaming
  if (pathname.startsWith('/api/run/logs/') && req.method === 'GET') {
    var logRunId = pathname.split('/').pop();
    var run = activeRuns.get(logRunId);
    if (!run) return sendJson(res, { ok: false, error: 'Run not found' }, 404);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send buffered logs first
    run.logs.forEach(function (line) {
      res.write('data: ' + JSON.stringify({ type: 'log', message: line }) + '\n\n');
    });

    // If already done, send done event and close
    if (run.status !== 'running') {
      res.write('data: ' + JSON.stringify({
        type: 'done',
        status: run.status,
        exitCode: run.exitCode,
        reportDir: run.reportDir ? path.basename(run.reportDir) : null,
      }) + '\n\n');
      return res.end();
    }

    // Register for live updates
    run.sseClients.push(res);
    req.on('close', function () {
      var idx = run.sseClients.indexOf(res);
      if (idx !== -1) run.sseClients.splice(idx, 1);
    });
    return;
  }

  // GET /api/run/screenshots/<runId> — list live screenshots for active containers
  if (pathname.startsWith('/api/run/screenshots/') && req.method === 'GET') {
    var ssRunId = pathname.replace('/api/run/screenshots/', '').split('/')[0];
    var ssRun = activeRuns.get(ssRunId);
    if (!ssRun || !ssRun._handle || typeof ssRun._handle.getLiveScreenshotDirs !== 'function') {
      return sendJson(res, []);
    }
    var liveDirs = ssRun._handle.getLiveScreenshotDirs();
    var result = [];
    Object.keys(liveDirs).forEach(function (idx) {
      var entry = liveDirs[idx];
      var screenshots = [];
      try {
        if (fs.existsSync(entry.dir)) {
          var pngFiles = fs.readdirSync(entry.dir).filter(function (f) { return f.endsWith('.png'); });
          pngFiles.forEach(function (f) {
            screenshots.push({
              name: f,
              url: '/live-screenshots/' + ssRunId + '/' + idx + '/' + encodeURIComponent(f),
            });
          });
        }
      } catch (e) { /* ignore — dir may not exist yet */ }
      result.push({ idx: parseInt(idx, 10), specName: entry.specName, screenshots: screenshots });
    });
    return sendJson(res, result);
  }

  // GET /live-screenshots/<runId>/<idx>/<filename> — serve a live screenshot PNG
  if (pathname.startsWith('/live-screenshots/') && req.method === 'GET') {
    var liveSsParts = pathname.replace('/live-screenshots/', '').split('/');
    var lsRunId = liveSsParts[0];
    var lsIdx = liveSsParts[1];
    var lsFilename = liveSsParts.slice(2).join('/');

    // Sanitize filename — only allow safe characters, cancel traversal attempts
    var decodedFilename = '';
    try { decodedFilename = decodeURIComponent(lsFilename); } catch (e) {
      res.writeHead(400);
      return res.end('Invalid filename encoding');
    }
    if (!decodedFilename || decodedFilename.indexOf('..') !== -1 || decodedFilename.indexOf('/') !== -1 || !/^[a-zA-Z0-9._\- ]+$/.test(decodedFilename)) {
      res.writeHead(400);
      return res.end('Invalid filename');
    }
    if (!decodedFilename.endsWith('.png')) {
      res.writeHead(400);
      return res.end('Only PNG files are served here');
    }

    var lsRun = activeRuns.get(lsRunId);
    if (!lsRun || !lsRun._handle || typeof lsRun._handle.getLiveScreenshotDirs !== 'function') {
      res.writeHead(404);
      return res.end('Run not found');
    }
    var lsDirs = lsRun._handle.getLiveScreenshotDirs();
    var lsDirEntry = lsDirs[lsIdx];
    if (!lsDirEntry) {
      res.writeHead(404);
      return res.end('Container index not found');
    }

    var lsFilePath = path.join(lsDirEntry.dir, decodedFilename);
    // Prevent path traversal — verify resolved path is inside the expected dir
    if (!lsFilePath.startsWith(lsDirEntry.dir)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.readFile(lsFilePath, function (err, data) {
      if (err) {
        res.writeHead(404);
        return res.end('Screenshot not found');
      }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
      return res.end(data);
    });
    return;
  }

  // POST /api/run/stop/<runId> — stop a running test
  if (pathname.startsWith('/api/run/stop/') && req.method === 'POST') {
    var stopRunId = pathname.split('/').pop();
    var stopRun = activeRuns.get(stopRunId);
    if (!stopRun) return sendJson(res, { ok: false, error: 'Run not found' }, 404);
    if (stopRun.status !== 'running') return sendJson(res, { ok: false, error: 'Run is not running' }, 400);
    stopRun.status = 'stopped';
    // Stop Docker container or kill local process
    if (stopRun._handle && stopRun._handle.stop) stopRun._handle.stop();
    if (stopRun._childProcess) {
      try {
        killProcessTree(stopRun._childProcess);
      } catch (e) { /* ignore */ }
      // Restore test data backup if exists
      if (stopRun._backupTdPath && stopRun._realTdPath) {
        try {
          fs.copyFileSync(stopRun._backupTdPath, stopRun._realTdPath);
          fs.unlinkSync(stopRun._backupTdPath);
        } catch (e) { /* ignore */ }
      }
    }
    return sendJson(res, { ok: true });
  }

  // GET /api/reports/:name/failures — return failure summary for a specific report
  if (pathname.startsWith('/api/reports/') && pathname.endsWith('/failures') && req.method === 'GET') {
    var failuresReportName = pathname.replace('/api/reports/', '').replace('/failures', '');
    if (!failuresReportName || failuresReportName.includes('..') || failuresReportName.includes('/')) {
      return sendJson(res, { ok: false, error: 'Invalid report name' }, 400);
    }
    try {
      var failureData = docker.getFailures(failuresReportName);
      return sendJson(res, { ok: true, data: failureData });
    } catch (e) {
      return sendJson(res, { ok: false, error: e.message }, 500);
    }
  }

  // GET /api/reports/:name/logs — return full run.log as JSON array of lines
  if (pathname.startsWith('/api/reports/') && pathname.endsWith('/logs') && req.method === 'GET') {
    var logsReportName = pathname.replace('/api/reports/', '').replace('/logs', '');
    if (!logsReportName || logsReportName.includes('..') || logsReportName.includes('/')) {
      return sendJson(res, { ok: false, error: 'Invalid report name' }, 400);
    }
    var logFilePath = path.join(docker.REPORTS_DIR, logsReportName, 'run.log');
    if (!fs.existsSync(logFilePath)) {
      return sendJson(res, { ok: false, error: 'No log file found for this report' }, 404);
    }
    try {
      var logContent = fs.readFileSync(logFilePath, 'utf8');
      var logLines = logContent.split('\n');
      return sendJson(res, { ok: true, lines: logLines, count: logLines.length });
    } catch (e) {
      return sendJson(res, { ok: false, error: e.message }, 500);
    }
  }

  // GET /api/reports/:name/screenshots/* — serve screenshot image files
  if (pathname.startsWith('/api/reports/') && pathname.includes('/screenshots/') && req.method === 'GET') {
    var ssSegments = pathname.replace('/api/reports/', '').split('/screenshots/');
    var ssReportName = ssSegments[0];
    var ssRelPath = ssSegments.slice(1).join('/screenshots/');
    if (!ssReportName || ssReportName.includes('..') || !ssRelPath) {
      res.writeHead(400);
      return res.end('Invalid request');
    }
    // Decode URI components for folder/file names with spaces or special chars
    var decodedRelPath = ssRelPath.split('/').map(decodeURIComponent).join('/');
    var ssFilePath = path.join(docker.REPORTS_DIR, ssReportName, 'screenshots', decodedRelPath);
    // Prevent path traversal
    var ssBaseDir = path.join(docker.REPORTS_DIR, ssReportName, 'screenshots');
    if (!ssFilePath.startsWith(ssBaseDir)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    try {
      if (!fs.existsSync(ssFilePath)) {
        res.writeHead(404);
        return res.end('Screenshot not found');
      }
      var ssData = fs.readFileSync(ssFilePath);
      var ssExt = path.extname(ssFilePath).toLowerCase();
      var ssContentType = ssExt === '.png' ? 'image/png' : ssExt === '.jpg' || ssExt === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ssContentType, 'Cache-Control': 'public, max-age=3600' });
      return res.end(ssData);
    } catch (e) {
      res.writeHead(500);
      return res.end('Error serving screenshot: ' + e.message);
    }
  }

  // GET /api/reports — list past report folders
  if (pathname === '/api/reports' && req.method === 'GET') {
    return sendJson(res, { ok: true, reports: docker.listReports() });
  }

  // DELETE /api/reports/:name — delete a report folder
  if (pathname.startsWith('/api/reports/') && req.method === 'DELETE') {
    var reportName = pathname.replace('/api/reports/', '');
    if (!reportName || reportName.includes('..') || reportName.includes('/')) {
      return sendJson(res, { ok: false, error: 'Invalid report name' }, 400);
    }
    var deleted = docker.deleteReport(reportName);
    if (!deleted) {
      return sendJson(res, { ok: false, error: 'Report not found' }, 404);
    }
    return sendJson(res, { ok: true, message: 'Report deleted' });
  }

  // ============================================================================
  //  ISSUE LOGGER — read-only API; issues are written by Claude via log-issue.js
  // ============================================================================

  // GET /api/issues — list all issues + summary stats
  if (pathname === '/api/issues' && req.method === 'GET') {
    try {
      var issueList = readIssues();
      var byCat = {}, byPlat = {}, bySev = {};
      issueList.forEach(function (iss) {
        byCat[iss.category] = (byCat[iss.category] || 0) + 1;
        var plat = (iss.device && iss.device.platform) || 'Unknown';
        byPlat[plat] = (byPlat[plat] || 0) + 1;
        bySev[iss.severity] = (bySev[iss.severity] || 0) + 1;
      });
      return sendJson(res, { ok: true, issues: issueList, summary: { total: issueList.length, byCategory: byCat, byPlatform: byPlat, bySeverity: bySev } });
    } catch (e) {
      return sendJson(res, { ok: false, error: e.message }, 500);
    }
  }

  // POST /api/shutdown — gracefully shut down the server
  if (pathname === '/api/shutdown' && req.method === 'POST') {
    sendJson(res, { ok: true, message: 'Shutting down...' });
    console.log('\n  Server shutting down...');
    setTimeout(function () { process.exit(0); }, 500);
    return;
  }

  // POST /api/docker/cleanup — remove image and all stopped containers
  if (pathname === '/api/docker/cleanup' && req.method === 'POST') {
    var cleaned = docker.cleanupImage(function (line) {
      console.log(line);
    });
    return sendJson(res, { ok: true, cleaned: cleaned });
  }

  // GET /reports/* — static file server for report HTML
  if (pathname.startsWith('/reports/') && req.method === 'GET') {
    var reportRelPath = pathname.replace('/reports/', '');
    var reportFilePath = path.join(docker.REPORTS_DIR, reportRelPath);
    try {
      if (!fs.existsSync(reportFilePath)) {
        res.writeHead(404);
        return res.end('Report file not found');
      }
      var stat = fs.statSync(reportFilePath);
      if (stat.isDirectory()) {
        // Try serving index.html
        reportFilePath = path.join(reportFilePath, 'index.html');
        if (!fs.existsSync(reportFilePath)) {
          res.writeHead(404);
          return res.end('index.html not found');
        }
      }
      var ext = path.extname(reportFilePath).toLowerCase();
      var contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      };
      var cType = contentTypes[ext] || 'application/octet-stream';
      var reportData = fs.readFileSync(reportFilePath);
      res.writeHead(200, { 'Content-Type': cType });
      return res.end(reportData);
    } catch (e) {
      res.writeHead(500);
      return res.end('Error serving report: ' + e.message);
    }
  }

  res.writeHead(404);
  res.end('Not found');

}).listen(PORT, function () {
  console.log('');
  console.log('  Cypress Launchpad');
  console.log('  ──────────────────────────────────────────────────────');
  console.log('  URL   :  http://localhost:' + PORT);
  console.log('  Data  :  cypress/fixtures/testData/{env}TestData.json');
  console.log('  DB    :  Linked autocomplete (category->product->variant->user->cart)');
  console.log('');
  console.log('  Press Ctrl+C to stop.');
  console.log('');

  // Auto-start Docker if not running, then clean up dangling images
  docker.ensureDockerRunning(function (msg) { console.log(' ', msg); }, function (err) {
    if (err) {
      console.log('  [docker] Warning:', err.message);
    } else {
      docker.pruneDanglingImages(function (msg) { console.log(' ', msg); });
    }
  });
});
