import DatManagerInterface, {
    DatDownloadOptions,
    DatManagerOptions
} from "./DatManagerInterface";
import fs from "fs-extra";
import path from "path";
import { createNode } from "@ao/dat-node";
// import { createNode } from "../../dat-node"; // relative path while developing
import Debug from "debug";
import DatArchive from "./DatArchive";
import { lstatSync } from "fs";
const debug = Debug(`ao:dat-manager`);

export default class DatManager implements DatManagerInterface {
    private datStoragePath;
    private dat;

    constructor(opts: DatManagerOptions) {
        const { storagePath, datStorageOptions } = opts;
        this.datStoragePath = storagePath;
        fs.ensureDirSync(this.datStoragePath);
        this.dat = createNode({
            path: this.datStoragePath,
            datStorageOpts: datStorageOptions || {
                secretDir: path.join(storagePath, ".dat_secrets")
            }
        });
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

    async get(key: string): Promise<DatArchive> {
        if (this.dat.exists(key)) return this.dat.getArchive(key);
        throw new Error(`Dat does not exist`);
    }

    async download(
        key: string,
        opts: DatDownloadOptions = {}
    ): Promise<DatArchive> {
        debug(`[${key}] attempting download...`);
        if (opts.resolveOnStart) {
            try {
                return await this.dat.getArchive(key);
            } catch (error) {
                await this.dat.removeArchive(key);
                throw error;
            }
        } else {
            return await this.dat.downloadArchive(key);
        }
    }

    /**
     * Returns the newly created archive
     *
     * @param srcPath
     */
    async create(srcPath: string): Promise<DatArchive> {
        debug(`attempting to create dat, initial data: ${srcPath}`);
        const archive = await this.dat.createArchive({});
        debug(`[${archive.key}] created`);
        if (await fs.pathExists(srcPath)) {
            if (lstatSync(srcPath).isDirectory()) {
                debug(`[${archive.key}] importing directory...`);
            } else {
                debug(`[${archive.key}] importing file...`);
                // const filename = srcPath.split("/").pop();
                // const storageContents = await fs.readFile(srcPath);
                // await archive.writeFile(`/${filename}`, storageContents);
            }
            await archive.writeFileFromDisk(srcPath);
            debug(`[${archive.key}] import succesful!`);
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
        if (!(await fs.pathExists(srcPath)))
            throw new Error(`invalid import path`);
        if (!this.dat.exists(key))
            throw new Error(`cannot import files, dat does not exist`);
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
        if (!this.dat.exists(key))
            throw new Error(`cannot remove dat, does not exist`);
        await this.dat.removeArchive(key);
        debug(`[${key}] succesfully removed!`);
    }

    list() {
        return this.dat.listKeys();
    }
}

async function sleep(ms: number): Promise<any> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
