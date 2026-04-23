@products @listing
Feature: Product Listing

  Background:
    Given I am logged in as "standard_user"

  @smoke @view-products
  Scenario: Products page shows all available products
    Then I should see 6 products on the listing page
    And all products should have a name, price, and add-to-cart button

  @product-details
  Scenario: View individual product details
    When I click on product "Sauce Labs Backpack"
    Then I should be on the product detail page
    And the product name should be "Sauce Labs Backpack"
    And the product should have a price
    And the product should have a description

  @sort-az
  Scenario: Sort products alphabetically A to Z
    When I sort products by "az"
    Then the products should be sorted alphabetically ascending

  @sort-za
  Scenario: Sort products alphabetically Z to A
    When I sort products by "za"
    Then the products should be sorted alphabetically descending

  @sort-price-low
  Scenario: Sort products by price low to high
    When I sort products by "lohi"
    Then the products should be sorted by price ascending

  @sort-price-high
  Scenario: Sort products by price high to low
    When I sort products by "hilo"
    Then the products should be sorted by price descending
