/**
 * Custom Cypress commands for the Launchpad Demo project.
 */

/**
 * Login to SauceDemo with given credentials.
 * @param {string} username
 * @param {string} password
 */
Cypress.Commands.add('login', (username, password) => {
  cy.visit('/');
  cy.get('[data-test="username"]').clear().type(username);
  cy.get('[data-test="password"]').clear().type(password);
  cy.get('[data-test="login-button"]').click();
});

/**
 * Login as the default standard_user.
 */
Cypress.Commands.add('loginAsStandardUser', () => {
  cy.login('standard_user', 'secret_sauce');
});

/**
 * Add a product to cart by its name.
 * @param {string} productName
 */
Cypress.Commands.add('addToCart', (productName) => {
  cy.contains('.inventory_item', productName)
    .find('[data-test^="add-to-cart"]')
    .click();
});

/**
 * Remove a product from the cart by its name (from products page).
 * @param {string} productName
 */
Cypress.Commands.add('removeFromCart', (productName) => {
  cy.contains('.inventory_item', productName)
    .find('[data-test^="remove"]')
    .click();
});

/**
 * Go to the cart page.
 */
Cypress.Commands.add('goToCart', () => {
  cy.get('[data-test="shopping-cart-link"]').click();
});

/**
 * Assert the cart badge count.
 * @param {number} count
 */
Cypress.Commands.add('assertCartCount', (count) => {
  if (count === 0) {
    cy.get('[data-test="shopping-cart-badge"]').should('not.exist');
  } else {
    cy.get('[data-test="shopping-cart-badge"]').should('have.text', String(count));
  }
});
