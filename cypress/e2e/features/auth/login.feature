@auth @login
Feature: User Authentication

  @smoke @valid-login
  Scenario: Successful login with valid credentials
    Given I am on the SauceDemo login page
    When I enter username "standard_user" and password "secret_sauce"
    And I click the login button
    Then I should be on the products page

  @logout
  Scenario: User can log out
    Given I am logged in as "standard_user"
    When I open the burger menu
    And I click logout
    Then I should be on the login page

  @invalid-login
  Scenario Outline: Failed login with invalid credentials
    Given I am on the SauceDemo login page
    When I enter username "<username>" and password "<password>"
    And I click the login button
    Then I should see login error "<error>"

    Examples:
      | username        | password     | error                                                                      |
      | locked_out_user | secret_sauce | Epic sadface: Sorry, this user has been locked out.                        |
      | invalid_user    | wrong_pass   | Epic sadface: Username and password do not match any user in this service. |
      | standard_user   |              | Epic sadface: Password is required                                         |
      |                 | secret_sauce | Epic sadface: Username is required                                         |
