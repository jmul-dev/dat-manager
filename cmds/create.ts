import fs from "fs-extra";
import DatManager_DatNode from "../src/DatManager_DatNode";

exports.command = "create [dir]";
exports.desc = "Create dat at given location";
exports.builder = {
    dir: {
        default: "."
    }
};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager_DatNode();
        await manager.init();
        const datKey = await manager.create(argv.dir);
        console.log(`Dat key: ${datKey}`);
    } catch (error) {
        console.error(error);
    }
};
