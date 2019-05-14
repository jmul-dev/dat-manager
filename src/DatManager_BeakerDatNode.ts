import DatManagerInterface from "./DatManagerInterface";
import path from "path";
import fs from "fs-extra";
import { createNode } from "@ao/dat-node";
import Debug from "debug";
const debug = Debug(`ao:dat-manager`);

async function sleep(ms: number): Promise<any> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export default class DatManager_BeakerDatNode implements DatManagerInterface {
    private datStoragePath;
    private dat = null;

    constructor() {
        this.datStoragePath = path.resolve(__dirname, "../data/beaker-content");
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
        console.log(
            `attempting to create dat at path with file: ${storagePath}`
        );
        const archive = await this.dat.createArchive({});
        if (await fs.pathExists(storagePath)) {
            console.log(`writing file...`);
            const filename = storagePath.split("/").pop();
            const storageContents = await fs.readFile(storagePath);
            await archive.writeFile(`/${filename}`, storageContents);
        } else {
            console.log(`writing sample index.md...`);
            await archive.writeFile(
                "/index.md",
                "# Sup!\n\n This was created by the @beaker/dat-node example code. See [the readme](https://npm.im/@beaker/dat-node) for more information."
            );
        }
        console.log(`archive created: ${archive.url}`);
        const info = await archive.getInfo();
        return info.key;
    }

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
