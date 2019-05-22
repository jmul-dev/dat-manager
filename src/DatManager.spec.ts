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
        await fs.remove(tmpDir);
        await dat.close();
    });

    // describe("Creation", () => {
    //     let archive: DatArchive;
    //     let tmpFolderA = path.join(tmpDir, "A");
    //     let tmpFilePathA = path.join(tmpFolderA, "testA.json");
    //     let tmpFolderB = path.join(tmpDir, "B");
    //     let tmpFilePathB = path.join(tmpFolderB, "testB.json");

    //     before(async function() {
    //         await fs.ensureDir(tmpFolderA);
    //         await fs.ensureDir(tmpFolderB);
    //         await fs.writeJson(tmpFilePathA, { DEAD: "BEEF" });
    //         await fs.writeJson(tmpFilePathB, { BEEF: "DEAD" });
    //     });

    //     it("should create a new dat", async function() {
    //         archive = await dat.create(tmpFolderA);
    //         const expectedFilePath = path.join(archive.getPath(), "testA.json");
    //         const contents = await fs.readJson(expectedFilePath);
    //         expect(contents.DEAD).to.equal("BEEF");
    //         expect(await dat.exists(archive.key.toString("hex"))).to.be.true;
    //     });

    //     it("should import files from disk to an existing dat", async function() {
    //         await dat.importFiles(archive.key.toString("hex"), tmpFolderB);
    //         const expectedFilePath = path.join(archive.getPath(), "testB.json");
    //         expect(fs.existsSync(expectedFilePath)).to.be.true;
    //         const contents = await fs.readJson(expectedFilePath);
    //         expect(contents.BEEF).to.equal("DEAD");
    //     });

    //     it("import files should overwrite existing file", async function() {
    //         await fs.writeJson(tmpFilePathA, { DEADLY: "BEEF" });
    //         await dat.importFiles(archive.key.toString("hex"), tmpFolderA);
    //         const expectedFilePath = path.join(archive.getPath(), "testA.json");
    //         const contents = await fs.readJson(expectedFilePath);
    //         expect(contents.DEADLY).to.equal("BEEF");
    //     });
    // });

    describe("Downloads", () => {
        const unreachableDat =
            "778f8d955175c92e4ced5e4f5563f69bfec0c86cc6f670352c457943666fe638";
        const knownDat =
            "778f8d955175c92e4ced5e4f5563f69bfec0c86cc6f670352c457943666fe639";
        let knownDatDownlaoded = false;

        // it("should download available dat", async function() {
        //     this.timeout(16000);
        //     const archive = await dat.download(knownDat);
        //     expect(archive.key.toString("hex")).to.be.equal(knownDat);
        //     expect(dat.exists(knownDat)).to.be.true;
        //     knownDatDownlaoded = true;
        // });

        // it("should remove dowloaded dat", async function() {
        //     if (!knownDatDownlaoded) this.skip();
        //     const archive = await dat.get(knownDat);
        //     const diskPath = archive.getPath();
        //     await dat.remove(knownDat);
        //     const diskExists = await fs.pathExists(diskPath);
        //     expect(
        //         diskExists,
        //         "Dat still exists on disk, it should have been removed"
        //     ).to.be.false;
        //     expect(dat.exists(knownDat)).to.be.false;
        // });

        it("should fail to download unavailable dat", async function() {
            this.timeout(16000);
            // this.skip();
            try {
                await dat.download(unreachableDat);
            } catch (error) {
                expect(dat.exists(unreachableDat)).to.be.false;
                return;
            }
            throw new Error(`Download should have failed`);
        });
    });
});
