import DatManager from "../src/DatManager";

exports.command = "resume";
exports.desc = "Resume all dats that were persisted";
exports.builder = {
    dir: {
        default: "."
    }
};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager();
        await manager.init();
        await manager.resumeAll();
    } catch (error) {
        console.error(error);
    }
};
