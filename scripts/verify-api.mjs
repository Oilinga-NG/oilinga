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
  },
  {
    path: "/reviews?targetType=PRODUCT&limit=1",
    validate: payload => payload?.success === true && (Array.isArray(payload?.data?.items) || Array.isArray(payload?.data))
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

// Optional: the OpenAPI document may be served at the API root or the app root.
// A missing spec is not a failure — only public data endpoints are required.
async function checkOpenApiSpec() {
  const candidates = [...new Set([baseUrl, baseUrl.replace(/\/api\/v1$/, "")])];
  for (const origin of candidates) {
    try {
      const response = await fetch(`${origin}/openapi.json`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;
      const body = await response.json().catch(() => null);
      // The API serves its contract inside the standard success envelope.
      const spec = body?.data ?? body;
      if (spec && (spec.openapi || spec.swagger) && spec.info) {
        console.log("✓ /openapi.json (optional spec available)");
        return;
      }
    } catch {
      // Try the next root; the spec is optional.
    }
  }
  console.log("- /openapi.json (optional spec not reachable; skipped)");
}
await checkOpenApiSpec();

if (failed) {
  console.error("Frontend API verification failed.");
  process.exit(1);
}

console.log("Frontend API verification passed.");
