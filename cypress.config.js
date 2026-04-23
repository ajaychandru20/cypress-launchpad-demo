const { defineConfig } = require('cypress');
const cucumberPlugin = require('cypress-cucumber-preprocessor').default;
require('dotenv').config();

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.BASE_URL || 'https://www.saucedemo.com',
    specPattern: 'cypress/e2e/features/**/*.feature',
    supportFile: 'cypress/support/e2e.js',
    defaultCommandTimeout: 10000,
    requestTimeout: 30000,
    responseTimeout: 30000,
    pageLoadTimeout: 30000,
    video: false,
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: false,
    reporter: 'cypress-multi-reporters',
    reporterOptions: {
      configFile: 'reporter-config.json',
    },
    env: {
      USERNAME: process.env.USERNAME || 'standard_user',
      PASSWORD: process.env.PASSWORD || 'secret_sauce',
      REGION: process.env.REGION || 'demo1',
      BASE_URL: process.env.BASE_URL || 'https://www.saucedemo.com',
    },
    setupNodeEvents(on, config) {
      on('file:preprocessor', cucumberPlugin());
      return config;
    },
  },
});
