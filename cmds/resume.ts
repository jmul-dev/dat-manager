import DatManager_DatNode from "../src/DatManager_DatNode";

exports.command = "resume";
exports.desc = "Resume all dats that were persisted";
exports.builder = {
    dir: {
        default: "."
    }
};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager_DatNode();
        await manager.init();
    } catch (error) {
        console.error(error);
    }
};
