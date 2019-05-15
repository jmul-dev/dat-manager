import DatManager from "../DatManager";

exports.command = "list";
exports.desc = "List all dats";
exports.builder = {};
exports.handler = async function({ storagePath }) {
    try {
        const manager = new DatManager({
            storagePath
        });
        await manager.resumeAll();
        const list = manager.list();
        list.forEach(key => {
            console.log(`${key}`);
        });
    } catch (error) {
        console.error(error);
    }
};
