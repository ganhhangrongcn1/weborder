import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const renderer = process.env.RECRUITMENT_RENDERER_MODULE;
if (!renderer) throw new Error("Set RECRUITMENT_RENDERER_MODULE to isolated QA react-test-renderer module.");
const temporary = await mkdtemp(path.join(tmpdir(), "ghr-recruitment-ui-"));
try {
  const output = path.join(temporary, "tests.cjs");
  await build({
    entryPoints: ["scripts/recruitment-ui.test.jsx"], outfile: output,
    bundle: true, platform: "node", format: "cjs", jsx: "automatic", loader: { ".css": "empty" },
    alias: { react: path.resolve("node_modules/react"), "recruitment-test-renderer": renderer },
    define: { "import.meta.env": JSON.stringify({
      VITE_SUPABASE_URL: "https://isolated.invalid", VITE_SUPABASE_ANON_KEY: "isolated-publishable",
      VITE_DATA_SOURCE: "supabase", VITE_ENABLE_SUPABASE_RUNTIME_WRITES: "true"
    }) }
  });
  const result = spawnSync(process.execPath, ["--test", "--test-force-exit", output], { stdio: "inherit" });
  process.exitCode = result.status || (result.error ? 1 : 0);
} finally { await rm(temporary, { recursive: true, force: true }); }
