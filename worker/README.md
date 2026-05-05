# Local Scan Worker

This local worker runs on your device and performs exchange scraping from your public IP address.

## Run the worker

```bash
npm run worker
```

The worker exposes the following control endpoints on `http://127.0.0.1:3333`:

- `POST /scan/manual`
- `POST /scan/online/start`
- `POST /scan/online/stop`
- `GET /scan/status`
- `GET /scan/ip`

## Notes

- The dashboard will use this worker to execute scans, so exchange requests originate from the device.
- The worker uses the same backend scan logic and database connectivity from the repository.
- If the worker stops, the dashboard will show an offline state.
- Online mode will execute a scan every 180 seconds until stopped.
