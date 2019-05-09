import fs from "fs-extra";
import DatManager_DatNode from "../src/DatManager_DatNode";

exports.command = "download <key>";
exports.desc = "Download a dat from the network";
exports.builder = {};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager_DatNode();
        await manager.init();
        await manager.download(argv.key);
        console.log(`Success!`);
    } catch (error) {
        console.error(error);
    }
};
