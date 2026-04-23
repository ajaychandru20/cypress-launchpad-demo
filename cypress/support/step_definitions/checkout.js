import { When, Then } from 'cypress-cucumber-preprocessor/steps';

// ── When ─────────────────────────────────────────────────────────────────────

When('I proceed to checkout', () => {
  cy.get('[data-test="checkout"]').click();
});

When('I fill in shipping details with first name {string}, last name {string}, postal code {string}',
  (firstName, lastName, postalCode) => {
    cy.get('[data-test="firstName"]').clear().type(firstName);
    cy.get('[data-test="lastName"]').clear().type(lastName);
    cy.get('[data-test="postalCode"]').clear().type(postalCode);
  }
);

When('I continue to the order overview', () => {
  cy.get('[data-test="continue"]').click();
});

When('I finish the order', () => {
  cy.get('[data-test="finish"]').click();
});

When('I cancel the checkout', () => {
  cy.get('[data-test="cancel"]').click();
});

When('I cancel the order from overview', () => {
  cy.get('[data-test="cancel"]').click();
});

// ── Then ─────────────────────────────────────────────────────────────────────

Then('I should see the correct item in the overview', () => {
  cy.url().should('include', '/checkout-step-two.html');
  cy.get('.cart_item').should('have.length.at.least', 1);
});

Then('I should see the order confirmation page', () => {
  cy.url().should('include', '/checkout-complete.html');
});

Then('the confirmation message should be {string}', (message) => {
  cy.get('.complete-header').should('have.text', message);
});

Then('the order total should be displayed', () => {
  cy.get('.summary_total_label').should('not.be.empty');
});

Then('the payment information should be displayed', () => {
  cy.get('.summary_info').should('contain.text', 'Payment Information');
});

Then('the shipping information should be displayed', () => {
  cy.get('.summary_info').should('contain.text', 'Shipping Information');
});

Then('I should be on the cart page', () => {
  cy.url().should('include', '/inventory.html');
});
