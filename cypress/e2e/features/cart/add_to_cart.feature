@cart @shopping-cart
Feature: Shopping Cart Management

  Background:
    Given I am logged in as "standard_user"

  @smoke @add-single-item
  Scenario: Add a single item to the cart
    When I add "Sauce Labs Backpack" to the cart
    Then the cart badge should show "1"

  @add-multiple-items
  Scenario: Add multiple items to the cart
    When I add "Sauce Labs Backpack" to the cart
    And I add "Sauce Labs Bike Light" to the cart
    Then the cart badge should show "2"
    And the cart should contain "Sauce Labs Backpack"
    And the cart should contain "Sauce Labs Bike Light"

  @remove-from-cart
  Scenario: Remove an item from the cart
    Given I have added "Sauce Labs Backpack" to the cart
    When I remove "Sauce Labs Backpack" from the cart
    Then the cart badge should not be visible

  @cart-persistence
  Scenario: Cart persists after navigating away
    When I add "Sauce Labs Onesie" to the cart
    And I navigate back to the products page
    Then the cart badge should still show "1"

  @continue-shopping
  Scenario: Continue shopping from cart
    When I add "Sauce Labs Bolt T-Shirt" to the cart
    And I go to the cart page
    And I click "Continue Shopping"
    Then I should be back on the products page
