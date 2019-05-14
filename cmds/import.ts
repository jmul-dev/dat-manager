import fs from "fs-extra";
import DatManager from "../src/DatManager";
import path from "path";

exports.command = "import <key> [file]";
exports.desc = "Import files on the existing dat instance";
exports.builder = {};
exports.handler = async function(argv) {
    try {
        if (!argv.key) throw new Error(`Invalid dat key`);
        // move files to correct folder
        const exists = await fs.pathExists(argv.file);
        if (exists) {
            const filename = argv.file.split("/").pop();
            await fs.copy(
                argv.file,
                path.resolve(
                    __dirname,
                    `../data/content/${argv.key}/${filename}`
                )
            );
        }
        const manager = new DatManager({
            storagePath: path.resolve(__dirname, "../data/ao-dat-node")
        });
        await manager.init();
        await manager.importFiles(argv.key);
    } catch (error) {
        console.error(error);
    }
};
