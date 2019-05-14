import DatManager from "../src/DatManager";

exports.command = "download <key>";
exports.desc = "Download a dat from the network";
exports.builder = {};
exports.handler = async function(argv) {
    try {
        const manager = new DatManager();
        await manager.init();
        await manager.download(argv.key);
        console.log(`Success!`);
    } catch (error) {
        console.error(error);
    }
};
