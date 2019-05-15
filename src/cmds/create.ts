import DatManager from "../DatManager";

exports.command = "create [dir]";
exports.desc = "Create dat at given location";
exports.builder = {};
exports.handler = async function({ dir, storagePath }) {
    try {
        const manager = new DatManager({
            storagePath
        });
        const datKey = await manager.create(dir);
        console.log(`Dat key: ${datKey}`);
    } catch (error) {
        console.error(error);
    }
};
