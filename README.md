# Readme

# Commands

Optionally install `ts-node` to run commands on direct src, otherwise build the package (`npm run build`) and run the compiled src under node. Debugging is available via the `DEBUG=ao:dat-manager` env variable.

List all available commands:

-   `ts-node src/bin.ts`
-   `DEBUG=ao:dat-manager node dist/bin.js`

General format:

-   `ts-node src/bin.ts [command] [args]`
-   `DEBUG=ao:dat-manager node dist/bin.js [command] [args]`

# Notes

-   For some reason when using both utp and tcp connections in dat-node it will crash while trying to close utp connection (somewhat randomly and usually when there are multiple dat-node instances running at a given time).
