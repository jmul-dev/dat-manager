import DatManager from "../DatManager";

exports.command = "get <key>";
exports.desc = "Get a dat from the network";
exports.builder = {};
exports.handler = async function({ key, storagePath }) {
    try {
        const manager = new DatManager({
            storagePath
        });
        const datArchive = await manager.get(key);
		const stats = datArchive.getStats();
		console.log('stats', stats);
		console.log(`Success!`);
    } catch (error) {
        console.error(error);
    }
};
