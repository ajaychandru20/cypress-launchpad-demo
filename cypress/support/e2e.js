import './commands';

// Load env variables into Cypress.env
before(() => {
  // Log the current environment for debugging
  cy.log('Environment: ' + Cypress.env('REGION'));
});

// Suppress common uncaught exceptions from the demo app
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver')) return false;
  return true;
});
