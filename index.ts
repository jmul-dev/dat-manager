const yargs = require("yargs");

yargs
    .commandDir("cmds", { extensions: ["ts"] })
    .demandCommand()
    .help().argv;
