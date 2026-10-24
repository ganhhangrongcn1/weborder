import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const configPath = new URL("../app-config.json", import.meta.url);
const sourceConfig = await readFile(configPath, "utf8");
const buildConfig = await readFile(new URL("../dist/app-config.json", import.meta.url), "utf8");
const config = JSON.parse(buildConfig);
if (!config.listSyncJS?.length) throw new Error("Chưa có gói build hợp lệ.");
const require = createRequire(import.meta.url);
// Zalo CLI reads the resource manifest at project root, including existing builds.
// Restore the source configuration after uploading, even when deployment fails.
try {
  await writeFile(configPath, buildConfig, "utf8");
  const code = await new Promise((resolve, reject) => {
    const cli = spawn(process.execPath, [require.resolve("zmp-cli"), "deploy", "--existing", "--testing",
      "--outputDir", "dist", "--desc", "attendance-auth-testing"], { cwd: root, stdio: "inherit" });
    cli.once("error", reject);
    cli.once("exit", (result) => resolve(result ?? 1));
  });
  process.exitCode = code;
} finally {
  await writeFile(configPath, sourceConfig, "utf8");
}
