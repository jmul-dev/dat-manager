import { EventEmitter } from "events";
import hyperdrive from "hyperdrive";

export default interface DatArchive {
    key: Buffer;
    writable: boolean;
    connected: boolean;
    archive: hyperdrive;
    metadata: hyperdrive;
    importFiles(srcDir?: string, opts?: object, cb?: Function): EventEmitter;
    close(cb?: Function);
    trackStats(): EventEmitter;
    getProgress(): number;
    joinNetwork(opts: Object, cb?: Function);
    leaveNetwork();
    stats: {
        get(): DatFileStats;
        network: {
            downloadSpeed: number;
            uploadSpeed: number;
            downloadTotal: number;
            uploadTotal: number;
        };
        peers: {
            total: number;
            complete: number;
        };
    } & EventEmitter;
    network: {
        connected: boolean;
        connecting: boolean;
        close(cb?: Function);
    } & EventEmitter;
    getStats(): Promise<DatStats>;
    getPath(): string;
}

export type DatFileStats = {
    files: number;
    byteLength: number;
    length: number;
    version: number;
    downloaded: number;
};

export type DatStats = {
    key: string;
    writer: boolean;
    version: number;
    files: number;
    blocksDownloaded: number;
    blocksLength: number;
    byteLength: number;
    progress: number;
    complete: boolean;
    network: {
        connected: boolean;
        downloadSpeed: number;
        uploadSpeed: number;
        downloadTotal: number;
        uploadTotal: number;
    };
    peers: {
        total: number;
        complete: number;
    };
};
