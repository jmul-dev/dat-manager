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
    stats(): {
        peers: number;
        connected: boolean;
        progress: number;
        files: number;
        byteLength: number;
        length: number;
        version: number;
    };
}
