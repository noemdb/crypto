# SPEC.md

## Title

Device-Origin Arbitrage Scanner Modes

## Overview

This feature adds two operating modes to the arbitrage monitor:

1. **Ejecutar Escaner**: one-time manual scan.
2. **Datos online**: continuous scan based on a dynamically configurable interval (defaults to 180 seconds).

Both modes must execute from the **device executor** so that outbound requests to Binance and Bybit originate from the device’s public IP, not from Vercel cloud infrastructure.

Vercel remains the UI and control plane only.

## Problem Statement

Current production deployment on Vercel runs exchange requests from cloud/serverless infrastructure, which has resulted in blocking responses from Binance and Bybit. The app needs a new execution model where scan traffic originates from the device running the worker.

## Goals

- Preserve the existing manual scan action.
- Add a new online mode that runs continuous scans based on a dynamically configurable interval from the database.
- Ensure both modes use the device executor IP (or standalone worker IP) as the source of network traffic.
- Keep Vercel as the dashboard only.
- Provide clear runtime status, error reporting, and stop/start control.

## Non-Goals

- No proxy rotation implementation in this change.
- No scraping logic rewrite unless needed to extract worker code.
- No execution of exchange requests inside Vercel serverless functions.
- No cloud scheduler that becomes the actual network origin.

## User Stories

- As a user, I want to click **Ejecutar Escaner** to run a scan once.
- As a user, I want to click **Datos online** to start continuous scanning based on my configured interval.
- As a user, I want to stop online mode when I no longer need it.
- As a user, I want to see whether the worker is running, when the last scan happened, and whether it failed.
- As a user, I want exchange requests to come from my device IP, not cloud infrastructure.

## Functional Requirements

### Manual Scan

- The system shall keep a button labeled **Ejecutar Escaner**.
- Clicking the button shall trigger exactly one scan execution.
- The scan shall run from the device executor, not from Vercel.
- The UI shall show success or failure after execution.

### Online Mode

- The system shall add a button labeled **Datos online**.
- Clicking the button shall start a continuous scan loop.
- The loop shall execute one scan per the interval defined in the database (e.g. 180 seconds).
- The loop shall fetch the latest interval configuration before each cycle to allow dynamic updates.
- The loop shall continue until explicitly stopped.
- Clicking the button again or using a stop action shall stop the loop.
- The scans shall run from the device executor, not from Vercel.

### Status and Feedback

- The UI shall display current mode: `idle`, `manual`, or `online`.
- The UI shall display whether the worker is running.
- The UI shall display the last execution timestamp.
- The UI shall display the last error, if any.
- The UI shall display the execution origin as `device-executor`.

## Architecture Requirements

- The frontend shall remain a Next.js application deployed on Vercel.
- The scan execution shall live in a separate worker process running on the device.
- The worker shall expose a control API accessible from the dashboard or local environment.
- The worker shall perform all outbound HTTP requests to Binance and Bybit.
- The worker shall store or report runtime state and scan results.

## Proposed Components

### Frontend

- Buttons for manual scan and online mode.
- Status panel for worker state.
- Results table or dashboard cards.
- Error display.

### Worker

- Manual scan handler.
- Online scan loop with dynamically fetched interval.
- Start/stop/status/ip endpoints.
- Logging of executions and failures.
- Persistent or in-memory state.

### Storage

- Existing database or local persistence for scan results.
- Optional local state file for worker runtime status.

## API Contract

The worker should support the following endpoints:

- `POST /scan/manual`
- `POST /scan/online/start`
- `POST /scan/online/stop`
- `GET /scan/status`
- `GET /scan/ip`

### Example Status Response

```json
{
  "mode": "online",
  "running": true,
  "intervalSeconds": 180,
  "lastRunAt": "2026-05-05T18:00:00.000Z",
  "nextRunAt": "2026-05-05T18:03:00.000Z",
  "lastStatus": "success",
  "lastError": null,
  "sourceIpMode": "device-executor"
}
```

## UI Behavior

- If the worker is unavailable, show a clear offline state.
- Disable duplicate start requests while online mode is active.
- Show the active interval when online mode is enabled.
- Show stop control when online mode is active.
- Refresh status periodically or via polling.

## Implementation Notes

- Extract exchange-request logic into a reusable worker module.
- Ensure the worker is the only component that calls Binance and Bybit.
- Keep the Vercel app decoupled from direct exchange requests.
- Verify origin IP by testing a simple IP echo endpoint from the worker.

## Acceptance Criteria

- Manual scan runs once from the device executor.
- Online mode scans based on a dynamically configurable interval from the device executor.
- Both modes preserve the device’s public IP (or worker's IP) as the network origin.
- Vercel never performs the exchange requests directly.
- UI reflects runtime status accurately.
- Online mode can be started and stopped reliably.

## Edge Cases

- Worker is offline.
- Device sleeps or loses network.
- User clicks start multiple times.
- Exchange returns error codes.
- Manual scan is invoked while online mode is already active.

## Risks

- If the device is powered off, the worker stops.
- If the device network changes, the public IP may change.
- If the worker is still hosted in cloud infrastructure, the IP-origin requirement is not satisfied.

## Definition of Done

- Two buttons exist: **Ejecutar Escaner** and **Datos online**.
- Manual mode works.
- Online mode works and dynamically adjusts to the configured interval.
- Worker execution originates from the device/standalone instance.
- Status, errors, and last run time are visible in the UI.
