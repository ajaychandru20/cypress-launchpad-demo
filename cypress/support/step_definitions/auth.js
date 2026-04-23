import { Given, When, Then } from 'cypress-cucumber-preprocessor/steps';
import LoginPage from '../../pages/LoginPage';

// ── Given ────────────────────────────────────────────────────────────────────

Given('I am on the SauceDemo login page', () => {
  LoginPage.visit();
});

Given('I am logged in as {string}', (username) => {
  LoginPage.visit();
  LoginPage.login(username, 'secret_sauce');
  LoginPage.assertOnProductsPage();
});

// ── When ─────────────────────────────────────────────────────────────────────

When('I enter username {string} and password {string}', (username, password) => {
  LoginPage.enterUsername(username);
  LoginPage.enterPassword(password);
});

When('I click the login button', () => {
  LoginPage.clickLogin();
});

When('I open the burger menu', () => {
  cy.get('#react-burger-menu-btn').click();
});

When('I click logout', () => {
  cy.get('#logout_sidebar_link').click();
});

// ── Then ─────────────────────────────────────────────────────────────────────

Then('I should be on the products page', () => {
  LoginPage.assertOnProductsPage();
});

Then('I should be on the login page', () => {
  cy.url().should('eq', Cypress.config('baseUrl') + '/');
  cy.get('[data-test="login-button"]').should('be.visible');
});

Then('I should see login error {string}', (message) => {
  LoginPage.assertErrorMessage(message);
});
