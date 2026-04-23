/**
 * Docker Runner Module
 * -----------------------------------------------------------------
 * Encapsulates all Docker interaction for the Test Data Manager.
 * Uses child_process only — no extra dependencies.
 *
 * Lifecycle per run:
 *   docker build (once) → docker create → docker cp (inject .env + testData)
 *   → docker start → docker logs -f (stream) → docker cp (extract reports)
 *   → docker rm → (after all runs) docker rmi
 */

const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
var glob = require('glob');

const IMAGE_NAME = 'cypress-launchpad-demo-runner';
const BASE_IMAGE_NAME = 'cypress-launchpad-demo-base';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(__dirname, 'reports');
var dockerPath = null; // Cache Docker executable path

// -- Docker availability checks -----------------------------------------------

function findDocker() {
  if (dockerPath) return dockerPath; // Return cached path

  var isWindows = process.platform === 'win32';

  // Windows: Check common Docker Desktop installation paths
  if (isWindows) {
    var commonPaths = [
      'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
      'C:\\Program Files (x86)\\Docker\\Docker\\resources\\bin\\docker.exe',
    ];

    for (var i = 0; i < commonPaths.length; i++) {
      if (fs.existsSync(commonPaths[i])) {
        try {
          execSync('"' + commonPaths[i] + '" --version', { stdio: 'ignore', timeout: 5000 });
          dockerPath = commonPaths[i];
          return dockerPath;
        } catch (e) { }
      }
    }
  }

  // Try via PATH
  var pathMethods = [
    function () { execSync('docker --version', { stdio: 'ignore', timeout: 5000, shell: true, env: process.env }); return 'docker'; },
    function () { execSync('docker ps', { stdio: 'ignore', timeout: 5000, shell: true, env: process.env }); return 'docker'; },
  ];

  for (var j = 0; j < pathMethods.length; j++) {
    try {
      dockerPath = pathMethods[j]();
      return dockerPath;
    } catch (e) { }
  }

  return null;
}

function checkDocker() {
  return findDocker() !== null;
}

// Verify the Docker daemon is actually running (not just the exe exists).
// Uses a short 3s timeout so status checks stay fast.
function checkDockerDaemon() {
  var docker = findDocker();
  if (!docker) return false;
  try {
    var cmd = docker.includes('\\') ? '"' + docker + '"' : docker;
    execSync(cmd + ' info', { timeout: 3000, shell: true, stdio: 'ignore', env: process.env });
    return true;
  } catch (e) {
    return false;
  }
}

function checkImage() {
  try {
    var docker = findDocker();
    if (!docker) return false;
    var cmd = docker.includes('\\') ? '"' + docker + '"' : docker;
    var out = execSync(cmd + ' images -q ' + IMAGE_NAME, { timeout: 10000, shell: true, env: process.env }).toString().trim();
    return out.length > 0;
  } catch (e) {
    return false;
  }
}

// Helper to build docker command with proper path
function dockerCmd(args) {
  var docker = findDocker();
  if (!docker) throw new Error('Docker not found');
  var cmd = docker.includes('\\') ? '"' + docker + '"' : docker;
  return cmd + ' ' + args;
}

// -- Build helpers ------------------------------------------------------------

function runDockerBuild(docker, args, onLog, onProgress) {
  return new Promise(function (resolve, cancel) {
    var totalSteps = 0;
    var currentStep = 0;
    var stepRegex = /^Step (\d+)\/(\d+)/;
    var lastErrors = []; // Capture last 10 error lines for meaningful rejection messages

    function parseAndLog(line, isError) {
      if (!line.trim()) return;
      var match = line.match(stepRegex);
      if (match) {
        currentStep = parseInt(match[1], 10);
        totalSteps = parseInt(match[2], 10);
        if (typeof onProgress === 'function') onProgress(currentStep, totalSteps);
      }
      if (isError) {
        lastErrors.push(line);
        if (lastErrors.length > 10) lastErrors.shift();
      }
      onLog(isError ? '[error] ' + line : line);
    }

    // Build command as a string (not array+shell) to avoid DEP0190 on Windows
    // and correctly handle paths with spaces (e.g. C:\Program Files\Docker\...)
    var cmd = docker.includes('\\') ? '"' + docker + '"' : docker;
    var fullCmd = cmd + ' ' + args.join(' ');

    var proc = exec(fullCmd, {
      cwd: PROJECT_ROOT,
      env: Object.assign({}, process.env, { DOCKER_BUILDKIT: '0' }),
      maxBuffer: 50 * 1024 * 1024 // 50 MB — docker build output can be large
    });

    proc.stdout.on('data', function (data) {
      data.toString().split('\n').forEach(function (line) { parseAndLog(line, false); });
    });

    proc.stderr.on('data', function (data) {
      data.toString().split('\n').forEach(function (line) { parseAndLog(line, true); });
    });

    proc.on('close', function (code) {
      if (code === 0) {
        if (typeof onProgress === 'function') onProgress(totalSteps, totalSteps);
        resolve();
      } else {
        var hint = lastErrors.length
          ? ' Last error: ' + lastErrors[lastErrors.length - 1]
          : '';
        cancel(new Error('Docker build failed with exit code ' + code + hint));
      }
    });

    proc.on('error', function (err) {
      cancel(new Error('Docker build error: ' + err.message));
    });
  });
}

// -- Check if base image exists -----------------------------------------------

function baseImageExists() {
  try {
    var docker = findDocker();
    if (!docker) return false;
    var cmd = docker.includes('\\') ? '"' + docker + '"' : docker;
    var output = execSync(cmd + ' images -q ' + BASE_IMAGE_NAME, { timeout: 5000, shell: true, env: process.env }).toString().trim();
    return output.length > 0;
  } catch (e) {
    return false;
  }
}

// -- Build base image (with npm install) --------------------------------------

// -- Remove dangling (<none>:<none>) images -----------------------------------

// Auto-start Docker Desktop / daemon and wait for it to become ready.
// onLog(msg) — optional logging callback
// callback(err) — null on success, Error if timed out or unsupported
function ensureDockerRunning(onLog, callback) {
  if (checkDockerDaemon()) {
    return callback(null); // already up
  }

  var platform = process.platform;
  if (onLog) onLog('[docker] Docker is not running. Attempting to start Docker...');

  try {
    if (platform === 'darwin') {
      execSync('open -a Docker', { timeout: 5000, shell: true });
    } else if (platform === 'win32') {
      var desktopPaths = [
        'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
        'C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe',
      ];
      var launched = false;
      for (var i = 0; i < desktopPaths.length; i++) {
        if (fs.existsSync(desktopPaths[i])) {
          exec('"' + desktopPaths[i] + '"');
          launched = true;
          break;
        }
      }
      if (!launched) {
        return callback(new Error('Docker Desktop not found. Please start Docker manually and re-run npm run launch.'));
      }
    } else {
      // Linux — try systemctl then service
      var startedOnLinux = false;
      try {
        execSync('sudo systemctl start docker', { timeout: 10000, shell: true, stdio: 'ignore' });
        startedOnLinux = true;
      } catch (e) {
        try {
          execSync('service docker start', { timeout: 10000, shell: true, stdio: 'ignore' });
          startedOnLinux = true;
        } catch (e2) { }
      }
      if (!startedOnLinux) {
        return callback(new Error('Could not start Docker. Please run: sudo systemctl start docker'));
      }
    }
  } catch (e) {
    return callback(new Error('Failed to start Docker: ' + e.message));
  }

  // Poll until daemon responds — max 90 seconds, every 3 seconds
  if (onLog) onLog('[docker] Waiting for Docker daemon to become ready...');
  var elapsed = 0;
  var interval = 3000;
  var maxWait = 90000;

  var timer = setInterval(function () {
    elapsed += interval;
    if (checkDockerDaemon()) {
      clearInterval(timer);
      if (onLog) onLog('[docker] Docker is now running.');
      callback(null);
    } else if (elapsed >= maxWait) {
      clearInterval(timer);
      callback(new Error('Docker did not start within 90 seconds. Please start Docker manually and re-run npm run launch.'));
    } else {
      if (onLog) onLog('[docker] Still waiting for Docker... (' + (elapsed / 1000) + 's elapsed)');
    }
  }, interval);
}

function pruneDanglingImages(onLog) {
  try {
    var docker = findDocker();
    if (!docker) return;
    var cmd = docker.includes('\\') ? '"' + docker + '"' : docker;
    // Get IDs of all dangling images
    var ids = execSync(cmd + ' images -f "dangling=true" -q', { timeout: 10000, shell: true, env: process.env }).toString().trim();
    if (!ids) return; // nothing to clean
    execSync(cmd + ' rmi ' + ids.split('\n').join(' '), { stdio: 'ignore', timeout: 30000, shell: true, env: process.env });
    if (onLog) onLog('[docker] Removed ' + ids.split('\n').length + ' dangling <none>:<none> image(s).');
  } catch (e) {
    // Non-fatal — some images may be in use
    if (onLog) onLog('[docker] Note: Could not remove all dangling images (' + e.message + ')');
  }
}

function buildBaseImage(onLog, options) {
  var opts = options || {};
  var onProgress = opts.onProgress || null;

  var docker = findDocker();
  if (!docker) return Promise.cancel(new Error('Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop/ and restart the Launchpad.'));

  if (!checkDockerDaemon()) {
    return Promise.cancel(new Error('Docker Desktop is not running. Open Docker Desktop, wait for the green icon in the system tray, then try again.'));
  }

  onLog('[docker] Building BASE image (with npm install)...');
  onLog('[docker] This installs all packages. Only needed when package.json changes.');

  var args = ['build', '-f', 'Dockerfile.base', '--no-cache', '-t', BASE_IMAGE_NAME, '.'];

  return runDockerBuild(docker, args, onLog, onProgress).then(function () {
    onLog('[docker] Base image built successfully!');
    // Now build the runner image on top
    onLog('[docker] Now building runner image with your code...');
    var runnerArgs = ['build', '-t', IMAGE_NAME, '.'];
    return runDockerBuild(docker, runnerArgs, onLog, onProgress);
  }).then(function () {
    onLog('[docker] Runner image built successfully!');
    pruneDanglingImages(onLog);
  });
}

// -- Build runner image (code only, no npm) -----------------------------------

function buildImage(onLog, options) {
  var opts = options || {};
  var onProgress = opts.onProgress || null;

  var docker = findDocker();
  if (!docker) return Promise.cancel(new Error('Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop/ and restart the Launchpad.'));

  if (!checkDockerDaemon()) {
    return Promise.cancel(new Error('Docker Desktop is not running. Open Docker Desktop, wait for the green icon in the system tray, then try again.'));
  }

  // Check if base image exists
  if (!baseImageExists()) {
    onLog('[docker] Base image not found. Building base image first (one-time setup)...');
    return buildBaseImage(onLog, opts);
  }

  onLog('[docker] Quick rebuild — copying code only (no npm install)');

  var args = ['build', '-t', IMAGE_NAME, '.'];

  return runDockerBuild(docker, args, onLog, onProgress).then(function () {
    onLog('[docker] Image rebuilt successfully!');
    pruneDanglingImages(onLog);
  });
}

// -- Host-side spec resolution (replaces inline script tag logic) --------------

/**
 * Resolves feature file paths matching a given tag on the HOST filesystem.
 * Mirrors the tag-matching logic that used to run inside the container's temp script.
 *
 * @param {string} tag - Tag name without the @ prefix
 * @returns {string[]} Array of relative spec file paths matching the tag
 */
function resolveSpecsByTag(tag) {
  var featureFiles = glob.sync('cypress/e2e/features/**/*.feature', { cwd: PROJECT_ROOT })
    .filter(function (f) { try { return fs.statSync(path.join(PROJECT_ROOT, f)).isFile(); } catch (e) { return false; } });
  var matchingFiles = [];

  featureFiles.forEach(function (file) {
    var fullPath = path.join(PROJECT_ROOT, file);
    var content;
    try { content = fs.readFileSync(fullPath, 'utf8'); } catch (e) { return; }

    var lines = content.split('\n');
    var currentTags = [];
    var fileHasMatch = false;
    var tagAppliesToFile = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('@')) {
        line.split(/\s+/).forEach(function (t) { currentTags.push(t); });
        continue;
      }
      if (line.startsWith('Feature:')) {
        if (currentTags.indexOf('@' + tag) !== -1) { tagAppliesToFile = true; fileHasMatch = true; }
        currentTags = [];
        continue;
      }
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        if (tagAppliesToFile || currentTags.indexOf('@' + tag) !== -1) { fileHasMatch = true; }
        currentTags = [];
        continue;
      }
      if (!line.startsWith('@')) { currentTags = []; }
    }

    if (fileHasMatch) matchingFiles.push(file);
  });

  return matchingFiles;
}

/**
 * Creates the shared report directory structure for a run and returns its path.
 * Directory layout: cypress-launchpad/reports/{YYYY-MM-DD_HH-MM}_{env}_{safeTag}/
 *   cucumber-json/
 *   screenshots/
 *
 * @param {string} env  - Environment name (e.g. env3)
 * @param {string} tag  - Tag or label (e.g. checkout, custom)
 * @returns {string} Absolute path to the created report directory
 */
function buildReportDir(env, tag, mode) {
  var now = new Date();
  var dateStr = now.getFullYear() + '-' +
    pad(now.getMonth() + 1) + '-' +
    pad(now.getDate()) + '_' +
    pad(now.getHours()) + '-' +
    pad(now.getMinutes());
  var tagPart = (tag || 'custom').replace(/[^a-zA-Z0-9_-]/g, '-');
  var modePart = mode ? '_' + mode.replace(/[^a-zA-Z0-9_-]/g, '-') : '';
  var folderName = dateStr + '_' + env + '_' + tagPart + modePart;
  var reportDir = path.join(REPORTS_DIR, folderName);

  fs.mkdirSync(path.join(reportDir, 'cucumber-json'), { recursive: true });
  fs.mkdirSync(path.join(reportDir, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(reportDir, 'live'), { recursive: true });

  return reportDir;
}

/**
 * Extracts cucumber JSON from a single container after it exits and moves any
 * live-mounted screenshots into the permanent screenshots directory.
 * Screenshots are already on the host via volume mount — no docker cp needed.
 *
 * @param {string}   containerId       - Full Docker container ID
 * @param {number}   idx               - Zero-based spec index (used as filename prefix)
 * @param {string}   cucumberDir       - Absolute path to shared cucumber-json output dir
 * @param {string}   screenshotsDir    - Absolute path to shared screenshots output dir
 * @param {string}   liveScreenshotDir - Absolute path to the per-container live screenshots dir (volume-mounted)
 * @param {Function} onLog             - Log callback
 */
function extractPartialReports(containerId, idx, cucumberDir, screenshotsDir, liveScreenshotDir, onLog, specLabel) {
  var label = specLabel || '[docker]';
  // Step 1: copy JSON files into a temp sub-dir to avoid collisions during rename
  var tmpDir = path.join(cucumberDir, '_tmp_' + idx);
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(
      dockerCmd('cp ' + containerId + ':/app/cypress/cucumber-json/. ' + windowsEscape(tmpDir)),
      { timeout: 30000, shell: true, env: process.env }
    );

    // Step 2: rename each JSON with the idx prefix and move to cucumberDir
    var files = fs.readdirSync(tmpDir).filter(function (f) { return f.endsWith('.json'); });
    files.forEach(function (f) {
      var src = path.join(tmpDir, f);
      var dst = path.join(cucumberDir, idx + '__' + f);
      try { fs.renameSync(src, dst); } catch (e) { /* ignore individual rename failure */ }
    });

    onLog(label + ' Extracted ' + files.length + ' JSON file(s)');
  } catch (e) {
    onLog(label + ' Warning: No cucumber JSON found (' + e.message + ')');
  } finally {
    // Step 3: remove temp dir regardless of outcome
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }

  // Step 4: move live-mounted screenshots into the permanent screenshots dir.
  // Screenshots arrived via volume mount — no docker cp needed.
  // Rename each PNG with the {idx}__ prefix to avoid collisions across containers.
  if (liveScreenshotDir && fs.existsSync(liveScreenshotDir)) {
    try {
      var pngFiles = fs.readdirSync(liveScreenshotDir).filter(function (f) { return f.endsWith('.png'); });
      pngFiles.forEach(function (f) {
        var src = path.join(liveScreenshotDir, f);
        var dst = path.join(screenshotsDir, idx + '__' + f);
        try { fs.renameSync(src, dst); } catch (e) { /* ignore individual rename failure */ }
      });
      if (pngFiles.length > 0) {
        onLog(label + ' Moved ' + pngFiles.length + ' screenshot(s) to screenshots/');
      }
    } catch (e) { /* no screenshots is fine */ }
  }
}

// -- Post-run cleanup ----------------------------------------------------------

/**
 * Prunes all stopped Docker containers after a 5-second delay.
 * Called after a run completes or is stopped by the user.
 * Frees the memory/disk used by completed containers so the next run starts clean.
 *
 * Note: on Windows (Docker Desktop / WSL2), this frees memory within the WSL2 VM.
 * To fully return that memory to Windows, Docker Desktop itself must be restarted.
 */
function scheduleContainerPrune(onLog) {
  setTimeout(function () {
    try {
      execSync(dockerCmd('container prune -f'), { timeout: 15000, shell: true, stdio: 'ignore', env: process.env });
      if (onLog) onLog('[docker] Stopped containers pruned. Memory freed for next run.');
    } catch (e) { /* ignore — Docker may not be running or prune may fail */ }
  }, 5000);
}

// -- Run management ------------------------------------------------------------

/**
 * Create and start a test run in a Docker container.
 *
 * @param {Object} opts
 * @param {string} opts.runId       - Unique run identifier
 * @param {string} opts.env         - Environment name (env3, etc.)
 * @param {string} opts.envContent  - .env file content
 * @param {string} opts.testDataPath - Path to the TestData JSON on host
 * @param {string} opts.testDataFile - Filename of the TestData JSON (e.g. env3TestData.json)
 * @param {string} [opts.tag]       - Tag to filter tests
 * @param {string[]} [opts.specs]   - Specific spec files to run
 * @param {number} [opts.batchSize] - Batch size for parallel runs
 * @param {string} [opts.browser]   - Browser (default: chrome)
 * @param {Function} opts.onLog     - Called with each log line
 * @param {Function} opts.onDone    - Called with { code, reportDir }
 * @returns {{ containerId: string, stop: Function }}
 */
function startRun(opts) {
  var browser = opts.browser || 'chrome';
  var batchSize = Math.max(1, opts.batchSize || 2);
  var docker = findDocker();

  if (!docker) {
    opts.onLog('[docker] Docker not found');
    opts.onDone({ code: 1, reportDir: null });
    return { stop: function () {}, getActiveContainerIds: function () { return []; } };
  }

  // 1. Resolve specs on HOST — no temp scripts, no container-side glob
  var specs;
  if (opts.tag) {
    specs = resolveSpecsByTag(opts.tag);
  } else if (opts.specs && opts.specs.length > 0) {
    specs = opts.specs;
  } else {
    specs = glob.sync('cypress/e2e/features/**/*.feature', { cwd: PROJECT_ROOT })
      .filter(function (f) { try { return fs.statSync(path.join(PROJECT_ROOT, f)).isFile(); } catch (e) { return false; } });
  }

  if (specs.length === 0) {
    opts.onLog('[docker] No matching specs found. Aborting.');
    opts.onDone({ code: 0, reportDir: null });
    return { stop: function () {}, getActiveContainerIds: function () { return []; } };
  }

  opts.onLog('[docker] Found ' + specs.length + ' spec(s). Running up to ' + batchSize + ' in parallel.');
  // Emit full spec list so the UI can display pending/running/done for each spec
  opts.onLog('[docker] spec-manifest: ' + specs.map(function (s, i) {
    return (i + 1) + ':' + path.basename(s, '.feature');
  }).join(','));

  // 2. Create shared report directory once (all containers write here)
  var label = opts.tag || 'custom';
  var reportDir = buildReportDir(opts.env, label, 'docker');
  var cucumberDir = path.join(reportDir, 'cucumber-json');
  var screenshotsDir = path.join(reportDir, 'screenshots');
  var liveScreenshotsBase = path.join(reportDir, 'live');

  // 3. Semaphore state
  var stopped = false;
  var nextIdx = 0;
  var running = 0;
  var overallCode = 0;
  var activeContainerIds = [];
  var allDoneCalled = false;
  var staleImageDetected = false; // set when any container reports "no spec files found"

  // Map of idx -> { dir, specName } for live screenshot polling
  var liveScreenshotDirs = {};

  // 4. allDone — called exactly once when every container has finished
  function allDone() {
    if (allDoneCalled || stopped) return;
    allDoneCalled = true;
    opts.onLog('[docker] All specs complete. Generating merged report...');
    if (staleImageDetected) {
      opts.onLog('[docker] \u26A0 Skipping HTML report — Docker image is missing spec files. Rebuild the image first (Configure step \u2192 Rebuild Image), then re-run.');
    } else {
      generateHtmlReport(reportDir, cucumberDir, opts.env, label, browser, 'docker', opts.onLog);
    }
    opts.onDone({ code: overallCode, reportDir: reportDir });
    // Prune stopped containers 5s after run — frees memory for the next run
    scheduleContainerPrune(opts.onLog);
  }

  // 5. runOneContainer — full lifecycle for a single spec
  function runOneContainer(idx, spec, onComplete) {
    var containerName = 'cypress-run-' + opts.runId + '-' + idx;
    var specLabel = '[spec-' + (idx + 1) + ' | ' + path.basename(spec, '.feature') + ']';
    var containerId = null;
    var logProc = null;
    var tmpEnvPath = path.join(__dirname, '.env.docker-' + opts.runId + '-' + idx);
    var specNotFoundInImage = false; // tracks "no spec files" Cypress error

    function cleanup(cid) {
      try {
        execSync(dockerCmd('rm -f ' + cid), { timeout: 10000, shell: true, stdio: 'ignore', env: process.env });
      } catch (e) { /* ignore */ }
      var pos = activeContainerIds.indexOf(cid);
      if (pos !== -1) activeContainerIds.splice(pos, 1);
    }

    // Step 1: create host directory for live screenshots (volume-mounted into container)
    var liveScreenshotDir = path.join(liveScreenshotsBase, 'spec_' + (idx + 1));
    fs.mkdirSync(liveScreenshotDir, { recursive: true });
    liveScreenshotDirs[idx] = { dir: liveScreenshotDir, specName: path.basename(spec, '.feature') };

    // Step 2: docker create (with volume mount for live screenshots)
    var isWindows = process.platform === 'win32';
    // Dynamic memory allocation: give each container a fair share of free RAM,
    // capped at 4 GB. On 8 GB free + batchSize 2 → 4 GB each; on 4 GB free + batchSize 2 → 2 GB each.
    var memArgs = '';
    if (!isWindows) {
      var freeGb = Math.floor(os.freemem() / (1024 * 1024 * 1024));
      var perContainerGb = Math.min(4, Math.max(1, Math.floor(freeGb / batchSize)));
      memArgs = ' --memory=' + perContainerGb + 'g --memory-swap=' + perContainerGb + 'g';
    }
    var volumeMount = toDockerPath(liveScreenshotDir) + ':/app/cypress/screenshots';
    var createCmd = dockerCmd(
      'create -t --shm-size=1g --name ' + containerName + memArgs +
      ' -v "' + volumeMount + '"' +
      ' ' + IMAGE_NAME +
      ' npx cypress run --spec "' + spec + '" --headless --browser ' + browser
    );
    var cidResult;
    try {
      cidResult = execSync(createCmd, { timeout: 30000, shell: true, env: process.env }).toString().trim();
    } catch (e) {
      // Retry once after removing any stale container with the same name
      try {
        execSync(dockerCmd('rm -f ' + containerName), { timeout: 10000, shell: true, stdio: 'ignore', env: process.env });
        cidResult = execSync(createCmd, { timeout: 30000, shell: true, env: process.env }).toString().trim();
      } catch (e2) {
        opts.onLog(specLabel + ' Failed to create container: ' + e2.message);
        onComplete(1);
        return;
      }
    }
    containerId = cidResult;
    activeContainerIds.push(containerId);

    // Step 3: inject .env
    try {
      fs.writeFileSync(tmpEnvPath, opts.envContent);
      execSync(
        dockerCmd('cp ' + windowsEscape(tmpEnvPath) + ' ' + containerId + ':/app/.env'),
        { timeout: 15000, shell: true, env: process.env }
      );
      fs.unlinkSync(tmpEnvPath);
    } catch (e) {
      opts.onLog(specLabel + ' Failed to inject .env: ' + e.message);
      cleanup(containerId);
      onComplete(1);
      return;
    }

    // Step 4: inject testData
    try {
      execSync(
        dockerCmd('cp ' + windowsEscape(opts.testDataPath) + ' ' + containerId + ':/app/cypress/fixtures/testData/' + opts.testDataFile),
        { timeout: 15000, shell: true, env: process.env }
      );
    } catch (e) {
      opts.onLog(specLabel + ' Failed to inject testData: ' + e.message);
      cleanup(containerId);
      onComplete(1);
      return;
    }

    // Step 5: docker start
    try {
      execSync(dockerCmd('start ' + containerId), { timeout: 15000, shell: true, env: process.env });
      opts.onLog(specLabel + ' Container started.');
    } catch (e) {
      opts.onLog(specLabel + ' Failed to start container: ' + e.message);
      cleanup(containerId);
      onComplete(1);
      return;
    }

    // Step 6: stream logs (non-blocking — exec returns immediately, streams async)
    var logCmd = dockerCmd('logs -f ' + containerId);
    logProc = exec(logCmd, { timeout: 3600000, shell: true, env: process.env });
    function handleLogLine(line) {
      var stripped = line.replace(/\x1b\[[0-9;]*m/g, '').trim(); // strip ANSI for detection
      if (stripped.includes("Can't run because") && stripped.includes('no spec files')) {
        specNotFoundInImage = true;
      }
      if (line.trim()) opts.onLog(specLabel + ' ' + line);
    }
    logProc.stdout.on('data', function (data) {
      data.toString().split('\n').forEach(handleLogLine);
    });
    logProc.stderr.on('data', function (data) {
      data.toString().split('\n').forEach(function (line) {
        var trimmed = line.trim();
        // Filter out Docker's "No such container" noise — this fires when the
        // container exits before docker logs -f fully connects, not a real error.
        if (trimmed && !trimmed.includes('No such container') && !trimmed.includes('Error response from daemon')) {
          handleLogLine(line);
        }
      });
    });

    // Step 7: wait for container exit code
    var exitCode = 1;
    var waitProc = exec(dockerCmd('wait ' + containerId), { timeout: 3600000, shell: true, env: process.env });
    waitProc.stdout.on('data', function (data) {
      var s = data.toString().trim();
      if (s) exitCode = parseInt(s, 10) || 0;
    });

    waitProc.on('close', function () {
      if (logProc) { try { logProc.kill(); } catch (e) { /* ignore */ } }
      if (stopped) {
        cleanup(containerId);
        return;
      }
      // Warn if Cypress couldn't find the spec inside the container — image is stale
      if (specNotFoundInImage) {
        staleImageDetected = true;
        opts.onLog(specLabel + ' \u26A0 SPEC NOT FOUND IN IMAGE: "' + spec + '" does not exist inside the container.');
        opts.onLog(specLabel + ' \u26A0 The Docker image was built before this file was added. Please REBUILD the image in the Configure step.');
        opts.onLog('[docker] \u26A0 Rebuild required: one or more spec files are missing from the Docker image. Go to Step 3 (Configure) \u2192 Rebuild Image.');
      }
      // Step 8: extract partial reports from this container
      extractPartialReports(containerId, idx, cucumberDir, screenshotsDir, liveScreenshotDir, opts.onLog, specLabel);
      // Step 9: remove container
      cleanup(containerId);
      opts.onLog(specLabel + ' Done (exit ' + exitCode + ')');
      // Summary line in the general log area (no spec prefix → shown above panels)
      var status = exitCode === 0 ? '\u2713 PASSED' : '\u2717 FAILED';
      opts.onLog('[docker] Spec ' + (idx + 1) + ' | ' + path.basename(spec, '.feature') + ' \u2014 ' + status);
      onComplete(exitCode);
    });

    waitProc.on('error', function (e) {
      opts.onLog(specLabel + ' Wait error: ' + e.message);
      if (logProc) { try { logProc.kill(); } catch (ex) { /* ignore */ } }
      cleanup(containerId);
      onComplete(1);
    });
  }

  // 6. scheduleNext — fill semaphore slots up to batchSize
  function scheduleNext() {
    if (stopped) return;
    while (running < batchSize && nextIdx < specs.length) {
      var idx = nextIdx++;
      running++;
      runOneContainer(idx, specs[idx], function (exitCode) {
        if (exitCode !== 0) overallCode = exitCode;
        running--;
        if (!stopped) scheduleNext();
        if (running === 0 && nextIdx >= specs.length) allDone();
      });
    }
  }

  // 7. stop — kill all active containers immediately
  function stop() {
    stopped = true;
    var toKill = activeContainerIds.slice();
    opts.onLog('[docker] Stopping ' + toKill.length + ' container(s)...');
    toKill.forEach(function (cid) {
      try { execSync(dockerCmd('kill ' + cid), { timeout: 10000, shell: true, stdio: 'ignore', env: process.env }); } catch (e) { /* ignore */ }
      try { execSync(dockerCmd('rm -f ' + cid), { timeout: 10000, shell: true, stdio: 'ignore', env: process.env }); } catch (e) { /* ignore */ }
    });
    activeContainerIds = [];
    // Prune stopped containers 5s after stop — frees memory for the next run
    scheduleContainerPrune(opts.onLog);
  }

  // Kick off the first wave of containers
  scheduleNext();

  return {
    stop: stop,
    getActiveContainerIds: function () { return activeContainerIds.slice(); },
    getLiveScreenshotDirs: function () { return liveScreenshotDirs; },
  };
}

// -- HTML report generation ----------------------------------------------------

function generateHtmlReport(reportDir, cucumberDir, env, tag, browser, mode, onLog) {
  try {
    var report = require('multiple-cucumber-html-reporter');
    var htmlDir = path.join(reportDir, 'html');
    var modeLabel = mode || 'docker';
    var isDocker = modeLabel === 'docker';
    var isHeaded = modeLabel === 'local-headed';
    var isDebug = modeLabel === 'debug';
    var deviceLabel = isDocker ? 'Docker Container' : 'Local Machine';
    var displayMode = isDocker ? 'Headless (Docker)' : isHeaded ? 'Headed' : isDebug ? 'Debug (cypress open)' : 'Headless';

    report.generate({
      jsonDir: cucumberDir,
      reportPath: htmlDir,
      staticFilePath: false,
      openReportInBrowser: false,
      displayDuration: true,
      displayReportTime: true,
      saveCollectionJSON: true,
      disableLog: true,
      pageTitle: 'Automation Report - ' + env + ' @' + tag,
      reportName: 'Automation Report - ' + env,
      metadata: {
        browser: { name: browser || 'chrome', version: isDocker ? 'headless' : (isHeaded ? 'headed' : 'headless') },
        device: deviceLabel,
        platform: { name: isDocker ? 'linux' : process.platform, version: modeLabel },
      },
      customData: {
        title: 'Run Information',
        data: [
          { label: 'Project', value: 'SauceDemo' },
          { label: 'Region', value: env },
          { label: 'Tag / Mode', value: tag ? '@' + tag : 'custom' },
          { label: 'Run Mode', value: modeLabel },
          { label: 'Display', value: displayMode },
          { label: 'Timestamp', value: new Date().toISOString() },
        ],
      },
    });

    onLog('[local] HTML report generated at reports/' + path.basename(reportDir) + '/html/');
  } catch (e) {
    onLog('[local] Warning: HTML report generation failed: ' + e.message);
    onLog('[local] You can generate manually: npm run report');
  }
}

// -- Docker cleanup (remove image) ---------------------------------------------

function cleanupImage(onLog) {
  try {
    // Remove all stopped containers using this image
    var containers = execSync(dockerCmd('ps -a -q --filter ancestor=' + IMAGE_NAME), { timeout: 10000, shell: true }).toString().trim();
    if (containers) {
      execSync(dockerCmd('rm -f ' + containers.split('\n').join(' ')), { stdio: 'ignore', timeout: 15000, shell: true });
      if (onLog) onLog('[docker] Removed stopped containers.');
    }

    // Remove the image
    execSync(dockerCmd('rmi -f ' + IMAGE_NAME), { stdio: 'ignore', timeout: 30000, shell: true });
    if (onLog) onLog('[docker] Image ' + IMAGE_NAME + ' removed.');
    return true;
  } catch (e) {
    if (onLog) onLog('[docker] Cleanup warning: ' + e.message);
    return false;
  }
}

// -- List past reports ---------------------------------------------------------

function listReports() {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  var folders = fs.readdirSync(REPORTS_DIR).filter(function (f) {
    return fs.statSync(path.join(REPORTS_DIR, f)).isDirectory();
  });
  return folders.sort().reverse().map(function (f) {
    var reportDir = path.join(REPORTS_DIR, f);
    var hasHtml = fs.existsSync(path.join(reportDir, 'html', 'index.html'));
    var hasLogs = fs.existsSync(path.join(reportDir, 'run.log'));
    return { name: f, path: reportDir, hasHtml: hasHtml, hasLogs: hasLogs };
  });
}

// -- Container stats -----------------------------------------------------------

function getContainerStats(containerId) {
  try {
    var docker = findDocker();
    if (!docker) return null;
    var dockerExe = docker.includes(' ') ? '"' + docker + '"' : docker;
    var out = execSync(
      dockerExe + ' stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.PIDs}}" ' + containerId,
      { timeout: 5000, shell: true }
    ).toString().trim();

    var parts = out.split('|');
    return {
      cpu: parts[0] || '0%',
      memory: parts[1] || '0B / 0B',
      memPercent: parts[2] || '0%',
      netIO: parts[3] || '0B / 0B',
      pids: parts[4] || '0',
    };
  } catch (e) {
    return null;
  }
}

// -- Failures report -----------------------------------------------------------

/**
 * Reads all cucumber JSON files for a report and returns structured failure data.
 *
 * @param {string} reportName - The report folder name (no path separators)
 * @returns {{ failures: Array, totalScenarios: number, passedScenarios: number, failedScenarios: number }}
 */
function getFailures(reportName) {
  var cucumberDir = path.join(REPORTS_DIR, reportName, 'cucumber-json');
  var screenshotsDir = path.join(REPORTS_DIR, reportName, 'screenshots');

  if (!fs.existsSync(cucumberDir)) {
    return { failures: [], totalScenarios: 0, passedScenarios: 0, failedScenarios: 0 };
  }

  var jsonFiles = fs.readdirSync(cucumberDir).filter(function (f) {
    return f.endsWith('.json');
  });

  var totalScenarios = 0;
  var failedScenarios = 0;
  var failures = [];

  jsonFiles.forEach(function (jsonFile) {
    var fullPath = path.join(cucumberDir, jsonFile);
    var content;
    try {
      content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (e) {
      return; // skip malformed JSON
    }

    if (!Array.isArray(content)) return;

    content.forEach(function (feature) {
      var featureName = feature.name || feature.id || 'Unknown Feature';
      var elements = feature.elements || [];

      elements.forEach(function (scenario) {
        // Skip background steps
        if (scenario.type === 'background') return;

        totalScenarios++;

        var steps = scenario.steps || [];
        var scenarioFailed = steps.some(function (step) {
          return step.result && step.result.status === 'failed';
        });

        if (!scenarioFailed) return;

        failedScenarios++;

        // Find the first failed step
        var failedStep = null;
        steps.forEach(function (step) {
          if (!failedStep && step.result && step.result.status === 'failed') {
            failedStep = {
              keyword: (step.keyword || '').trim(),
              name: step.name || '',
              errorMessage: (step.result.error_message || '').trim(),
            };
          }
        });

        // Find matching screenshot(s) for this specific scenario
        var screenshots = [];
        if (fs.existsSync(screenshotsDir)) {
          // Normalize scenario name for fuzzy matching against screenshot filenames
          var scenarioNameNorm = (scenario.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          var featureFolders = fs.readdirSync(screenshotsDir);
          featureFolders.forEach(function (folder) {
            var folderPath = path.join(screenshotsDir, folder);
            if (!fs.statSync(folderPath).isDirectory()) return;
            var files = fs.readdirSync(folderPath);
            files.forEach(function (file) {
              if (!(file.endsWith('.png') || file.endsWith('.jpg'))) return;
              // Match screenshot to scenario: normalize filename and check if it contains the scenario name
              var fileNorm = file.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              if (scenarioNameNorm && fileNorm.includes(scenarioNameNorm.substring(0, 120))) {
                screenshots.push({
                  folder: folder,
                  file: file,
                  apiPath: '/api/reports/' + reportName + '/screenshots/' + encodeURIComponent(folder) + '/' + encodeURIComponent(file),
                });
              }
            });
          });
        }

        failures.push({
          featureName: featureName,
          scenarioName: scenario.name || 'Unknown Scenario',
          failedStep: failedStep,
          screenshots: screenshots,
        });
      });
    });
  });

  var passedScenarios = totalScenarios - failedScenarios;

  return {
    failures: failures,
    totalScenarios: totalScenarios,
    passedScenarios: passedScenarios,
    failedScenarios: failedScenarios,
  };
}

// -- Delete a report folder ----------------------------------------------------

function deleteReport(reportName) {
  var reportPath = path.join(REPORTS_DIR, reportName);
  if (!fs.existsSync(reportPath)) return false;
  fs.rmSync(reportPath, { recursive: true, force: true });
  return true;
}

// -- Utilities -----------------------------------------------------------------

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function shellEscape(s) {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// Windows-aware escape for paths with spaces (uses double quotes)
function windowsEscape(s) {
  if (process.platform === 'win32') {
    return '"' + s.replace(/"/g, '\\"') + '"';
  }
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Converts a host filesystem path to a Docker-compatible volume mount path.
 * Docker requires forward slashes in -v flags on all platforms.
 * On Windows, also converts C:\foo\bar to C:/foo/bar (drive letter preserved).
 *
 * @param {string} hostPath - Absolute host path (may contain backslashes on Windows)
 * @returns {string} Docker-safe path string (forward slashes, no trailing slash)
 */
function toDockerPath(hostPath) {
  // Replace all backslashes with forward slashes
  return hostPath.replace(/\\/g, '/');
}

module.exports = {
  IMAGE_NAME: IMAGE_NAME,
  REPORTS_DIR: REPORTS_DIR,
  checkDocker: checkDocker,
  checkDockerDaemon: checkDockerDaemon,
  checkImage: checkImage,
  buildImage: buildImage,
  buildBaseImage: buildBaseImage,
  baseImageExists: baseImageExists,
  startRun: startRun,
  getContainerStats: getContainerStats,
  cleanupImage: cleanupImage,
  listReports: listReports,
  deleteReport: deleteReport,
  getFailures: getFailures,
  pruneDanglingImages: pruneDanglingImages,
  ensureDockerRunning: ensureDockerRunning,
  buildReportDir: buildReportDir,
  generateHtmlReport: generateHtmlReport,
};
