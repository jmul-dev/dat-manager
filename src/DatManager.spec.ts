import "mocha";
import path from "path";
import DatManager from "./index";
import fs from "fs-extra";
import { expect } from "chai";

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

    describe("Downloads", () => {
        const knownDat =
            "778f8d955175c92e4ced5e4f5563f69bfec0c86cc6f670352c457943666fe639";
        it("should download available dat", async function() {
            const archive = await dat.download(knownDat);
            expect(archive.key).to.be.equal(knownDat);
            expect(dat.exists(knownDat)).to.be.true;
        });

        it("should remove dowloaded dat", async function() {
            const archive = await dat.get(knownDat);
            const diskPath = archive.getPath();
            await dat.remove(knownDat);
            const diskExists = await fs.pathExists(diskPath);
            expect(
                diskExists,
                "Dat still exists on disk, it should have been removed"
            ).to.be.false;
            expect(dat.exists(knownDat)).to.be.false;
        });

        const unreachableDat =
            "778f8d955175c92e4ced5e4f5563f69bfec0c86cc6f670352c457943666fe638";
        it("should fail to download unavailable dat", async function() {
            this.timeout(12000);
            this.skip();
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
