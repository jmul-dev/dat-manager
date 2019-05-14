import fs from "fs-extra";
import DatManager from "../src/DatManager";
import os from "os";
import path from "path";

exports.command = "remove <key>";
exports.desc = "Remove the given dat";
exports.builder = {};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager({
            storagePath: path.resolve(__dirname, "../data/ao-dat-node")
        });
        await manager.init();
        await manager.remove(argv.key);
        await manager.close();
    } catch (error) {
        console.error(error);
    }
};
