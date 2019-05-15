import DatManager from "../DatManager";

exports.command = "remove <key>";
exports.desc = "Remove the given dat";
exports.builder = {};
exports.handler = async function({ key, storagePath }) {
    try {
        const manager = new DatManager({
            storagePath
        });
        await manager.remove(key);
        await manager.close();
    } catch (error) {
        console.error(error);
    }
};
