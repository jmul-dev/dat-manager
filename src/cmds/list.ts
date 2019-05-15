import fs from "fs-extra";
import DatManager from "../DatManager";
import os from "os";
import path from "path";

exports.command = "list";
exports.desc = "List all dats";
exports.builder = {};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager({
            storagePath: path.resolve(__dirname, "../data/ao-dat-node")
        });
        await manager.init();
        await manager.resumeAll();
        const list = manager.list();
        list.forEach(key => {
            console.log(`${key}`);
        });
    } catch (error) {
        console.error(error);
    }
};
