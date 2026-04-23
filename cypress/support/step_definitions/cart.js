import { Given, When, Then } from 'cypress-cucumber-preprocessor/steps';

// ── Given ────────────────────────────────────────────────────────────────────

Given('I have added {string} to the cart', (productName) => {
  cy.addToCart(productName);
});

// ── When ─────────────────────────────────────────────────────────────────────

When('I add {string} to the cart', (productName) => {
  cy.addToCart(productName);
});

When('I remove {string} from the cart', (productName) => {
  cy.removeFromCart(productName);
});

When('I navigate back to the products page', () => {
  cy.visit('/inventory.html');
});

When('I go to the cart page', () => {
  cy.goToCart();
});

When('I click {string}', (buttonText) => {
  cy.contains('a, button', buttonText).click();
});

// ── Then ─────────────────────────────────────────────────────────────────────

Then('the cart badge should show {string}', (count) => {
  cy.assertCartCount(parseInt(count));
});

Then('the cart badge should not be visible', () => {
  cy.assertCartCount(0);
});

Then('the cart badge should still show {string}', (count) => {
  cy.assertCartCount(parseInt(count));
});

Then('the cart should contain {string}', (productName) => {
  cy.goToCart();
  cy.get('.cart_item').should('contain.text', productName);
});

Then('I should be back on the products page', () => {
  cy.url().should('include', '/inventory.html');
  cy.get('.title').should('have.text', 'Products');
});
