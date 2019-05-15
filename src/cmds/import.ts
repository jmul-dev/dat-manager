import fs from "fs-extra";
import DatManager from "../DatManager";
import path from "path";

exports.command = "import <key> <file>";
exports.desc = "Import file/folder to an existing dat instance";
exports.builder = {};
exports.handler = async function(argv) {
    try {
        if (!argv.key) throw new Error(`Invalid dat key`);
        // move files to correct folder
        const srcPath = path.resolve(argv.file);
        const exists = await fs.pathExists(srcPath);
        if (!exists) {
            throw new Error(`Src path missing`);
        }
        const manager = new DatManager({
            storagePath: path.resolve(__dirname, "../data/ao-dat-node")
        });
        await manager.init();
        await manager.importFiles(argv.key, srcPath);
    } catch (error) {
        console.error(error);
    }
};
