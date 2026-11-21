import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocalEnv(key, fallback) {
  try {
    const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const line = contents.split(/\r?\n/).find(entry => entry.startsWith(`${key}=`));
    if (!line) return fallback;
    const value = line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
    return value || fallback;
  } catch {
    return fallback;
  }
}

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || readLocalEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000/api/v1")).replace(/\/$/, "");

const checks = [
  {
    path: "/health",
    validate: payload => payload?.success === true && payload?.data?.status === "healthy" && payload?.data?.dependencies?.database === "healthy"
  },
  {
    path: "/products?limit=1",
    validate: payload => payload?.success === true && Array.isArray(payload?.data?.items)
  },
  {
    path: "/shops",
    validate: payload => payload?.success === true && Array.isArray(payload?.data)
  },
  {
    path: "/products/categories",
    validate: payload => payload?.success === true && Array.isArray(payload?.data)
  },
  {
    path: "/reviews/stats",
    validate: payload => payload?.success === true && payload?.data?.products && payload?.data?.shops
  }
];

let failed = false;

for (const check of checks) {
  try {
    const response = await fetch(`${baseUrl}${check.path}`, { signal: AbortSignal.timeout(5000) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !check.validate(payload)) {
      console.error(`✗ ${check.path} (HTTP ${response.status})`);
      failed = true;
      continue;
    }
    console.log(`✓ ${check.path}`);
  } catch (error) {
    console.error(`✗ ${check.path} (${error instanceof Error ? error.message : "request failed"})`);
    failed = true;
  }
}

if (failed) {
  console.error("Frontend API verification failed.");
  process.exit(1);
}

console.log("Frontend API verification passed.");
