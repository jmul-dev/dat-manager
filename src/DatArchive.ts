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
