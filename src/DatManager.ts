import DatManagerInterface from "./DatManagerInterface";
import path from "path";
import fs from "fs-extra";
// import { createNode } from "@ao/dat-node";
import { createNode } from "../../dat-node"; // relative path while developing
import Debug from "debug";
import DatArchive from "./DatArchive";
const debug = Debug(`ao:dat-manager`);

export default class DatManager implements DatManagerInterface {
    private datStoragePath;
    private dat;

    constructor({ storagePath }) {
        this.datStoragePath =
            storagePath || path.resolve(__dirname, "../data/ao-dat-node");
        fs.ensureDirSync(this.datStoragePath);
        this.dat = createNode({ path: this.datStoragePath, fs });
    }

    async close() {
        await this.dat.close();
    }

    async resumeAll() {
        await this.dat.resumeAll();
    }

    exists(key: string): boolean {
        return this.dat.exists(key);
    }

    async download(key: string): Promise<DatArchive> {
        debug(`attempting to download: ${key}`);
        const archive = await this.dat.downloadArchive(key);
        return archive;
    }

    /**
     * Returns the newly created archive
     *
     * @param storagePath
     */
    async create(storagePath: string): Promise<DatArchive> {
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
                "/test.md",
                "# Sup!\n\n This was created by the @beaker/dat-node example code. See [the readme](https://npm.im/@beaker/dat-node) for more information."
            );
        }
        return archive;
    }

    /**
     * Import file(s) from disk into the given archive
     *
     * @param {string}  key
     * @param {string}  srcPath
     */
    async importFiles(key: string, srcPath: string) {
        debug(`[${key}] import: ${srcPath}`);
        if (!(await fs.pathExists)) throw new Error(`invalid import path`);
        const archive = await this.dat.getArchive(key);
        await archive.writeFileFromDisk(srcPath);
        debug(`[${key}] import success`);
    }

    /**
     * Remove a dat completely from disk
     *
     * @param {string} key
     */
    async remove(key: string) {
        debug(`[${key}] remove()`);
        if (!this.dat.exists())
            throw new Error(`cannot remove dat, does not exist`);
        const archive = await this.dat.getArchive(key);
        const diskPath = archive.getPath();
        await this.dat.removeArchive(key);
        debug(`[${key}] deleting: ${diskPath}`);
        await fs.remove(diskPath);
        debug(`[${key}] succesfully removed!`);
    }

    list() {
        return this.dat.listKeys();
    }

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
