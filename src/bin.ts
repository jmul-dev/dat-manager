const yargs = require("yargs");
const path = require("path");
yargs
    .commandDir("./cmds", { extensions: ["ts"] })
    .option("storagePath", {
        alias: "s",
        default: path.resolve(__dirname, "../data")
    })
    .demandCommand()
    .help().argv;
