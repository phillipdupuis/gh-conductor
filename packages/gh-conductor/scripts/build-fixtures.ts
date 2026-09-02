// Write fixtures/*.json from their builders. Re-run after editing a builder; the fixtures test fails on drift.
import { fixturePath, STAGES, upgradePython } from "../fixtures/upgrade-python.ts";

for (const stage of STAGES) {
  const path = fixturePath(stage);
  await Bun.write(path, `${JSON.stringify(upgradePython(stage), null, 2)}\n`);
  console.log(path);
}
