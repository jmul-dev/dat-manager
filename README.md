# Readme

# Commands

Need to install `ts-node` globally to run these commands.

List all available commands:
`ts-node index.ts`

General format:
`ts-node index.ts [command] [args]`

# Notes

-   For some reason when using both utp and tcp connections in dat-node it will crash while trying to close utp connection (somewhat randomly and usually when there are multiple dat-node instances running at a given time).
