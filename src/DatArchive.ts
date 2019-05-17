export default interface DatArchive {
    key: string;
    url: string;
    hyperdrive: object;
    readFile(filepath: string, opts?: Object): Promise<string>;
    writeFile(filepath: string, data: string, opts?: Object): Promise<any>;
    writeFileFromDisk(
        srcPath: string,
        dstPath: string,
        opts?: Object
    ): Promise<any>;
    download(filepath: string, opts?: Object): Promise<any>;
    stats(): DatStats;
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
