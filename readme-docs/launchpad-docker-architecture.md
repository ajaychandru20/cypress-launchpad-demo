# Cypress Launchpad — Docker Architecture Deep Dive

[← Test Data Manager](./test-data-manager.md) | [← AI Agents Guide](./ai-agents-guide.md) | [← Back to CLAUDE.md](../CLAUDE.md)

**This guide explains how the Cypress Launchpad runs tests inside Docker containers.** It's written for both beginners (1 year exp) and experienced engineers (15+ years exp). Skip to your level or read all sections for complete understanding.

---

## Quick Overview (30 seconds)

The Launchpad runs Cypress tests inside a **Docker container** instead of on your local machine. This is useful for:
- **Clean environment**: Same Linux base for everyone (no "works on my machine" problems)
- **Parallel testing**: Run multiple test batches at the same time without conflicts
- **Windows support**: Windows Docker works seamlessly with proper path handling

**The flow**: You click "Run in Docker" → Launchpad builds a Docker image → Creates a container → Copies your tests and data into it → Runs tests inside → Gets the reports out.

---

## Fresher Foundations (Before You Start — 0-6 Months Experience)

**If you're completely new to software, read this first.** It explains every term without assuming prior knowledge.

### Key Terms Explained

#### What is a Computer?
A computer has:
- **CPU** (brain) — processes instructions
- **RAM** (short-term memory) — holds data while running programs
- **Disk** (long-term memory) — saves files permanently
- **OS** (operating system) — Windows, Mac, Linux — manages everything

#### What is an Operating System (OS)?

An operating system is software that manages your computer's resources. Examples:
- **Windows** — What most people use
- **Mac** — Apple's operating system
- **Linux** — Free, open-source OS used by servers and developers

All three are different, so software written for Windows might not work on Mac without changes.

#### What is Linux?

Linux is an **operating system like Windows, but:**
- **Free** — No license fee
- **Open-source** — Anyone can see and modify the code
- **Server-friendly** — Used by 90% of servers worldwide
- **Command-line focused** — Controlled via text commands, not GUI

Docker containers typically run **Linux** because it's lightweight and reliable.

#### What is a Terminal / Command Line?

Instead of clicking buttons (GUI), you type text commands. Example:
```bash
ls                    # List files
cd documents          # Change directory
mkdir newfolder       # Make new folder
node myapp.js         # Run a JavaScript file
```

It's faster for developers once you learn it.

#### What is Node.js?

**Node.js** is:
- JavaScript runtime (like Python interpreter)
- Lets you run JavaScript outside the browser (on servers)
- Comes with tools like **npm** (package manager)

Think of it: JavaScript normally runs in browser. Node.js lets JavaScript run on your computer/server.

#### What is npm?

**npm** = Node Package Manager

Like an **app store for code libraries**. Examples:
```bash
npm install express          # Download "express" library
npm install cypress          # Download "cypress" testing library
npm ci                       # Install all dependencies listed in package.json
```

All dependencies are listed in `package.json` (a shopping list file).

#### What is package.json?

A file that lists:
- **Your project name**
- **Version**
- **Dependencies** (what libraries you need)
- **Scripts** (commands you can run)

Example:
```json
{
  "name": "my-test-project",
  "version": "1.0.0",
  "dependencies": {
    "cypress": "^13.0.0",
    "express": "^4.18.0"
  },
  "scripts": {
    "test": "cypress run",
    "dev": "npm run cy:open"
  }
}
```

#### What is Cypress?

A **test automation tool** that:
- Opens a browser automatically
- Clicks buttons, fills forms, checks results
- Writes reports when tests pass/fail
- Used by QA to automate testing

#### What is .env File?

A file that stores **secrets and configuration**:
```
API_KEY=sk-1234567890
DATABASE_URL=postgres://user:pass@host
ENVIRONMENT=env
```

**Important**: Never commit `.env` to git (has passwords!). It's in `.gitignore`.

#### What is PostgreSQL?

A **database system** that stores data in tables (like Excel spreadsheets).

In our case: Stores all business data (variants, carts, checkouts, etc.)

#### What is a Process?

A running program. Examples:
```
Running Cypress = 1 process
Running Node.js server = 1 process
Running Docker container = 1 process
```

When a process finishes, it exits with an exit code (0 = success, non-zero = error).

#### What is Memory (RAM)?

**RAM** = Temporary storage while program runs.
- **Larger RAM** = More programs can run simultaneously
- **Out of Memory (OOM)** = Too many programs, system crashes

Docker memory allocation: `--memory=8g` = Max 8 GB RAM for this container.

#### What is a Layer?

In Docker, a **layer** is like a **page in a book**. When you build an image:

```dockerfile
FROM ubuntu            # Layer 1: Base OS
RUN apt-get update    # Layer 2: Update system
RUN npm install       # Layer 3: Install npm
COPY . .              # Layer 4: Copy your code
```

Docker **caches layers**:
- If Layer 1-2 haven't changed, reuse them (fast)
- If Layer 4 changes (your code), rebuild just that layer and beyond

#### What is Server-Sent Events (SSE)?

A way to send **live updates from server to browser** without refreshing the page.

Example: While tests run, Launchpad streams logs in real-time to your browser:
```
Browser sends: "Show me logs"
Server streams: "[17:45:20] Test 1 started..."
              : "[17:45:21] Browser opened..."
              : "[17:45:22] Test 1 passed!"
```

No page refresh needed — logs appear as they happen.

#### What is a Port?

A **number that identifies a service** on your computer. Examples:
- Port 3000 = Cypress runs here
- Port 4500 = Launchpad server runs here
- Port 5432 = Database runs here

When you see `http://localhost:4500`, you're connecting to port 4500.

---

## Level 1: Beginner Explanation (1 Year Experience)

### What is Docker?

Docker is like a **lightweight virtual machine** or **portable box**.

#### Without Docker
You run tests on your Windows laptop. Problem:
- You need Node.js installed (specific version)
- You need Cypress installed
- You need Chrome/Firefox installed
- You need PostgreSQL driver installed
- Your teammate on Mac has different paths → "Works on my machine!" problem

#### With Docker
You create a **box** with everything pre-installed. Problem solved:
- Windows user runs the box → Gets Linux inside
- Mac user runs the same box → Gets same Linux inside
- Linux user runs the same box → Gets same environment
- **Result**: Identical setup everywhere

**Analogy**: Like shipping a app in a cargo container instead of pieces
- Without container: Ship wheels, engine, body separately → might damage, might not fit together
- With container: Everything packed in one sealed box → arrives intact, runs anywhere

### Launchpad's Docker Setup

The Launchpad creates a Docker **image** (a recipe/blueprint) and uses it to run **containers** (actual running instances).

**Image = Recipe, Container = Cooked Meal**

#### Image (The Blueprint)
Think of a **Dockerfile** like a recipe card:
```dockerfile
FROM ubuntu:20.04              # Step 1: Start with Linux
RUN apt-get install curl       # Step 2: Install curl tool
RUN apt-get install nodejs     # Step 3: Install Node.js
COPY . /app                    # Step 4: Copy your code
CMD ["npm", "start"]           # Step 5: Default command
```

When you **build** the image, Docker:
1. Creates a Linux environment
2. Installs curl
3. Installs Node.js
4. Copies your code
5. Saves this as a reusable image

#### Container (The Running Thing)
A **container** is the image actually running. You can:
- Create 1 container from the image (run 1 test)
- Create 10 containers from the same image (run 10 tests in parallel)

**Important**: Image is like a class in programming, container is like an object (instance).

```
Image Structure (Saved on disk)
  ├─ Base OS (Linux)
  ├─ Node.js
  ├─ Cypress
  ├─ All npm packages (node_modules folder)
  └─ Test files
  Size: ~1-2 GB (stored once, reused)

Container (Running in memory, temporary)
  ├─ Everything from image
  ├─ .env file (injected at runtime)
  ├─ testData.json (injected at runtime)
  └─ Working directory for tests
  Lifetime: 2-5 minutes (then deleted)
```

### The Docker Lifecycle (Simple Version)

Imagine building a Lego house:

```
1. Pull Base Image (Get the foundation)
   Download "cypress/browsers:latest" from Docker Hub
   What you get: Linux OS + Chrome/Firefox already installed
   Why: Starting from scratch would take forever

2. Build Image (Build the house)
   Take the foundation + add walls, roof, rooms
   What you do: Add Node.js, Cypress, test files
   Result: A complete house blueprint (called "image")
   Time: 2-5 minutes (first run), then cached

3. Create Container (Set up furniture)
   Take the house blueprint and set up a living instance
   Result: A house that's ready but not occupied yet
   Time: Few seconds

4. Copy Files In (Move in with your stuff)
   Inject your .env file (like house keys = credentials)
   Inject your testData.json (like furniture = test data)
   Inject your test scripts (like decorations = which tests to run)
   Why: These change per run, can't bake them into the image

5. Start Container (Turn on the lights)
   Activate the house and run tests inside
   Command: "npm run cy:run" inside the container
   Tests use the injected files to know what to do

6. Watch Tests Run (Live streaming)
   See test output in real-time in your browser
   Logs stream via SSE (Server-Sent Events)
   Like watching a live TV feed

7. Get Reports Out (Pack up the results)
   Copy HTML reports from inside container to your computer
   Results saved to: cypress-launchpad/reports/
   Now you can open the report in your browser

8. Cleanup (Tear down the house)
   Delete the container (it was temporary)
   Keep the image (it's reusable for next run)
   Saves disk space (containers are big, image is stored once)
```

### Why This Matters

#### Problem Without Docker: "Works on My Machine"

**Scenario**: Your teammate writes tests on Mac, you run them on Windows
```
Mac setup:
  - Chrome at: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
  - Node.js: v18.12.0
  - Tests pass ✅

Windows setup:
  - Chrome at: C:\Program Files\Google\Chrome\Application\chrome.exe
  - Node.js: v16.0.0
  - Tests fail ❌ (different Node.js version!)

Result: "But it works on MY machine!" argument
```

#### Solution With Docker

```
Both Mac and Windows run the same Docker image:
  - Linux kernel (always same)
  - Node.js v18.12.0 (always same)
  - Chrome installed exactly same way (always same)
  - Test results: Identical ✅
```

#### Benefits for Different People

| Person | Benefit |
|--------|---------|
| **QA Tester (You)** | Click "Docker Mode" → tests run perfectly. No installation hassles. |
| **Your Manager** | All test results are identical. No platform surprises. Reliable reports. |
| **DevOps** | Can run tests in CI/CD (GitHub Actions, Jenkins) without setup. Consistent everywhere. |
| **New Team Member** | No "install Node, install Cypress, install drivers..." — just Docker. |

#### Real Example
```
You on Windows 11 laptop with 14GB RAM:
  Click "Docker" mode → Launchpad shows "Recommended batch size: 2"
  You run 4 parallel tests (batch size 2) safely

Your teammate on Mac with 16GB RAM:
  Same Docker image → Same reliable behavior
  Can run batch size 3 (more RAM available)

Everyone's tests pass. No surprises.
```

### Visual Walkthrough for Freshers

This is exactly what happens when you click "Run in Docker":

#### Step 1: You Click "Run in Docker"
```
Browser (localhost:4500)
┌─────────────────────────┐
│ [Step 4] Run Tests      │
│                         │
│ Run Mode: [Docker ✓]    │
│ Batch Size: 2           │
│                         │
│ [▶ RUN TESTS]           │ ← You click here
└─────────────────────────┘
         ↓
   HTTP Request sent to server
```

#### Step 2: Server Prepares Files
```
Your computer's disk:

.env file (has credentials):
  REGION=env3
  API_URL=https://hasura-env3.saucedemo.io/...
  PG_PASSWORD=Readroleenv3

testData.json (has entity names):
  "categories": "Category Inc"
  "carts": "Cart ABC"

test-specs:
  cypress/e2e/features/product/...
  cypress/e2e/features/checkout/...
```

#### Step 3: Docker Pulls Base Image
```
Docker Hub (online)
        ↓
Download: cypress/browsers:latest (500 MB)
        ↓
Your computer (saved)
```

#### Step 4: Docker Builds Image
```
Dockerfile instructions:
  FROM cypress/browsers:latest    ← Use base image
  COPY package.json ./            ← Copy files
  RUN npm ci                       ← Install npm packages
  COPY . .                         ← Copy all test files
        ↓
Result: platform-cypress-runner image (2 GB)
        ↓
Saved to your computer for reuse
```

#### Step 5: Docker Creates Container
```
Image (stored on disk): 2 GB
        ↓
Create container (memory): 
  - Memory allocated: 8 GB (batch size 2 × 4)
  - Workspace: /app (inside container)
  - Status: CREATED (but not started yet)
```

#### Step 6: Copy Files Into Container
```
Your .env file
        ↓
Docker command: "cp .env into container:/app/.env"
        ↓
Inside container:
  /app/.env (now has your credentials)

Your testData.json
        ↓
Docker command: "cp testData.json into container:/app/cypress/fixtures/..."
        ↓
Inside container:
  /app/cypress/fixtures/testData.json (now has your entity names)
```

#### Step 7: Start Container & Run Tests
```
Container starts running:
  cd /app
  npm run cy:run
        ↓
Cypress opens inside container's Linux environment
        ↓
Tests execute:
  [17:45:20] Running 'product/create.feature'
  [17:45:21] Login successful
  [17:45:22] Product created
  ...logs stream back to browser...
```

#### Step 8: Browser Receives Live Logs
```
Container (inside Docker)
  └─ Test output: "Product created"
         ↓
Server receives logs
         ↓
SSE Stream: Sends to browser in real-time
         ↓
Browser (localhost:4500)
  [Step 4] Run Tests
  Logs:
    [17:45:20] Running 'product/create.feature'
    [17:45:21] Product created
```

#### Step 9: Tests Complete, Reports Generated
```
Inside container:
  /app/cypress/cucumber-json/ (test results)
  /app/cypress/reports/ (HTML report)
        ↓
Docker copies out:
  docker cp container:/app/cypress/reports/ → /Users/you/project/cypress-launchpad/reports/
        ↓
Your computer now has:
  cypress-launchpad/reports/2026-04-01_17-45_env3_custom/html/
```

#### Step 10: Browser Shows Reports
```
[Step 5] Reports
┌─────────────────────────────┐
│ Available Reports:          │
│ • 2026-04-01_17:45         │
│   └─ View HTML ← Click to see
│                             │
│ Latest Run:                 │
│ Total: 5 tests              │
│ Passed: 4 ✅                │
│ Failed: 1 ❌                │
└─────────────────────────────┘
```

#### Step 11: Cleanup
```
Container deleted (temporary, no longer needed)
        ↓
Image remains (will be reused next run)
        ↓
Next time you click "Run in Docker":
  Image already exists → Skip build
  Just create container → Run tests (faster!)
```

---

## Level 2: Detailed Technical Explanation (5-10 Year Experience)

### Architecture Components

#### 1. Docker Runner Module (`cypress-launchpad/docker-runner.js`)

The **docker-runner.js** orchestrates the entire Docker lifecycle using Node.js `child_process` module. Key functions:

```javascript
findDocker()           // Locates docker executable (Windows paths first)
checkImage()          // Verifies "platform-cypress-runner" image exists
buildImage()          // Builds image from Dockerfile with real-time logs
startRun()            // Creates container, injects files, starts tests
```

**Why Node.js, not Docker CLI library?**
- Zero external dependencies (uses only Node.js built-ins)
- Full control over process spawning and output streaming
- Better error handling for Windows path quoting issues

#### 2. Image Build Process

**File**: `Dockerfile` at project root

```dockerfile
FROM cypress/browsers:latest

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npx", "cypress", "run", "--headless", "--browser", "chrome"]
```

**Key points**:
- **Layer caching**: `npm ci` is a separate layer so dependencies are cached
- **Full copy**: `COPY . .` includes all test files, step definitions, utilities
- **BuildKit disabled**: `DOCKER_BUILDKIT=0` (avoids Windows credential issues)

#### 3. File Injection Pattern

Tests require configuration that changes per run (environment, entity data, test specs). Solution: **Inject at runtime**

```javascript
// In docker-runner.js startRun()

// Step 2: Inject .env
tmpEnvPath = path.join(__dirname, '.env.docker-' + opts.runId)
fs.writeFileSync(tmpEnvPath, opts.envContent)
execSync(`docker cp ${tmpEnvPath} ${containerId}:/app/.env`)
fs.unlinkSync(tmpEnvPath)  // Cleanup immediately

// Step 3: Inject TestData JSON
execSync(`docker cp ${testDataPath} ${containerId}:/app/cypress/fixtures/testData/${testDataFile}`)

// Step 3b: Inject temp spec runner (for spec-based runs)
fs.writeFileSync(tmpScriptPath, inlineScript)
execSync(`docker cp ${tmpScriptPath} ${containerId}:/app/${tmpScriptName}`)
```

**Why not bake these into the image?**
- `.env` contains credentials (can't commit to git)
- `TestData.json` changes per test run (dynamic data)
- Spec list is user-selected (different each time)

#### 4. Real-Time Log Streaming

**Problem**: `docker logs` output is buffered, so you see tests finish before logs appear.

**Solution**: Use `child_process.exec()` with event emitters

```javascript
var logProc = exec(`docker logs -f ${containerId}`, { timeout: 3600000 })

logProc.stdout.on('data', function (chunk) {
  var lines = chunk.toString().split('\n')
  lines.forEach(function (line) {
    if (line.trim()) {
      onLog(line)  // Send to SSE stream → Browser UI
    }
  })
})
```

This achieves **true real-time logging** without buffering.

#### 5. SSE (Server-Sent Events) Integration

HTTP server streams logs to browser using Server-Sent Events:

```javascript
// In testdata-manager.js
res.writeHead(200, { 'Content-Type': 'text/event-stream' })
res.write(`data: ${JSON.stringify(logLine)}\n\n`)  // Send to browser
```

Browser receives logs in real-time and appends to the log viewer without page refresh.

### Platform-Specific Handling

#### Windows

**Problem 1**: Docker executable path contains spaces
```
C:\Program Files\Docker\Docker\resources\bin\docker.exe
                ^^^^^^
              Space here!
```

**Solution**: Wrap in double quotes
```javascript
var dockerCmd = docker.includes(' ') ? '"' + docker + '"' : docker
// Result: "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
```

**Problem 2**: Memory allocation not supported
- Linux/Mac: Can use `--memory=8g --memory-swap=8g` flags
- Windows: Docker Desktop manages memory dynamically (flag is ignored)

**Solution**: Skip memory flags on Windows
```javascript
var memoryFlags = ''
if (!isWindows) {
  memoryFlags = ` --memory=${memoryGb}g --memory-swap=${memoryGb}g`
}
```

#### Mac & Linux

**Memory allocation**: Explicit limits prevent OOM
```javascript
// For batch size 2: allocate 8 GB
var memoryGb = (opts.batchSize || 1) * 4
var memoryFlags = ` --memory=${memoryGb}g --memory-swap=${memoryGb}g`
```

**Path handling**: No quotes needed (no spaces issue)

### Container Lifecycle State Machine

```
NOT CREATED
    ↓
[execSync createCmd]
    ↓
CREATED (stopped)
    ↓
[Inject .env, testdata, scripts]
    ↓
[execSync startCmd]
    ↓
RUNNING (streaming logs)
    ↓
[wait for exit]
    ↓
EXITED (with exit code)
    ↓
[Copy reports out]
    ↓
[execSync rmCmd]
    ↓
REMOVED (image persists for next run)
```

**Key point**: Image is built once (expensive), containers are created/destroyed per run (cheap).

---

## Level 3: Advanced Deep Dive (15+ Year Experience)

### Design Decisions & Trade-Offs

#### 1. No Docker SDK Library

**Decision**: Use `child_process` (exec/execSync) instead of `dockerode` or `docker-js`

**Rationale**:
- **Zero dependencies**: docker-sdk adds npm bloat; `child_process` is built-in
- **Better observability**: Can see actual docker CLI commands in logs
- **Process control**: Native Node.js event handlers for stdout/stderr
- **Windows compatibility**: Avoids issues with complex npm package builds on Windows

**Trade-off**: Can't use advanced Docker SDK features (like docker events API), but not needed for this use case.

#### 2. exec() vs spawn() for Docker Commands

**Decision**: Use `exec()` for `docker build` and `docker logs -f`

```javascript
// This approach (using exec):
var proc = exec(`docker build --no-cache -t ${IMAGE_NAME} .`, { cwd: PROJECT_ROOT })
proc.stdout.on('data', cb)  // Real-time streaming

// Not this (spawn would be):
// var proc = spawn('docker', ['build', '--no-cache', '-t', IMAGE_NAME, '.'])
```

**Rationale**:
- **Windows shell quoting**: `exec()` handles complex quoting better than `spawn()`
- **Real-time output**: Both can stream, but `exec()` + shell context is more reliable
- **Build layer caching**: Docker output includes cache hints that are useful to log

**Code snippet that shows why**:
```javascript
// exec() handles this correctly on Windows:
exec(`"C:\Program Files\Docker\docker.exe" build -t image .`)

// spawn() would require complex quoting:
// spawn('C:\Program Files\Docker\docker.exe', ['build', '-t', 'image', '.'])
// ^ This fails on Windows because of spaces
```

#### 3. File Injection vs Image Baking

**Decision**: Inject .env and TestData at container runtime

**Alternative considered**: Bake everything into the image

```
Bake (rejected):
├─ Problem 1: Credentials in image (can't commit)
├─ Problem 2: Image is 5+ GB
├─ Problem 3: New image for every run
└─ Problem 4: Slow CI/CD

Inject (chosen):
├─ Image built once (efficient)
├─ .env injected at container create (secure)
├─ TestData injected at container create (dynamic)
└─ Fast turnaround: build → create → inject → run
```

#### 4. Batch Parallelization Logic

**Where**: `test.runner.js` (main), `docker-runner.js` (spec-based runs)

For spec-based Docker runs, a **temp script is written to disk**:

```javascript
// Why not inline the script in the docker create command?
var inlineScript = [
  'const cypress = require("cypress");',
  'const specs = ' + JSON.stringify(opts.specs) + ';',
  // ... script lines
].join('\n')

// Write to temp file instead of inline
tmpScriptPath = path.join(__dirname, 'temp-spec-runner-' + opts.runId + '.js')
fs.writeFileSync(tmpScriptPath, inlineScript)
execSync(`docker cp ${tmpScriptPath} ${containerId}:/app/temp-spec-runner-${runId}.js`)
```

**Why file on disk, not inline**?
- **Windows quoting nightmare**: Inline script in docker create command = exponential quote escaping
- **File injection is atomic**: Write once, copy once, execute once
- **Cleanup guaranteed**: `fs.unlinkSync()` after copy ensures no temp files leak

#### 5. Memory Allocation Strategy

**Linux/Mac**:
```javascript
var memoryGb = batchSize * 4  // 1 batch = 4GB, 2 batch = 8GB, 3 batch = 12GB
// Both limits must match for cgroup limits to work correctly
execSync(`docker create --memory=${memoryGb}g --memory-swap=${memoryGb}g ...`)
```

**Why both `--memory` and `--memory-swap`?**
- `--memory`: RAM limit
- `--memory-swap`: RAM + swap combined limit
- If swap > memory, container can use disk. Setting equal = no swap, pure RAM.

**Windows**: Skipped entirely
- Docker Desktop abstracts memory via Hyper-V, can't manually allocate
- Better approach: Device capacity detection (`/api/device-capacity`) tells user recommended batch size
- Graceful degradation: User sees warning if batch size exceeds recommended

#### 6. BuildKit Disabled Globally

**Decision**: `DOCKER_BUILDKIT=0` on all platforms (not just Windows)

**Why**:
- BuildKit (new build engine) tries to use credential helpers for registry auth
- On Windows/CI, credential helpers can fail silently during build
- Fallback to classic builder = more reliable and transparent

**Code**:
```javascript
var env = Object.assign({}, process.env, { DOCKER_BUILDKIT: '0' })
exec(buildCmd, { env: env, ... })
```

#### 7. Error Handling Philosophy

**Graceful degradation** for non-blocking errors:

```javascript
// Temp file cleanup — fail silently, don't fail the run
if (tmpScriptPath) {
  try {
    fs.unlinkSync(tmpScriptPath)
  } catch (e) {
    // Log it but don't crash
    onLog('[warn] Failed to cleanup temp script: ' + e.message)
  }
}
```

**Fail-fast** for blocking errors:

```javascript
// Can't create container — this is fatal
try {
  containerId = execSync(createCmd).toString().trim()
} catch (e) {
  opts.onLog('[error] Container creation failed: ' + e.message)
  opts.onDone({ code: 1, reportDir: null })  // Signal failure
  return { containerId: null, stop: function() {} }
}
```

### Performance Optimizations

#### Image Caching

```dockerfile
COPY package.json package-lock.json ./   # Layer 1 (cached if deps don't change)
RUN npm ci                               # Layer 2 (cached if layer 1 cached)
COPY . .                                 # Layer 3 (NOT cached, rebuilds every run)
```

**Result**: Only layer 3 rebuilds per run. Deps cached unless `package.json` changes.

#### Process Cleanup

Windows:
```javascript
execSync(`taskkill /pid ${pid} /t /f`)  // /t = tree, /f = force
```

Unix:
```javascript
process.kill(pid, 'SIGTERM')  // Try graceful
setTimeout(() => process.kill(pid, 'SIGKILL'), 5000)  // Force after 5s
```

#### Device Capacity API

**Endpoint**: `GET /api/device-capacity`

Returns device memory info + recommended batch size in O(1) time:

```javascript
var os = require('os')
var totalMemory = os.totalmem() / 1024 / 1024 / 1024  // GB
var freeMemory = os.freemem() / 1024 / 1024 / 1024
var recommendedBatchSize = freeMemory > 10 ? 3 : (freeMemory > 8 ? 2 : 1)
```

UI shows warning if user selects batch > recommended:

```
⚠️ Batch size 3 exceeds recommended 2 (based on 7.5 GB free)
   Risk: OOM on 14GB Windows laptops
```

### Security Considerations

#### 1. .env Injection (Secrets)

**Threat**: .env contains database passwords and API keys.

**Mitigation**:
- `.env` never committed to git (in `.gitignore`)
- Temporary `.env.docker-{runId}` file created only during run
- File deleted immediately after docker cp
- No .env in Docker image (credentials never baked)

```javascript
var tmpEnvPath = path.join(__dirname, '.env.docker-' + opts.runId)
fs.writeFileSync(tmpEnvPath, opts.envContent)          // Create
execSync(`docker cp ${tmpEnvPath} ${containerId}:/app/.env`)  // Copy
fs.unlinkSync(tmpEnvPath)                              // Delete
```

#### 2. SQL Injection in TestData

**Threat**: If TestData.json contains SQL, it could execute in database.

**Mitigation**:
- TestData.json is **read-only** in database queries (fixture → test step definitions)
- Tests use parameterized GraphQL queries, not raw SQL
- Database connection is read-only (read-only role in PostgreSQL)

#### 3. Container Isolation

**Thread model**: Container runs as unprivileged user (not root)

```dockerfile
# Implicitly runs as user in Cypress base image (not root)
# Better: Explicitly set USER if needed
```

---

## Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser UI (localhost:4500)                 │
│  [Step 1] [Step 2] [Step 3] [Step 4 ← You are here] [Step 5]       │
└────────────────────────────────┬──────────────────────────────────┘
                                 │
                    testdata-manager.js (HTTP server)
                    ├─ API routes (/api/run/start, /api/run/logs)
                    ├─ Database queries (entity search)
                    └─ SSE log stream → Browser
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌─────LOCAL MODE────┐    ┌───DOCKER MODE──────┐
            │                    │    │                    │
         cypress run        docker-runner.js
            │                    │
        Host machine         docker build
        └─Browser────┘         │ (Dockerfile)
                                │
                    ┌──────────────────────────┐
                    │  Image: platform-cypress  │
                    │  ├─ Base: cypress/...    │
                    │  ├─ Node.js               │
                    │  ├─ npm packages         │
                    │  └─ Test files           │
                    └──────────────────────────┘
                                │
                         docker create
                                │
                    ┌──────────────────────────┐
                    │  Container (running)      │
                    │  ├─ .env (injected)      │
                    │  ├─ testData.json (inj.) │
                    │  ├─ temp-spec-runner.js  │
                    │  └─ workspace=/app       │
                    └──────────────────────────┘
                                │
                    docker start & logs -f
                                │
                            cypress run
                    (inside container, same Linux)
                                │
                    ┌───────────────────────────┐
                    │  Tests generate reports:  │
                    │  └─ cucumber-json/        │
                    │  └─ html/ (index.html)    │
                    └───────────────────────────┘
                                │
                    docker cp (extract reports)
                                │
                    cypress-launchpad/reports/
                    {date}_{env}_{tag}/html/
                                │
                    SSE logs → Browser
                    reports appear in Step 5
```

---

## Configuration Reference

### Dockerfile (Project Root)

```dockerfile
FROM cypress/browsers:latest      # Contains Cypress + Chrome/Firefox
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                         # Install dependencies (layer cached)
COPY . .                          # Copy test files
CMD ["npx", "cypress", "run", "--headless", "--browser", "chrome"]
```

### docker-runner.js Key Variables

```javascript
const IMAGE_NAME = 'platform-cypress-runner'
const PROJECT_ROOT = path.resolve(__dirname, '..')  // platform-cypress/
const REPORTS_DIR = path.join(__dirname, 'reports')  // cypress-launchpad/reports/

// Container naming
var containerName = 'cypress-run-' + opts.runId
// Example: "cypress-run-a1b2c3d4"

// Memory allocation
var memoryGb = (opts.batchSize || 1) * 4  // Batch 2 = 8GB
// Linux/Mac: explicit limits via --memory flag
// Windows: skipped (Docker Desktop manages)
```

### Environment Variables in Container

Inside the running container (`/app/.env`):
```
REGION=env3
API_URL=https://hasura-env3.saucedemo.io/v1/graphql
APP_URL=https://env3-app.saucedemo.io/auth/login
OPS_URL=https://env3-ops.saucedemo.io/auth/login
PG_USER=readonlyhasura
PG_PASSWORD=Readroleenv3
PG_HOST=platform-env3.csnfja1kdi2c.ap-south-1.rds.amazonaws.com
```

These are injected from the host's `.env` file and read by Cypress.

---

## Troubleshooting Advanced Issues

### Docker Desktop vs Docker Engine on Linux

**Docker Desktop for Linux** runs inside a QEMU virtual machine. When running multiple parallel Cypress containers (`batchSize >= 2`), the QEMU process can be killed by the Linux OOM killer:

```
qemu: process terminated unexpectedly: signal: killed
Error response from daemon: Docker Desktop is unable to start
```

This causes Docker Desktop to enter a crash loop. The Launchpad has no way to prevent this — it's a Docker Desktop infrastructure issue.

**Recommended fix: Use Docker Engine (native) instead**

```bash
# Remove Docker Desktop
sudo apt remove docker-desktop

# Install native Docker Engine
sudo apt update
sudo apt install -y docker.io

# Add yourself to docker group (no sudo needed)
sudo usermod -aG docker $USER

# Enable and start
sudo systemctl enable --now docker

# Log out and back in, then verify
docker ps
```

Docker Engine runs containers directly on the Linux kernel — no VM, no QEMU overhead. The Launchpad uses the same `docker` CLI commands — **zero code changes needed**.

**Tradeoff:** Docker Desktop provides a GUI dashboard; Docker Engine does not. The Launchpad's own stats panel (CPU/Memory/NET I/O per container) covers the monitoring you need during test runs.

---

### Issue: Docker build layer not caching

**Root cause**: `COPY . .` includes everything, so any file change invalidates the layer.

**Solution**: If performance critical, split Dockerfile layers:
```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY cypress/ ./cypress/
COPY cypress.config.js ./
# etc.
```

### Issue: Container's /app/node_modules conflict

**Root cause**: `npm ci` runs inside container, but if host has node_modules, they're copied in.

**Solution**: Add `.dockerignore` if needed:
```
node_modules/
.git/
reports/
```

### Issue: Temp script not injected on Windows

**Root cause**: Path escaping in docker cp command.

**Solution**: Already fixed in docker-runner.js (line 275):
```javascript
execSync(dockerCmd('cp ' + windowsEscape(tmpScriptPath) + ' ' + containerId + ':/app/' + tmpScriptName))
```

The `windowsEscape()` function wraps paths in quotes.

---

## Summary: Key Takeaways

| Level | What You Need to Know |
|-------|----------------------|
| **Beginner** | Docker runs tests in a box. Image is the recipe, container is the running instance. Click "Docker" → tests run in that box. |
| **Intermediate** | Image built once with Dockerfile. Each run: create container → inject .env/testdata → run tests → extract reports → delete container. Real-time logs via SSE. |
| **Advanced** | Memory allocation strategy per platform. File injection avoids quote escaping. BuildKit disabled for reliability. Process lifecycle with graceful cleanup. Security via temporary injection. |

---

## Related Documentation

- **[Test Data Manager](./test-data-manager.md)** - Using Launchpad UI (Step 1-5)
- **[Running Tests](./running-tests.md)** - Local vs Docker mode, environment setup
- **[Architecture Overview](./architecture.md)** - How test framework integrates with Docker
- **[cypress-launchpad/CLAUDE.md](../cypress-launchpad/CLAUDE.md)** - Technical reference, API routes, state variables

---

**Last Updated**: 2026-04-01  
**Audience**: Developers with 1-30+ years experience  
**Maintained By**: Ajay Chandru (achandru@saucedemo.com)
