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
            await dat.download(knownDat);
        });
    });
});
