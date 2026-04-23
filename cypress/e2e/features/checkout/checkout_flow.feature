@checkout @purchase
Feature: Checkout Flow

  Background:
    Given I am logged in as "standard_user"
    And I have added "Sauce Labs Backpack" to the cart

  @smoke @complete-purchase
  Scenario: Complete a full purchase successfully
    When I go to the cart page
    And I proceed to checkout
    And I fill in shipping details with first name "John", last name "Doe", postal code "10001"
    And I continue to the order overview
    Then I should see the correct item in the overview
    When I finish the order
    Then I should see the order confirmation page
    And the confirmation message should be "Thank you for your order!"

  @checkout-overview
  Scenario: Verify order overview details
    When I go to the cart page
    And I proceed to checkout
    And I fill in shipping details with first name "Jane", last name "Smith", postal code "90210"
    And I continue to the order overview
    Then the order total should be displayed
    And the payment information should be displayed
    And the shipping information should be displayed

  @checkout-cancel
  Scenario: Cancel checkout returns to cart
    When I go to the cart page
    And I proceed to checkout
    And I cancel the checkout
    Then I should be on the cart page

  @back-to-products
  Scenario: Back to products button works from overview
    When I go to the cart page
    And I proceed to checkout
    And I fill in shipping details with first name "Bob", last name "Jones", postal code "12345"
    And I continue to the order overview
    And I cancel the order from overview
    Then I should be back on the products page
