/**
 * ProductsPage — Page Object for the SauceDemo inventory/products page
 */
class ProductsPage {
  assertOnPage() {
    cy.url().should('include', '/inventory.html');
    cy.get('.title').should('have.text', 'Products');
  }

  getProductCount() {
    return cy.get('.inventory_item').its('length');
  }

  assertProductCount(expected) {
    cy.get('.inventory_item').should('have.length', expected);
  }

  sortBy(option) {
    cy.get('[data-test="product-sort-container"]').select(option);
  }

  getProductNames() {
    return cy.get('.inventory_item_name').then(($els) =>
      [...$els].map((el) => el.innerText)
    );
  }

  addProductToCart(productName) {
    cy.contains('.inventory_item', productName)
      .find('[data-test^="add-to-cart"]')
      .click();
  }

  openProduct(productName) {
    cy.contains('.inventory_item_name', productName).click();
  }

  getCartBadge() {
    return cy.get('[data-test="shopping-cart-badge"]');
  }

  assertCartBadge(count) {
    if (count === 0) {
      cy.get('[data-test="shopping-cart-badge"]').should('not.exist');
    } else {
      cy.get('[data-test="shopping-cart-badge"]').should('have.text', String(count));
    }
  }
}

export default new ProductsPage();
