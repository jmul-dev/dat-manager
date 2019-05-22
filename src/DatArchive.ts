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
    stats: {
        get(): {
            files: number;
            byteLength: number;
            length: number;
            version: number;
            downloaded: number;
        };
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
    getStats(): DatStats;
    getPath(): string;
}

export type DatStats = {
    key: string;
    writer: boolean;
    version: number;
    files: number;
    blocksDownlaoded: number;
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
