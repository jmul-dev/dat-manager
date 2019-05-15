import DatManager from "../DatManager";
import path from "path";

exports.command = "download <key>";
exports.desc = "Download a dat from the network";
exports.builder = {};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager({
            storagePath: path.resolve(__dirname, "../data/ao-dat-node")
        });
        await manager.init();
        await manager.download(argv.key);
        console.log(`Success!`);
    } catch (error) {
        console.error(error);
    }
};
