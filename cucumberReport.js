/**
 * Generates an HTML report from Cucumber JSON output.
 * Run after: npx cypress run
 * Usage: node cucumberReport.js
 */

const report = require('multiple-cucumber-html-reporter');
const path = require('path');
const os = require('os');

report.generate({
  jsonDir: path.join(__dirname, 'cypress', 'cucumber-json'),
  reportPath: path.join(__dirname, 'reports', 'html'),
  metadata: {
    browser: { name: 'chrome', version: 'latest' },
    device: os.hostname(),
    platform: { name: process.platform, version: os.release() },
  },
  customData: {
    title: 'Cypress Launchpad Demo',
    data: [
      { label: 'Project', value: 'Cypress Launchpad Demo' },
      { label: 'Target App', value: 'https://www.saucedemo.com' },
      { label: 'Generated', value: new Date().toISOString() },
    ],
  },
  openReportInBrowser: false,
  saveCollectedJSON: false,
});

console.log('Report generated at reports/html/index.html');
