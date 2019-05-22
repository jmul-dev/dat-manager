import DatManagerInterface, {
    DatDownloadOptions,
    DatManagerOptions
} from "./DatManagerInterface";
import fs from "fs-extra";
import path, { resolve, join } from "path";
import Dat from "dat-node";
import Debug from "debug";
import DatArchive from "./DatArchive";
import Datastore from "nedb";
import signatures from "sodium-signatures";
import datEncoding from "dat-encoding";
import ram from "random-access-memory";
import mirror from "mirror-folder";
const debug = Debug(`ao:dat-manager`);

interface DatDbEntry {
    key: string;
    path: string;
    writable?: boolean;
}

export default class DatManager implements DatManagerInterface {
    public DOWNLOAD_PROGRESS_TIMEOUT = 16000;
    private datStoragePath;
    // see dat-storage package
    private datStorageOptions: {
        secretDir?: string;
        prefix?: string;
    };
    private _db: Datastore;
    private _dats: { [key: string]: DatArchive } = {};

    constructor(opts: DatManagerOptions) {
        const { storagePath, datStorageOptions } = opts;
        this.datStoragePath = storagePath;
        this.datStorageOptions = datStorageOptions || {};
        fs.ensureDirSync(this.datStoragePath);
        this._db = new Datastore({
            filename: path.join(storagePath, "dats.json"),
            autoload: true,
            onload: error => {
                if (error) debug(`Error loading dats db: ${error.message}`);
            }
        });
        this._db.ensureIndex({
            fieldName: "key",
            unique: true
        });
    }

    async close() {
        for (const key in this._dats) {
            if (this._dats.hasOwnProperty(key)) {
                const dat: DatArchive = this._dats[key];
                try {
                    await closeDat(dat);
                } catch (error) {
                    debug(
                        `[${key}] error attempting to close: ${error.message}`
                    );
                }
            }
        }
    }

    async resumeAll() {
        const entries: Array<DatDbEntry> = await new Promise(
            (resolve, reject) => {
                this._db.find({}, function(err, entries) {
                    if (err) reject(err);
                    else resolve(entries || []);
                });
            }
        );
        for (const entry of entries) {
            const { key } = entry;
            let dat: DatArchive;
            try {
                if (this._dats[key])
                    throw new Error(
                        `Dat instance already exists, cannot resume`
                    );
                dat = await createDat(entry.path, {
                    key,
                    ...this.datStorageOptions
                });
                await joinNetwork(dat);
                this._dats[key] = dat;
                debug(`[${key}] resumed dat`);
            } catch (error) {
                if (dat) await closeDat(dat);
                debug(`[${key}] failed to resume dat: ${error.message}`);
            }
        }
    }

    exists(key: string): boolean {
        if (this._dats[key]) return true;
        return false;
    }

    async get(key: string): Promise<DatArchive> {
        if (this._dats[key]) return this._dats[key];
        const datDir = path.join(this.datStoragePath, key);
        const datDirExists = await fs.pathExists(datDir);
        if (!datDirExists) throw new Error(`Dat not found in storage`);
        const dat: DatArchive = await createDat(datDir, {
            key,
            ...this.datStorageOptions
        });
        this._dats[key] = dat;
        return dat;
    }

    async download(
        key: string,
        opts: DatDownloadOptions = {}
    ): Promise<DatArchive> {
        debug(`[${key}] attempting to download...`);
        let dat: DatArchive = this._dats[key];
        if (dat && dat.getProgress() < 1) {
            throw new Error(
                `Dat instance already exists, download in progress`
            );
        } else if (dat) {
            // Already have completely downloaded dat, just return that
            return dat;
        }
        try {
            const downloadPath = path.join(this.datStoragePath, key);
            // 1. Create the dat in ram, which will then be mirrored to downloadPath
            dat = await createDat(ram, {
                key,
                sparse: true,
                metadataStorageCacheSize: 0,
                contentStorageCacheSize: 0,
                treeCacheSize: 2048,
                ...this.datStorageOptions
            });
            this._dats[key] = dat;
            // 2. Join network to start connecting to peers
            const network = await joinNetwork(dat, true);
            // 3. On first connection, trigger the download & mirror
            await new Promise((_resolve, _reject) => {
                let responded = false;
                let timeoutId;
                let progress;

                const reject = err => {
                    if (responded) return;
                    responded = true;
                    if (progress && typeof progress.destroy === "function")
                        progress.destroy();
                    _reject(err);
                };
                const resolve = (data?) => {
                    if (responded) return;
                    responded = true;
                    clearTimeout(timeoutId);
                    _resolve(data);
                };

                // Start timeout early
                timeoutId = timeoutPromise(
                    this.DOWNLOAD_PROGRESS_TIMEOUT,
                    reject
                );

                network.once("connection", () => {
                    debug(`[${key}] connection made`);
                });
                dat.archive.on("error", error => {
                    debug(`[${key}] archive error: ${error.message}`);
                    reject(error);
                });
                dat.archive.metadata.update(() => {
                    debug(`[${key}] metadata update`);
                    // race condition, if we hit timeout before this callback do not proceed!
                    if (responded) return;
                    progress = mirror(
                        { fs: dat.archive, name: "/" },
                        downloadPath,
                        async err => {
                            try {
                                if (err) throw err;
                                // 4. Mirror complete
                                debug(`[${key}] mirror complete`);
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        }
                    );
                    progress.on("put-data", onProgressUpdate);
                    progress.on("error", reject);
                    // reset timeout
                    onProgressUpdate();
                });

                const onProgressUpdate = () => {
                    clearTimeout(timeoutId);
                    timeoutId = timeoutPromise(
                        this.DOWNLOAD_PROGRESS_TIMEOUT,
                        reject
                    );
                };
            });
            debug(`[${key}] download promise resolved`);
            const diskDat: DatArchive = await createDat(downloadPath, {
                key,
                ...this.datStorageOptions
            });
            const diskDatExists = await fs.pathExists(
                path.join(downloadPath, ".dat")
            );
            if (!diskDatExists) throw new Error(`.dat folder does not exist`);
            // 5. Add dat to storage
            await this._dbUpsert({
                key: key,
                path: downloadPath
            });
            this._dats[key] = diskDat;
            // Close in memory dat
            debug(`[${key}] closing ram dat`);
            try {
                await closeDat(dat);
            } catch (error) {
                debug(`[${key}] error closing ram dat: ${error.message}`);
            }
            // Join network with the disk dat
            debug(`[${key}] joining network...`);
            await joinNetwork(diskDat);
            debug(`[${key}] succesffuly downloaded and joined network!`);
            return diskDat;
        } catch (error) {
            try {
                debug(
                    `[${key}] caught error during download process (${
                        error.message
                    }), attempt to clean up...`
                );
                // try to cleanup
                await this.remove(key);
            } catch (error) {
                debug(
                    `[${key}] error cleaning up after failed download: ${
                        error.message
                    }`
                );
            }
            throw error;
        }
    }

    /**
     * Returns the newly created archive
     *
     * @param srcPath
     */
    async create(srcPath: string): Promise<DatArchive> {
        const kp = signatures.keyPair();
        const keyBuf = kp.publicKey;
        const secretKey = kp.secretKey;
        const key = datEncoding.toStr(keyBuf);
        const newDatDir = path.join(this.datStoragePath, key);
        debug(`[${key}] initializing dat instance...`);
        const dat: DatArchive = await createDat(newDatDir, {
            key,
            secretKey,
            ...this.datStorageOptions
        });
        this._dats[key] = dat;
        debug(`[${key}] dat instance initialized, importing files...`);
        await this.importFiles(key, srcPath);
        debug(`[${key}] files imported, joining network...`);
        await joinNetwork(dat);
        debug(`[${key}] storing dat in persisted storage...`);
        await this._dbUpsert({ key, path: newDatDir, writable: dat.writable });
        debug(`[${key}] dat created and stored!`);
        return dat;
    }

    /**
     * Import file(s) from disk into the given archive
     *
     * @param {string}  key
     * @param {string}  srcPath
     */
    async importFiles(key: string, srcPath: string) {
        debug(`[${key}] import: ${srcPath}`);
        const dat: DatArchive = await this.get(key);
        if (!dat.writable)
            throw new Error(`Cannot import files on a non-writable dat`);
        await new Promise((resolve, reject) => {
            let filesImported = 0;
            const progress = dat.importFiles(
                srcPath,
                { keepExisting: true, count: false },
                err => {
                    if (err) return reject(err);
                    debug(`[${key}] ${filesImported} imported files!`);
                    resolve({ filesImported });
                }
            );
            progress.on("put", (src, dest) => {
                filesImported++;
                debug(`[${key}] imported file: ${dest.name}`);
            });
        });
        debug(`[${key}] import success`);
    }

    /**
     * Remove a dat completely from disk
     *
     * @param {string} key
     */
    async remove(key: string) {
        debug(`[${key}] removing...`);
        const dat: DatArchive = this._dats[key];
        // 1. If we have dat instance, close it up
        if (dat) {
            debug(`[${key}] closing dat instance...`);
            await closeDat(dat);
            debug(`[${key}] dat instance closed`);
            this._dats[key] = null;
        }
        // 2. Remove from persisted storage
        debug(`[${key}] removing from db...`);
        await this._dbRemove(key);
        debug(`[${key}] removed from db`);
        // 3. Remove from disk
        const datDir = path.join(this.datStoragePath, key);
        const dirExists = await fs.pathExists(datDir);
        if (dirExists) {
            debug(`[${key}] removing from disk...`);
            await sleep(
                500
            ); /* For some reason dat close may hang on to fd longer than it should */
            await fs.remove(datDir);
        }
        debug(`[${key}] succesfully removed!`);
    }

    list() {
        return Object.keys(this._dats);
    }

    private async _dbUpsert(data: DatDbEntry): Promise<any> {
        if (!data.key) throw new Error(`upsert requires key`);
        return new Promise((resolve, reject) => {
            this._db.update({ key: data.key }, data, { upsert: true }, err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    private async _dbRemove(key: string): Promise<any> {
        this._db.remove({ key }, {}, function(
            error: Error,
            numRemoved: number
        ) {
            if (error)
                debug(
                    `[${key}] error removing entry from db: ${error.message}`
                );
            resolve();
        });
    }
}

function createDat(storagePath: string, options?: Object): Promise<DatArchive> {
    return new Promise((resolve, reject) => {
        const datOptions = options || {};
        if (typeof storagePath === "string") {
            fs.ensureDirSync(storagePath);
        }
        Dat(storagePath, datOptions, (err: Error, dat: DatArchive) => {
            if (err) reject(err);
            else {
                dat.trackStats();
                dat.getPath = () => storagePath;
                dat.getStats = () => {
                    const stats = dat.stats.get();
                    let downloadPercent = stats.downloaded / stats.length;
                    if (dat.archive.writable) downloadPercent = 1.0;
                    return {
                        key: dat.key.toString("hex"),
                        writer: dat.writable,
                        version: dat.archive.version || stats.version,
                        files: stats.files,
                        blocksDownlaoded: dat.writable
                            ? stats.length
                            : stats.downloaded,
                        blocksLength: stats.length,
                        byteLength: stats.byteLength,
                        progress: downloadPercent,
                        network: {
                            connected: dat.connected,
                            downloadSpeed: dat.stats.network.downloadSpeed,
                            uploadSpeed: dat.stats.network.uploadSpeed,
                            downloadTotal: dat.stats.network.downloadTotal,
                            uploadTotal: dat.stats.network.uploadTotal
                        },
                        peers: {
                            total: dat.stats.peers.total,
                            complete: dat.stats.peers.complete
                        }
                    };
                };
                dat.getProgress = () => {
                    const stats = dat.stats.get();
                    let downloadPercent = stats.downloaded / stats.length;
                    if (dat.archive.writable) downloadPercent = 1.0;
                    if (!Number.isFinite(downloadPercent)) downloadPercent = 0;
                    return downloadPercent;
                };
                resolve(dat);
            }
        });
    });
}

async function closeDat(dat: DatArchive): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!dat || !dat.close) return resolve();
        dat.close(resolve);
    });
}

/**
 * Note that joinNetwork callback is not called until the first round of discovery is complete.
 * This is mostly useful for downloading/cloning a dat and not so much while sharing a local dat.
 *
 * @param dat
 * @param resolveOnNetworkCallback
 */
async function joinNetwork(
    dat,
    resolveOnNetworkCallback: boolean = false
): Promise<any> {
    return new Promise((resolve, reject) => {
        const network = dat.joinNetwork(error => {
            if (error) return reject(error);
            if (resolveOnNetworkCallback) {
                dat.connected = true;
                resolve(network);
            }
        });
        network.on("listening", () => {
            if (!resolveOnNetworkCallback) {
                dat.connected = true;
                resolve(network);
            }
        });
        network.on("error", error => {
            if (error.code !== "EADDRINUSE") {
                debug(
                    `[${dat.key.toString("hex")}] network error: ${
                        error.message
                    }`
                );
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

async function sleep(ms: number): Promise<any> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function timeoutPromise(ms, rejection): NodeJS.Timeout {
    return setTimeout(() => {
        rejection(new Error(`promise timed out`));
    }, ms);
}
