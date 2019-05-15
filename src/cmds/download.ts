import DatManager from "../DatManager";

exports.command = "download <key>";
exports.desc = "Download a dat from the network";
exports.builder = {};
exports.handler = async function({ key, storagePath }) {
    try {
        const manager = new DatManager({
            storagePath
        });
        await manager.download(key);
        console.log(`Success!`);
    } catch (error) {
        console.error(error);
    }
};
