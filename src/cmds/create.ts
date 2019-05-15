import fs from "fs-extra";
import DatManager from "../DatManager";
import os from "os";
import path from "path";

exports.command = "create [dir]";
exports.desc = "Create dat at given location";
exports.builder = {};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager({
            storagePath: path.resolve(__dirname, "../data/ao-dat-node")
        });
        await manager.init();
        const datKey = await manager.create(argv.dir);
        console.log(`Dat key: ${datKey}`);
    } catch (error) {
        console.error(error);
    }
};
