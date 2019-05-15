// type DatDownloadManager = {
//     on(event: "complete", callback: Function): void;
//     on(event: "failed", callback: (error: Error) => void): void;
//     progress: number;
// }
type DatStats = {
    key: string;
    writer: boolean;
    version: number;
    files: number;
    blocksDownlaoded: number;
    blocksLength: number;
    synced: boolean;
    byteLength: number;
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

export default interface DatManagerInterface {
    close(): Promise<any>;
    /**
     * Downloads a given dat, resolving on success or rejecting on error or timeout.
     *
     * @param key
     */
    download(key: string): Promise<any>;
    /**
     * Initializes a dat and imports files at the given location
     */
    create(storagePath: string): Promise<string>;
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
