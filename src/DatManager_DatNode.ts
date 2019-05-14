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

async function joinNetwork(dat): Promise<any> {
    return new Promise((resolve, reject) => {
        const network = dat.joinNetwork();
        network.on("listening", () => {
            resolve(network);
        });
        network.on("error", error => {
            if (error.code !== "EADDRINUSE") {
                reject(error);
            }
        });
    });
}

async function ensurePeerConnected(
    network,
    timeout: number = 5000
): Promise<any> {
    return checkExit(timeout);
    async function checkExit(timeout: number): Promise<any> {
        console.log(`checkExit with timeout: ${timeout}`);
        if (timeout <= 0)
            return Promise.reject(new Error(`Peer connection timeout`));
        if (network.connected) {
            console.log(`network.connected = true`);
            return Promise.resolve();
        }
        if (network.connecting) {
            await sleep(1000);
            return checkExit(timeout - 1000);
        }
        // not connected or connecting
        return Promise.reject(
            new Error(`Unable to establish network connection`)
        );
    }
}

function closeDat(dat): Promise<any> {
    return new Promise((resolve, reject) => {
        dat.close(resolve);
    });
}

async function sleep(ms: number): Promise<any> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export default class DatManager_DatNode implements DatManagerInterface {
    private db;
    private dbPath;
    private dbStoragePath;
    private datStoragePath;
    private datStorageTempPath;
    private secretDir;
    datKeys: Array<string> = [];
    private dats: Array<any> = [];

    constructor({ storagePath }) {
        this.datStoragePath = path.resolve(storagePath, "data/content");
        this.datStorageTempPath = path.resolve(storagePath, "data/tmp");
        this.dbStoragePath = path.resolve(storagePath, "data/dbs");
        this.dbPath = path.resolve(storagePath, "data/dbs/dat-node.json");
        this.secretDir = path.resolve(this.datStoragePath, "secrets");
    }

    async init() {
        await fs.ensureDir(this.datStoragePath);
        await fs.ensureDir(this.datStorageTempPath);
        await fs.ensureDir(this.dbStoragePath);
        if (!fs.pathExistsSync(this.dbPath)) {
            await fs.writeJson(this.dbPath, {});
        }
        this.db = toiletdb(this.dbPath);
        await this.db.open();
    }

    async resumeAll() {
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

    // async download(key: string) {
    //     if (this.dats[key])
    //         throw new Error(`Dat instance already exists, skipping download`);
    //     const downloadPath = path.join(this.datStoragePath, key);
    //     // 1. Create the dat in ram, which will then be mirrored to downloadPath
    //     const dat = await createDat(ram, { key, sparse: true });
    //     // 2. Join network to start connecting to peers
    //     const network = await joinNetwork(dat);
    //     // 3. On first connection, trigger the download & mirror
    //     return new Promise((resolve, reject) => {
    //         network.once("connection", () => {
    //             console.log(`[${key}] connection made`);
    //         });
    //         dat.archive.metadata.update(() => {
    //             console.log(`[${key}] metadata update`);
    //             var progress = mirror(
    //                 { fs: dat.archive, name: "/" },
    //                 downloadPath,
    //                 async err => {
    //                     try {
    //                         if (err) throw err;
    //                         // 4. Mirror complete
    //                         console.log(`[${key}] mirror complete`);
    //                         const diskDat = await createDat(downloadPath, {
    //                             key
    //                         });
    //                         const diskDatExists = await fs.pathExists(
    //                             path.join(downloadPath, ".dat")
    //                         );
    //                         if (!diskDatExists)
    //                             throw new Error(`.dat folder does not exist`);
    //                         console.log(`[${key}] ${downloadPath}`);
    //                         // 5. Add dat to storage
    //                         await this.db.write(key, {
    //                             key: key,
    //                             path: downloadPath
    //                         });
    //                         this.dats[key] = diskDat;
    //                         // Close in memory dat
    //                         console.log(`[${key}] closing ram dat`);
    //                         await closeDat(dat);
    //                         // Join network with the disk dat
    //                         console.log(`[${key}] joining network`);
    //                         await joinNetwork(diskDat);
    //                         resolve();
    //                     } catch (error) {
    //                         reject(error);
    //                     }
    //                 }
    //             );
    //         });
    //     });
    // }

    async download(key: string) {
        if (this.dats[key])
            throw new Error(`Dat instance already exists, skipping download`);
        const downloadPath = path.join(this.datStoragePath, key);
        // 1. Create the dat in ram, which will then be mirrored to downloadPath
        const dat = await createDat(downloadPath, { key });
        // 2. Join network to start connecting to peers
        const network = await joinNetwork(dat);
        // 3. Ensure that a peer connects within a decent amount of time
        await ensurePeerConnected(network);
        console.log(`[${key}] tracking stats...`);
        const stats = dat.trackStats();
        // 4. Once archive content is available we can listen for sync completion
        if (!dat.archive.content)
            await new Promise(resolve => {
                dat.archive.once("content", resolve);
            });
        dat.archive.metadata.update();
        // 5 Wait for archive sync
        return new Promise((resolve, reject) => {
            console.log(`[${key}] waiting for archive sync...`);
            dat.archive.readFile("/dat.json", content => {
                console.log(`read file:`, content);
            });
            let modified = false;
            let synced = false;
            dat.archive.content.on("clear", () => {
                console.log(`[${key}] content:clear`);
                modified = true;
            });
            dat.archive.content.on("download", () => {
                console.log(`[${key}] content:download`);
                modified = true;
            });
            dat.archive.on("syncing", () => {
                console.log(`[${key}] archive:syncing`);
                synced = false;
            });
            dat.archive.on("sync", () => {
                console.log(`[${key}] archive:sync, modified: ${modified}`);
                synced = true;
                if (modified) complete();
                else setTimeout(complete, 1000);

                function complete() {
                    console.log(`[${key}] checking version complete...`);
                    if (stats.get().version !== dat.archive.version)
                        return stats.once("update", complete);
                    console.log(`[${key}] fully synced!`);
                    resolve();
                }
            });
        });
    }

    async create(storagePath: string) {
        console.log(`attempting to create dat at path: ${storagePath}`);
        // 1. copy content to temp dir
        const tmpDir = path.join(
            this.datStoragePath,
            `tmp`,
            Date.now().toString()
        );
        await fs.copy(storagePath, tmpDir);
        // 2. initialize the dat in tmp location (to generate dat key)
        let dat = await createDat(tmpDir, { secretDir: this.secretDir });
        const datKey = dat.key.toString("hex");
        this.dats[datKey] = dat;
        await this.importFiles(datKey);
        // 3. close the dat before we move to perminent location
        await closeDat(dat);
        dat = null;
        console.log(`moving temp dir to perm dir`);
        // 4. move to perm location
        const permDir = path.join(this.datStoragePath, datKey);
        await fs.move(tmpDir, permDir);
        // 5. reinitialize the dat
        const permDat = await createDat(permDir, {
            key: datKey,
            secretDir: this.secretDir
        });
        permDat.archive.on("ready", () => {
            console.log("archive:ready");
        });
        permDat.archive.on("error", err => {
            console.log("archive:error", err);
        });
        // console.log(permDat.archive.stat('/'))
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
        await joinNetwork(permDat);
        // console.log(util.inspect(permDat, false, 4, true))
        return datKey;
    }

    async importFiles(key: string) {
        const dat = this.dats[key];
        if (!dat) throw new Error(`dat not found`);
        return new Promise((resolve, reject) => {
            const progress = dat.importFile();
            progress.on("put", (src, dest) => {
                console.log(`[${key}] imported file: ${dest.name}`);
            });
            progress.on("end", () => {
                console.log("progress:end");
                resolve();
            });
            progress.on("error", error => {
                console.log("progress:error", error);
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
