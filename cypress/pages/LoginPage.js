/**
 * LoginPage — Page Object for https://www.saucedemo.com login screen
 */
class LoginPage {
  visit() {
    cy.visit(Cypress.env('BASE_URL'));
  }

  enterUsername(username) {
    cy.get('[data-test="username"]').clear().type(username);
  }

  enterPassword(password) {
    cy.get('[data-test="password"]').clear().type(password);
  }

  clickLogin() {
    cy.get('[data-test="login-button"]').click();
  }

  login(username, password) {
    this.enterUsername(username);
    this.enterPassword(password);
    this.clickLogin();
  }

  getErrorMessage() {
    return cy.get('[data-test="error"]');
  }

  assertOnProductsPage() {
    cy.url().should('include', '/inventory.html');
    cy.get('.title').should('have.text', 'Products');
  }

  assertErrorMessage(message) {
    this.getErrorMessage().should('contain.text', message);
  }
}

export default new LoginPage();
