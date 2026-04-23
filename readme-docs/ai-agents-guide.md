# AI Agents Guide

[← Back to CLAUDE.md](../CLAUDE.md)

---

## Table of Contents

- [Available AI Agents Overview](#available-ai-agents-overview)
- [Code & Test Agents (Sonnet Model)](#code--test-agents-sonnet-model)
- [Documentation Agents (Haiku Model)](#documentation-agents-haiku-model)
- [Exploration Agent](#exploration-agent)
- [Agent Selection Guide](#agent-selection-guide)
- [Best Practices](#best-practices)
- [AI Agent Restrictions](#ai-agent-restrictions)
- [Example Prompts](#example-prompts)

---

## Available AI Agents Overview

This project includes 10 specialized AI agents designed for specific development tasks. Each agent has domain expertise and follows project-specific patterns from CLAUDE.md.

### Agent Categories

```
┌─────────────────────────────────────────────────────────────────┐
│  CODE & TEST AGENTS (Sonnet Model):                             │
│  • super-dev-agent: Code Generation & Test Writing              │
│  • ultimate-code-reviewer: Code Quality Analysis                │
│  • debug-agent: Error Diagnosis & Debugging                     │
│  • optimization-agent: Performance & Stability                  │
│                                                                  │
│  LAUNCHPAD AGENTS (Sonnet Model):                               │
│  • launchpad-dev: Expert Launchpad Development                  │
│  • launchpad-monitor: Detects Changes, Triggers Doc Sync        │
│  • docs-sync-orchestrator: Single Entry Point for Doc Sync      │
│                                                                  │
│  DOCUMENTATION AGENTS (Haiku Model):                            │
│  • project-readme-writer: Documentation Management              │
│  • claude-md-syncer: CLAUDE.md Updates                     │
│                                                                  │
│  EXPLORATION:                                                   │
│  • Explore Agent: Codebase Structure Understanding              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code & Test Agents (Sonnet Model)

These agents use the **Sonnet model** for enhanced reasoning and code generation.

### 1. super-dev-agent: Code Generation & Test Writing

**Primary Use**: Creating new features, test files, and code implementations following project patterns.

**When to Use:**
- Creating new feature files and step definitions
- Generating page objects for new UI workflows
- Writing GraphQL queries for database validation
- Building custom Cypress commands
- Creating data generation utilities
- Implementing new workflows

**Capabilities:**
- Generates production-ready code following BDD/Cucumber patterns
- Implements Page Object Model architecture
- Creates database validation with GraphQL queries
- Writes reusable, atomic step definitions
- Applies hierarchical tag system from CLAUDE.md
- Follows project naming conventions

**Example 1: Creating a Feature File**

```
Prompt: "Use the super-dev-agent to create a feature file for ending a
Non-Card temporary order in the bulk funding model. Include
database validation and follow the existing pattern in VISA order tests."

Agent will:
- Create feature file in correct path:
  cypress/e2e/features/product/temporaryOrder/Non-Card/bulk/cancelOrder.feature
- Add hierarchical tags: @product @temporaryOrder @Non-Card @bulk @end
- Implement step definitions in temporaryOrder.cy.js
- Generate database query in utility/query.js
- Add page object methods if needed
```

**Example 2: Creating a Custom Command**

```
Prompt: "super-dev-agent, create a custom Cypress command called
'verifyCheckoutAmount' that validates checkout Net, Gross, and VAT amounts
against database values using the connectDB task."

Agent will:
- Add command to cypress/support/commands.js
- Use cy.task('connectDB', query.query_checkout_details(checkoutId))
- Validate all three amounts with assertions
- Handle edge cases and error scenarios
```

**Example 3: Building a GraphQL Query**

```
Prompt: "super-dev-agent, create a GraphQL query to fetch cart payment
details including bank name, account number, sort code, and payment status.
Add it to utility/query.js following the existing pattern."

Agent will:
- Create function: query_cart_payment_details(cartId)
- Write Hasura GraphQL query with proper fields
- Return structured data for assertions
- Follow naming conventions
```

---

### 2. ultimate-code-reviewer: Code Quality Analysis

**Primary Use**: Reviewing code for quality, best practices, and potential issues.

**When to Use:**
- Reviewing new test implementations before committing
- Analyzing code for best practice violations
- Identifying potential flaky test patterns
- Validating page object architecture
- Checking database validation completeness
- Pre-commit code reviews

**Capabilities:**
- Comprehensive code review against CLAUDE.md standards
- Identifies code smells, anti-patterns, and refactoring opportunities
- Validates Cypress best practices and tag hierarchy
- Checks proper wait patterns and assertions
- Focuses on Cypress, JavaScript, TypeScript, and Node.js

**Example 1: Reviewing a Feature File**

```
Prompt: "ultimate-code-reviewer, review this new checkout approval feature
file and step definitions. Check if it follows the project patterns for
database validation, tag hierarchy, and multi-user workflows."

Agent will:
- Verify hierarchical tags are present
- Check database validation exists using cy.task('connectDB')
- Validate multi-role pattern (Maker creates, Checker reviews)
- Ensure atomic, reusable step definitions
- Flag any hardcoded test data
- Suggest improvements for flaky patterns
```

**Example 2: Analyzing Page Object Quality**

```
Prompt: "ultimate-code-reviewer, analyze the StandardOrderPage.js
for code quality issues, large method refactoring opportunities, and
adherence to Page Object Model principles."

Agent will:
- Identify overly complex methods needing breakdown
- Check for proper selector encapsulation
- Validate method names follow conventions
- Suggest extraction of reusable utilities
- Flag duplicate code across page objects
```

**Example 3: Pre-Commit Review**

```
Prompt: "ultimate-code-reviewer, perform a comprehensive review of all my
changes before I commit. Focus on security issues, test independence,
and proper error handling."

Agent will:
- Check for hardcoded credentials or secrets
- Validate tests don't depend on execution order
- Ensure proper try-catch blocks and error messages
- Verify .env is not committed
- Check for proper cleanup in after hooks
```

---

### 3. debug-agent: Error Diagnosis & Debugging

**Primary Use**: Fixing failing tests, debugging errors, and diagnosing root causes.

**When to Use:**
- Tests failing inconsistently (flaky tests)
- Timeout errors in Cypress
- Database validation failures
- Element not found errors
- API request failures
- File operation errors (PDF, Excel, CSV)
- Unexpected test behavior

**Capabilities:**
- Diagnoses and fixes errors in Cypress, Node.js, and JavaScript
- Analyzes error logs, stack traces, and failure patterns
- Identifies root causes of flaky tests and race conditions
- Debugs database query and API issues
- Provides actionable fixes with clear explanations

**Example 1: Debugging Flaky Test**

```
Prompt: "debug-agent, this checkout approval test passes 60% of the time
and fails with 'element not found' errors. The selector is '.review-button'.
Help me fix the flakiness."

Agent will:
- Analyze the selector pattern
- Suggest replacing with cy.contains('Review').should('be.visible').click()
- Add proper wait: cy.wait('@checkoutLoadAPI')
- Implement retry logic if needed
- Add database state check before UI interaction
```

**Example 2: Database Query Debugging**

```
Prompt: "debug-agent, my database validation is failing. The query
query_tempOrder_info_details returns empty array but the order
exists in the UI. Help me debug this."

Agent will:
- Review the GraphQL query syntax
- Check if order ID is correctly passed
- Verify environment database connection (.env file)
- Suggest adding cy.log(orderId) for debugging
- Test query directly in Hasura console
- Check for timing issues
```

**Example 3: Timeout Error Resolution**

```
Prompt: "debug-agent, I'm getting 'Timed out retrying after 60000ms' when
running the payment processing test. The custom task 'parsePdf' is failing."

Agent will:
- Check if PDF file exists in cypress/downloads/
- Verify PDF path is correct
- Suggest increasing timeout if needed
- Check if PDF is still being generated when parsing starts
- Add explicit wait for file download completion
```

---

### 4. optimization-agent: Performance & Stability

**Primary Use**: Improving test execution speed and enhancing stability.

**When to Use:**
- Tests running slower than expected
- Reducing test execution time
- Optimizing parallel execution
- Improving batch processing performance
- Reducing database query overhead
- Stability and flakiness issues

**Capabilities:**
- Improves test speed by optimizing waits and selectors
- Enhances stability by fixing race conditions and flaky patterns
- Optimizes GraphQL queries to prevent over-fetching
- Recommends efficient test data strategies
- Prioritizes suggestions by impact (Stability > Speed)

**Example 1: Speeding Up Test Suite**

```
Prompt: "optimization-agent, our regression suite with @checkout tag takes
45 minutes to run with batch size 3. How can we optimize this?"

Agent will:
- Analyze feature files with @checkout tag
- Suggest increasing batch size: node test.runner.js env1 @checkout 5
- Identify redundant database queries
- Recommend caching common queries in fixtures
- Suggest splitting tests with sub-tags
```

**Example 2: Reducing Database Query Overhead**

```
Prompt: "optimization-agent, I'm executing the same database query
query_client_list_page() 15 times across different tests. How can I
optimize this?"

Agent will:
- Suggest using cy.fixture() to cache query results
- Implement before() hook to fetch data once
- Store results in Cypress aliases
- Reuse alias across tests
- Reduce database round trips
```

**Example 3: Optimizing Tag Strategy**

```
Prompt: "optimization-agent, we want to run smoke tests in parallel across
all domains. What's the best tag strategy?"

Agent will:
- Suggest adding @smoke tag to critical scenarios
- Create tag combinations
- Recommend batch size based on test duration
- Configure parallel runs
- Balance load across parallel batches
```

---

## Launchpad Agents (Sonnet Model)

These agents handle the Cypress Launchpad (`cypress-launchpad/`) — development, monitoring, and documentation synchronisation.

### 5. launchpad-dev: Expert Launchpad Development

**Primary Use**: Building and fixing features inside `cypress-launchpad/` with production-grade quality.

**When to Use:**
- Adding new UI features to the Launchpad (new components, new steps)
- Fixing Docker lifecycle bugs or SSE streaming issues
- Handling platform-specific behaviour (Windows path quoting, Linux memory flags)
- Refactoring Launchpad server or React UI code

**Capabilities:**
- Knows the full Launchpad architecture (server, docker-runner, React UI)
- Handles Windows/Mac/Linux differences (Docker paths, memory allocation, browser detection)
- Implements real-time streaming, container lifecycle, and report extraction
- Produces FANG-level quality code with proper error handling

**Example Prompt:**

```
"launchpad-dev, add a Cancel button to Step 4 that stops all running
Docker containers and resets the run state without losing the log output."
```

---

### 6. launchpad-monitor: Change Detection and Doc Sync Trigger

**Primary Use**: Detecting changes in `cypress-launchpad/` and triggering documentation updates automatically.

**When to Use:**
- After making any code changes to `cypress-launchpad/`
- To ensure `cypress-launchpad/CLAUDE.md` and main `CLAUDE.md` stay in sync
- When you want a change report without manually comparing files

**Capabilities:**
- Scans git diff to identify which Launchpad files changed
- Determines which documentation sections are affected
- Triggers `claude-md-syncer` with precise instructions
- Reports inconsistencies between the two CLAUDE.md files

**Example Prompt:**

```
"launchpad-monitor, I just updated docker-runner.js to add a new
container stats endpoint. Check what needs updating in docs."
```

---

### 7. docs-sync-orchestrator: Single Entry Point for Doc Sync

**Primary Use**: Auto-detect all git changes across the repo and trigger the right documentation agents in the correct order.

**When to Use:**
- At the end of any coding session before committing
- When multiple files changed and you are unsure which docs need updating
- As a single command to keep all documentation current

**How to Invoke**: Say **"sync docs"** — the orchestrator reads the git diff, classifies changes by area (Launchpad, framework, configuration, etc.), and dispatches the appropriate doc agents.

**Capabilities:**
- Detects changes across all directories (not just `cypress-launchpad/`)
- Prioritises which docs to update based on change severity
- Chains documentation agents in dependency order
- Produces a summary of what was updated and why

**Example Prompt:**

```
"sync docs"
```

---

## Documentation Agents (Haiku Model)

These agents use the **Haiku model** for efficient documentation tasks.

### 8. project-readme-writer: Documentation Management

**Primary Use**: Creating and updating project documentation.

**When to Use:**
- Creating or updating README.md
- Adding new sections to documentation
- Documenting new features or workflows
- Creating architecture diagrams
- Writing onboarding guides
- Restructuring documentation

**Capabilities:**
- Creates and updates README and topic-specific docs
- Generates production-ready Markdown with Mermaid diagrams
- Maintains consistent documentation style and structure
- Integrates CLAUDE.md context for project alignment
- Writes clear, comprehensive, developer-friendly guides

**Example 1: Adding Feature Documentation**

```
Prompt: "project-readme-writer, add a section to README.md explaining
the new cart expense workflow, including Mermaid diagram and
code examples."

Agent will:
- Create new section with proper heading hierarchy
- Generate Mermaid graph TD diagram showing workflow steps
- Add code examples for creating and approving expenses
- Include database validation pattern
- Link to relevant page objects and step definitions
```

**Example 2: Documenting New Environment**

```
Prompt: "project-readme-writer, we've added a new 'UAT' environment.
Update the README with commands and configuration details."

Agent will:
- Add to environment table: npm run set-uat-env
- Update environment list: npm run uat
- Add to architecture diagram
- Document database connection details
- Update .env file examples
```

---

### 9. claude-md-syncer: CLAUDE.md Updates

**Primary Use**: Preparing updates to CLAUDE.md (protected file).

**When to Use:**
- Updating CLAUDE.md with new patterns (requires approval)
- Adding new custom commands documentation
- Documenting new page objects or utilities
- Updating database query patterns
- Adding new environment configurations

**IMPORTANT**: CLAUDE.md is a protected file. This agent helps prepare updates but changes require team approval.

**Capabilities:**
- Drafts CLAUDE.md updates when code, structure, or config changes
- Ensures documentation stays in sync with codebase
- Maintains consistency in formatting and terminology
- Outputs complete updated file (never truncates)
- Resolves conflicts by preferring recent changes

**Example 1: Documenting New Custom Command**

```
Prompt: "claude-md-syncer, prepare an update to CLAUDE.md for the
new 'verifyFinancialCalculation' custom command that validates Net/Gross/VAT
calculations. I'll submit it for approval."

Agent will:
- Draft addition to "Custom Commands" section
- Include command signature and parameters
- Provide usage examples
- Show integration with calculation.js
- Format for approval submission
```

**Example 2: Adding New Query Pattern**

```
Prompt: "claude-md-syncer, I've added 10 new GraphQL queries for
the product module. Help me document them in CLAUDE.md following the
existing pattern."

Agent will:
- Draft update to "Database Integration Pattern" section
- Document query naming convention
- Add examples for all 10 queries
- Show usage pattern with cy.task('connectDB')
- Prepare for approval
```

---

## Exploration Agent

### 10. Explore Agent: Understanding Codebase Structure

**Primary Use**: Learning and understanding the project architecture.

**When to Use:**
- Learning the project architecture
- Finding existing implementations
- Understanding code flow
- Locating specific files or patterns
- Discovering available utilities
- Onboarding new developers

**Capabilities:**
- Navigates complex directory structures
- Finds files by pattern or content
- Explains code relationships and dependencies
- Maps data flow and component interactions
- Identifies reusable components

**Example 1: Finding Existing Implementations**

```
Prompt: "Explore Agent, I need to create a cart rejection workflow.
Show me existing rejection patterns I can reference."

Agent will:
- Search for @cancel tag across feature files
- Locate rejection step definitions
- Find page object methods for rejection
- Show database validation patterns
- Provide file paths and code examples
```

**Example 2: Understanding File Organization**

```
Prompt: "Explore Agent, explain the structure of the temporaryOrder
feature folder. Why is it nested so deeply?"

Agent will:
- Map directory structure with explanation
- Explain business model variations (VISA vs Non-Card)
- Document funding model split (Solo vs Enterprise)
- Show payment model organization
- Explain holiday pay variants
```

**Example 3: Discovering Utilities**

```
Prompt: "Explore Agent, what utilities are available for date manipulation
and formatting in this project?"

Agent will:
- Locate functions in cypress/utility/functions.js
- List available methods
- Show usage examples from existing tests
- Explain integration with faker
- Provide import statements
```

---

## Agent Selection Guide

| Task | Recommended Agent | Model | Approval Needed |
|------|-------------------|-------|-----------------|
| Write new feature file | super-dev-agent | Sonnet | No |
| Create page object | super-dev-agent | Sonnet | No |
| Review code quality | ultimate-code-reviewer | Sonnet | No |
| Fix failing test | debug-agent | Sonnet | No |
| Speed up test execution | optimization-agent | Sonnet | No |
| Build/fix Launchpad feature | launchpad-dev | Sonnet | No |
| Sync Launchpad docs after code change | launchpad-monitor | Sonnet | No |
| Sync all docs after any coding session | docs-sync-orchestrator | Sonnet | No |
| Update README | project-readme-writer | Haiku | No |
| Update CLAUDE.md | claude-md-syncer | Haiku | Yes |
| Find existing code | Explore Agent | Auto | No |
| Understand architecture | Explore Agent | Auto | No |
| Add database query | super-dev-agent | Sonnet | No |
| Debug flaky test | debug-agent | Sonnet | No |
| Optimize parallel runs | optimization-agent | Sonnet | No |

---

## Best Practices

### 1. Provide Context

Always reference CLAUDE.md in your AI prompts for project-specific context:

```
Good: "Using context from CLAUDE.md, create a new page object for the
Cart Onboarding flow. Follow the pattern used in TemporaryOrderPage.js..."

Bad: "Create a page object for cart onboarding"
```

### 2. Review Generated Code

Never commit AI-generated code without thorough review:

```
1. Read all generated code carefully
2. Verify it follows project patterns
3. Check database queries for correctness
4. Ensure proper error handling
5. Test locally before committing
```

### 3. Test Locally

Run all AI-generated tests locally before pushing to repository:

```bash
npm run env1  # Open Cypress UI
npm run cy:run    # Run headless tests
npm run report    # Generate report
```

### 4. Validate Against Standards

Ensure AI code follows patterns in existing page objects and steps:

```
- Compare with existing page objects
- Check step definitions are atomic and reusable
- Verify tag hierarchy is correct
- Validate database query patterns
```

### 5. Ask for Clarification

If AI suggests modifying config files, verify with team first:

```
Ask: "Should this change cypress.config.js?"
Response: "No, unless you have approval from Akash"
```

### 6. Use for Learning

AI tools are great for understanding existing code structure:

```
"Explore Agent, explain how the checkout approval workflow works"
"super-dev-agent, show me examples of atomic step definitions"
```

### 7. Verify Database Queries

Always validate AI-generated GraphQL queries:

```
1. Compare against utility/query.js patterns
2. Test in Hasura console
3. Verify field names match database schema
4. Check parameter passing
```

---

## AI Agent Restrictions

```
╔═══════════════════════════════════════════════════════════════════╗
║  DO NOT allow AI agents to modify:                               ║
║                                                                   ║
║  • cypress.config.js (without Akash's approval)                   ║
║  • .cypress-cucumber-preprocessorrc.json (without approval)       ║
║  • CLAUDE.md (framework documentation)                            ║
║  • env.js (environment generator)                                 ║
║  • test.runner.js (parallel execution logic)                      ║
║  • package.json dependencies (without team discussion)            ║
║                                                                   ║
║  AI-generated changes to these files will be REJECTED.            ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Protected from AI Modification

These files require human review and team approval:

- `cypress.config.js` - Only architects can modify
- `.cypress-cucumber-preprocessorrc.json` - Only architects can modify
- `CLAUDE.md` - Only architects can update with approval
- `env.js` - Only architects can modify
- `test.runner.js` - Only architects can modify
- `package.json` - Team discussion required for dependency changes
- `.gitignore` - Team approval required
- Core configuration files

### What AI CAN Create/Modify

AI agents are authorized to create/modify:

- Feature files (`.feature`)
- Step definitions (`*.cy.js`)
- Page objects
- Custom commands (via `cypress/support/commands.js`)
- Utilities and helpers
- Test data files
- Documentation (README, guides)
- Comments and inline documentation

---

## Example Prompts

### Good Prompts

```
"Using context from CLAUDE.md, create a new page object for the
Cart Onboarding flow. Follow the pattern used in
TemporaryOrderPage.js with methods for form filling,
submission, and validation. Include database validation methods."

"super-dev-agent, create a feature file for canceling a VISA
temporary order in the solo funding model. Include database
validation and follow existing cancel order patterns."

"ultimate-code-reviewer, review my new checkout approval feature
file. Check for proper database validation, tag hierarchy, and
multi-user workflow patterns."

"debug-agent, my cart creation test is timing out at
database validation. The query returns empty results but the
cart appears in UI. Help me debug."

"optimization-agent, we're running 200 checkout tests in parallel
with batch size 5. How can we optimize without sacrificing stability?"

"Explore Agent, show me all existing payment-related custom commands
and how they're used across the test suite."
```

### Bad Prompts

```
"Modify cypress.config.js to add a new database connection"
(DON'T - Requires Akash's approval!)

"Change CLAUDE.md to add new documentation"
(DON'T - Protected file!)

"Create a test"
(Too vague - should specify domain, workflow, details)

"Fix this broken code"
(Too vague - should explain what's breaking)

"Make tests faster"
(Too vague - should identify specific performance issues)
```

---

**Navigation**:
- [← Back to CLAUDE.md](../CLAUDE.md) | [Test Data Manager →](./test-data-manager.md) | [Launchpad Docker Architecture →](./launchpad-docker-architecture.md)

