import DatManager from "../src/DatManager";
import path from "path";

exports.command = "resume";
exports.desc = "Resume all dats that were persisted";
exports.builder = {
    dir: {
        default: "."
    }
};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager({
            storagePath: path.resolve(__dirname, "../data/ao-dat-node")
        });
        await manager.init();
        await manager.resumeAll();
    } catch (error) {
        console.error(error);
    }
};
