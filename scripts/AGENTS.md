This folder contains start and stop scripts for local Docker execution:

- `start-mac.sh`, `stop-mac.sh`
- `start-linux.sh`, `stop-linux.sh`
- `start-windows.ps1`, `stop-windows.ps1`

Behavior:

- Start scripts build image `pm-mvp:local`, replace container `pm-mvp`, and run on port `8000`.
- Stop scripts stop and remove container `pm-mvp`.