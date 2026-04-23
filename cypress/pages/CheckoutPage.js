/**
 * CheckoutPage — Page Object for SauceDemo checkout flow
 */
class CheckoutPage {
  goToCart() {
    cy.get('[data-test="shopping-cart-link"]').click();
  }

  assertOnCartPage() {
    cy.url().should('include', '/cart.html');
  }

  assertItemInCart(productName) {
    cy.get('.cart_item').should('contain.text', productName);
  }

  removeItemFromCart(productName) {
    cy.contains('.cart_item', productName)
      .find('[data-test^="remove"]')
      .click();
  }

  proceedToCheckout() {
    cy.get('[data-test="checkout"]').click();
  }

  cancelCheckout() {
    cy.get('[data-test="cancel"]').click();
  }

  fillShippingInfo(firstName, lastName, postalCode) {
    cy.get('[data-test="firstName"]').clear().type(firstName);
    cy.get('[data-test="lastName"]').clear().type(lastName);
    cy.get('[data-test="postalCode"]').clear().type(postalCode);
  }

  continueToOverview() {
    cy.get('[data-test="continue"]').click();
  }

  assertOnOverviewPage() {
    cy.url().should('include', '/checkout-step-two.html');
  }

  finishOrder() {
    cy.get('[data-test="finish"]').click();
  }

  assertOrderConfirmation() {
    cy.url().should('include', '/checkout-complete.html');
    cy.get('.complete-header').should('have.text', 'Thank you for your order!');
  }
}

export default new CheckoutPage();
