# tasks.md

## Feature

Device-Origin Arbitrage Scanner Modes

## Goal

Implement two scan modes that run from the device executor IP:

- Manual one-shot scan.
- Online scan every 180 seconds.

Vercel must remain only the dashboard/control plane.

---

## Phase 1: Worker extraction and runtime state

### 1.1 Extract scanner logic into a worker module

- Move Binance/Bybit request logic out of the Vercel route layer.
- Create a reusable worker service/module for scan execution.
- Ensure all outbound exchange requests are executed only from the worker.

### 1.2 Add runtime state model

- Define worker state fields:
  - `mode`
  - `running`
  - `intervalSeconds`
  - `lastRunAt`
  - `lastStatus`
  - `lastError`
  - `sourceIpMode`
- Add initialization defaults.

### 1.3 Add worker logging

- Log manual scan start/success/error.
- Log online mode start/stop/tick/error.
- Include timestamps and mode in every log event.

#### Checkpoint

- Worker can execute one manual scan locally.
- Worker state is readable and updates correctly.

---

## Phase 2: Worker control API

### 2.1 Create manual scan endpoint

- Add `POST /scan/manual`.
- Trigger one scan execution.
- Return status and result metadata.

### 2.2 Create online mode start endpoint

- Add `POST /scan/online/start`.
- Start a scan loop that runs every 180 seconds.
- Reject duplicate starts when already running.

### 2.3 Create online mode stop endpoint

- Add `POST /scan/online/stop`.
- Stop the active loop safely.
- Return final state.

### 2.4 Create status endpoint

- Add `GET /scan/status`.
- Return current runtime state and last execution info.

#### Checkpoint

- API can start/stop online mode.
- API can run a one-shot manual scan.
- API status reflects current state.

---

## Phase 3: UI integration

### 3.1 Add second primary action

- Keep existing button: `Ejecutar Escaner`.
- Add new button: `Datos online`.

### 3.2 Manual mode UI flow

- Clicking `Ejecutar Escaner` calls the worker manual endpoint.
- Show execution progress and final result.

### 3.3 Online mode UI flow

- Clicking `Datos online` starts the 180-second loop.
- Clicking again or using stop action stops the loop.
- Show online-active state clearly.

### 3.4 Status panel

- Display:
  - current mode
  - running state
  - last execution time
  - last status
  - last error
  - source IP mode

#### Checkpoint

- Both buttons are visible and functional.
- Status updates are visible in the dashboard.

---

## Phase 4: Device-origin execution verification

### 4.1 Verify outbound IP origin

- Add a local IP echo test for the worker.
- Confirm outbound requests originate from the device executor network.

### 4.2 Guard against cloud execution

- Prevent exchange requests from being triggered inside Vercel serverless routes.
- Add warnings/errors if execution path is misconfigured.

### 4.3 Document execution model

- Document that Vercel is only the control plane.
- Document that the worker must run on the device or a local host.

#### Checkpoint

- Manual and online scans use device-origin network traffic.
- No exchange request is made directly from Vercel.

---

## Phase 5: Reliability and edge cases

### 5.1 Handle worker offline state

- Show worker unavailable state in the UI.
- Return a clear error if the control API is unreachable.

### 5.2 Handle duplicate start requests

- Prevent multiple online loops from running at the same time.

### 5.3 Handle scan failures

- Capture and store exchange errors.
- Show meaningful last error messages.

### 5.4 Handle device interruptions

- Stop or recover gracefully if the device sleeps or loses connection.

#### Checkpoint

- System behaves predictably under offline and error conditions.

---

## Final acceptance criteria

- `Ejecutar Escaner` runs a single scan.
- `Datos online` runs scans every 180 seconds.
- Both modes use the device executor IP.
- Vercel remains UI/control only.
- Status and errors are visible.
- The worker can be started and stopped reliably.
