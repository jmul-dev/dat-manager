import "mocha";
import path from "path";
import DatManager from "./index";
import fs from "fs-extra";
import { expect } from "chai";
import DatArchive from "./DatArchive";

describe("DatManager Test Suite", () => {
    const tmpDir = path.join(
        __dirname,
        `../data/dat-manager-test-${Date.now()}`
    );
    let dat: DatManager;

    before(async function() {
        await fs.ensureDir(tmpDir);
        dat = new DatManager({ storagePath: tmpDir });
    });
    after(async function() {
        // await fs.remove(tmpDir);
        await dat.close();
    });

    describe("Creation", () => {
        let archive: DatArchive;
        let tmpFilePathA = path.join(tmpDir, "testA.json");
        let tmpFilePathB = path.join(tmpDir, "testB.json");

        before(async function() {
            await fs.writeJson(tmpFilePathA, { DEAD: "BEEF" });
            await fs.writeJson(tmpFilePathB, { BEEF: "DEAD" });
        });

        it("should create a new dat", async function() {
            archive = await dat.create(tmpFilePathA);
            const expectedFilePath = path.join(archive.getPath(), "testA.json");
            const contents = await fs.readJson(expectedFilePath);
            expect(contents.DEAD).to.equal("BEEF");
            const archiveRead = await archive.readFile("testA.json");
            const archiveReadContents = JSON.parse(archiveRead);
            expect(archiveReadContents.DEAD).to.equal("BEEF");
        });

        it("should import files from disk to an existing dat", async function() {
            await archive.writeFileFromDisk(tmpFilePathB, "/");
            const expectedFilePath = path.join(archive.getPath(), "testB.json");
            expect(fs.existsSync(expectedFilePath)).to.be.true;
            const contents = await fs.readJson(expectedFilePath);
            expect(contents.BEEF).to.equal("DEAD");
        });

        it("should write file from string to an existing dat", async function() {
            await archive.writeFile(
                "/testC.json",
                JSON.stringify({ HELLO: "WORLD" })
            );
            const expectedFilePath = path.join(archive.getPath(), "testC.json");
            expect(fs.existsSync(expectedFilePath)).to.be.true;
            const contents = await fs.readJson(expectedFilePath);
            expect(contents.HELLO).to.equal("WORLD");
        });

        it("import files should overwrite existing file", async function() {
            await fs.writeJson(tmpFilePathA, { DEADLY: "BEEF" });
            await dat.importFiles(archive.key, tmpFilePathA);
            const expectedFilePath = path.join(archive.getPath(), "testA.json");
            const contents = await fs.readJson(expectedFilePath);
            expect(contents.DEADLY).to.equal("BEEF");
        });
    });

    // describe("Downloads", () => {
    //     const knownDat =
    //         "778f8d955175c92e4ced5e4f5563f69bfec0c86cc6f670352c457943666fe639";
    //     it("should download available dat", async function() {
    //         const archive = await dat.download(knownDat);
    //         expect(archive.key).to.be.equal(knownDat);
    //         expect(dat.exists(knownDat)).to.be.true;
    //     });

    //     it("should remove dowloaded dat", async function() {
    //         const archive = await dat.get(knownDat);
    //         const diskPath = archive.getPath();
    //         await dat.remove(knownDat);
    //         const diskExists = await fs.pathExists(diskPath);
    //         expect(
    //             diskExists,
    //             "Dat still exists on disk, it should have been removed"
    //         ).to.be.false;
    //         expect(dat.exists(knownDat)).to.be.false;
    //     });

    //     const unreachableDat =
    //         "778f8d955175c92e4ced5e4f5563f69bfec0c86cc6f670352c457943666fe638";
    //     it("should fail to download unavailable dat", async function() {
    //         this.timeout(12000);
    //         this.skip();
    //         try {
    //             await dat.download(unreachableDat);
    //         } catch (error) {
    //             expect(dat.exists(unreachableDat)).to.be.false;
    //             return;
    //         }
    //         throw new Error(`Download should have failed`);
    //     });
    // });
});
