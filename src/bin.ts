const yargs = require("yargs");
const path = require("path");

const isRunningUnderTsNode = `${process.env._}`.indexOf("ts-node") > -1;

yargs
    .commandDir("./cmds", {
        extensions: isRunningUnderTsNode ? ["ts"] : ["js"]
    })
    .option("storagePath", {
        alias: "s",
        default: path.resolve(__dirname, "../data")
    })
    .demandCommand()
    .help().argv;
