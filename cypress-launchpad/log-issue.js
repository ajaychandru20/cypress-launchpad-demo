#!/usr/bin/env node
/**
 * Issue Logger for Cypress Launchpad
 * -----------------------------------------------------------------
 * Called by Claude Code automatically when a user reports a bug,
 * pastes an error, or shares a screenshot of a problem.
 *
 * Claude runs this script — no manual step needed by the user.
 * Device info (OS, RAM, CPU) is captured automatically from the
 * machine running this script.
 *
 * Usage (called by Claude):
 *   node cypress-launchpad/log-issue.js '<json>'
 *
 * JSON fields:
 *   username    — who reported it (asked by Claude in conversation)
 *   title       — short description of the issue
 *   description — full details
 *   category    — "performance" | "docker" | "ui" | "test-failure" | "crash" | "other"
 *   severity    — "low" | "medium" | "high" | "critical"
 *   env         — which environment (env1, env3, etc.) if applicable
 *   errorText   — raw error/stack trace pasted by the user
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ISSUE_DIR  = path.join(__dirname, 'issue-logs');
const ISSUE_FILE = path.join(ISSUE_DIR, 'issues.json');

// -- Ensure directory exists --------------------------------------------------
if (!fs.existsSync(ISSUE_DIR)) fs.mkdirSync(ISSUE_DIR, { recursive: true });

// -- Parse input --------------------------------------------------------------
const raw = process.argv[2];
if (!raw) {
  console.error('Usage: node cypress-launchpad/log-issue.js \'{"username":"Ajay","title":"...","category":"..."}\'');
  process.exit(1);
}

let data;
try { data = JSON.parse(raw); } catch (e) {
  console.error('Invalid JSON: ' + e.message);
  process.exit(1);
}

if (!data.title || !data.title.trim()) {
  console.error('Error: title is required');
  process.exit(1);
}

// -- Auto-detect device info --------------------------------------------------
const platform = process.platform;
const platformLabel = platform === 'win32' ? 'Windows'
                    : platform === 'darwin' ? 'macOS'
                    : platform === 'linux'  ? 'Linux'
                    : platform;
const cpus = os.cpus();
const cpuModel = cpus && cpus[0] ? cpus[0].model : 'Unknown';
const totalMemGb = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10;
const freeMemGb  = Math.round(os.freemem()  / (1024 * 1024 * 1024) * 10) / 10;

// -- Build issue record -------------------------------------------------------
const now   = new Date().toISOString();
const issue = {
  id:          now + '-' + Math.random().toString(36).slice(2, 8),
  timestamp:   now,
  username:    (data.username    || 'Unknown').trim(),
  title:       (data.title       || '').trim(),
  description: (data.description || '').trim(),
  category:    data.category  || 'other',
  severity:    data.severity  || 'medium',
  env:         data.env       || '',
  errorText:   (data.errorText || '').trim(),
  device: {
    platform:   platformLabel,
    totalMemGb: totalMemGb,
    freeMemGb:  freeMemGb,
    cpu:        cpuModel,
    hostname:   os.hostname(),
    nodeVersion: process.version,
  },
};

// -- Load existing issues and prepend new one ---------------------------------
let issues = [];
if (fs.existsSync(ISSUE_FILE)) {
  try { issues = JSON.parse(fs.readFileSync(ISSUE_FILE, 'utf8')); } catch (e) { issues = []; }
}
issues.unshift(issue);
fs.writeFileSync(ISSUE_FILE, JSON.stringify(issues, null, 2), 'utf8');

// -- Print summary ------------------------------------------------------------
console.log('Issue logged successfully');
console.log('ID:       ' + issue.id);
console.log('User:     ' + issue.username);
console.log('Title:    ' + issue.title);
console.log('Category: ' + issue.category + ' | Severity: ' + issue.severity);
console.log('Device:   ' + issue.device.platform + ' | ' + issue.device.totalMemGb + 'GB RAM | ' + issue.device.cpu);
console.log('Total issues on file: ' + issues.length);
