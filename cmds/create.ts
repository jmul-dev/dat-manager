import fs from "fs-extra";
import DatManager_DatNode from "../src/DatManager_DatNode";
import os from 'os'
import path from 'path'

exports.command = "create [dir]";
exports.desc = "Create dat at given location";
exports.builder = {};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager_DatNode();
        await manager.init();
        if ( !argv.dir ) {
            argv.dir = path.resolve(os.tmpdir(), "sample")
            await fs.ensureDir(argv.dir)
            await fs.writeJson(path.join(argv.dir, "sample.json"), {hello: "world"})
        }
        const datKey = await manager.create(argv.dir);
        console.log(`Dat key: ${datKey}`);
    } catch (error) {
        console.error(error);
    }
};
