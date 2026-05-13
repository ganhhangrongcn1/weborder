import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readFile(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${relPath}`);
  return fs.readFileSync(abs, "utf8");
}

function assertContains(text, pattern, message) {
  if (!text.includes(pattern)) throw new Error(message);
}

try {
  const envExample = readFile(".env.example");
  const runtimeFlags = readFile("src/services/supabase/runtimeFlags.js");
  const dataSource = readFile("src/services/repositories/dataSource.js");
  const runtimeStrategy = readFile("src/services/repositories/runtimeStrategy.js");
  const runtimeRepo = readFile("src/services/repositories/repositoryRuntime.js");
  const runtimeClient = readFile("src/services/supabase/supabaseRuntimeClient.js");
  const adminConfigRepo = readFile("src/services/repositories/adminConfigRepository.js");
  const adminApp = readFile("src/pages/admin/AdminApp.jsx");
  const adminTopHeader = readFile("src/pages/admin/AdminTopHeader.jsx");
  const mainEntry = readFile("src/main.jsx");

  const requiredEnvKeys = [
    "VITE_DATA_SOURCE=",
    "VITE_ENABLE_SUPABASE_CONFIG_SYNC=",
    "VITE_SUPABASE_URL=",
    "VITE_SUPABASE_ANON_KEY="
  ];

  requiredEnvKeys.forEach((key) => {
    assertContains(envExample, key, `.env.example missing key: ${key}`);
  });

  assertContains(runtimeFlags, "VITE_ENABLE_SUPABASE_CONFIG_SYNC", "runtimeFlags missing VITE_ENABLE_SUPABASE_CONFIG_SYNC");
  assertContains(runtimeFlags, "VITE_SUPABASE_URL", "runtimeFlags missing VITE_SUPABASE_URL");
  assertContains(runtimeFlags, "VITE_SUPABASE_ANON_KEY", "runtimeFlags missing VITE_SUPABASE_ANON_KEY");

  assertContains(dataSource, "VITE_DATA_SOURCE", "dataSource missing VITE_DATA_SOURCE");
  assertContains(runtimeStrategy, "getDataSource", "runtimeStrategy missing data source strategy");
  assertContains(runtimeRepo, "getRuntimeStrategy", "repositoryRuntime missing runtime strategy");

  assertContains(runtimeClient, "__GHR_SUPABASE_CLIENT__", "supabaseRuntimeClient missing global client registration");
  assertContains(mainEntry, "initSupabaseRuntimeClient()", "main.jsx is not initializing supabase runtime client");
  assertContains(adminConfigRepo, "runWithRetry", "adminConfigRepository missing retry wrapper");
  assertContains(adminApp, "syncStatusLabel", "AdminApp missing sync status binding");
  assertContains(adminTopHeader, "admin-top-sync-badge", "AdminTopHeader missing sync status badge");

  console.log("Supabase config smoke test passed.");
} catch (error) {
  console.error("Supabase config smoke test failed:", error.message);
  process.exit(1);
}
