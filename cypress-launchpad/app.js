// Cypress Launchpad — React component (Babel standalone, no build step)
// React and ReactDOM are globals from CDN

function Spinner({ dark }) {
  var stroke = dark ? '#6366F1' : 'white';
  var trackStroke = dark ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.3)';
  return React.createElement(
    'svg',
    { className: 'spin-icon', width: '13', height: '13', viewBox: '0 0 24 24', fill: 'none' },
    React.createElement('circle', { cx: '12', cy: '12', r: '10', stroke: trackStroke, strokeWidth: '3' }),
    React.createElement('path', { d: 'M12 2a10 10 0 0 1 10 10', stroke: stroke, strokeWidth: '3', strokeLinecap: 'round' })
  );
}

// ============================================================================
//  CONSTANTS
// ============================================================================

const CARDS = [
  { id: 'users', title: 'User Accounts', accent: '#6366F1', path: ['users'], fields: [{ label: 'Admin User', key: 'adminUser' }, { label: 'Standard User', key: 'standardUser' }, { label: 'Guest User', key: 'guestUser' }, { label: 'Locked User', key: 'lockedUser' }] },
  { id: 'products', title: 'Products', accent: '#06B6D4', path: ['products'], fields: [{ label: 'Featured Product', key: 'featuredProduct' }, { label: 'Sale Product', key: 'saleProduct' }, { label: 'New Arrival', key: 'newArrival' }, { label: 'Budget Item', key: 'budgetItem' }] },
  { id: 'checkout', title: 'Checkout Data', accent: '#8B5CF6', path: ['checkout'], fields: [{ label: 'First Name', key: 'firstName' }, { label: 'Last Name', key: 'lastName' }, { label: 'Postal Code', key: 'postalCode' }] },
  { id: 'config', title: 'App Config', accent: '#F472B6', path: ['config'], fields: [{ label: 'Base URL', key: 'baseUrl' }, { label: 'API Key', key: 'apiKey' }] },
];

var CART_BIZ_MAP = {};

const STEPS = [
  { num: 1, label: 'Entities', icon: '\u25C8' },
  { num: 2, label: 'Features', icon: '\u2630' },
  { num: 3, label: 'Configure', icon: '\u2699' },
  { num: 4, label: 'Run Tests', icon: '\u25B6' },
  { num: 5, label: 'Reports', icon: '\u2691' },
];

// ============================================================================
//  ANSI PARSER — converts terminal escape codes to colored spans
// ============================================================================

var ANSI_COLORS = {
  '30': '#4b4b67', '31': '#ef4444', '32': '#22c55e', '33': '#eab308',
  '34': '#3b82f6', '35': '#a855f7', '36': '#06b6d4', '37': '#f0f0f5',
  '90': '#6b7280', '91': '#fca5a5', '92': '#86efac', '93': '#fde68a',
  '94': '#93c5fd', '95': '#d8b4fe', '96': '#67e8f9', '97': '#ffffff',
};

function parseAnsi(text) {
  // Strip ANSI escape sequences and return segments with colors
  // Handles multiple formats:
  //   \x1b[35m   — standard ANSI escape
  //   \u001b[35m — unicode escape
  //   ←[35m      — Windows/docker raw output
  //   [35m       — bare escape codes (ESC byte stripped)
  var segments = [];
  var currentColor = null;
  var isBold = false;

  // Normalize: replace various ESC representations with a marker
  var cleaned = text
    .replace(/\u001b/g, '\x1b')
    .replace(/\x1b/g, '\x00ESC')
    .replace(/←/g, '\x00ESC')
    .replace(/␛/g, '\x00ESC');

  // Remove non-color ANSI sequences (cursor movement, screen erase, etc.)
  // These end in letters other than 'm' — e.g. ESC[?25l (cursor hide), ESC[2J (clear screen)
  cleaned = cleaned.replace(/\x00ESC\[[0-9;?]*[A-LN-Za-ln-z]/g, '');

  // Match both ESC[...m and bare [...]m patterns (when ESC byte was lost)
  var regex = /(?:\x00ESC|\u001b)?\[([0-9;]*)m/g;
  var lastIndex = 0;
  var match;

  while ((match = regex.exec(cleaned)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      var chunk = cleaned.substring(lastIndex, match.index);
      if (chunk) segments.push({ text: chunk, color: currentColor, bold: isBold });
    }
    lastIndex = regex.lastIndex;

    // Parse the escape code(s)
    var codes = match[1].split(';');
    codes.forEach(function (code) {
      if (code === '0' || code === '') { currentColor = null; isBold = false; }
      else if (code === '1') { isBold = true; }
      else if (ANSI_COLORS[code]) { currentColor = ANSI_COLORS[code]; }
      else if (code === '39') { currentColor = null; }
    });
  }

  // Add remaining text
  if (lastIndex < cleaned.length) {
    var remaining = cleaned.substring(lastIndex);
    if (remaining) segments.push({ text: remaining, color: currentColor, bold: isBold });
  }

  // Cleanup: remove any leftover ESC markers and residual escape sequences from segment text
  segments.forEach(function (seg) {
    seg.text = seg.text
      .replace(/\x00ESC\[[0-9;?]*[A-Za-z]/g, '')  // residual escape sequences
      .replace(/\x00ESC/g, '');                      // orphaned ESC markers
  });

  // Filter out empty segments
  segments = segments.filter(function (seg) { return seg.text.length > 0; });

  // If nothing parsed, return raw text
  if (segments.length === 0) {
    segments.push({ text: text, color: null, bold: false });
  }

  return segments;
}

// Strips all ANSI/VT100 escape sequences for clean clipboard copy.
// Covers: color codes (ESC[35m), cursor controls (ESC[?25l), and the
// visible ␛ symbol that some terminals render instead of the ESC byte.
function stripAnsi(text) {
  return text
    .replace(/(\x1b|\u001b|␛)\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/←\[[0-9;?]*[A-Za-z]/g, '');
}

function getLineType(text) {
  var lower = text.toLowerCase();
  // Check for pass/fail indicators
  if (/\bpassing\b|\bpassed\b|\u2713|\u2714|✓/.test(text)) return 'pass';
  if (/\bfailing\b|\bfailed\b|\u2717|\u2718|✗|Error:|AssertionError|CypressError/.test(text)) return 'fail';
  if (/\bpending\b|\bskipped\b/.test(lower)) return 'pending';
  if (/\bwarn\b|\bdeprecated\b|\bwarning\b/.test(lower)) return 'warn';
  if (/^\s*\[docker\]/.test(text)) return 'docker';
  return null;
}

function formatElapsed(secs) {
  var m = Math.floor(secs / 60);
  var s = secs % 60;
  return (m > 0 ? m + 'm ' : '') + String(s).padStart(2, '0') + 's';
}

// ============================================================================
//  HELPERS
// ============================================================================

function emptyFields() {
  return {
    users: { adminUser: '', standardUser: '', guestUser: '', lockedUser: '' },
    products: { featuredProduct: '', saleProduct: '', newArrival: '', budgetItem: '' },
    checkout: { firstName: '', lastName: '', postalCode: '' },
    config: { baseUrl: '', apiKey: '' },
  };
}

// ============================================================================
//  MAIN APP COMPONENT
// ============================================================================

function TestDataManager() {
  // -- Step state --
  const [currentStep, setCurrentStep] = React.useState(1);

  // -- Step 1: Entity state (existing) --
  const [envs, setEnvs] = React.useState([]);
  const [selectedEnv, setSelectedEnv] = React.useState('');
  const [hasData, setHasData] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('existing');
  const [testDataFile, setTestDataFile] = React.useState(null);
  const [existingFields, setExistingFields] = React.useState(emptyFields());
  const [newFields, setNewFields] = React.useState(emptyFields());
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [alert, setAlert] = React.useState(null);
  const [tourActive, setTourActive] = React.useState(false);
  const [dbEnvs, setDbEnvs] = React.useState([]);
  const alertTimerRef = React.useRef(null);

  // -- Step 2: Feature selector state --
  const [featureMode, setFeatureMode] = React.useState('tree'); // 'tree' or 'tag'
  const [allTags, setAllTags] = React.useState([]);
  const [tagSearch, setTagSearch] = React.useState('');
  const [selectedTag, setSelectedTag] = React.useState('');
  const [tagSpecs, setTagSpecs] = React.useState({ specs: [], scenarioCount: 0 });
  const [tagSpecsLoading, setTagSpecsLoading] = React.useState(false);
  const [featureTree, setFeatureTree] = React.useState(null);
  const [selectedSpecs, setSelectedSpecs] = React.useState([]);
  const [loadingFeatures, setLoadingFeatures] = React.useState(false);

  // -- Step 3: Run config state --
  const [runMode, setRunMode] = React.useState('local'); // 'local' | 'docker' | 'debug'
  const [batchSize, setBatchSize] = React.useState(2);
  const [browser, setBrowser] = React.useState('chrome');
  const [dataSetMode, setDataSetMode] = React.useState('both'); // 'direct', 'indirect', 'both'
  const [headed, setHeaded] = React.useState(false); // headed mode toggle (local only)
  const [installedBrowsers, setInstalledBrowsers] = React.useState(null); // detected local browsers
  const [deviceCapacity, setDeviceCapacity] = React.useState(null); // device memory info

  // -- Step 4: Run state --
  const [dockerStatus, setDockerStatus] = React.useState(null);
  const [buildingImage, setBuildingImage] = React.useState(false);
  const [buildLogs, setBuildLogs] = React.useState([]);
  const [buildProgress, setBuildProgress] = React.useState({ current: 0, total: 0 });
  const buildStartRef = React.useRef(null);
  const [buildElapsed, setBuildElapsed] = React.useState(0);
  const [runId, setRunId] = React.useState(null);
  const [runStatus, setRunStatus] = React.useState(null); // 'running', 'passed', 'failed', 'stopped'
  const [runLogs, setRunLogs] = React.useState([]);
  const [runReportDir, setRunReportDir] = React.useState(null);
  const logEndRef = React.useRef(null);
  const eventSourceRef = React.useRef(null);

  // -- Reports state (accessible from anywhere via drawer) --
  const [pastReports, setPastReports] = React.useState([]);
  const [showReports, setShowReports] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState('reports');
  const reportsRefreshRef = React.useRef(null);

  // -- Browser conflict modal state (shown when Chrome is running on macOS during debug) --

  // -- Alert helpers --
  function showAlert(msg, type) {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setAlert({ msg, type });
    if (type !== 'err') {
      alertTimerRef.current = setTimeout(() => setAlert(null), 5000);
    }
  }
  function dismissAlert() {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setAlert(null);
  }

  // -- Field state helpers --
  function getVal(section, cardPath, fieldKey) {
    var src = section === 'existing' ? existingFields : newFields;
    var node = src;
    for (var i = 0; i < cardPath.length; i++) {
      node = node[cardPath[i]];
      if (!node) return '';
    }
    return node[fieldKey] || '';
  }

  function setVal(section, cardPath, fieldKey, value) {
    var setter = section === 'existing' ? setExistingFields : setNewFields;
    setter(function (prev) {
      var next = JSON.parse(JSON.stringify(prev));
      var node = next;
      for (var i = 0; i < cardPath.length; i++) {
        node = node[cardPath[i]];
      }
      node[fieldKey] = value;
      return next;
    });
  }

  function getBusinessContext(section, cardId) {
    var fields = section === 'existing' ? existingFields : newFields;
    var bizCardId = CART_BIZ_MAP[cardId];
    if (bizCardId) {
      var prefix = cardId.startsWith('direct') ? 'direct' : 'indirect';
      return {
        categories: (fields[prefix] && fields[prefix].businesses && fields[prefix].businesses.categories) || '',
        products: (fields[prefix] && fields[prefix].businesses && fields[prefix].businesses.products) || '',
        variants: (fields[prefix] && fields[prefix].businesses && fields[prefix].businesses.variants) || '',
        users: (fields[prefix] && fields[prefix].businesses && fields[prefix].businesses.users) || '',
      };
    }
    var card = CARDS.find(function (c) { return c.id === cardId; });
    if (card && card.path.length === 2) {
      var prefix2 = card.path[0];
      var group = card.path[1];
      return {
        categories: (fields[prefix2] && fields[prefix2][group] && fields[prefix2][group].categories) || '',
        products: (fields[prefix2] && fields[prefix2][group] && fields[prefix2][group].products) || '',
        variants: (fields[prefix2] && fields[prefix2][group] && fields[prefix2][group].variants) || '',
        users: (fields[prefix2] && fields[prefix2][group] && fields[prefix2][group].users) || '',
      };
    }
    return { categories: '', products: '', variants: '', users: '' };
  }

  // -- On mount: fetch envs + DB envs --
  React.useEffect(function () {
    fetch('/api/envs')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        setEnvs(data);
      })
      .catch(function (e) { showAlert('Failed to load envs: ' + e.message, 'err'); });

    fetch('/api/db-envs')
      .then(function (r) { return r.json(); })
      .then(function (data) { setDbEnvs(data); })
      .catch(function () { });

    fetch('/api/browsers')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        setInstalledBrowsers(data);
        if (data.length > 0 && !data.some(function (b) { return b.name === 'chrome'; })) {
          setBrowser(data[0].name);
        }
      })
      .catch(function () { });

    fetch('/api/device-capacity')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) setDeviceCapacity(data);
      })
      .catch(function () { });
  }, []);

  // -- Poll device capacity every 5s when Configure step is active and Docker mode selected --
  React.useEffect(function () {
    if (currentStep !== 3 || runMode !== 'docker') return;
    var interval = setInterval(function () {
      fetch('/api/device-capacity')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) setDeviceCapacity(data);
        })
        .catch(function () { });
    }, 5000);
    return function () { clearInterval(interval); };
  }, [currentStep, runMode]);

  // -- Load data (Step 1) --
  function loadData() {
    if (!selectedEnv) return;
    setLoading(true);
    fetch('/api/data?env=' + encodeURIComponent(selectedEnv))
      .then(function (r) { return r.json(); })
      .then(function (r) {
        setLoading(false);
        if (!r.ok) { showAlert(r.error || 'Load failed', 'err'); return; }
        setExistingFields(r.fields.existing);
        setNewFields(r.fields.new);
        setTestDataFile(r.testDataFile);
        setHasData(true);
        dismissAlert();
      })
      .catch(function (e) { setLoading(false); showAlert('Load failed: ' + e.message, 'err'); });
  }

  // -- Save data (Step 1) --
  function saveData() {
    setSaving(true);
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env: selectedEnv, fields: { existing: existingFields, new: newFields } }),
    })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        setSaving(false);
        if (r.ok) showAlert('Saved \u2192 testData/' + r.file, 'ok');
        else showAlert('Save failed: ' + r.error, 'err');
      })
      .catch(function (e) { setSaving(false); showAlert('Save failed: ' + e.message, 'err'); });
  }

  // -- Load features/tags (Step 2) --
  function loadTags(bust) {
    setLoadingFeatures(true);
    fetch('/api/tags' + (bust ? '?refresh=1' : ''))
      .then(function (r) { return r.json(); })
      .then(function (r) {
        setLoadingFeatures(false);
        if (r.ok) setAllTags(r.tags);
      })
      .catch(function () { setLoadingFeatures(false); });
  }

  function loadFeatureTree(bust) {
    setLoadingFeatures(true);
    fetch('/api/features' + (bust ? '?refresh=1' : ''))
      .then(function (r) { return r.json(); })
      .then(function (r) {
        setLoadingFeatures(false);
        if (r.ok) setFeatureTree(r.tree);
      })
      .catch(function () { setLoadingFeatures(false); });
  }

  function refreshFeatures() {
    setAllTags([]);
    setFeatureTree(null);
    loadTags(true);
    loadFeatureTree(true);
  }

  function selectTag(tag) {
    setSelectedTag(tag);
    setTagSpecs({ specs: [], scenarioCount: 0 });
    setTagSpecsLoading(true);
    fetch('/api/specs-by-tag?tag=' + encodeURIComponent(tag))
      .then(function (r) { return r.json(); })
      .then(function (r) {
        setTagSpecsLoading(false);
        if (r.ok) setTagSpecs({ specs: r.specs, scenarioCount: r.scenarioCount });
      })
      .catch(function () { setTagSpecsLoading(false); });
  }

  // Load tags/features when entering Step 2
  React.useEffect(function () {
    if (currentStep === 2) {
      if (allTags.length === 0) loadTags();
      if (!featureTree) loadFeatureTree();
    }
  }, [currentStep]);

  // -- Docker status check (Step 4) --
  function checkDockerStatus() {
    fetch('/api/docker/status')
      .then(function (r) { return r.json(); })
      .then(function (r) { if (r.ok) setDockerStatus(r); })
      .catch(function () { setDockerStatus({ docker: false, imageExists: false }); });
  }

  React.useEffect(function () {
    if (currentStep === 4) checkDockerStatus();
  }, [currentStep]);

  // -- Elapsed timer for build --
  React.useEffect(function () {
    if (!buildingImage) return;
    var interval = setInterval(function () {
      if (buildStartRef.current) {
        setBuildElapsed(Math.floor((Date.now() - buildStartRef.current) / 1000));
      }
    }, 1000);
    return function () { clearInterval(interval); };
  }, [buildingImage]);

  // -- Build Docker image --
  function buildDockerImage(noCache) {
    setBuildingImage(true);
    setBuildLogs([]);
    setBuildProgress({ current: 0, total: 0 });
    setBuildElapsed(0);
    buildStartRef.current = Date.now();

    fetch('/api/docker/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noCache: !!noCache })
    })
      .then(function (response) {
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function readChunk() {
          return reader.read().then(function (result) {
            if (result.done) {
              setBuildingImage(false);
              buildStartRef.current = null;
              checkDockerStatus();
              return;
            }
            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            lines.forEach(function (chunk) {
              if (chunk.startsWith('data: ')) {
                try {
                  var data = JSON.parse(chunk.substring(6));
                  if (data.type === 'log') {
                    setBuildLogs(function (prev) { return prev.concat([data.message]); });
                  } else if (data.type === 'progress') {
                    setBuildProgress({ current: data.current, total: data.total });
                  } else if (data.type === 'done') {
                    if (data.success) {
                      showAlert('Docker image built successfully!', 'ok');
                    } else {
                      showAlert('Docker build failed: ' + data.message, 'err');
                    }
                  }
                } catch (e) { }
              }
            });
            return readChunk();
          });
        }
        return readChunk();
      })
      .catch(function (e) {
        setBuildingImage(false);
        buildStartRef.current = null;
        showAlert('Build request failed: ' + e.message, 'err');
      });
  }

  // -- Start test run --
  function startRun() {
    var body = {
      env: selectedEnv,
      runMode: runMode,
      batchSize: batchSize,
      browser: browser,
      dataSetMode: dataSetMode,
      headed: runMode === 'local' ? headed : false,
      debugMode: runMode === 'debug',
    };

    if (featureMode === 'tag' && selectedTag) {
      body.tag = selectedTag;
    } else if (featureMode === 'tree' && selectedSpecs.length > 0) {
      body.specs = selectedSpecs;
    }

    setRunLogs([]);
    setRunStatus('running');
    setRunReportDir(null);

    fetch('/api/run/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.ok) {
          showAlert('Failed to start run: ' + r.error, 'err');
          setRunStatus(null);
          return;
        }
        setRunId(r.runId);
        // Connect to SSE for live logs
        connectToLogs(r.runId);
      })
      .catch(function (e) {
        showAlert('Run request failed: ' + e.message, 'err');
        setRunStatus(null);
      });
  }

  function connectToLogs(id) {
    if (eventSourceRef.current) eventSourceRef.current.close();
    var es = new EventSource('/api/run/logs/' + id);
    eventSourceRef.current = es;

    es.onmessage = function (event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'log') {
          setRunLogs(function (prev) { return prev.concat([data.message]); });
        } else if (data.type === 'done') {
          setRunStatus(data.status);
          setRunReportDir(data.reportDir);
          es.close();
          eventSourceRef.current = null;
          // Load reports
          loadReports();
        }
      } catch (e) { }
    };

    es.onerror = function () {
      es.close();
      eventSourceRef.current = null;
    };
  }

  // Auto-scroll logs
  React.useEffect(function () {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [runLogs]);

  // -- Stop run --
  function stopRun() {
    if (!runId) return;
    setRunStatus('stopping'); // immediate feedback — server may block on execSync
    fetch('/api/run/stop/' + runId, { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (r.ok) {
          setRunStatus('stopped');
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        } else {
          setRunStatus('running'); // revert if server rejected
        }
      })
      .catch(function () { setRunStatus('running'); });
  }

  // -- Reset run state (allows re-running without restarting) --
  function resetRun(goToStep) {
    setRunId(null);
    setRunStatus(null);
    setRunLogs([]);
    setRunReportDir(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    checkDockerStatus();
    if (goToStep) setCurrentStep(goToStep);
  }

  // -- Actually launch cypress open with a specific browser choice --
  // Called directly when there is no conflict, or from the conflict modal after user picks.
  // -- Launch cypress open with no --browser flag; Cypress shows its own browser picker --
  function launchDebug() {
    if (!selectedEnv) return;
    if (runMode === 'debug' && (runStatus === 'running' || runStatus === 'stopping')) { stopRun(); return; }
    if (runStatus === 'running' || runStatus === 'stopping') return;
    setRunMode('debug');
    setRunLogs([]);
    setRunStatus('running');
    setRunReportDir(null);
    setCurrentStep(4);
    fetch('/api/run/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env: selectedEnv, runMode: 'local', debugMode: true, dataSetMode: dataSetMode }),
    })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.ok) { showAlert('Failed to open Cypress: ' + r.error, 'err'); setRunStatus(null); return; }
        setRunId(r.runId);
        connectToLogs(r.runId);
      })
      .catch(function (e) { showAlert('Debug start failed: ' + e.message, 'err'); setRunStatus(null); });
  }

  // -- When a debug run ends, reset runMode to 'local' so Configure shows normally --
  React.useEffect(function () {
    if (runMode === 'debug' && (runStatus === 'stopped' || runStatus === 'passed' || runStatus === 'failed')) {
      setRunMode('local');
    }
  }, [runStatus]);

  // -- Load reports (Step 5) --
  function loadReports() {
    fetch('/api/reports')
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (r.ok) setPastReports(r.reports);
      })
      .catch(function () { });
  }

  // Load reports on mount and when navigating to step 5
  React.useEffect(function () {
    loadReports();
  }, []);
  React.useEffect(function () {
    if (currentStep === 5) loadReports();
  }, [currentStep]);

  // Auto-refresh reports every 30s while drawer is open; clear on close
  React.useEffect(function () {
    if (showReports) {
      loadReports();
      reportsRefreshRef.current = setInterval(loadReports, 30000);
    } else {
      clearInterval(reportsRefreshRef.current);
    }
    return function () { clearInterval(reportsRefreshRef.current); };
  }, [showReports]);

  // -- Navigation --
  function canGoNext() {
    if (currentStep === 1) return hasData;
    if (currentStep === 2) return runMode === 'debug' || (featureMode === 'tag' && selectedTag) || (featureMode === 'tree' && selectedSpecs.length > 0);
    if (currentStep === 3) return true;
    if (currentStep === 4) return runStatus === 'passed' || runStatus === 'failed' || runStatus === 'stopped';
    return false;
  }

  function goNext() {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  }

  function goBack() {
    if (currentStep > 1) {
      // Clear run state when backing out from Run Tests step
      if (runStatus) resetRun(currentStep - 1);
      else setCurrentStep(currentStep - 1);
    }
  }

  // -- Styles --
  const C = {
    bg: '#0A0B0F',
    surface: '#12141A',
    inputBg: '#1A1D26',
    border: '#2A2D3A',
    inputBorder: '#353849',
    text: '#E8EBF3',
    muted: '#7B8299',
    subtle: '#4A506A',
    accent: '#6366F1',
    accentHov: '#818CF8',
    accentAlt: '#06B6D4',
  };

  const alertStyles = {
    ok: { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34D399' },
    info: { background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8' },
    err: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes glow-pulse { 0%, 100% { box-shadow: 0 0 12px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 24px rgba(99,102,241,0.6); } }
        .ping-dot { animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite; }
        .spin-icon { animation: spin 0.7s linear infinite; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0A0B0F; }
        ::-webkit-scrollbar-thumb { background: #2A2D3A; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #6366F1; }
        select option { background: #12141A; color: #E8EBF3; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #0A0B0F; }
        ::selection { background: rgba(99,102,241,0.35); color: #fff; }
        input::placeholder { color: #4A506A !important; }
        input, select, textarea { color-scheme: dark; }
      `}</style>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', backdropFilter: 'blur(20px)', backgroundColor: 'rgba(10,11,15,0.85)', borderBottom: '1px solid #1E2030', boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Launchpad" style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0 }} />
          <span data-tour="logo" style={{ fontSize: '15px', fontWeight: '700', background: 'linear-gradient(135deg, #818CF8, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.3px' }}>Cypress Launchpad</span>
          <button
            data-tour="tour-btn"
            onClick={function () { setTourActive(true); }}
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '999px', padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#818CF8', fontSize: '10px', fontWeight: '600', transition: 'all 0.2s' }}
          >&#x2753; Tour</button>
        </div>

        {/* Breadcrumb pill */}
        <div data-tour="env-pill" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '999px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
          <span style={{ color: '#4A506A' }}>env/</span>
          <span style={{ color: selectedEnv ? '#06B6D4' : '#4A506A' }}>{selectedEnv || 'none'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* CYPRESS badge */}
          <div style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: '999px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px' }}>
              <span className="ping-dot" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#06B6D4', opacity: 0.75 }}></span>
              <span style={{ position: 'relative', borderRadius: '50%', background: '#06B6D4', width: '8px', height: '8px' }}></span>
            </span>
            <span style={{ color: '#06B6D4', fontSize: '10px', fontWeight: '700', letterSpacing: '0.15em' }}>CYPRESS</span>
          </div>
          {/* Reports drawer toggle */}
          <button
            onClick={function () { setShowReports(true); }}
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '999px', padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#818CF8', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em' }}
          >
            &#x2691; REPORTS
            {pastReports.length > 0 && (
              <span style={{ background: '#6366F1', color: 'white', borderRadius: '999px', padding: '1px 6px', fontSize: '9px', fontWeight: '700' }}>{pastReports.length}</span>
            )}
          </button>
          {/* Debug mode — runs cypress open with no --browser; Cypress shows its own picker */}
          <button
            onClick={launchDebug}
            title={
              !selectedEnv ? 'Select an environment first' :
              (runStatus === 'running' && runMode !== 'debug') ? 'Stop current run before using Debug' :
              (runStatus === 'running' && runMode === 'debug') ? 'Stop cypress open' :
              'Open Cypress interactive Test Runner (cypress open)'
            }
            style={{
              background: (runMode === 'debug' && runStatus === 'running') ? 'rgba(220,107,47,0.25)' : (runMode === 'debug' && runStatus === 'stopping') ? 'rgba(217,119,6,0.2)' : 'rgba(255,255,255,0.08)',
              border: '1px solid ' + ((runMode === 'debug' && runStatus === 'running') ? 'rgba(220,107,47,0.6)' : (runMode === 'debug' && runStatus === 'stopping') ? 'rgba(217,119,6,0.4)' : 'rgba(255,255,255,0.15)'),
              borderRadius: '999px', padding: '5px 12px',
              cursor: (!selectedEnv || (runStatus === 'running' && runMode !== 'debug') || runStatus === 'stopping') ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              color: (runMode === 'debug' && runStatus === 'running') ? '#FDBA74' : (runMode === 'debug' && runStatus === 'stopping') ? '#FCD34D' : (!selectedEnv || (runStatus === 'running' && runMode !== 'debug')) ? 'rgba(240,237,232,0.35)' : '#F0EDE8',
              fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em',
              opacity: (!selectedEnv || (runStatus === 'running' && runMode !== 'debug')) ? 0.45 : 1,
            }}
          >
            {runMode === 'debug' && runStatus === 'stopping'
              ? <span>&#x23F3; STOPPING...</span>
              : runMode === 'debug' && runStatus === 'running'
              ? <span>&#x25A0; STOP DEBUG</span>
              : <span>&#x1F41E; DEBUG</span>
            }
          </button>
          {/* Kill switch */}
          <button
            onClick={function () {
              if (confirm('Shut down Cypress Launchpad?')) {
                fetch('/api/shutdown', { method: 'POST' }).catch(function () {});
                document.title = 'Launchpad - Stopped';
                document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0A0B0F;color:#E8EBF3;font-family:Inter,system-ui,sans-serif;text-align:center">' +
                  '<div style="font-size:48px;margin-bottom:16px">&#x23FB;</div>' +
                  '<h2 style="margin:0 0 8px;font-size:20px;font-weight:600">Cypress Launchpad Stopped</h2>' +
                  '<p style="color:#7B8299;font-size:13px;margin:0 0 24px">Server on port 4500 has been shut down.</p>' +
                  '<p style="color:#4A506A;font-size:12px">Run <code style="background:#1A1D26;padding:3px 8px;border-radius:4px;color:#818CF8">npm run launch</code> to start again.</p>' +
                  '</div>';
              }
            }}
            title="Shut down server (port 4500)"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '999px', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#FCA5A5', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em' }}
          >&#x23FB; KILL</button>
        </div>
      </header>


      {/* Reports Drawer — fixed right panel, always accessible */}
      {showReports && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex' }}>
          {/* Backdrop */}
          <div
            onClick={function () { setShowReports(false); setDrawerTab('reports'); }}
            style={{ flex: 1, background: 'rgba(11,40,56,0.55)', backdropFilter: 'blur(2px)' }}
          />
          {/* Drawer panel — widened slightly for charts */}
          <div style={{
            width: '560px', background: '#12141A', display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 48px rgba(0,0,0,0.6)', overflow: 'hidden',
          }}>
            {/* Drawer header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', background: 'rgba(10,11,15,0.9)', borderBottom: '1px solid #1E2030',
            }}>
              <span style={{ color: '#E8EBF3', fontWeight: '700', fontSize: '14px', letterSpacing: '-0.2px' }}>
                &#x2691; Test Reports
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={loadReports}
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                >&#x21BB; Refresh</button>
                <button
                  onClick={function () { setShowReports(false); setDrawerTab('reports'); }}
                  style={{ background: 'transparent', border: 'none', color: '#E8EBF3', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 4px', opacity: 0.7 }}
                >&#x2715;</button>
              </div>
            </div>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1E2030', background: '#0A0B0F', flexShrink: 0 }}>
              {[
                { id: 'reports', label: '&#x1F4C4; Reports', icon: '' },
                { id: 'analytics', label: '&#x1F4CA; Analytics', icon: '' },
              ].map(function (tab) {
                var isActive = drawerTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={function () { setDrawerTab(tab.id); }}
                    dangerouslySetInnerHTML={{ __html: tab.label }}
                    style={{
                      flex: 1, padding: '10px', fontSize: '12px', fontWeight: isActive ? '700' : '500',
                      color: isActive ? '#818CF8' : '#4A506A',
                      background: 'none', border: 'none',
                      borderBottom: isActive ? '2px solid #6366F1' : '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  />
                );
              })}
            </div>
            {/* Drawer body — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#0E0F14' }}>
              {drawerTab === 'analytics' ? (
                <AnalyticsDashboard colors={C} />
              ) : (
                <ReportViewer
                  pastReports={pastReports}
                  runReportDir={runReportDir}
                  loadReports={loadReports}
                  colors={C}
                />
              )}
            </div>
            {/* Drawer footer */}
            <div style={{ padding: '8px 20px', borderTop: '1px solid #1E2030', fontSize: '11px', color: '#4A506A', textAlign: 'center', background: '#0A0B0F' }}>
              Auto-refreshes every 30s &mdash; last fetched on open
            </div>
          </div>
        </div>
      )}

      {/* Step Indicator */}
      <StepIndicator steps={STEPS} current={currentStep} onStepClick={function (n) {
        // Only allow going back to completed steps
        if (n < currentStep) {
          // Clear run state when navigating away from Run Tests step
          if (runStatus) resetRun(n);
          else setCurrentStep(n);
        }
      }} colors={C} />

      {/* Control bar — Environment selector (visible on all steps) */}
      <div data-tour="env-bar" style={{ background: '#12141A', borderBottom: '1px solid #1E2030', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '12px', color: C.muted, fontWeight: '500' }}>Environment</label>
        <select
          value={selectedEnv}
          onChange={function (e) { setSelectedEnv(e.target.value); setHasData(false); }}
          disabled={currentStep > 1 || hasData}
          style={{ background: currentStep > 1 || hasData ? 'rgba(99,102,241,0.15)' : '#1A1D26', border: '1px solid ' + (currentStep > 1 || hasData ? 'rgba(99,102,241,0.4)' : '#353849'), color: currentStep > 1 || hasData ? '#818CF8' : '#E8EBF3', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: currentStep > 1 || hasData ? 'not-allowed' : 'pointer', opacity: currentStep > 1 || hasData ? 0.9 : 1 }}
        >
          {!selectedEnv && <option value="">-- select environment --</option>}
          {envs.map(function (e) { return <option key={e} value={e}>{e}</option>; })}
        </select>

        {currentStep === 1 && !hasData && (
          <button
            onClick={loadData}
            disabled={loading || !selectedEnv}
            style={{ background: '#6366F1', color: 'white', padding: '7px 18px', borderRadius: '7px', fontWeight: '600', fontSize: '13px', border: 'none', cursor: loading || !selectedEnv ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading || !selectedEnv ? 0.5 : 1, boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
          >
            {loading && <Spinner dark={false} />}
            {loading ? 'Loading...' : 'Load Data'}
          </button>
        )}

        {hasData && currentStep === 1 && (
          <button
            onClick={function () { setHasData(false); setExistingFields({}); setNewFields({}); }}
            style={{ background: 'transparent', color: C.muted, padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', border: '1px solid #D4CCC2', cursor: 'pointer' }}
            title="Unlock to change environment"
          >&#x1F513; Change Env</button>
        )}
      </div>

      {/* Gradient divider */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #6366F1 20%, #06B6D4 50%, #6366F1 80%, transparent)', opacity: 0.4 }} />

      {/* Alert bar */}
      {alert && (
        <div style={{ ...alertStyles[alert.type], margin: '16px 24px 0', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span>{alert.msg}</span>
          <button onClick={dismissAlert} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px', opacity: 0.7 }}>&#x2715;</button>
        </div>
      )}

      {/* Main area */}
      <main style={{ flex: 1, padding: '24px', paddingBottom: '80px' }}>

        {/* ============ STEP 1: ENTITIES ============ */}
        {currentStep === 1 && (
          <>
            {!hasData ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: C.muted }}>
                <div style={{ fontSize: '52px', marginBottom: '16px', opacity: 0.15 }}>&#x2B21;</div>
                <p style={{ fontSize: '14px', lineHeight: '1.8', color: C.muted }}>
                  Choose an <span style={{ color: '#818CF8' }}>environment</span>,<br />
                  then click <span style={{ color: '#6366F1', fontWeight: 600 }}>Load Data</span> to start editing.
                </p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E2DCD3', marginBottom: '20px' }}>
                  {['existing', 'new'].map(function (tab) {
                    var isActive = activeTab === tab;
                    var label = tab === 'existing' ? 'Existing Entities' : 'New Entities';
                    return (
                      <button
                        key={tab}
                        onClick={function () { setActiveTab(tab); }}
                        style={{
                          padding: '10px 22px', fontSize: '13px', fontWeight: isActive ? '600' : '400',
                          color: isActive ? '#E8EBF3' : C.muted, background: 'none', border: 'none',
                          borderBottom: isActive ? '2px solid #6366F1' : '2px solid transparent',
                          marginBottom: '-1px', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >{label}</button>
                    );
                  })}
                </div>

                {/* Cards grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {CARDS.map(function (card) {
                    return <DataCard
                      key={card.id + '-' + activeTab}
                      card={card}
                      section={activeTab}
                      getVal={getVal}
                      setVal={setVal}
                      colors={C}
                      selectedEnv={selectedEnv}
                      dbEnvs={dbEnvs}
                      getBusinessContext={function () { return getBusinessContext(activeTab, card.id); }}
                    />;
                  })}
                </div>

                {/* Save button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <SaveButton saving={saving} onClick={saveData} />
                </div>
              </>
            )}
          </>
        )}

        {/* ============ STEP 2: FEATURE SELECTOR ============ */}
        {currentStep === 2 && runMode === 'debug' && (
          <div style={{ marginBottom: '16px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', color: '#9A3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>&#x1F41E;</span>
            <span><strong>Debug mode:</strong> Feature file selection is optional — cypress open shows all specs in the Test Runner. Skip this step or pick a specific file to pre-select it.</span>
          </div>
        )}
        {currentStep === 2 && (
          <FeatureSelector
            featureMode={featureMode}
            setFeatureMode={setFeatureMode}
            allTags={allTags}
            tagSearch={tagSearch}
            setTagSearch={setTagSearch}
            selectedTag={selectedTag}
            selectTag={selectTag}
            tagSpecs={tagSpecs}
            tagSpecsLoading={tagSpecsLoading}
            featureTree={featureTree}
            selectedSpecs={selectedSpecs}
            setSelectedSpecs={setSelectedSpecs}
            loadingFeatures={loadingFeatures}
            onRefresh={refreshFeatures}
            colors={C}
          />
        )}

        {/* ============ STEP 3: RUN CONFIG ============ */}
        {currentStep === 3 && (
          <RunConfig
            selectedEnv={selectedEnv}
            featureMode={featureMode}
            selectedTag={selectedTag}
            tagSpecs={tagSpecs}
            selectedSpecs={selectedSpecs}
            runMode={runMode}
            setRunMode={setRunMode}
            batchSize={batchSize}
            setBatchSize={setBatchSize}
            browser={browser}
            setBrowser={setBrowser}
            headed={headed}
            setHeaded={setHeaded}
            installedBrowsers={installedBrowsers}
            deviceCapacity={deviceCapacity}
            colors={C}
          />
        )}

        {/* ============ STEP 4: RUN TESTS ============ */}
        {currentStep === 4 && (
          <RunPanel
            runMode={runMode}
            batchSize={batchSize}
            selectedEnv={selectedEnv}
            browser={browser}
            dockerStatus={dockerStatus}
            buildingImage={buildingImage}
            buildLogs={buildLogs}
            buildProgress={buildProgress}
            buildElapsed={buildElapsed}
            buildDockerImage={buildDockerImage}
            runId={runId}
            runStatus={runStatus}
            runLogs={runLogs}
            runReportDir={runReportDir}
            startRun={startRun}
            stopRun={stopRun}
            resetRun={resetRun}
            logEndRef={logEndRef}
            colors={C}
            checkDockerStatus={checkDockerStatus}
          />
        )}

        {/* ============ STEP 5: REPORTS ============ */}
        {currentStep === 5 && (
          <ReportViewer
            pastReports={pastReports}
            runReportDir={runReportDir}
            loadReports={loadReports}
            colors={C}
          />
        )}
      </main>

      {/* Footer / Navigation bar */}
      <footer data-tour="footer" style={{ position: 'sticky', bottom: 0, height: '56px', background: 'rgba(10,11,15,0.95)', borderTop: '1px solid #1E2030', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', gap: '16px', boxShadow: '0 -4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
          <span>Step {currentStep} of {STEPS.length}</span>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>|</span>
          <span style={{ color: '#F0EDE8', fontWeight: '500' }}>{STEPS[currentStep - 1].label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentStep > 1 && (
            <button
              onClick={goBack}
              style={{ background: 'rgba(255,255,255,0.1)', color: '#F0EDE8', padding: '7px 18px', borderRadius: '7px', fontWeight: '600', fontSize: '13px', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}
            >Back</button>
          )}
          {currentStep < 5 && (
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              style={{
                background: canGoNext() ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'rgba(255,255,255,0.06)',
                color: canGoNext() ? 'white' : 'rgba(255,255,255,0.25)',
                padding: '7px 18px', borderRadius: '7px', fontWeight: '600', fontSize: '13px', border: 'none',
                cursor: canGoNext() ? 'pointer' : 'not-allowed',
                boxShadow: canGoNext() ? '0 2px 12px rgba(99,102,241,0.4)' : 'none',
                transition: 'all 0.2s',
              }}
            >Next</button>
          )}
        </div>
      </footer>

      {/* Guided Tour */}
      {tourActive && <TourOverlay onClose={function () { setTourActive(false); }} />}
    </div>
  );
}

// ============================================================================
//  GUIDED TOUR
// ============================================================================

var TOUR_STEPS = [
  {
    target: null,
    title: 'Welcome to Cypress Launchpad!',
    body: 'This is your control center for managing test data, selecting tests, and running them in Docker containers.\n\nLet me walk you through each part.',
    position: 'center',
  },
  {
    target: '[data-tour="env-pill"]',
    title: 'Current Environment',
    body: 'This pill always shows which environment you\'re working with. It updates when you select one from the dropdown below.',
    position: 'bottom',
  },
  {
    target: '[data-tour="env-bar"]',
    title: 'Environment Selector',
    body: 'Start here \u2014 pick your target environment (env1-4, alpha, beta, etc.) then click "Load Data" to fetch entity names.\n\nThe dropdown locks after loading to prevent accidental switches.',
    position: 'bottom',
  },
  {
    target: '[data-tour="steps"]',
    title: '5-Step Workflow',
    body: '\u2460 Entities \u2014 Edit test data (categories, variants, users...)\n\u2461 Features \u2014 Pick test files or tags to run\n\u2462 Configure \u2014 Set batch size, browser, data mode\n\u2463 Run Tests \u2014 Execute in Docker with live logs\n\u2464 Reports \u2014 View HTML test reports',
    position: 'bottom',
  },
  {
    target: '[data-tour="footer"]',
    title: 'Navigation',
    body: 'Use Back/Next to move between steps. You can also click completed steps in the step bar above to jump back.',
    position: 'top',
  },
  {
    target: '[data-tour="tour-btn"]',
    title: 'That\'s it!',
    body: 'You can restart this tour anytime by clicking this button.\n\nHappy testing!',
    position: 'bottom',
  },
];

function TourOverlay({ onClose }) {
  const [step, setStep] = React.useState(0);
  const [spotRect, setSpotRect] = React.useState(null);
  var current = TOUR_STEPS[step];

  React.useEffect(function () {
    if (!current.target) { setSpotRect(null); return; }
    var el = document.querySelector(current.target);
    if (el) {
      var rect = el.getBoundingClientRect();
      setSpotRect({ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 });
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else { setSpotRect(null); }
  }, [step]);

  React.useEffect(function () {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return function () { window.removeEventListener('keydown', onKey); };
  }, []);

  var isFirst = step === 0;
  var isLast = step === TOUR_STEPS.length - 1;

  var tooltipStyle = {
    position: 'fixed', zIndex: 10002,
    background: 'rgba(18, 20, 26, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: '14px', padding: '22px',
    maxWidth: '360px', width: '360px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  if (current.position === 'center' || !spotRect) {
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  } else if (current.position === 'bottom') {
    tooltipStyle.top = (spotRect.top + spotRect.height + 12) + 'px';
    tooltipStyle.left = Math.max(16, Math.min(spotRect.left, window.innerWidth - 390)) + 'px';
  } else if (current.position === 'top') {
    tooltipStyle.bottom = (window.innerHeight - spotRect.top + 12) + 'px';
    tooltipStyle.left = Math.max(16, Math.min(spotRect.left, window.innerWidth - 390)) + 'px';
  }

  return React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 10000 } },
    // Dark overlay with cutout
    React.createElement('div', {
      onClick: onClose,
      style: {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10001,
        backdropFilter: 'blur(2px)',
        clipPath: spotRect
          ? 'polygon(0% 0%, 0% 100%, ' + spotRect.left + 'px 100%, ' + spotRect.left + 'px ' + spotRect.top + 'px, ' + (spotRect.left + spotRect.width) + 'px ' + spotRect.top + 'px, ' + (spotRect.left + spotRect.width) + 'px ' + (spotRect.top + spotRect.height) + 'px, ' + spotRect.left + 'px ' + (spotRect.top + spotRect.height) + 'px, ' + spotRect.left + 'px 100%, 100% 100%, 100% 0%)'
          : 'none',
      },
    }),
    // Indigo highlight ring around target element
    spotRect && React.createElement('div', {
      style: {
        position: 'fixed', zIndex: 10001,
        top: spotRect.top + 'px', left: spotRect.left + 'px',
        width: spotRect.width + 'px', height: spotRect.height + 'px',
        border: '2px solid #6366F1', borderRadius: '8px',
        boxShadow: '0 0 0 4px rgba(99,102,241,0.2), 0 0 24px rgba(99,102,241,0.4)',
        pointerEvents: 'none',
      },
    }),
    // Tooltip card
    React.createElement('div', { style: tooltipStyle },
      // Step counter badge
      React.createElement('div', {
        style: {
          fontSize: '9px', color: '#6366F1', fontWeight: '700',
          letterSpacing: '0.15em', marginBottom: '10px',
          textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px',
        }
      },
        React.createElement('span', {
          style: {
            display: 'inline-block', width: '18px', height: '18px',
            borderRadius: '50%', background: 'rgba(99,102,241,0.2)',
            border: '1px solid rgba(99,102,241,0.4)',
            textAlign: 'center', lineHeight: '18px', fontSize: '9px', color: '#818CF8',
          }
        }, step + 1),
        'Step ' + (step + 1) + ' of ' + TOUR_STEPS.length
      ),
      // Title
      React.createElement('h3', {
        style: {
          margin: '0 0 10px', fontSize: '16px', fontWeight: '700',
          color: '#E8EBF3', letterSpacing: '-0.3px',
        }
      }, current.title),
      // Body
      React.createElement('p', {
        style: {
          margin: '0 0 20px', fontSize: '13px', color: '#7B8299',
          lineHeight: '1.65', whiteSpace: 'pre-line',
        }
      }, current.body),
      // Divider
      React.createElement('div', { style: { height: '1px', background: '#1E2030', marginBottom: '16px' } }),
      // Actions
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('button', {
          onClick: onClose,
          style: {
            background: 'transparent', border: 'none', color: '#4A506A',
            fontSize: '12px', cursor: 'pointer', padding: '4px 8px',
            transition: 'color 0.15s',
          },
        }, 'Skip tour'),
        React.createElement('div', { style: { display: 'flex', gap: '8px' } },
          !isFirst && React.createElement('button', {
            onClick: function () { setStep(step - 1); },
            style: {
              background: '#1A1D26', color: '#E8EBF3', border: '1px solid #2A2D3A',
              borderRadius: '7px', padding: '7px 16px', fontSize: '12px',
              fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
            },
          }, '\u2190 Back'),
          React.createElement('button', {
            onClick: function () { if (isLast) onClose(); else setStep(step + 1); },
            style: {
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              color: 'white', border: 'none', borderRadius: '7px',
              padding: '7px 16px', fontSize: '12px', fontWeight: '600',
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
            },
          }, isLast ? 'Finish' : 'Next \u2192')
        )
      )
    )
  );
}


// ============================================================================
//  STEP INDICATOR
// ============================================================================

function StepIndicator({ steps, current, onStepClick, colors }) {
  return (
    <div data-tour="steps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 24px', background: '#0E0F14', borderBottom: '1px solid #1E2030', gap: '4px' }}>
      {steps.map(function (step, idx) {
        var isActive = step.num === current;
        var isCompleted = step.num < current;
        var bgColor = isActive ? '#6366F1' : isCompleted ? '#4F46E5' : '#1A1D26';
        var textColor = isActive || isCompleted ? '#fff' : colors.muted;
        var borderColor = isActive ? '#6366F1' : isCompleted ? '#4F46E5' : '#2A2D3A';

        return (
          <React.Fragment key={step.num}>
            {idx > 0 && (
              <div style={{ width: '40px', height: '1px', background: isCompleted ? '#4F46E5' : '#2A2D3A', margin: '0 4px' }} />
            )}
            <button
              onClick={function () { onStepClick(step.num); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px',
                borderRadius: '999px', border: '1px solid ' + borderColor,
                background: bgColor, color: textColor,
                cursor: isCompleted ? 'pointer' : 'default', fontSize: '12px', fontWeight: isActive ? '700' : '500',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 0 16px rgba(99,102,241,0.4)' : 'none',
              }}
            >
              <span>{isCompleted ? '\u2713' : step.icon}</span>
              <span>{step.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================================
//  STEP 2: FEATURE SELECTOR
// ============================================================================

function FeatureSelector({ featureMode, setFeatureMode, allTags, tagSearch, setTagSearch, selectedTag, selectTag, tagSpecs, tagSpecsLoading, featureTree, selectedSpecs, setSelectedSpecs, loadingFeatures, onRefresh, colors }) {
  const [fileSearch, setFileSearch] = React.useState('');

  function getFirstMatchingTag(query) {
    var searchTerm = query.toLowerCase();
    var match = allTags.find(function (t) { return t.tag.toLowerCase().includes(searchTerm); });
    return match ? match.tag : null;
  }

  function getFirstMatchingFile(query, node) {
    var searchTerm = query.toLowerCase().trim();
    var allFiles = getAllFiles(node);

    // Find all files that match the current search term
    var matches = allFiles.filter(function (f) { return f.toLowerCase().includes(searchTerm); });
    if (matches.length === 0) return null;

    // Extract the common path after the search term
    var firstMatch = matches[0].toLowerCase();
    var termIndex = firstMatch.indexOf(searchTerm);
    if (termIndex === -1) return null;

    // Get the path after the search term
    var afterSearch = matches[0].substring(termIndex + searchTerm.length);

    // Find the next "/" and stop there
    var nextSlashIndex = afterSearch.indexOf('/');
    if (nextSlashIndex === -1) {
      // No more folders, return the full match
      return matches[0];
    }

    // Return up to and including the next "/"
    var completion = query + afterSearch.substring(0, nextSlashIndex + 1);
    return completion;
  }

  var filteredTags = allTags.filter(function (t) {
    return !tagSearch || t.tag.toLowerCase().includes(tagSearch.toLowerCase());
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: colors.text }}>Select Features to Run</h3>
        <button
          onClick={onRefresh}
          disabled={loadingFeatures}
          title="Reload feature files and tags from disk"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
            cursor: loadingFeatures ? 'not-allowed' : 'pointer',
            background: 'transparent',
            border: '1px solid ' + colors.border,
            color: loadingFeatures ? colors.muted : colors.accent,
            opacity: loadingFeatures ? 0.6 : 1,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ display: 'inline-block', transform: loadingFeatures ? 'rotate(360deg)' : 'none', transition: loadingFeatures ? 'transform 1s linear' : 'none' }}>&#x21BB;</span>
          {loadingFeatures ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['tree', 'tag'].map(function (mode) {
          var isActive = featureMode === mode;
          return (
            <button
              key={mode}
              onClick={function () { setFeatureMode(mode); }}
              style={{
                padding: '8px 20px', borderRadius: '7px', fontSize: '13px', fontWeight: '600',
                background: isActive ? '#6366F1' : '#1A1D26', color: isActive ? 'white' : colors.muted,
                border: '1px solid ' + (isActive ? '#6366F1' : '#2A2D3A'), cursor: 'pointer', transition: 'all 0.2s',
              }}
            >{mode === 'tag' ? 'By Tag' : 'By File'}</button>
          );
        })}
      </div>

      {/* Tag mode */}
      {featureMode === 'tag' && (
        <div>
          {/* Search */}
          <input
            type="text"
            placeholder="Search tags... (press Tab to autocomplete)"
            value={tagSearch}
            onChange={function (e) { setTagSearch(e.target.value); }}
            onKeyDown={function (e) {
              if (e.key === 'Tab') {
                e.preventDefault();
                var match = getFirstMatchingTag(tagSearch);
                if (match) setTagSearch(match);
              }
            }}
            style={{ background: colors.inputBg, border: '1px solid ' + colors.inputBorder, color: colors.text, borderRadius: '6px', padding: '8px 12px', fontSize: '13px', width: '300px', outline: 'none', marginBottom: '16px' }}
          />

          {/* Tag pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '300px', overflowY: 'auto', padding: '4px 0' }}>
            {loadingFeatures ? (
              <div style={{ color: colors.muted, display: 'flex', alignItems: 'center', gap: '8px' }}><Spinner dark={true} /> Loading tags...</div>
            ) : filteredTags.map(function (t) {
              var isSelected = selectedTag === t.tag;
              return (
                <button
                  key={t.tag}
                  onClick={function () { selectTag(t.tag); }}
                  style={{
                    padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: isSelected ? '700' : '500',
                    background: isSelected ? '#6366F1' : '#1A1D26',
                    color: isSelected ? 'white' : colors.muted,
                    border: '1px solid ' + (isSelected ? '#6366F1' : '#2A2D3A'),
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >@{t.tag} <span style={{ opacity: 0.6, marginLeft: '4px' }}>({t.count})</span></button>
              );
            })}
          </div>

          {/* Selected tag details */}
          {selectedTag && (
            tagSpecsLoading ? (
              <div style={{ marginTop: '20px', color: colors.muted, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Spinner dark={true} /> Loading specs for @{selectedTag}...
              </div>
            ) : tagSpecs.specs.length > 0 ? (
              <div style={{ marginTop: '20px', background: colors.surface, border: '1px solid ' + colors.border, borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                  <div style={{ background: 'rgba(14,124,107,0.08)', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: colors.accent }}>{tagSpecs.specs.length}</div>
                    <div style={{ fontSize: '10px', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Feature Files</div>
                  </div>
                  <div style={{ background: 'rgba(46,139,87,0.08)', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#2E8B57' }}>{tagSpecs.scenarioCount}</div>
                    <div style={{ fontSize: '10px', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Scenarios</div>
                  </div>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {tagSpecs.specs.map(function (spec) {
                    return (
                      <div key={spec} style={{ padding: '4px 0', fontSize: '12px', color: colors.muted, fontFamily: 'monospace' }}>
                        {spec}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '20px', color: colors.muted, fontSize: '13px' }}>
                No feature files found for @{selectedTag}.
              </div>
            )
          )}
        </div>
      )}

      {/* Tree mode */}
      {featureMode === 'tree' && (
        <div>
          {loadingFeatures || !featureTree ? (
            <div style={{ color: colors.muted, display: 'flex', alignItems: 'center', gap: '8px' }}><Spinner dark={true} /> Loading feature tree...</div>
          ) : (
            <div style={{ background: colors.surface, border: '1px solid ' + colors.border, borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search file path... (e.g. checkout, VISA/solo, create) — press Tab to autocomplete"
                    value={fileSearch}
                    onChange={function (e) { setFileSearch(e.target.value); }}
                    onKeyDown={function (e) {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        var match = getFirstMatchingFile(fileSearch, featureTree);
                        if (match) setFileSearch(match);
                      }
                    }}
                    style={{ width: '100%', padding: '8px 32px 8px 32px', borderRadius: '7px', border: '1px solid ' + colors.border, background: colors.bg, color: colors.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: colors.subtle, fontSize: '14px', pointerEvents: 'none' }}>&#x1F50D;</span>
                  {fileSearch && (
                    <span
                      onClick={function () { setFileSearch(''); }}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: colors.muted, fontSize: '16px', cursor: 'pointer', lineHeight: '1', userSelect: 'none' }}
                      title="Clear search"
                    >&#x2715;</span>
                  )}
                </div>
                <span style={{ fontSize: '12px', color: colors.muted, whiteSpace: 'nowrap' }}>
                  Selected: {selectedSpecs.length} file(s)
                </span>
              </div>
              <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
              <TreeNode
                node={featureTree}
                selectedSpecs={selectedSpecs}
                setSelectedSpecs={setSelectedSpecs}
                colors={colors}
                depth={0}
                fileSearch={fileSearch.toLowerCase().trim()}
              />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
//  TREE NODE (recursive)
// ============================================================================

function TreeNode({ node, selectedSpecs, setSelectedSpecs, colors, depth, fileSearch }) {
  var isSearching = fileSearch && fileSearch.length > 0;

  // Check if this node or any descendant matches the search
  var matchesSearch = React.useMemo(function () {
    if (!isSearching) return true;
    if (node.type === 'file') return node.path.toLowerCase().indexOf(fileSearch) !== -1;
    return getAllFiles(node).some(function (f) { return f.toLowerCase().indexOf(fileSearch) !== -1; });
  }, [node, fileSearch, isSearching]);

  const [expanded, setExpanded] = React.useState(depth < 2);

  // Auto-expand when search matches descendants
  React.useEffect(function () {
    if (isSearching && matchesSearch && node.type !== 'file') {
      setExpanded(true);
    }
  }, [fileSearch, matchesSearch, isSearching]);

  // Hide non-matching nodes
  if (isSearching && !matchesSearch) return null;

  if (node.type === 'file') {
    var isChecked = selectedSpecs.indexOf(node.path) !== -1;
    // Highlight matching part of filename
    var fileName = node.name;
    var highlightedName = null;
    if (isSearching) {
      var lowerPath = node.path.toLowerCase();
      var idx = lowerPath.indexOf(fileSearch);
      if (idx !== -1) {
        // Find the matching part relative to the displayed name
        var lowerName = fileName.toLowerCase();
        var nameIdx = lowerName.indexOf(fileSearch);
        if (nameIdx !== -1) {
          highlightedName = React.createElement('span', null,
            fileName.substring(0, nameIdx),
            React.createElement('span', { style: { background: 'rgba(14, 124, 107, 0.2)', borderRadius: '2px', padding: '0 2px' } }, fileName.substring(nameIdx, nameIdx + fileSearch.length)),
            fileName.substring(nameIdx + fileSearch.length)
          );
        }
      }
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', paddingLeft: depth * 16 + 'px' }}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={function () {
            if (isChecked) {
              setSelectedSpecs(selectedSpecs.filter(function (s) { return s !== node.path; }));
            } else {
              setSelectedSpecs(selectedSpecs.concat([node.path]));
            }
          }}
          style={{ accentColor: colors.accent }}
        />
        <span style={{ fontSize: '12px', color: isChecked ? colors.text : colors.muted, fontFamily: 'monospace' }}>{highlightedName || fileName}</span>
      </div>
    );
  }

  // Directory — filter child files for counts when searching
  var childFiles = getAllFiles(node);
  var visibleChildFiles = isSearching ? childFiles.filter(function (f) { return f.toLowerCase().indexOf(fileSearch) !== -1; }) : childFiles;

  function toggleAll() {
    var filesToToggle = isSearching ? visibleChildFiles : childFiles;
    var allChecked = filesToToggle.every(function (f) { return selectedSpecs.indexOf(f) !== -1; });
    if (allChecked) {
      setSelectedSpecs(selectedSpecs.filter(function (s) { return filesToToggle.indexOf(s) === -1; }));
    } else {
      var newSpecs = selectedSpecs.slice();
      filesToToggle.forEach(function (f) {
        if (newSpecs.indexOf(f) === -1) newSpecs.push(f);
      });
      setSelectedSpecs(newSpecs);
    }
  }

  var allChecked = visibleChildFiles.length > 0 && visibleChildFiles.every(function (f) { return selectedSpecs.indexOf(f) !== -1; });
  var someChecked = visibleChildFiles.some(function (f) { return selectedSpecs.indexOf(f) !== -1; });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', paddingLeft: depth * 16 + 'px', cursor: 'pointer' }}>
        <span onClick={function () { setExpanded(!expanded); }} style={{ fontSize: '10px', color: colors.subtle, width: '14px', textAlign: 'center', userSelect: 'none' }}>
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
        <input
          type="checkbox"
          checked={allChecked}
          ref={function (el) { if (el) el.indeterminate = someChecked && !allChecked; }}
          onChange={toggleAll}
          style={{ accentColor: colors.accent }}
        />
        <span onClick={function () { setExpanded(!expanded); }} style={{ fontSize: '12px', fontWeight: '600', color: colors.text }}>
          {node.name}/
        </span>
        <span style={{ fontSize: '10px', color: colors.subtle }}>({visibleChildFiles.length})</span>
      </div>
      {expanded && node.children && node.children.map(function (child, idx) {
        return <TreeNode key={child.name + '-' + idx} node={child} selectedSpecs={selectedSpecs} setSelectedSpecs={setSelectedSpecs} colors={colors} depth={depth + 1} fileSearch={fileSearch} />;
      })}
    </div>
  );
}

function getAllFiles(node) {
  if (node.type === 'file') return [node.path];
  var files = [];
  if (node.children) {
    node.children.forEach(function (child) {
      files = files.concat(getAllFiles(child));
    });
  }
  return files;
}


// ============================================================================
//  STEP 3: RUN CONFIG
// ============================================================================

function RunConfig({ selectedEnv, featureMode, selectedTag, tagSpecs, selectedSpecs, runMode, setRunMode, batchSize, setBatchSize, browser, setBrowser, headed, setHeaded, installedBrowsers, deviceCapacity, colors }) {
  var specCount = featureMode === 'tag' ? tagSpecs.specs.length : selectedSpecs.length;
  var scenarioCount = featureMode === 'tag' ? tagSpecs.scenarioCount : selectedSpecs.length;

  return (
    <div>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px', color: colors.text }}>Run Configuration</h3>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: runMode === 'debug' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard label="Environment" value={selectedEnv} accent={colors.accent} colors={colors} />
        <SummaryCard label="Mode" value={runMode === 'debug' ? (selectedTag ? '@' + selectedTag : selectedSpecs.length > 0 ? selectedSpecs.length + ' file(s)' : 'All Specs') : (featureMode === 'tag' ? '@' + selectedTag : 'Custom Files')} accent="#2D6A8A" colors={colors} />
        {runMode !== 'debug' && <SummaryCard label="Feature Files" value={specCount} accent="#1B8FB0" colors={colors} />}
        {runMode !== 'debug' && <SummaryCard label={featureMode === 'tag' ? 'Scenarios' : 'Files'} value={scenarioCount} accent="#2E8B57" colors={colors} />}
      </div>

      {/* Run Mode — Local / Docker (Debug is toggled from the header) */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <label style={{ fontSize: '11px', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600' }}>Run Mode</label>
          {runMode === 'debug' && (
            <span style={{ fontSize: '11px', background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', borderRadius: '999px', padding: '2px 10px', fontWeight: '600' }}>
              &#x1F41E; Debug active — toggle off in header to switch mode
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { value: 'local',  label: 'Local',  icon: '\u{1F4BB}', desc: 'Run on your machine directly — uses system memory, faster startup', accent: '#0E7C6B' },
            { value: 'docker', label: 'Docker', icon: '\u{1F433}', desc: 'Run in isolated Docker container — controlled memory, clean environment', accent: '#2D6A8A' },
          ].map(function (opt) {
            var isSelected = runMode === opt.value;
            var isDebugActive = runMode === 'debug';
            return (
              <button
                key={opt.value}
                onClick={function () { setRunMode(opt.value); }}
                title={isDebugActive ? 'Click to switch to ' + opt.label + ' mode (exits Debug)' : ''}
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                  background: isSelected ? opt.accent + '12' : colors.surface,
                  border: '2px solid ' + (isSelected ? opt.accent : colors.border),
                  textAlign: 'left', transition: 'all 0.15s',
                  opacity: isDebugActive ? 0.45 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: '2px solid ' + (isSelected ? opt.accent : colors.subtle),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isSelected ? opt.accent : 'transparent',
                  }}>
                    {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: isSelected ? opt.accent : colors.text }}>{opt.icon} {opt.label}</span>
                </div>
                <div style={{ fontSize: '11px', color: colors.muted, marginLeft: '24px' }}>{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Config form */}
      <div style={{ display: 'grid', gridTemplateColumns: runMode === 'docker' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '20px', maxWidth: runMode === 'docker' ? '720px' : runMode === 'debug' ? '280px' : '500px' }}>
        {runMode === 'docker' && (
          <div>
            <label style={{ fontSize: '11px', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Batch Size</label>
            <select
              value={batchSize}
              onChange={function (e) { setBatchSize(parseInt(e.target.value)); }}
              style={{ background: colors.inputBg, border: '1px solid ' + colors.inputBorder, color: colors.text, borderRadius: '6px', padding: '8px 12px', fontSize: '13px', width: '100%', cursor: 'pointer' }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
            <div style={{ fontSize: '10px', color: colors.subtle, marginTop: '4px' }}>Specs run in parallel per batch</div>
            <div style={{ fontSize: '11px', color: '#1E40AF', marginTop: '6px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '5px', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '13px' }}>&#x1F4BE;</span>
              <span>Docker memory: <strong>managed dynamically</strong></span>
            </div>
          </div>
        )}
        {deviceCapacity && runMode === 'docker' && (
          <div style={{ gridColumn: runMode === 'docker' ? '1 / -1' : 'auto', marginTop: '-10px' }}>
            <div style={{ fontSize: '11px', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600', marginBottom: '10px' }}>Device Capacity</div>
            <div style={{ fontSize: '12px', color: colors.text, background: colors.surface, border: '1px solid ' + colors.border, borderRadius: '6px', padding: '12px', lineHeight: '1.6' }}>
              <div>💾 <strong>Total Memory:</strong> {deviceCapacity.totalMemory}GB</div>
              <div>✓ <strong>Available:</strong> {deviceCapacity.freeMemory}GB</div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid ' + colors.border }}>
                <div style={{ fontSize: '12px', color: colors.accent, fontWeight: '600' }}>📌 Recommended batch size: <strong style={{ color: colors.accent, fontSize: '14px' }}>{deviceCapacity.recommendedBatchSize}</strong></div>
                {batchSize > deviceCapacity.recommendedBatchSize && (
                  <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '6px', fontWeight: '500' }}>⚠️ Warning: Batch size {batchSize} may exceed device capacity!</div>
                )}
              </div>
            </div>
          </div>
        )}
        <div>
          <label style={{ fontSize: '11px', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Browser</label>
          <select
            value={browser}
            onChange={function (e) { setBrowser(e.target.value); }}
            style={{ background: colors.inputBg, border: '1px solid ' + colors.inputBorder, color: colors.text, borderRadius: '6px', padding: '8px 12px', fontSize: '13px', width: '100%', cursor: 'pointer' }}
          >
            {(runMode === 'local' || runMode === 'debug') && installedBrowsers ? (
              installedBrowsers.map(function (b) {
                return React.createElement('option', { key: b.name, value: b.name }, b.displayName);
              })
            ) : runMode === 'docker' ? (
              React.createElement(React.Fragment, null,
                React.createElement('option', { value: 'chrome' }, 'Chrome'),
                React.createElement('option', { value: 'firefox' }, 'Firefox'),
                React.createElement('option', { value: 'edge' }, 'Edge')
              )
            ) : (
              React.createElement(React.Fragment, null,
                React.createElement('option', { value: 'chrome' }, 'Chrome'),
                React.createElement('option', { value: 'electron' }, 'Electron')
              )
            )}
          </select>
          {(runMode === 'local' || runMode === 'debug') && installedBrowsers && (
            <div style={{ fontSize: '10px', color: colors.subtle, marginTop: '4px' }}>{installedBrowsers.length} browser{installedBrowsers.length !== 1 ? 's' : ''} detected</div>
          )}
        </div>
        {runMode === 'local' && (
          <div>
            <label style={{ fontSize: '11px', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Display Mode</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'headless', label: 'Headless', icon: '\u{1F6AB}', accent: '#0E7C6B' },
                { id: 'headed',   label: 'Headed',   icon: '\u{1F5A5}\u{FE0F}', accent: '#7C3AED' },
              ].map(function (opt) {
                var isSelected = headed === (opt.id === 'headed');
                return (
                  <button
                    key={opt.id}
                    onClick={function () { setHeaded(opt.id === 'headed'); }}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                      background: isSelected ? opt.accent + '15' : colors.surface,
                      border: '2px solid ' + (isSelected ? opt.accent : colors.border),
                      color: isSelected ? opt.accent : colors.muted,
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.icon} {opt.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '10px', color: colors.subtle, marginTop: '4px' }}>
              {headed ? 'Browser window will be visible on screen' : 'Runs in background (faster)'}
            </div>
          </div>
        )}
      </div>

      {/* Info indicator */}
      {runMode === 'docker' ? (
        <div style={{ marginTop: '20px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>&#x1F433;</span>
          Tests will run in <strong style={{ margin: '0 4px' }}>headless mode</strong> inside a Docker container. Memory managed dynamically by Docker.
        </div>
      ) : runMode === 'debug' ? (
        <div style={{ marginTop: '20px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', color: '#9A3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>&#x1F41E;</span>
          <span><strong>cypress open</strong> will launch the interactive Test Runner — command log, time-travel snapshots &amp; DevTools. Feature file selection is optional; you can pick specs directly in the Test Runner.</span>
        </div>
      ) : (
        <div style={{ marginTop: '20px', background: headed ? '#F5F3FF' : '#ECFDF5', border: '1px solid ' + (headed ? '#DDD6FE' : '#A7F3D0'), borderRadius: '8px', padding: '10px 16px', fontSize: '13px', color: headed ? '#5B21B6' : '#065F46', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{headed ? '\u{1F5A5}\u{FE0F}' : '\u{1F4BB}'}</span>
          Tests will run <strong style={{ margin: '0 4px' }}>locally</strong> in <strong style={{ margin: '0 4px' }}>{headed ? 'headed' : 'headless'}</strong> mode{headed ? ' — browser window will open on screen.' : ' using available system memory. No Docker overhead.'}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent, colors }) {
  return (
    <div style={{ background: colors.surface, border: '1px solid ' + colors.border, borderRadius: '10px', padding: '14px', borderLeft: '2px solid ' + accent, boxShadow: '0 0 16px rgba(99,102,241,0.06)' }}>
      <div style={{ fontSize: '10px', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: accent }}>{value}</div>
    </div>
  );
}

// ============================================================================
//  RUN STATUS BAR — sticky top bar showing status, env, timer, progress
// ============================================================================

function RunStatusBar({ runStatus, selectedEnv, runMode, browser, batchSize, manifest, completions, elapsed, stopRun, colors }) {
  var isRunning = runStatus === 'running';
  var isStopping = runStatus === 'stopping';
  var isPassed = runStatus === 'passed';
  var isFailed = runStatus === 'failed';

  var dotColor = (isRunning || isStopping) ? '#F59E0B' : isPassed ? '#10B981' : isFailed ? '#EF4444' : '#6B7B8D';
  var statusText = isRunning ? 'RUNNING' : isStopping ? 'STOPPING' : isPassed ? 'PASSED' : isFailed ? 'FAILED' : 'STOPPED';

  var doneCount = Object.keys(completions).length;
  var totalCount = manifest.length;
  var progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : (isRunning ? 5 : 0);
  var barColor = isFailed ? '#EF4444' : isPassed ? '#10B981' : '#F59E0B';
  var elapsedStr = formatElapsed(elapsed);

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: '#0F1B2B',
      border: '1px solid ' + colors.border,
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: '12px', fontWeight: '700', color: dotColor, letterSpacing: '0.06em' }}>{statusText}</span>
        <span style={{ color: colors.border }}>|</span>
        <span style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px' }}>
          {selectedEnv || 'env'}
        </span>
        <span style={{ fontSize: '11px', color: colors.muted }}>
          {runMode === 'docker' ? '\uD83D\uDC33 Docker' : '\uD83D\uDCBB Local'}
          {' \u00B7 '}{browser || 'chrome'}
          {runMode === 'docker' ? ' \u00B7 Batch ' + batchSize : ''}
        </span>
        <div style={{ flex: 1 }} />
        {elapsed > 0 && (
          <span style={{ fontSize: '12px', color: colors.muted, fontFamily: "'Cascadia Code', monospace" }}>
            {'\u23F1 ' + elapsedStr}
          </span>
        )}
        {(isRunning || isStopping) && (
          <button
            onClick={stopRun}
            disabled={isStopping}
            style={{
              background: isStopping ? '#374151' : '#7F1D1D',
              color: isStopping ? '#9CA3AF' : '#FCA5A5',
              border: '1px solid ' + (isStopping ? '#4B5563' : '#991B1B'),
              padding: '4px 12px', borderRadius: '5px',
              fontSize: '11px', fontWeight: '700', cursor: isStopping ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            {isStopping ? 'STOPPING...' : '\u25A0 STOP'}
          </button>
        )}
      </div>
      <div>
        <div style={{ width: '100%', height: '4px', background: colors.inputBg, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            width: Math.max(progressPct, 2) + '%', height: '100%',
            background: barColor, borderRadius: '2px', transition: 'width 0.5s ease',
          }} />
        </div>
        {totalCount > 0 && (
          <div style={{ fontSize: '10px', color: colors.muted, marginTop: '4px' }}>
            {doneCount} / {totalCount} specs complete
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
//  COMPLETION SUMMARY — banner + failure cards shown when run finishes
// ============================================================================

function CompletionSummary({ runStatus, elapsed, manifest, completions, byContainer, colors, resetRun }) {
  var isPassed = runStatus === 'passed';
  var isFailed = runStatus === 'failed';
  var failedNums = Object.keys(completions).filter(function(n) { return completions[parseInt(n)] === 'failed'; }).map(Number);
  var passedCount = Object.keys(completions).filter(function(n) { return completions[parseInt(n)] === 'passed'; }).length;
  var failedCount = failedNums.length;
  var totalCount = manifest.length;

  var bannerBg = isPassed ? '#F0FDF4' : isFailed ? '#FEF2F2' : '#F8FAFC';
  var bannerBorder = isPassed ? '1px solid #86EFAC' : isFailed ? '1px solid #FECACA' : '1px solid #CBD5E1';
  var bannerTextColor = isPassed ? '#166534' : isFailed ? '#991B1B' : '#475569';
  var icon = isPassed ? '\u2713' : isFailed ? '\u2717' : '\u25A0';
  var title = isPassed ? 'All Tests Passed' : isFailed ? (failedCount + ' Spec' + (failedCount > 1 ? 's' : '') + ' Failed') : 'Run Stopped';

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        background: bannerBg, border: bannerBorder, borderRadius: '8px',
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: failedNums.length > 0 ? '10px' : '0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', color: bannerTextColor, fontWeight: '700' }}>{icon}</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: bannerTextColor }}>{title}</div>
            <div style={{ fontSize: '11px', color: '#6B7B8D', marginTop: '2px' }}>
              {passedCount + ' passed \u00B7 ' + failedCount + ' failed \u00B7 ' + totalCount + ' total \u00B7 ' + formatElapsed(elapsed)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={function() { resetRun(); }} style={{ background: '#0E7C6B', color: 'white', padding: '7px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
            {'\u21BB Run Again'}
          </button>
          <button onClick={function() { resetRun(2); }} style={{ background: 'transparent', border: '1px solid ' + colors.border, color: colors.text, padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
            {'\u2190 Change Specs'}
          </button>
        </div>
      </div>
      {failedNums.map(function(specNum) {
        var spec = manifest.find(function(s) { return s.num === specNum; });
        var container = byContainer[specNum];
        var errorLine = container && container.lines.slice().reverse().find(function(l) { return getLineType(l) === 'fail'; });
        return (
          <div key={specNum} style={{
            background: '#FFF5F5', border: '1px solid #FECACA',
            borderLeft: '3px solid #EF4444', borderRadius: '6px',
            padding: '10px 14px', marginBottom: '5px',
            fontFamily: "'Cascadia Code', 'Fira Code', monospace", fontSize: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: errorLine ? '4px' : '0' }}>
              <span style={{ color: '#DC2626', fontWeight: '700' }}>{'\u2717'}</span>
              <span style={{ color: '#991B1B', fontWeight: '600' }}>{'Spec ' + specNum + ' \u00B7 ' + (spec ? spec.name : '?')}</span>
            </div>
            {errorLine && (
              <div style={{ color: '#B91C1C', paddingLeft: '20px', opacity: 0.85, fontSize: '11px' }}>{stripAnsi(errorLine)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
//  STEP 4: RUN PANEL
// ============================================================================

function RunPanel({ runMode, batchSize, selectedEnv, browser, dockerStatus, buildingImage, buildLogs, buildProgress, buildElapsed, buildDockerImage, runId, runStatus, runLogs, runReportDir, startRun, stopRun, resetRun, logEndRef, colors, checkDockerStatus }) {

  const [stats, setStats] = React.useState(null);
  const statsIntervalRef = React.useRef(null);
  const [liveScreenshots, setLiveScreenshots] = React.useState([]);
  var isDocker = runMode === 'docker';

  // Elapsed timer for active run
  const [runElapsed, setRunElapsed] = React.useState(0);
  const runStartRef = React.useRef(null);
  React.useEffect(function() {
    if (runStatus === 'running') {
      if (!runStartRef.current) runStartRef.current = Date.now();
      var interval = setInterval(function() {
        setRunElapsed(Math.floor((Date.now() - runStartRef.current) / 1000));
      }, 1000);
      return function() { clearInterval(interval); };
    } else if (!runStatus) {
      runStartRef.current = null;
      setRunElapsed(0);
    }
  }, [runStatus]);

  // Log filter state
  const [logFilter, setLogFilter] = React.useState('all');
  const [logSearch, setLogSearch] = React.useState('');
  const [autoScroll, setAutoScroll] = React.useState(true);

  // Poll Docker stats while running (docker mode only)
  React.useEffect(function () {
    if (isDocker && runStatus === 'running' && runId) {
      function fetchStats() {
        fetch('/api/docker/stats/' + runId)
          .then(function (r) { return r.json(); })
          .then(function (r) {
            if (r.ok && r.stats) setStats(r.stats);
          })
          .catch(function () { });
      }
      fetchStats();
      statsIntervalRef.current = setInterval(fetchStats, 3000);
      return function () { clearInterval(statsIntervalRef.current); };
    } else {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (runStatus !== 'running') setStats(null);
    }
  }, [runStatus, runId, isDocker]);

  // Poll live screenshots every 3s while Docker run is active
  React.useEffect(function () {
    if (!runId || runStatus !== 'running' || !isDocker) return;
    var interval = setInterval(function () {
      fetch('/api/run/screenshots/' + runId)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (Array.isArray(data) && data.length > 0) {
            setLiveScreenshots(data);
          }
        })
        .catch(function () { });
    }, 3000);
    return function () { clearInterval(interval); };
  }, [runId, runStatus, isDocker]);

  // Clear live screenshots when run resets
  React.useEffect(function () {
    if (!runStatus) setLiveScreenshots([]);
  }, [runStatus]);

  // Docker-specific checks (skip for local mode)
  if (isDocker) {
    // Not checked yet
    if (!dockerStatus) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: colors.muted }}>
          <Spinner dark={true} /> Checking Docker status...
        </div>
      );
    }

    // Docker exe not found — not installed
    if (!dockerStatus.docker) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#x26A0;</div>
          <h3 style={{ color: '#991B1B', marginBottom: '8px' }}>Docker Not Found</h3>
          <p style={{ color: colors.muted, fontSize: '13px' }}>Docker is required to run tests in isolated containers.</p>
          <p style={{ color: colors.muted, fontSize: '13px' }}>Install Docker Desktop and restart Cypress Launchpad.</p>
          <button onClick={checkDockerStatus} style={{ marginTop: '16px', background: colors.accent, color: 'white', padding: '8px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', boxShadow: '0 2px 8px rgba(14,124,107,0.2)' }}>
            Re-check Docker
          </button>
        </div>
      );
    }

    // Docker exe found but daemon not running
    if (!dockerStatus.daemonRunning) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#x1F6D1;</div>
          <h3 style={{ color: '#92400E', marginBottom: '8px' }}>Docker Desktop is Not Running</h3>
          <p style={{ color: colors.muted, fontSize: '13px' }}>Docker is installed but the daemon is not running.</p>
          <p style={{ color: colors.muted, fontSize: '13px' }}>Open Docker Desktop and wait for the green icon in the system tray, then click Re-check.</p>
          <button onClick={checkDockerStatus} style={{ marginTop: '16px', background: colors.accent, color: 'white', padding: '8px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', boxShadow: '0 2px 8px rgba(14,124,107,0.2)' }}>
            Re-check Docker
          </button>
        </div>
      );
    }

    // Image not built
    if (!dockerStatus.imageExists && !buildingImage && !runStatus) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#x1F4E6;</div>
          <h3 style={{ color: colors.text, marginBottom: '8px' }}>Docker Image Required</h3>
          <p style={{ color: colors.muted, fontSize: '13px', marginBottom: '16px' }}>First-time build may take several minutes.</p>
          <button onClick={function() { buildDockerImage(true); }} style={{ background: colors.accent, color: 'white', padding: '10px 28px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
            Build Docker Image
          </button>
        </div>
      );
    }

    // Building image
    if (buildingImage) {
      var pct = buildProgress.total > 0 ? Math.round((buildProgress.current / buildProgress.total) * 100) : 0;
      var elapsedMin = Math.floor(buildElapsed / 60);
      var elapsedSec = buildElapsed % 60;
      var elapsedStr = (elapsedMin > 0 ? elapsedMin + 'm ' : '') + elapsedSec + 's';
      return (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: colors.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner dark={true} /> Building Docker Image...
          </h3>

          {/* Progress bar */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>
                {buildProgress.total > 0 ? 'Step ' + buildProgress.current + ' / ' + buildProgress.total : 'Initializing...'}
              </span>
              <span style={{ fontSize: '13px', color: colors.muted, fontFamily: "'Cascadia Code', 'Fira Code', monospace" }}>
                {pct + '% \u00B7 ' + elapsedStr}
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: colors.inputBg, borderRadius: '4px', overflow: 'hidden', border: '1px solid ' + colors.border }}>
              <div style={{
                width: (pct || 2) + '%',
                height: '100%',
                background: pct >= 100 ? '#0E7C6B' : 'linear-gradient(90deg, #0E7C6B, #12a089)',
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>

          <LogViewer logs={buildLogs} logEndRef={logEndRef} colors={colors} />
        </div>
      );
    }
  }

  // Parse logs once for all sub-components
  var parsedLogs = parseLogs(runLogs);

  // Compute visible panel indices (same priority logic as SplitLogViewer) so filter counts match what's shown
  var _allIdx = Object.keys(parsedLogs.byContainer).map(Number).sort(function(a,b){return a-b;});
  var _runIdx = _allIdx.filter(function(i){return !parsedLogs.completions[i];});
  var _visIdx;
  if (_runIdx.length >= 2) {
    _visIdx = _runIdx.slice(-2);
  } else if (_runIdx.length === 1) {
    var _compIdx = _allIdx.filter(function(i){return !!parsedLogs.completions[i];});
    _visIdx = _compIdx.length > 0
      ? [_compIdx[_compIdx.length-1], _runIdx[0]].sort(function(a,b){return a-b;})
      : _runIdx;
  } else {
    _visIdx = _allIdx.slice(-2);
  }
  // Count errors/warnings only from lines that SplitLogViewer will actually display
  var visibleLogLines = parsedLogs.general.concat(
    _visIdx.reduce(function(acc, idx) {
      var c = parsedLogs.byContainer[idx];
      return c ? acc.concat(c.lines) : acc;
    }, [])
  );
  var errorCount = visibleLogLines.filter(function(l) { return getLineType(l) === 'fail'; }).length;
  var warnCount = visibleLogLines.filter(function(l) { return getLineType(l) === 'warn'; }).length;

  // Map stats entries to spec names via parseLogs (active running specs in order)
  var runningSpecNums = Object.keys(parsedLogs.byContainer)
    .map(Number).sort(function(a, b) { return a - b; })
    .filter(function(n) { return !parsedLogs.completions[n]; });

  // Ready to run or already running
  return (
    <div>

      {/* ── STICKY STATUS BAR — shown once a run starts ─────────────────── */}
      {runStatus && (
        <RunStatusBar
          runStatus={runStatus}
          selectedEnv={selectedEnv}
          runMode={runMode}
          browser={browser}
          batchSize={batchSize}
          manifest={parsedLogs.manifest}
          completions={parsedLogs.completions}
          elapsed={runElapsed}
          stopRun={stopRun}
          colors={colors}
        />
      )}

      {/* ── POST-RUN ACTION BAR — quick restart buttons shown after run ends ── */}
      {(runStatus === 'passed' || runStatus === 'failed' || runStatus === 'stopped') && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={function() { resetRun(); }}
            style={{ background: '#0E7C6B', color: 'white', padding: '7px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Run again with the same config"
          >&#x21BB; Run Again</button>
          <button
            onClick={function() { resetRun(2); }}
            style={{ background: 'transparent', color: colors.text, padding: '7px 14px', borderRadius: '6px', border: '1px solid ' + colors.border, cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
            title="Go back to Features step"
          >&#x2630; Change Features</button>
          <button
            onClick={function() { resetRun(1); }}
            style={{ background: 'transparent', color: colors.text, padding: '7px 14px', borderRadius: '6px', border: '1px solid ' + colors.border, cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
            title="Go back to Step 1 to change environment"
          >&#x2B21; Change Environment</button>
        </div>
      )}

      {/* ── READY STATE — no run yet ─────────────────────────────────────── */}
      {!runStatus && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: colors.text }}>Ready to Run</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <button onClick={startRun} style={{ background: '#0E7C6B', color: 'white', padding: '10px 28px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(14,124,107,0.25)' }}>
              {isDocker ? '\uD83D\uDC33 Run Tests in Docker' : '\uD83D\uDCBB Run Tests Locally'}
            </button>
          </div>
          {isDocker && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <button onClick={function() { buildDockerImage(false); }} style={{ background: 'transparent', color: colors.muted, padding: '7px 14px', borderRadius: '7px', border: '1px solid ' + colors.border, cursor: 'pointer', fontSize: '12px', fontWeight: '600' }} title="Fast rebuild — copies updated code, skips npm install">
                  {'\u21BB Rebuild Image'}
                </button>
                <button onClick={function() { buildDockerImage(true); }} style={{ background: 'transparent', color: '#e8a735', padding: '7px 14px', borderRadius: '7px', border: '1px solid #e8a735', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }} title="Full rebuild — runs npm install from scratch">
                  {'\u21BB Full Rebuild (npm install)'}
                </button>
              </div>
              <div style={{ fontSize: '11px', color: colors.muted }}>
                Use <strong style={{ color: colors.text }}>Rebuild Image</strong> after code changes &nbsp;{'\u00B7'}&nbsp; Use <strong style={{ color: '#e8a735' }}>Full Rebuild</strong> only after package.json changes
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STOPPING NOTICE ──────────────────────────────────────────────── */}
      {runStatus === 'stopping' && (
        <div style={{ fontSize: '12px', color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '7px 12px', marginBottom: '12px', display: 'inline-block' }}>
          Sending stop signal to containers, please wait...
        </div>
      )}

      {/* ── CONTAINER STATS — inline bar per active container ────────────── */}
      {(runStatus === 'running' || runStatus === 'stopping') && stats && stats.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          {stats.map(function(entry, i) {
            var specNum = runningSpecNums[i];
            var specName = (specNum != null && parsedLogs.byContainer[specNum])
              ? parsedLogs.byContainer[specNum].name
              : entry.containerId;
            var s = entry.stats;
            var cpuPct = parseFloat(s.cpu) || 0;
            var memPct = parseFloat(s.memPercent) || 0;
            var cpuColor = cpuPct > 90 ? '#EF4444' : cpuPct > 70 ? '#F59E0B' : '#34D399';
            var memColor = memPct > 85 ? '#EF4444' : memPct > 65 ? '#F59E0B' : '#38BDF8';
            return React.createElement('div', { key: entry.containerId, style: {
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '6px 10px', background: colors.surface,
              border: '1px solid ' + colors.border, borderRadius: '6px',
              marginBottom: '4px', fontSize: '11px',
              fontFamily: "'Cascadia Code', monospace",
            }},
              React.createElement('span', { style: { color: '#F59E0B', fontWeight: '700', flexShrink: 0 } },
                specNum != null ? 'Spec ' + specNum : '\u2014'
              ),
              React.createElement('span', { style: { color: colors.text, flexShrink: 0, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, specName),
              React.createElement('span', { style: { color: colors.muted, marginLeft: 'auto', flexShrink: 0, fontSize: '10px' } }, '\u26A1'),
              React.createElement('div', { style: { width: '72px', height: '5px', background: colors.inputBg, borderRadius: '3px', flexShrink: 0 } },
                React.createElement('div', { style: { width: Math.min(cpuPct,100)+'%', height:'100%', background: cpuColor, borderRadius:'3px', transition:'width 0.5s' } })
              ),
              React.createElement('span', { style: { color: cpuColor, fontWeight: '600', minWidth: '38px', flexShrink: 0 } }, s.cpu || '--'),
              React.createElement('span', { style: { color: colors.muted, marginLeft: '6px', flexShrink: 0, fontSize: '10px' } }, '\uD83D\uDCBE'),
              React.createElement('div', { style: { width: '60px', height: '5px', background: colors.inputBg, borderRadius: '3px', flexShrink: 0 } },
                React.createElement('div', { style: { width: Math.min(memPct,100)+'%', height:'100%', background: memColor, borderRadius:'3px', transition:'width 0.5s' } })
              ),
              React.createElement('span', { style: { color: memColor, fontWeight: '600', minWidth: '80px', flexShrink: 0 } }, s.memory || '--')
            );
          })}
        </div>
      )}

      {/* ── SPEC PROGRESS TRACKER ────────────────────────────────────────── */}
      {runLogs.length > 0 && (
        <SpecProgressTracker logs={runLogs} colors={colors} />
      )}

      {/* ── LOG FILTER BAR ───────────────────────────────────────────────── */}
      {runLogs.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'full-log', label: 'Full Log' },
          ].map(function(f) {
            var isActive = logFilter === f.key;
            var accentColor = f.key === 'full-log' ? '#7C3AED' : colors.accent;
            return (
              <button key={f.key} onClick={function() { setLogFilter(f.key); }}
                style={{
                  padding: '4px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: '600',
                  cursor: 'pointer', transition: 'all 0.12s',
                  background: isActive ? accentColor + '20' : 'transparent',
                  border: '1px solid ' + (isActive ? accentColor : colors.border),
                  color: isActive ? accentColor : colors.muted,
                }}
              >{f.label}</button>
            );
          })}
          <button
            onClick={function() { setAutoScroll(function(v) { return !v; }); }}
            title={autoScroll ? 'Auto-scroll ON — click to disable' : 'Auto-scroll OFF — click to enable'}
            style={{
              padding: '4px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: '600',
              cursor: 'pointer', transition: 'all 0.12s',
              background: autoScroll ? '#0E7C6B20' : 'transparent',
              border: '1px solid ' + (autoScroll ? '#0E7C6B' : colors.border),
              color: autoScroll ? '#0E7C6B' : colors.muted,
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >&#x21E9; {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}</button>
          <input
            type="text"
            placeholder="Search logs..."
            value={logSearch}
            onChange={function(e) { setLogSearch(e.target.value); }}
            style={{
              marginLeft: 'auto', background: colors.inputBg, border: '1px solid ' + colors.inputBorder,
              borderRadius: '5px', color: colors.text, padding: '4px 10px',
              fontSize: '11px', fontFamily: "'Cascadia Code', monospace",
              width: '180px',
            }}
          />
        </div>
      )}

      {/* ── LOG VIEWERS — Full Log tab shows all containers; otherwise split panels ── */}
      {runLogs.length > 0 && logFilter === 'full-log' ? (
        <FullLogViewer logs={runLogs} logSearch={logSearch} colors={colors} />
      ) : runLogs.length > 0 ? (
        <SplitLogViewer logs={runLogs} batchSize={batchSize || 2} colors={colors} logFilter={logFilter} logSearch={logSearch} autoScroll={autoScroll} />
      ) : null}

      {/* ── LIVE SCREENSHOTS ─────────────────────────────────────────────── */}
      {liveScreenshots.some(function (g) { return g.screenshots.length > 0; }) && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>
            Failed Screenshots (live)
          </div>
          {liveScreenshots.filter(function (g) { return g.screenshots.length > 0; }).map(function (group) {
            return React.createElement('div', { key: group.idx, style: { marginBottom: '12px' } },
              React.createElement('div', { style: { fontSize: '12px', color: colors.muted, marginBottom: '6px' } },
                'Spec ' + (parseInt(group.idx) + 1) + ' \u2502 ' + group.specName
              ),
              React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
                group.screenshots.map(function (ss) {
                  return React.createElement('a', { key: ss.name, href: ss.url, target: '_blank', rel: 'noreferrer' },
                    React.createElement('img', {
                      src: ss.url, alt: ss.name, title: ss.name,
                      style: { width: '200px', height: '120px', objectFit: 'cover', borderRadius: '4px', border: '1px solid ' + colors.border, cursor: 'pointer' },
                    })
                  );
                })
              )
            );
          })}
        </div>
      )}

    </div>
  );
}

// ============================================================================
//  STAT BADGE (Docker container stats)
// ============================================================================

function StatBadge({ label, value, icon, barColor, barPercent, colors }) {
  return (
    <div style={{
      background: colors.surface, border: '1px solid ' + colors.border, borderRadius: '8px',
      padding: '10px 12px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background progress bar for CPU/Memory */}
      {barPercent != null && (
        <div style={{
          position: 'absolute', left: 0, bottom: 0, height: '3px',
          width: Math.min(barPercent, 100) + '%',
          background: barColor, borderRadius: '0 2px 0 8px',
          transition: 'width 0.5s ease',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px' }}>{icon}</span>
        <span style={{ fontSize: '10px', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>{label}</span>
      </div>
      <div style={{ fontSize: '13px', fontWeight: '700', color: barColor, fontFamily: "'Cascadia Code', 'Fira Code', monospace" }}>
        {value || '--'}
      </div>
    </div>
  );
}

// ============================================================================
//  LOG VIEWER
// ============================================================================

// Splits a flat log array into per-container groups by parsing [spec-X | name] prefix.
// Also extracts spec-manifest (full ordered list) and completions (passed/failed per spec num).
// Lines without a spec prefix (e.g. [docker] Found 3 spec(s)...) go into `general`.
function parseLogs(logs) {
  var prefixRe = /^\[spec-(\d+) \| ([^\]]+)\]/;
  var manifestRe = /^\[docker\] spec-manifest: (.+)$/;
  var completionRe = /^\[docker\] Spec (\d+) \| .+ \u2014 ([\u2713\u2717])/;
  var byContainer = {};
  var general = [];
  var manifest = []; // [{ num, name }] ordered list of all specs
  var completions = {}; // { specNum: 'passed' | 'failed' }

  logs.forEach(function (line) {
    // Spec manifest — parse once, don't add to general
    var mm = line.match(manifestRe);
    if (mm) {
      manifest = mm[1].split(',').map(function (part) {
        var colon = part.indexOf(':');
        return { num: parseInt(part.substring(0, colon), 10), name: part.substring(colon + 1) };
      });
      return;
    }
    // Completion summary line — track status and keep in general
    var mc = line.match(completionRe);
    if (mc) {
      completions[parseInt(mc[1], 10)] = mc[2] === '\u2713' ? 'passed' : 'failed';
    }
    // Per-container prefixed line
    var m = line.match(prefixRe);
    if (m) {
      var idx = parseInt(m[1], 10);
      var name = m[2].trim();
      if (!byContainer[idx]) byContainer[idx] = { name: name, lines: [] };
      byContainer[idx].lines.push(line.replace(prefixRe, '').trim());
    } else {
      general.push(line);
    }
  });

  return { byContainer: byContainer, general: general, manifest: manifest, completions: completions };
}

// ============================================================================
//  SPEC PROGRESS TRACKER
// ============================================================================

// Shows all specs with their current status: pending / running / passed / failed.
// Derives status from parseLogs output — no extra state needed.
function SpecProgressTracker({ logs, colors }) {
  var parsed = parseLogs(logs);
  var manifest = parsed.manifest;       // [{ num, name }]
  var completions = parsed.completions; // { num: 'passed'|'failed' }
  var running = parsed.byContainer;     // { num: { name, lines[] } }

  if (manifest.length === 0) return null;

  var passedCount = Object.keys(completions).filter(function(n){return completions[parseInt(n)]==='passed';}).length;
  var failedCount = Object.keys(completions).filter(function(n){return completions[parseInt(n)]==='failed';}).length;
  var doneCount = Object.keys(completions).length;
  var runningCount = Object.keys(running).filter(function (n) { return !completions[parseInt(n)]; }).length;
  var pendingCount = manifest.length - doneCount - runningCount;

  var statusColors = {
    pending: colors.muted,
    running: '#D97706',
    passed: '#059669',
    failed: '#DC2626',
  };

  return (
    <div style={{
      marginBottom: '12px',
      background: colors.surface,
      border: '1px solid ' + colors.border,
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '8px 14px',
        background: colors.surface,
        borderBottom: '1px solid ' + colors.border,
        fontSize: '12px', fontWeight: '600', color: colors.text,
      }}>
        <span>Spec Progress</span>
        <span style={{ marginLeft: 'auto', color: colors.muted, fontWeight: '400' }}>
          {manifest.length} total
        </span>
        {runningCount > 0 && (
          <span style={{ color: statusColors.running }}>&#x25B6; {runningCount} running</span>
        )}
        {pendingCount > 0 && (
          <span style={{ color: colors.muted }}>&#x23F3; {pendingCount} pending</span>
        )}
        {passedCount > 0 && (
          <span style={{ color: statusColors.passed }}>&#x2713; {passedCount} passed</span>
        )}
        {failedCount > 0 && (
          <span style={{ color: statusColors.failed }}>&#x2717; {failedCount} failed</span>
        )}
      </div>

      {/* Spec list */}
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {manifest.map(function (spec) {
          var isRunning = !!running[spec.num] && !completions[spec.num];
          var status = completions[spec.num] || (isRunning ? 'running' : 'pending');
          var icon = status === 'passed' ? '\u2713'
                   : status === 'failed' ? '\u2717'
                   : status === 'running' ? '\u25B6'
                   : '\u00B7';
          var col = statusColors[status];
          return (
            <div key={spec.num} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '5px 14px',
              borderBottom: '1px solid ' + colors.border,
              fontSize: '12px',
              background: isRunning ? 'rgba(245,158,11,0.06)' : status === 'failed' ? 'rgba(239,68,68,0.04)' : 'transparent',
            }}>
              <span style={{ color: col, fontWeight: '700', width: '14px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
              <span style={{ color: colors.muted, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>Spec {spec.num}</span>
              <span style={{
                color: status === 'pending' ? colors.muted : colors.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={spec.name}>{spec.name}</span>
              <span style={{
                marginLeft: 'auto', flexShrink: 0,
                fontSize: '11px', fontWeight: '600', color: col,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
//  FULL LOG VIEWER — shows ALL container logs in one sequential Jenkins-style stream
// ============================================================================

function FullLogViewer({ logs, logSearch, colors }) {
  var parsed = parseLogs(logs);
  var bodyRef = React.useRef(null);
  var [copied, setCopied] = React.useState(false);

  // Auto-scroll to bottom when new lines arrive
  React.useEffect(function() {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [logs]);

  function applySearch(lines) {
    if (!logSearch) return lines;
    var q = logSearch.toLowerCase();
    return lines.filter(function(l) { return l.toLowerCase().includes(q); });
  }

  // Build ordered sections: general [docker] lines first, then each spec in manifest order
  var sections = [];
  var generalLines = applySearch(parsed.general);
  if (generalLines.length > 0) {
    sections.push({ type: 'general', lines: generalLines });
  }

  if (parsed.manifest.length > 0) {
    parsed.manifest.forEach(function(spec) {
      var container = parsed.byContainer[spec.num];
      var lines = applySearch(container ? container.lines : []);
      if (lines.length > 0 || !logSearch) {
        sections.push({ type: 'spec', num: spec.num, name: spec.name, lines: lines, status: parsed.completions[spec.num] || (container ? 'running' : 'pending') });
      }
    });
  } else {
    // Local mode — no manifest, just show raw logs flat
    var rawLines = applySearch(logs);
    if (rawLines.length > 0) sections.push({ type: 'general', lines: rawLines });
  }

  var totalLines = sections.reduce(function(acc, s) { return acc + s.lines.length; }, 0);

  function copyAll() {
    var allText = sections.map(function(s) {
      if (s.type === 'general') return s.lines.map(stripAnsi).join('\n');
      return ['=== Spec ' + s.num + ' | ' + s.name + ' ==='].concat(s.lines.map(stripAnsi)).join('\n');
    }).join('\n\n');
    try {
      navigator.clipboard.writeText(allText);
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 1500);
    } catch(e) {}
  }

  var statusColors = { passed: '#059669', failed: '#DC2626', running: '#D97706', pending: '#6B7B8D' };

  return React.createElement('div', { style: { background: '#1A2332', border: '1px solid ' + colors.border, borderRadius: '8px', overflow: 'hidden' } },
    // Header bar
    React.createElement('div', { style: { padding: '7px 12px', background: '#0F1B2B', borderBottom: '1px solid ' + colors.border, display: 'flex', alignItems: 'center', gap: '10px' } },
      React.createElement('span', { style: { fontSize: '11px', fontWeight: '600', color: '#8899AA', fontFamily: "'Cascadia Code',monospace" } }, 'Full Log'),
      React.createElement('span', { style: { fontSize: '10px', color: '#4B5A6A', marginLeft: '4px' } }, totalLines + ' lines'),
      React.createElement('button', {
        onClick: copyAll,
        style: {
          marginLeft: 'auto', background: 'transparent', border: '1px solid #2A3A4A',
          borderRadius: '4px', color: copied ? '#059669' : '#8899AA',
          padding: '2px 10px', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
        },
      }, copied ? '\u2713 Copied' : 'Copy All')
    ),
    // Log body — fixed-height scrollable area
    React.createElement('div', {
      ref: bodyRef,
      style: {
        height: '640px', overflowY: 'auto', padding: '8px 4px',
        fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace",
        fontSize: '11.5px', lineHeight: '1.55',
      },
    },
      sections.length === 0
        ? React.createElement('div', { style: { padding: '20px', textAlign: 'center', color: '#4B5A6A', fontSize: '12px' } }, 'No logs match the search.')
        : sections.map(function(section, si) {
            if (section.type === 'general') {
              return React.createElement('div', { key: 'gen-' + si, style: { padding: '0 8px' } },
                section.lines.map(function(line, i) { return React.createElement(LogLine, { key: i, text: line, colors: colors }); })
              );
            }
            // Spec section with divider header
            var sColor = statusColors[section.status] || '#8899AA';
            return React.createElement('div', { key: 'spec-' + section.num },
              // Section header — Jenkins-style stage banner
              React.createElement('div', { style: {
                margin: '8px 0 2px', padding: '5px 10px',
                background: 'rgba(255,255,255,0.04)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                borderLeft: '3px solid ' + sColor,
                display: 'flex', alignItems: 'center', gap: '8px',
              }},
                React.createElement('span', { style: { color: sColor, fontSize: '10px', fontWeight: '700' } }, '\u25B6'),
                React.createElement('span', { style: { color: '#D0DBE8', fontSize: '11px', fontWeight: '700', fontFamily: "'Cascadia Code',monospace" } },
                  'Spec ' + section.num + '  |  ' + section.name
                ),
                React.createElement('span', { style: { marginLeft: 'auto', fontSize: '10px', fontWeight: '600', color: sColor, letterSpacing: '0.05em' } },
                  section.status.toUpperCase()
                )
              ),
              // Spec log lines
              React.createElement('div', { style: { padding: '2px 8px 4px' } },
                section.lines.length === 0
                  ? React.createElement('div', { style: { color: '#4B5A6A', fontSize: '11px', padding: '4px 0', fontStyle: 'italic' } }, 'No log lines.')
                  : section.lines.map(function(line, i) { return React.createElement(LogLine, { key: i, text: line, colors: colors }); })
              )
            );
          })
    )
  );
}

// Renders logs split into per-container panels side-by-side.
// Always shows the last 2 panels so completed specs remain visible.
// Column layout is controlled by batchSize: batchSize=1 → single column, batchSize≥2 → split.
function SplitLogViewer({ logs, batchSize, colors, logFilter, logSearch, autoScroll }) {
  var parsed = parseLogs(logs);
  var allIndices = Object.keys(parsed.byContainer).map(Number).sort(function(a, b) { return a - b; });
  // Prioritize running containers (not yet in completions) over completed ones
  var runningIndices = allIndices.filter(function(idx) { return !parsed.completions[idx]; });
  var indices;
  if (runningIndices.length >= 2) {
    indices = runningIndices.slice(-2);
  } else if (runningIndices.length === 1) {
    // Show the one running container + the most recent completed one (if any)
    var completedIndices = allIndices.filter(function(idx) { return !!parsed.completions[idx]; });
    indices = completedIndices.length > 0
      ? [completedIndices[completedIndices.length - 1], runningIndices[0]].sort(function(a, b) { return a - b; })
      : runningIndices;
  } else {
    // All done — show last 2
    indices = allIndices.slice(-2);
  }

  var ref0 = React.useRef(null);
  var ref1 = React.useRef(null);
  var refs = [ref0, ref1];
  var generalRef = React.useRef(null);
  const [copiedIdx, setCopiedIdx] = React.useState(null);

  React.useEffect(function () {
    if (!autoScroll) return;
    if (logFilter === 'all' && !logSearch) {
      // Scroll container panels
      indices.forEach(function (idx, slot) {
        if (refs[slot] && refs[slot].current) {
          refs[slot].current.scrollIntoView({ behavior: 'smooth' });
        }
      });
      // Scroll general section (debug / local run output)
      if (generalRef.current) {
        generalRef.current.scrollTop = generalRef.current.scrollHeight;
      }
    }
  }, [logs, autoScroll]);

  function filterLines(lines) {
    var out = lines;
    if (logFilter === 'errors') {
      out = out.filter(function(l) { return getLineType(l) === 'fail'; });
    } else if (logFilter === 'warnings') {
      out = out.filter(function(l) { return getLineType(l) === 'warn'; });
    }
    if (logSearch) {
      var q = logSearch.toLowerCase();
      out = out.filter(function(l) { return l.toLowerCase().includes(q); });
    }
    return out;
  }

  var filteredGeneral = filterLines(parsed.general);
  var columns = (indices.length >= 2 && (batchSize || 1) >= 2) ? '1fr 1fr' : '1fr';

  function copyLogs(lines, idx) {
    try {
      var clean = lines.map(stripAnsi).join('\n');
      navigator.clipboard.writeText(clean);
      setCopiedIdx(idx);
      setTimeout(function() { setCopiedIdx(null); }, 1500);
    } catch(e) {}
  }

  var panelStyle = {
    background: '#1A2332', border: '1px solid ' + colors.border, borderRadius: '8px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  };

  return (
    <div>
      {filteredGeneral.length > 0 && (
        <div ref={generalRef} style={{
          background: '#1A2332', border: '1px solid ' + colors.border, borderRadius: '8px',
          padding: '8px 12px', marginBottom: '6px',
          fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace", fontSize: '12px', lineHeight: '1.5',
          maxHeight: '420px', overflowY: 'auto',
        }}>
          {filteredGeneral.map(function (line, i) {
            return <LogLine key={i} text={line} colors={colors} />;
          })}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: columns, gap: '8px' }}>
        {indices.map(function (idx, slot) {
          var container = parsed.byContainer[idx];
          var filteredLines = filterLines(container.lines);
          return (
            <div key={idx} style={panelStyle}>
              <div style={{
                padding: '6px 10px', background: '#0F1B2B',
                borderBottom: '1px solid ' + colors.border,
                fontSize: '11px', color: colors.muted,
                fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                fontWeight: '600',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{'Spec ' + idx + ' \u2502 ' + container.name}</span>
                <button
                  onClick={function() { copyLogs(container.lines, idx); }}
                  style={{
                    background: 'transparent', border: '1px solid ' + colors.border,
                    color: copiedIdx === idx ? '#10B981' : colors.muted,
                    borderRadius: '4px', padding: '1px 8px',
                    fontSize: '10px', cursor: 'pointer', transition: 'color 0.2s',
                  }}
                >
                  {copiedIdx === idx ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{
                padding: '10px 12px',
                height: '640px', overflowY: 'auto',
                fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                fontSize: '12px', lineHeight: '1.5',
              }}>
                {filteredLines.length === 0
                  ? (container.lines.length === 0
                      ? <div style={{ color: colors.muted, fontStyle: 'italic' }}>Starting container...</div>
                      : <div style={{ color: colors.muted, fontStyle: 'italic' }}>No lines match current filter.</div>)
                  : filteredLines.map(function (line, i) {
                      return <LogLine key={i} text={line} colors={colors} />;
                    })
                }
                <div ref={refs[slot]} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogViewer({ logs, logEndRef, colors }) {
  return (
    <div style={{
      background: '#1A2332', border: '1px solid ' + colors.border, borderRadius: '8px',
      padding: '12px', maxHeight: '400px', overflowY: 'auto', fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace", fontSize: '12px',
      lineHeight: '1.5', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.15)',
    }}>
      {logs.map(function (line, idx) {
        return <LogLine key={idx} text={line} colors={colors} />;
      })}
      <div ref={logEndRef} />
    </div>
  );
}

function LogLine({ text, colors }) {
  var lineType = getLineType(text);
  var segments = parseAnsi(text);

  var lineBg = 'transparent';
  var lineIcon = '';
  if (lineType === 'pass') { lineBg = 'rgba(34, 197, 94, 0.08)'; lineIcon = '\u2713 '; }
  if (lineType === 'fail') { lineBg = 'rgba(239, 68, 68, 0.18)'; lineIcon = '\u2717 '; }
  if (lineType === 'warn') { lineBg = 'rgba(249, 115, 22, 0.12)'; lineIcon = '\u26A0 '; }

  var defaultColor = '#8899AA';
  if (lineType === 'pass') defaultColor = '#22c55e';
  if (lineType === 'fail') defaultColor = '#FCA5A5';
  if (lineType === 'warn') defaultColor = '#fdba74';
  if (lineType === 'pending') defaultColor = '#eab308';
  if (lineType === 'docker') defaultColor = '#06b6d4';

  var hasAnsiColors = segments.some(function (s) { return s.color !== null; });

  var borderLeftColor = 'transparent';
  if (lineType === 'fail') borderLeftColor = '#ef4444';
  if (lineType === 'warn') borderLeftColor = '#f97316';
  if (lineType === 'pass') borderLeftColor = '#22c55e';

  return (
    <div style={{
      padding: '2px 6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      background: lineBg, borderRadius: '3px', margin: '1px 0',
      borderLeft: '3px solid ' + borderLeftColor,
    }}>
      {lineIcon && (
        <span style={{ color: lineType === 'pass' ? '#22c55e' : lineType === 'warn' ? '#f97316' : '#ef4444', fontWeight: '700' }}>{lineIcon}</span>
      )}
      {segments.map(function (seg, i) {
        var segColor = seg.color || (hasAnsiColors ? '#c9d1d9' : defaultColor);
        return (
          <span key={i} style={{ color: segColor, fontWeight: seg.bold ? '700' : 'normal' }}>{seg.text}</span>
        );
      })}
    </div>
  );
}

// ============================================================================
//  FAILURES REPORT MODAL
// ============================================================================

function FailureReport({ reportName, data, onClose, colors }) {
  var failures = data.failures || [];
  var totalScenarios = data.totalScenarios || 0;
  var failedScenarios = data.failedScenarios || 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(27,40,56,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '32px 16px', overflowY: 'auto',
    }}>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2DCD3', borderRadius: '12px',
        width: '100%', maxWidth: '880px', minHeight: '200px',
        boxShadow: '0 24px 64px rgba(27,40,56,0.2)',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #E2DCD3',
          position: 'sticky', top: 0, background: '#FFFFFF', borderRadius: '12px 12px 0 0', zIndex: 10,
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: colors.text, marginBottom: '4px' }}>
              Failures Report
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', color: colors.muted }}>{reportName}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: failedScenarios > 0 ? '#FEF2F2' : '#ECFDF5',
              border: '1px solid ' + (failedScenarios > 0 ? '#FECACA' : '#A7F3D0'),
              borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: '700',
              color: failedScenarios > 0 ? '#991B1B' : '#065F46',
            }}>
              {failedScenarios} of {totalScenarios} scenarios failed
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#F2EDE6', border: '1px solid #E2DCD3', color: colors.muted,
                width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
                fontSize: '16px', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >&#x2715;</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {failures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: colors.muted }}>
              <div style={{ fontSize: '36px', marginBottom: '12px', color: '#065F46' }}>&#x2713;</div>
              <div style={{ fontSize: '14px' }}>No failures found in this report.</div>
            </div>
          ) : (
            failures.map(function (failure, idx) {
              return (
                <div key={idx} style={{
                  background: '#FAF7F2', border: '1px solid #E2DCD3', borderRadius: '10px', overflow: 'hidden',
                }}>
                  {/* Card header: feature name */}
                  <div style={{
                    background: '#F2EDE6', borderBottom: '1px solid #E2DCD3',
                    padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <span style={{ fontSize: '11px', color: '#6B7B8D', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Feature</span>
                    <span style={{ fontSize: '13px', color: '#1B2838', fontWeight: '600' }}>{failure.featureName}</span>
                  </div>

                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Scenario name */}
                    <div>
                      <div style={{ fontSize: '11px', color: '#6B7B8D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Scenario</div>
                      <div style={{ fontSize: '13px', color: '#1B2838', fontWeight: '500' }}>{failure.scenarioName}</div>
                    </div>

                    {/* Failed step */}
                    {failure.failedStep && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B7B8D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Failed Step</div>
                        <div style={{
                          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px',
                          padding: '8px 12px', fontSize: '13px', fontFamily: 'monospace', color: '#991B1B',
                        }}>
                          <span style={{ color: '#DC3545', fontWeight: '700' }}>{failure.failedStep.keyword} </span>
                          {failure.failedStep.name}
                        </div>
                      </div>
                    )}

                    {/* Error message */}
                    {failure.failedStep && failure.failedStep.errorMessage && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B7B8D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Error</div>
                        <pre style={{
                          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px',
                          padding: '12px', fontSize: '11px', fontFamily: 'monospace', color: '#991B1B',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '180px', overflowY: 'auto',
                          margin: 0,
                        }}>{failure.failedStep.errorMessage}</pre>
                      </div>
                    )}

                    {/* Screenshots */}
                    {failure.screenshots && failure.screenshots.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B7B8D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Screenshot</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {failure.screenshots.map(function (ss, si) {
                            return (
                              <img
                                key={si}
                                src={ss.apiPath}
                                alt={'Screenshot: ' + ss.file}
                                style={{
                                  maxWidth: '100%', borderRadius: '6px',
                                  border: '1px solid #E2DCD3', display: 'block',
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
//  RUN LOG VIEWER HELPERS (used in ReportViewer overlay)
// ============================================================================

// Copy-all button for run log overlay
function CopyLogButton({ lines }) {
  const [copied, setCopied] = React.useState(false);
  function copyAll() {
    try {
      navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 1500);
    } catch(e) {}
  }
  return React.createElement('button', {
    onClick: copyAll,
    style: {
      background: 'transparent', border: '1px solid #2A3A4A', borderRadius: '5px',
      color: copied ? '#059669' : '#8899AA', padding: '4px 10px',
      fontSize: '10px', fontWeight: '600', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
    },
  }, copied ? '\u2713 Copied' : 'Copy All');
}

// Scrollable log body — renders saved run.log lines using FullLogViewer logic
function RunLogBody({ lines, logSearch, colors }) {
  var bodyRef = React.useRef(null);

  if (!lines || lines.length === 0) {
    return React.createElement('div', {
      style: { flex: 1, background: '#1A2332', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5A6A', fontSize: '13px' },
    }, 'No log data found.');
  }

  // Apply search filter
  var filtered = logSearch
    ? lines.filter(function(l) { return l.toLowerCase().includes(logSearch.toLowerCase()); })
    : lines;

  // Re-use parseLogs to group by spec (the saved run.log contains original prefixed lines)
  var parsed = parseLogs(filtered);
  var statusColors = { passed: '#059669', failed: '#DC2626', running: '#D97706', pending: '#6B7B8D' };

  // Build sections same as FullLogViewer
  var sections = [];
  var generalLines = parsed.general;
  if (generalLines.length > 0) sections.push({ type: 'general', lines: generalLines });

  if (parsed.manifest.length > 0) {
    parsed.manifest.forEach(function(spec) {
      var container = parsed.byContainer[spec.num];
      var specLines = container ? container.lines : [];
      sections.push({ type: 'spec', num: spec.num, name: spec.name, lines: specLines, status: parsed.completions[spec.num] || (container ? 'running' : 'pending') });
    });
  } else if (sections.length === 0) {
    sections.push({ type: 'general', lines: filtered });
  }

  return React.createElement('div', {
    ref: bodyRef,
    style: {
      flex: 1, overflowY: 'auto', background: '#1A2332',
      padding: '8px 4px',
      fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace",
      fontSize: '11.5px', lineHeight: '1.55',
    },
  },
    filtered.length === 0
      ? React.createElement('div', { style: { padding: '20px', textAlign: 'center', color: '#4B5A6A', fontSize: '12px' } }, 'No lines match the search.')
      : sections.map(function(section, si) {
          if (section.type === 'general') {
            return React.createElement('div', { key: 'gen-' + si, style: { padding: '0 8px' } },
              section.lines.map(function(line, i) { return React.createElement(LogLine, { key: i, text: line, colors: colors }); })
            );
          }
          var sColor = statusColors[section.status] || '#8899AA';
          return React.createElement('div', { key: 'spec-' + section.num },
            React.createElement('div', { style: {
              margin: '8px 0 2px', padding: '5px 10px',
              background: 'rgba(255,255,255,0.04)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              borderLeft: '3px solid ' + sColor,
              display: 'flex', alignItems: 'center', gap: '8px',
            }},
              React.createElement('span', { style: { color: sColor, fontSize: '10px', fontWeight: '700' } }, '\u25B6'),
              React.createElement('span', { style: { color: '#D0DBE8', fontSize: '11px', fontWeight: '700', fontFamily: "'Cascadia Code',monospace" } },
                'Spec ' + section.num + '  |  ' + section.name
              ),
              React.createElement('span', { style: { marginLeft: 'auto', fontSize: '10px', fontWeight: '600', color: sColor, letterSpacing: '0.05em' } },
                section.status.toUpperCase()
              )
            ),
            React.createElement('div', { style: { padding: '2px 8px 4px' } },
              section.lines.length === 0
                ? React.createElement('div', { style: { color: '#4B5A6A', fontSize: '11px', padding: '4px 0', fontStyle: 'italic' } }, 'No log lines.')
                : section.lines.map(function(line, i) { return React.createElement(LogLine, { key: i, text: line, colors: colors }); })
            )
          );
        })
  );
}

// ============================================================================
//  ANALYTICS DASHBOARD
// ============================================================================

function AnalyticsDashboard({ colors }) {
  const [analytics, setAnalytics] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const chartRef = React.useRef(null);
  const chartInstance = React.useRef(null);

  React.useEffect(function () {
    fetch('/api/analytics')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          setAnalytics(data.analytics.reverse()); // Chronological for charts
        } else {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch(function (e) {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  React.useEffect(function () {
    if (!analytics || analytics.length === 0 || !chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    var labels = analytics.map(function(a) { return a.date.replace(/_/g, ' '); });
    var passed = analytics.map(function(a) { return a.passed; });
    var failed = analytics.map(function(a) { return a.failed; });

    var ctx = chartRef.current.getContext('2d');
    chartInstance.current = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Passed',
            data: passed,
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: '#10B981',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Failed',
            data: failed,
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderColor: '#EF4444',
            borderWidth: 1,
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#E8EBF3' }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(18,20,26,0.9)',
            titleColor: '#818CF8',
            bodyColor: '#E8EBF3',
            borderColor: '#353849',
            borderWidth: 1,
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: '#7B8299', maxRotation: 45, minRotation: 45, font: { size: 10 } },
            grid: { color: '#1E2030' }
          },
          y: {
            stacked: true,
            ticks: { color: '#7B8299', stepSize: 1 },
            grid: { color: '#1E2030' },
            beginAtZero: true
          }
        }
      }
    });

    return function() {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [analytics]);

  if (loading) return React.createElement('div', { style: { textAlign: 'center', padding: '40px', color: colors.muted } }, 'Loading analytics...');
  if (error) return React.createElement('div', { style: { textAlign: 'center', padding: '40px', color: '#EF4444' } }, 'Error loading analytics: ' + error);
  if (!analytics || analytics.length === 0) {
    return React.createElement('div', { style: { textAlign: 'center', padding: '40px', color: colors.muted } },
      React.createElement('div', { style: { fontSize: '40px', marginBottom: '12px', opacity: 0.3 } }, '\uD83D\uDCCA'),
      React.createElement('p', { style: { fontSize: '13px' } }, 'No run data available for analytics yet.')
    );
  }

  // Calculate summary stats
  var totalRuns = analytics.length;
  var avgPassRate = Math.round(analytics.reduce(function(acc, a) { return acc + a.passRate; }, 0) / totalRuns);
  
  // Find flakiest env/tag combinations (basic heuristic: low pass rate across multiple runs)
  var envStats = {};
  analytics.forEach(function(a) {
    var key = a.env + ' @' + a.tag;
    if (!envStats[key]) envStats[key] = { runs: 0, passed: 0, total: 0 };
    envStats[key].runs++;
    envStats[key].passed += a.passed;
    envStats[key].total += a.total;
  });
  
  var flakyCombos = Object.keys(envStats).map(function(k) {
    var s = envStats[k];
    return { name: k, runs: s.runs, rate: Math.round((s.passed / s.total) * 100) };
  }).filter(function(s) { return s.runs > 1 && s.rate < 100; }).sort(function(a, b) { return a.rate - b.rate; }).slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: '#1A1D26', border: '1px solid #2A2D3A', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '11px', color: '#7B8299', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Total Runs Analyzed</div>
          <div style={{ fontSize: '24px', color: '#E8EBF3', fontWeight: '700' }}>{totalRuns}</div>
        </div>
        <div style={{ background: '#1A1D26', border: '1px solid #2A2D3A', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '11px', color: '#7B8299', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Average Pass Rate</div>
          <div style={{ fontSize: '24px', color: avgPassRate >= 90 ? '#10B981' : avgPassRate >= 70 ? '#F59E0B' : '#EF4444', fontWeight: '700' }}>{avgPassRate}%</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ background: '#1A1D26', border: '1px solid #2A2D3A', borderRadius: '8px', padding: '16px' }}>
        <div style={{ fontSize: '13px', color: '#E8EBF3', fontWeight: '600', marginBottom: '16px' }}>Pass/Fail Trend</div>
        <div style={{ height: '250px', position: 'relative' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      {/* Stability Insights */}
      <div style={{ background: '#1A1D26', border: '1px solid #2A2D3A', borderRadius: '8px', padding: '16px' }}>
        <div style={{ fontSize: '13px', color: '#E8EBF3', fontWeight: '600', marginBottom: '12px' }}>Stability Insights</div>
        {flakyCombos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {flakyCombos.map(function(c, i) {
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12141A', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1E2030' }}>
                  <span style={{ fontSize: '12px', color: '#D0DBE8', fontFamily: 'monospace' }}>{c.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#7B8299' }}>{c.runs} runs</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: c.rate >= 90 ? '#10B981' : c.rate >= 70 ? '#F59E0B' : '#EF4444' }}>{c.rate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#7B8299' }}>No recurring stability issues detected across environments and tags.</div>
        )}
      </div>

    </div>
  );
}

// ============================================================================
//  STEP 5: REPORT VIEWER
// ============================================================================

function ReportViewer({ pastReports, runReportDir, loadReports, colors }) {
  const [failureReportName, setFailureReportName] = React.useState(null);
  const [failureData, setFailureData] = React.useState(null);
  const [loadingFailures, setLoadingFailures] = React.useState(false);

  // Log viewer state
  const [logReportName, setLogReportName] = React.useState(null);
  const [logLines, setLogLines] = React.useState(null);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [logSearch, setLogSearch] = React.useState('');

  function openFailures(reportName) {
    setLoadingFailures(true);
    setFailureReportName(reportName);
    fetch('/api/reports/' + reportName + '/failures')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) {
          setFailureData(res.data);
        } else {
          setFailureData({ failures: [], totalScenarios: 0, passedScenarios: 0, failedScenarios: 0 });
        }
        setLoadingFailures(false);
      })
      .catch(function () {
        setFailureData({ failures: [], totalScenarios: 0, passedScenarios: 0, failedScenarios: 0 });
        setLoadingFailures(false);
      });
  }

  function closeFailures() {
    setFailureReportName(null);
    setFailureData(null);
  }

  function openLogs(reportName) {
    setLoadingLogs(true);
    setLogReportName(reportName);
    setLogLines(null);
    setLogSearch('');
    fetch('/api/reports/' + reportName + '/logs')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        setLogLines(res.ok ? res.lines : []);
        setLoadingLogs(false);
      })
      .catch(function () {
        setLogLines([]);
        setLoadingLogs(false);
      });
  }

  function closeLogs() {
    setLogReportName(null);
    setLogLines(null);
    setLogSearch('');
  }

  return (
    <div>
      {/* Failure report modal */}
      {failureReportName && failureData && !loadingFailures && (
        <FailureReport
          reportName={failureReportName}
          data={failureData}
          onClose={closeFailures}
          colors={colors}
        />
      )}
      {failureReportName && loadingFailures && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(27,40,56,0.55)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ color: colors.text, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Spinner dark={true} /> Loading failures...
          </div>
        </div>
      )}

      {/* ── RUN LOG OVERLAY ─────────────────────────────────────────────── */}
      {logReportName && (loadingLogs || logLines !== null) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,27,43,0.85)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '12px', width: '96vw', maxWidth: '1600px',
            height: '92vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 20px', background: '#0F1B2B',
              display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
            }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#D0DBE8', fontFamily: "'Cascadia Code',monospace" }}>
                &#x1F4DC; Run Logs
              </span>
              <span style={{
                fontSize: '11px', color: '#4B5A6A', fontFamily: "'Cascadia Code',monospace",
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>{logReportName}</span>
              {/* Search */}
              <input
                type="text"
                placeholder="Search logs..."
                value={logSearch}
                onChange={function(e) { setLogSearch(e.target.value); }}
                style={{
                  background: '#1A2D40', border: '1px solid #2A3A4A', borderRadius: '5px',
                  color: '#D0DBE8', padding: '4px 10px', fontSize: '11px',
                  fontFamily: "'Cascadia Code',monospace", width: '180px', flexShrink: 0,
                }}
              />
              {/* Copy all */}
              {logLines && logLines.length > 0 && React.createElement(CopyLogButton, { lines: logLines })}
              {/* Close */}
              <button onClick={closeLogs} style={{
                background: 'transparent', border: '1px solid #2A3A4A', borderRadius: '5px',
                color: '#8899AA', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', flexShrink: 0,
              }}>&#x2715;</button>
            </div>

            {/* Body */}
            {loadingLogs ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A2332', gap: '10px', color: '#8899AA', fontSize: '13px' }}>
                <Spinner dark={false} /> Loading logs...
              </div>
            ) : (
              <RunLogBody lines={logLines} logSearch={logSearch} colors={colors} />
            )}

            {/* Footer */}
            <div style={{ padding: '8px 20px', background: '#0F1B2B', borderTop: '1px solid #1A2D40', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '10px', color: '#4B5A6A', fontFamily: "'Cascadia Code',monospace" }}>
                {logLines ? logLines.length + ' lines' : ''}
              </span>
              <button onClick={closeLogs} style={{ background: '#1A2D40', border: '1px solid #2A3A4A', borderRadius: '5px', color: '#8899AA', padding: '4px 14px', fontSize: '11px', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text }}>Test Reports</h3>
      </div>

      {/* Current run report */}
      {runReportDir && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#065F46', marginBottom: '8px' }}>Latest Run Report</div>
          <div style={{ fontSize: '12px', color: '#065F46', fontFamily: 'monospace' }}>reports/{runReportDir}/</div>
        </div>
      )}

      {/* Past reports list */}
      {pastReports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: colors.muted }}>
          <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>&#x2691;</div>
          <p style={{ fontSize: '13px' }}>No reports yet. Run some tests first!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pastReports.map(function (report) {
            return (
              <div key={report.name} style={{
                background: colors.surface, border: '1px solid ' + colors.border,
                borderRadius: '8px', padding: '10px 14px',
              }}>
                {/* Report name — truncated to stay within drawer width */}
                <div style={{
                  fontSize: '12px', fontWeight: '600', color: colors.text,
                  fontFamily: "'Cascadia Code','Fira Code',monospace",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: '8px',
                }} title={report.name}>{report.name}</div>
                {/* Action buttons — always in a consistent bottom row */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {report.hasHtml && (
                    <a
                      href={'/reports/' + report.name + '/html/'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: colors.accent, color: 'white',
                        padding: '4px 12px', borderRadius: '5px',
                        fontSize: '11px', fontWeight: '600', textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >Open Report</a>
                  )}
                  {report.hasLogs && (
                    <button
                      onClick={function () { openLogs(report.name); }}
                      style={{
                        background: '#F5F3FF', color: '#5B21B6',
                        padding: '4px 12px', borderRadius: '5px',
                        fontSize: '11px', fontWeight: '600',
                        border: '1px solid #DDD6FE', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >&#x1F4DC; View Logs</button>
                  )}
                  <button
                    onClick={function () {
                      if (confirm('Delete report "' + report.name + '"?')) {
                        fetch('/api/reports/' + report.name, { method: 'DELETE' })
                          .then(function (r) { return r.json(); })
                          .then(function () { loadReports(); });
                      }
                    }}
                    style={{
                      background: '#FEF2F2', color: '#991B1B',
                      padding: '4px 12px', borderRadius: '5px',
                      fontSize: '11px', fontWeight: '600',
                      border: '1px solid #FECACA', cursor: 'pointer',
                      whiteSpace: 'nowrap', marginLeft: 'auto',
                    }}
                  >Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
//  SHARED COMPONENTS (existing)
// ============================================================================

function DataCard({ card, section, getVal, setVal, selectedEnv, dbEnvs, getBusinessContext }) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={function () { setHovered(true); }}
      onMouseLeave={function () { setHovered(false); }}
      style={{
        backgroundColor: hovered ? '#16182280' : '#12141A',
        border: '1px solid ' + (hovered ? '#6366F1' : '#2A2D3A'),
        borderLeft: '2px solid ' + card.accent,
        borderRadius: '12px',
        boxShadow: hovered ? '0 0 24px rgba(99,102,241,0.15), 0 4px 20px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.3)',
        position: 'relative',
        overflow: 'visible',
        transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '12px', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-30px', right: '-30px', width: '140px', height: '140px',
          background: 'radial-gradient(circle, ' + card.accent + '18 0%, transparent 65%)',
          filter: 'blur(25px)',
        }} />
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #1E2030', position: 'relative' }}>
        <span style={{ color: card.accent, fontSize: '14px' }}>&#x25C8;</span>
        <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E8EBF3' }}>{card.title}</span>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
        {card.fields.map(function (field) {
          return (
            <AutocompleteInput
              key={field.key}
              label={field.label}
              fieldKey={field.key}
              value={getVal(section, card.path, field.key)}
              onChange={function (v) { setVal(section, card.path, field.key, v); }}
              accent={card.accent}
              selectedEnv={selectedEnv}
              dbEnvs={dbEnvs}
              getBusinessContext={getBusinessContext}
              fundingModel={card.id.startsWith('direct') ? 'direct' : card.id.startsWith('indirect') ? 'indirect' : null}
            />
          );
        })}
      </div>
    </div>
  );
}

function AutocompleteInput({ label, fieldKey, value, onChange, accent, selectedEnv, dbEnvs, getBusinessContext, fundingModel }) {
  const [focused, setFocused] = React.useState(false);
  const [inputVal, setInputVal] = React.useState(value);
  const [results, setResults] = React.useState([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [highlightIdx, setHighlightIdx] = React.useState(-1);
  const [isLinked, setIsLinked] = React.useState(false);
  const [isFallback, setIsFallback] = React.useState(false);
  const timerRef = React.useRef(null);
  const wrapperRef = React.useRef(null);
  var isEmpty = !inputVal;
  var hasDb = dbEnvs.indexOf(selectedEnv) !== -1;

  var LINKABLE_FIELDS = ['categories', 'products', 'variants', 'users', 'mastercard', 'amex', 'paypal', 'visa'];
  var isLinkable = LINKABLE_FIELDS.indexOf(fieldKey) !== -1;

  React.useEffect(function () { setInputVal(value); }, [value]);

  React.useEffect(function () {
    function handler(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return function () { document.removeEventListener('mousedown', handler); };
  }, []);

  function doSearch(q) {
    if (!q || q.length < 2 || !hasDb) return;
    setSearching(true);

    var url;
    if (isLinkable && getBusinessContext) {
      var ctx = getBusinessContext();
      var params = 'env=' + encodeURIComponent(selectedEnv) +
        '&field=' + encodeURIComponent(fieldKey) +
        '&q=' + encodeURIComponent(q);
      if (ctx.categories) params += '&categories=' + encodeURIComponent(ctx.categories);
      if (ctx.products) params += '&products=' + encodeURIComponent(ctx.products);
      if (ctx.variants) params += '&variants=' + encodeURIComponent(ctx.variants);
      if (ctx.users) params += '&users=' + encodeURIComponent(ctx.users);
      if (fundingModel) params += '&fundingModel=' + encodeURIComponent(fundingModel);
      url = '/api/search-linked?' + params;
    } else {
      url = '/api/search?env=' + encodeURIComponent(selectedEnv) + '&field=' + encodeURIComponent(fieldKey) + '&q=' + encodeURIComponent(q);
    }

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        setSearching(false);
        if (data.ok) {
          setResults(data.results);
          setShowDropdown(data.results.length > 0);
          setHighlightIdx(-1);
          setIsLinked(!!data.linked);
          setIsFallback(!!data.fallback);
        } else {
          setResults([]); setShowDropdown(false); setIsLinked(false); setIsFallback(false);
        }
      })
      .catch(function () { setSearching(false); setResults([]); setShowDropdown(false); });
  }

  function handleChange(e) {
    var v = e.target.value;
    setInputVal(v);
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.length >= 2 && hasDb) {
      timerRef.current = setTimeout(function () { doSearch(v); }, 300);
    } else {
      setResults([]); setShowDropdown(false);
    }
  }

  function selectItem(name) {
    setInputVal(name);
    onChange(name);
    setShowDropdown(false);
    setResults([]);
  }

  function handleKeyDown(e) {
    if (!showDropdown || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(function (i) { return i < results.length - 1 ? i + 1 : 0; });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(function (i) { return i > 0 ? i - 1 : results.length - 1; });
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      var sel = results[highlightIdx];
      selectItem(typeof sel === 'string' ? sel : sel.name);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  function getLinkHint() {
    if (!isLinkable || !getBusinessContext) return '';
    var ctx = getBusinessContext();
    if (fieldKey === 'products' && ctx.categories) return 'linked to ' + ctx.categories;
    if (fieldKey === 'variants' && ctx.products) return 'linked to ' + ctx.products;
    if (fieldKey === 'users' && ctx.variants) return 'linked to ' + ctx.variants;
    if ((fieldKey === 'mastercard' || fieldKey === 'amex' || fieldKey === 'paypal' || fieldKey === 'visa') && ctx.variants) return 'linked to ' + ctx.variants;
    return '';
  }

  var linkHint = getLinkHint();

  return (
    <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
      <label style={{ fontSize: '10px', color: '#6B7B8D', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {label}
        {hasDb && (
          <span style={{ fontSize: '8px', color: accent, opacity: 0.7, fontWeight: '400', letterSpacing: '0.05em' }}>
            {linkHint ? '\u26d3 ' + linkHint : '\u25cf DB'}
          </span>
        )}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={inputVal}
          onChange={handleChange}
          onFocus={function () { setFocused(true); if (inputVal.length >= 2 && hasDb && results.length === 0) doSearch(inputVal); }}
          onBlur={function () { setFocused(false); }}
          onKeyDown={handleKeyDown}
          placeholder={hasDb ? (linkHint ? 'type to search (' + linkHint + ')...' : 'type to search...') : 'not set'}
          style={{
            background: '#1A1D26',
            border: '1px solid ' + (focused ? accent : '#353849'),
            color: isEmpty ? '#4A506A' : '#E8EBF3',
            borderRadius: '6px',
            padding: '8px 10px',
            paddingRight: searching ? '32px' : '10px',
            fontSize: '13px',
            boxShadow: focused
              ? '0 0 0 2px ' + accent + '30'
              : 'none',
            outline: 'none',
            width: '100%',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {searching && (
          <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}>
            <Spinner dark={true} />
          </div>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          background: '#12141A',
          border: '1px solid ' + (isFallback ? 'rgba(251,191,36,0.4)' : isLinked ? accent + '60' : '#2A2D3A'),
          borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 1000, maxHeight: '200px', overflowY: 'auto',
        }}>
          {(isLinked || isFallback) && (
            <div style={{ padding: '4px 12px', fontSize: '9px', color: isFallback ? '#FBBF24' : accent, opacity: 0.8, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid #1E2030', background: isFallback ? 'rgba(251,191,36,0.08)' : 'rgba(99,102,241,0.06)' }}>
              {isFallback ? '\u26a0 no linked results \u2014 showing all' : '\u26d3 linked results'}
            </div>
          )}
          {results.map(function (item, idx) {
            var isHighlighted = idx === highlightIdx;
            var itemName = typeof item === 'string' ? item : item.name;
            var itemId = typeof item === 'string' ? '' : (item.humanId || '');
            return (
              <div
                key={itemName + '-' + idx}
                onMouseDown={function (e) { e.preventDefault(); selectItem(itemName); }}
                onMouseEnter={function () { setHighlightIdx(idx); }}
                style={{
                  padding: '8px 12px', fontSize: '13px',
                  color: isHighlighted ? '#E8EBF3' : '#7B8299',
                  background: isHighlighted ? accent + '18' : 'transparent',
                  cursor: 'pointer',
                  borderBottom: idx < results.length - 1 ? '1px solid #1E2030' : 'none',
                  transition: 'background 0.1s, color 0.1s',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                }}
              >
                <span>{itemName}</span>
                {itemId && (
                  <span style={{ fontSize: '10px', color: accent, opacity: 0.7, fontFamily: 'monospace', flexShrink: 0 }}>{itemId}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SaveButton({ saving, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      disabled={saving}
      onMouseEnter={function () { setHovered(true); }}
      onMouseLeave={function () { setHovered(false); }}
      style={{
        background: hovered ? 'linear-gradient(135deg, #818CF8, #4F46E5)' : 'linear-gradient(135deg, #6366F1, #4338CA)',
        color: 'white', border: 'none', padding: '7px 18px', borderRadius: '7px',
        fontWeight: '600', fontSize: '13px',
        cursor: saving ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: '6px',
        opacity: saving ? 0.7 : 1, transition: 'background 0.2s, box-shadow 0.2s',
        boxShadow: hovered ? '0 4px 16px rgba(99,102,241,0.5)' : '0 2px 8px rgba(99,102,241,0.3)',
      }}
    >
      {saving && <Spinner dark={false} />}
      {saving ? 'Saving...' : 'Save to TestData'}
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TestDataManager, null));
