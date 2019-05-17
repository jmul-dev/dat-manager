import DatArchive from "./DatArchive";

// type DatDownloadManager = {
//     on(event: "complete", callback: Function): void;
//     on(event: "failed", callback: (error: Error) => void): void;
//     progress: number;
// }
export type DatStats = {
    key: string;
    writer: boolean;
    version: number;
    files: number;
    blocksDownlaoded: number;
    downloaded: number;
    blocksLength: number;
    length: number;
    byteLength: number;
    connected: boolean;
    progress: number;
    network: {
        connected: boolean;
        downloadSpeed: number;
        uploadSpeed: number;
    };
    peers: {
        total: number;
        complete: number;
    };
};

export type DatManagerOptions = {
    storagePath: string;
};

export type DatDownloadOptions = {
    resolveOnStart?: boolean;
};

export default interface DatManagerInterface {
    close(): Promise<any>;
    exists(key: string): boolean;
    /**
     * Get an existing dat archive instance
     */
    get(key: string): Promise<DatArchive>;
    /**
     * Downloads a given dat, resolving on success or rejecting on error or timeout.
     *
     * @param key
     */
    download(key: string, opts?: DatDownloadOptions): Promise<DatArchive>;
    /**
     * Initializes a dat and imports files at the given location
     */
    create(storagePath: string): Promise<DatArchive>;
    /**
     * Import files for an existing dat instance.
     *
     * @param key
     */
    importFiles(key: string, srcPath: string): Promise<any>;
    /**
     * Remove an existing dat
     *
     * @param key
     */
    remove(key: string): Promise<any>;
    /**
     * Full stats for a given dat
     *
     * @param key
     */
    stats(key: string): DatStats;
}
