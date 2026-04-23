import { When, Then } from 'cypress-cucumber-preprocessor/steps';
import ProductsPage from '../../pages/ProductsPage';

// ── When ─────────────────────────────────────────────────────────────────────

When('I click on product {string}', (productName) => {
  ProductsPage.openProduct(productName);
});

When('I sort products by {string}', (sortOption) => {
  ProductsPage.sortBy(sortOption);
});

// ── Then ─────────────────────────────────────────────────────────────────────

Then('I should see {int} products on the listing page', (count) => {
  ProductsPage.assertProductCount(count);
});

Then('all products should have a name, price, and add-to-cart button', () => {
  cy.get('.inventory_item').each(($item) => {
    cy.wrap($item).find('.inventory_item_name').should('not.be.empty');
    cy.wrap($item).find('.inventory_item_price').should('not.be.empty');
    cy.wrap($item).find('[data-test^="add-to-cart"]').should('exist');
  });
});

Then('I should be on the product detail page', () => {
  cy.url().should('include', '/inventory-item.html');
});

Then('the product name should be {string}', (name) => {
  cy.get('.inventory_details_name').should('have.text', name);
});

Then('the product should have a price', () => {
  cy.get('.inventory_details_price').should('not.be.empty');
});

Then('the product should have a description', () => {
  cy.get('.inventory_details_desc').should('not.be.empty');
});

Then('the products should be sorted alphabetically ascending', () => {
  ProductsPage.getProductNames().then((names) => {
    const sorted = [...names].sort();
    expect(names).to.deep.equal(sorted);
  });
});

Then('the products should be sorted alphabetically descending', () => {
  ProductsPage.getProductNames().then((names) => {
    const sorted = [...names].sort().reverse();
    expect(names).to.deep.equal(sorted);
  });
});

Then('the products should be sorted by price ascending', () => {
  cy.get('.inventory_item_price').then(($prices) => {
    const prices = [...$prices].map((el) => parseFloat(el.innerText.replace('$', '')));
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).to.deep.equal(sorted);
  });
});

Then('the products should be sorted by price descending', () => {
  cy.get('.inventory_item_price').then(($prices) => {
    const prices = [...$prices].map((el) => parseFloat(el.innerText.replace('$', '')));
    const sorted = [...prices].sort((a, b) => b - a);
    expect(prices).to.deep.equal(sorted);
  });
});
