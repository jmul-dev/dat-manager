import DatManager from "../DatManager";
import path from "path";

exports.command = "resume";
exports.desc = "Resume all dats that were persisted";
exports.builder = {
    dir: {
        default: "."
    }
};
exports.handler = async function({ storagePath }) {
    try {
        const manager = new DatManager({
            storagePath
        });
        await manager.resumeAll();
    } catch (error) {
        console.error(error);
    }
};
