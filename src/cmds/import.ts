import fs from "fs-extra";
import DatManager from "../DatManager";
import path from "path";

exports.command = "import <key> <file>";
exports.desc = "Import file/folder to an existing dat instance";
exports.builder = {};
exports.handler = async function({ file, key, storagePath }) {
    try {
        if (!key) throw new Error(`Invalid dat key`);
        // move files to correct folder
        const srcPath = path.resolve(file);
        const exists = await fs.pathExists(srcPath);
        if (!exists) {
            throw new Error(`Src path missing`);
        }
        const manager = new DatManager({
            storagePath
        });
        await manager.resumeAll();
        await manager.importFiles(key, srcPath);
    } catch (error) {
        console.error(error);
    }
};
