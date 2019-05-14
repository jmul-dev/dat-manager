import DatManagerInterface from "./DatManagerInterface";
import path from "path";
import fs from "fs-extra";
// import { createNode } from "@ao/dat-node";
import { createNode } from "../../dat-node"; // relative path while developing
import Debug from "debug";
const debug = Debug(`ao:dat-manager`);

export default class DatManager_AODatNode implements DatManagerInterface {
    private datStoragePath;
    private dat = null;

    constructor({ storagePath }) {
        this.datStoragePath =
            storagePath || path.resolve(__dirname, "../data/ao-dat-node");
    }

    async init() {
        await fs.ensureDir(this.datStoragePath);
        this.dat = createNode({ path: this.datStoragePath, fs });
    }

    async resumeAll() {
        await this.dat.resumeAll();
    }

    async download(key: string) {
        debug(`attempting to download: ${key}`);
        const archive = await this.dat.getArchive(key);
        debug(`archive retrieved, start download...`);
        await archive.download("/");
        debug(`archive downloaded: ${key}`);
        return archive;
    }

    async create(storagePath: string) {
        debug(`attempting to create dat at path with file: ${storagePath}`);
        const archive = await this.dat.createArchive({});
        if (await fs.pathExists(storagePath)) {
            debug(`writing file...`);
            const filename = storagePath.split("/").pop();
            const storageContents = await fs.readFile(storagePath);
            await archive.writeFile(`/${filename}`, storageContents);
        } else {
            debug(`writing sample index.md...`);
            await archive.writeFile(
                "/index.md",
                "# Sup!\n\n This was created by the @beaker/dat-node example code. See [the readme](https://npm.im/@beaker/dat-node) for more information."
            );
        }
        debug(`archive created: ${archive.url}`);
        const info = await archive.getInfo();
        return info.key;
    }

    // @TODO: need to determine how files will be imported (stream, path, etc..)
    async importFiles(key: string) {}

    async remove(key: string) {}

    stats(key: string) {
        return {
            key: "",
            writer: false,
            version: 0,
            files: 0,
            blocksDownlaoded: 0,
            blocksLength: 0,
            synced: false,
            byteLength: 0,
            network: {
                connected: false,
                downloadSpeed: 0,
                uploadSpeed: 0
            },
            peers: {
                total: 0,
                complete: 0
            }
        };
    }
}

async function sleep(ms: number): Promise<any> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
