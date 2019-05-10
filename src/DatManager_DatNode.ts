import DatManagerInterface from "./DatManagerInterface";
import Dat from "dat-node";
import toiletdb from "toiletdb";
import path from "path";
import fs from "fs-extra";
import ram from "random-access-memory";
import mirror from "mirror-folder";

function createDat(storagePath: string, options?: Object): Promise<any> {
    return new Promise((resolve, reject) => {
        const datOptions = options || {};
        Dat(storagePath, datOptions, (err, dat) => {
            if (err) reject(err);
            else resolve(dat);
        });
    });
}

function joinNetwork(dat): Promise<any> {
    return new Promise((resolve, reject) => {
        const network = dat.joinNetwork();
        network.once("listening", () => {
            resolve(network);
        });
        network.on("error", error => {
            if (error.code !== "EADDRINUSE") {
                reject(error);
            }
        });
    });
}

function closeDat(dat): Promise<any> {
    return new Promise((resolve, reject) => {
        dat.close(resolve);
    });
}

export default class DatManager_DatNode implements DatManagerInterface {
    private db;
    private dbPath;
    private dbStoragePath;
    private datStoragePath;
    private datStorageTempPath;
    datKeys: Array<string> = [];
    private dats: Array<any> = [];

    constructor() {
        this.datStoragePath = path.resolve(__dirname, "../data/content");
        this.datStorageTempPath = path.resolve(__dirname, "../data/tmp");
        this.dbStoragePath = path.resolve(__dirname, "../data/dbs");
        this.dbPath = path.resolve(__dirname, "../data/dbs/dat-node.json");
    }

    async init() {
        await fs.ensureDir(this.datStoragePath)
        await fs.ensureDir(this.datStorageTempPath)
        await fs.ensureDir(this.dbStoragePath)
        if (!fs.pathExistsSync(this.dbPath)) {
            await fs.writeJson(this.dbPath, {})
        }
        this.db = toiletdb(this.dbPath);
        await this.db.open();
        const storage = await this.db.read();
        if (!storage || !Object.keys(storage).length) {
            console.log("no existing dats");
            return;
        }
        const dats = Object.keys(storage).map(key => storage[key]);
        console.log(
            `existing dats:\n`,
            dats.map(dat => dat.key).join("\n"),
            "\n"
        );
        for (let i = 0; i < dats.length; i++) {
            const entry = dats[i];
            try {
                console.log(
                    `[${entry.key}] attempting to resume: ${entry.path}`
                );
                const dat = await createDat(entry.path, {
                    key: entry.key
                });
                this.dats[entry.key] = dat;
                await joinNetwork(dat);
                console.log(`[${entry.key}] created and joined network`);
            } catch (error) {
                console.error(`[${entry.key}] error initializing dat`, error);
            }
        }
    }

    async download(key: string) {
        if (this.dats[key])
            throw new Error(`Dat instance already exists, skipping download`);
        const downloadPath = path.join(this.datStoragePath, key);
        // 1. Create the dat in ram, which will then be mirrored to downloadPath
        const dat = await createDat(ram, { key, sparse: true });
        // 2. Join network to start connecting to peers
        const network = await joinNetwork(dat);
        // 3. On first connection, trigger the download & mirror
        return new Promise((resolve, reject) => {
            network.once("connection", () => {
                console.log(`[${key}] connection made`);
                dat.archive.metadata.update(() => {
                    console.log(`[${key}] metadata update`);
                    var progress = mirror(
                        { fs: dat.archive, name: "/" },
                        downloadPath,
                        async err => {
                            try {
                                if (err) throw err;
                                // 4. Mirror complete
                                console.log(`[${key}] mirror complete`);
                                const diskDat = await createDat(downloadPath, {key});
                                const diskDatExists = await fs.pathExists(
                                    path.join(downloadPath, ".dat")
                                );
                                if (!diskDatExists)
                                    throw new Error(
                                        `.dat folder does not exist`
                                    );
                                console.log(`[${key}] ${downloadPath}`);
                                // 5. Add dat to storage
                                await this.db.write(key, {
                                    key: key,
                                    path: downloadPath
                                });
                                this.dats[key] = diskDat;
                                // Close in memory dat
                                console.log(`[${key}] closing ram dat`);
                                await closeDat(dat);
                                // Join network with the disk dat
                                console.log(`[${key}] joining network`);
                                await joinNetwork(diskDat);
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        }
                    );
                });
            });
        });
    }

    async create(storagePath: string) {
        console.log(`attempting to create dat at path: ${storagePath}`);
        // 1. copy content to temp dir
        const tmpDir = path.join(
            this.datStorageTempPath,
            Date.now().toString()
        );
        await fs.copy(storagePath, tmpDir);
        // 2. initialize the dat in tmp location
        const dat = await createDat(tmpDir);
        const datKey = dat.key.toString("hex");
        // 3. close the dat before we move to perminent location
        await new Promise((resolve, reject) => {
            dat.close(err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        // 4. move to perm location
        const permDir = path.join(this.datStoragePath, datKey);
        await fs.move(tmpDir, permDir);
        // 5. reinitialize the dat
        const permDat = await createDat(permDir, { key: datKey });
        this.dats[datKey] = permDat;
        // 6. finally run the import
        await this.importFiles(datKey);
        console.log(`[${datKey}] dat created`);
        // 7. write to db
        await this.db.write(datKey, {
            key: datKey,
            path: permDir
        });
        // 8. join network and share
        await joinNetwork(dat);
        return datKey;
    }

    async importFiles(key: string) {
        const dat = this.dats[key];
        if (!dat) throw new Error(`dat not found`);
        return new Promise((resolve, reject) => {

            const progress = dat.importFiles({ keepExisting: true }, err => {
                if (err) return reject(err);
                console.log(`[${key}] importFiles success!`);
                resolve();
            });
            progress.on("put", (src, dest) => {
                console.log(`[${key}] imported file: ${dest.name}`);
            });
            progress.once("end", () => {
                console.log('progress:end')
                resolve();
            });
            progress.once("error", (error) => {
                console.log('progress:error', error)
                reject();
            });
        });
    }

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
