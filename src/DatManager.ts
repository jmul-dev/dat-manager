import DatManagerInterface, {
    DatDownloadOptions,
    DatManagerOptions
} from "./DatManagerInterface";
import fs from "fs-extra";
import path, { resolve, join } from "path";
import Dat from "dat-node";
import Debug from "debug";
import DatArchive, { DatStats } from "./DatArchive";
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
    public DOWNLOAD_PROGRESS_TIMEOUT = 120000;
	public INBOUND_PORT_START = 10000;
	public INBOUND_PORT_END = 60000;

	private lastUsedInboundPort = this.INBOUND_PORT_START;
	private portsInUse = [];

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
        debug(`DatManager::close()`);
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
        debug(`DatManager::close() -> success`);
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
				const network = await this._joinNetwork(dat, true);
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
        debug(`[${key}] get dat but path does not exist, running createDat`);
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
                // metadataStorageCacheSize: 0,
                // contentStorageCacheSize: 0,
                // treeCacheSize: 2048,
                ...this.datStorageOptions
            });
            this._dats[key] = dat;
            debug(`[${key}] ram dat initialized`);
            // 2. Join network and esure that we make a succesful connection in a timely manner
			const network = await this._joinNetwork(dat, true);
            debug(`[${key}] network joined, ensuring peer connection...`);
            await ensurePeerConnected(network, this.DOWNLOAD_PROGRESS_TIMEOUT);
            debug(`[${key}] peer connection(s) has been made`);

            // 3. Wait for initial metadata sync if not the owner
            if (!dat.archive.writable && !dat.archive.metadata.length) {
                debug(
                    `[${key}] metadata does not exist, await initial sync...`
                );
                await new Promise((resolve, reject) => {
                    let timeoutId = setTimeout(() => {
                        reject(
                            new Error(`timed out while pulling in metadata`)
                        );
                    }, this.DOWNLOAD_PROGRESS_TIMEOUT);
                    dat.archive.metadata.update(err => {
                        clearTimeout(timeoutId);
                        if (err) reject(err);
                        else resolve();
                    });
                });
                debug(`[${key}] initial metadata sync`);
            }
            // 4. always download all metadata
            if (!dat.archive.writable) {
                dat.archive.metadata.download({ start: 0, end: -1 });
            }
            // 5. Mirroring ram archive to disk
            const downloadPromise = new Promise(async (_resolve, _reject) => {
                let responded = false;
                let progress;

                const reject = err => {
                    if (responded) return;
                    responded = true;
                    dat.stats.removeListener("update", logDownloadStats);
                    _reject(err);
                };
                const resolve = (data?) => {
                    if (responded) return;
                    responded = true;
                    dat.stats.removeListener("update", logDownloadStats);
                    _resolve(data);
                };
                const logDownloadStats = () => {
                    debug(
                        `[${key}] progress: ${(dat.getProgress() * 100).toFixed(
                            1
                        )}`
                    );
                };
                dat.stats.on("update", logDownloadStats);
                // mirror download to disk
                progress = mirror(
                    { fs: dat.archive, name: "/" },
                    downloadPath,
                    async err => {
                        try {
                            if (err) throw err;
                            // Mirror complete
                            debug(`[${key}] mirror complete`);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }
                );
                progress.on("error", reject);
            });
            // 6. Download may resolve once the download is complete, or once the download has
            // started. This difference is waiting on downloadPromise.
            if (!opts.resolveOnStart) {
                await downloadPromise;
                debug(
                    `[${key}] resolving completed download, handoff to post process`
                );
                return await this._postDownloadProcessing(key);
            } else {
                debug(`[${key}] resolving download on start`);
                downloadPromise
                    .then(() => {
                        return this._postDownloadProcessing(key);
                    })
                    .catch(error => {
                        debug(
                            `[${key}] error in download promise after resolving on download start: ${
                                error.message
                            }`
                        );
                    });
                return dat;
            }
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
                throw error;
            }
            throw error;
        }
    }

    /**
     * Download process involves mirroring the dat to disk, so we have to actually
     * instantiate the dat post-download to store in db, create .dat folder, etc..
     *
     * @param key
     */
    private async _postDownloadProcessing(key) {
        const dat = this._dats[key];
        if (!dat) throw new Error(`Cannot post-process non-existent dat`);
        try {
            const downloadPath = path.join(this.datStoragePath, key);
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
			const network = await this._joinNetwork(diskDat, true);
            debug(`[${key}] network joined, ensuring peer connection...`);
            await ensurePeerConnected(network, this.DOWNLOAD_PROGRESS_TIMEOUT);
            debug(`[${key}] peer connection(s) has been made`);
            debug(`[${key}] succesfuly downloaded and joined network!`);
            return diskDat;
        } catch (error) {
            try {
                debug(
                    `[${key}] caught error during download process (${
                        error.message
                    }), attempt to clean up...`
                );
                // try to cleanup
                await sleep(1000); // for some reason cleaning up too early causes udp crash
                await this.remove(key);
            } catch (error) {
                debug(
                    `[${key}] error cleaning up after failed download: ${
                        error.message
                    }`
                );
                throw error;
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
		await this._joinNetwork(dat, true);
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
        if (srcPath && !(await fs.pathExists(srcPath)))
            throw new Error(`Cannot import files, src path does not exist`);
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
            progress.on("error", error => {
                debug(`[${key}] error importing: ${error.message}`);
                reject(error);
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
        let dat: DatArchive = this._dats[key];
        // 1. If we have dat instance, close it up
        if (dat) {
            debug(`[${key}] closing dat instance...`);
            await closeDat(dat);
            debug(`[${key}] dat instance closed`);
            delete this._dats[key];
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
        dat = null;
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

	/**
	 * Note that joinNetwork callback is not called until the first round of discovery is complete.
	 * This is mostly useful for downloading/cloning a dat and not so much while sharing a local dat.
	 *
	 * @param dat
	 * @param resolveOnNetworkCallback
	 */
	private async _joinNetwork(
		dat: DatArchive,
		resolveOnNetworkCallback: boolean = false
	): Promise<any> {
		return new Promise(async (resolve, reject) => {
			let port = this.lastUsedInboundPort;
			while(this.portsInUse.indexOf(port) !== -1) {
				port++;
				if (port === this.INBOUND_PORT_END) {
					const error = `Exceed INBOUND_PORT_END (${this.INBOUND_PORT_END})`;
					debug(
						`[${dat.key.toString("hex")}] network error: ${error}`
					);
					await closeDat(dat);
					reject(error);
				}
			}
			this.lastUsedInboundPort = port;
			this.portsInUse.push(port);

			debug(`[${dat.key.toString("hex")}] joining network: port ${port}`);
			const network = dat.joinNetwork(
				{
					utp: false,
					tcp: true,
					port
				},
				async (error) => {
					if (error) {
						await closeDat(dat);
						return reject(error);
					}
					if (resolveOnNetworkCallback) {
						dat.connected = true;
						resolve(dat.network);
					}
				}
			);
			network.on("connection", (connection, info) => {
				//debug(`[${dat.key.toString("hex")}] network connected: port ${network.options.port}`);
				if (!resolveOnNetworkCallback) {
					dat.connected = true;
					resolve(dat.network);
				}
			});
			network.on("error", async (error) => {
				if (error.code === "EADDRINUSE") {
					await this._joinNetwork(dat, resolveOnNetworkCallback);
				} else {
					debug(
						`[${dat.key.toString("hex")}] network error: ${
							error.message
						}`
					);
					await closeDat(dat);
					reject(error);
				}
			});
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
            if (err) return reject(err);
            if (!dat) return reject(new Error(`No dat instance returned`));
            dat.trackStats();
            dat.getPath = () => storagePath;
            dat.getStats = (): DatStats => {
                const stats = dat.stats.get();
                let downloadPercent = stats.downloaded / stats.length;
                if (dat.archive.writable) downloadPercent = 1.0;
                // slight hack, but if this is an in-memory dat we override the complete
                // state (specifically for the download process, since we initialize a disk version
                // after in-memory dl is complete)
                return {
                    key: dat.key.toString("hex"),
                    writer: dat.archive.writable,
                    version: dat.archive.version || stats.version,
                    files: stats.files,
                    blocksDownlaoded: dat.archive.writable
                        ? stats.length
                        : stats.downloaded,
                    blocksLength: stats.length,
                    byteLength: stats.byteLength,
                    progress: downloadPercent,
                    complete: downloadPercent === 1 && storagePath !== ram,
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
            dat.archive.ready(error => {
                if (error) reject(error);
                else resolve(dat);
            });
        });
    });
}

async function closeDat(dat: DatArchive): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!dat || !dat.close) return resolve();
        dat.close(resolve);
    });
}

async function ensurePeerConnected(
    network,
    timeout: number = 5000
): Promise<any> {
    return checkExit(timeout);
    async function checkExit(timeout: number): Promise<any> {
        if (timeout <= 0)
            return Promise.reject(new Error(`Peer connection timeout`));
        if (network.connected) {
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
