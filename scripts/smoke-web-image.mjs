// Local-only production image smoke test. No host ports or external network are opened.
// Build first: docker build -f apps/web/Dockerfile -t starterkit-web:audit .
// Run: node scripts/smoke-web-image.mjs starterkit-web:audit
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const image = process.argv[2];
if (!image) throw new Error("Pass the locally built web image tag.");
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 }).trim();
const name = `starterkit-web-smoke-${randomBytes(6).toString("hex")}`;
try {
  docker("image", "inspect", image);
  docker("run", "--pull", "never", "-d", "--rm", "--name", name, "--network", "none",
    "-e", "APP_URL=http://127.0.0.1:3000", "-e", "API_BASE_URL=http://127.0.0.1:49999",
    "-e", `SESSION_SECRET=${randomBytes(32).toString("hex")}`, "-e", `INTERNAL_API_TOKEN=${randomBytes(32).toString("hex")}`, image);
  if (docker("exec", name, "id", "-u") === "0") throw new Error("The web image runs as root.");
  const check = `
    for (let i = 0; i < 100; i++) {
      try { const r = await fetch('http://127.0.0.1:3000/login', { signal: AbortSignal.timeout(1000) }); if (r.ok) break; } catch {}
      if (i === 99) throw new Error('Login never became ready');
      await new Promise(r => setTimeout(r, 100));
    }
    const login = await fetch('http://127.0.0.1:3000/login', { signal: AbortSignal.timeout(1000) });
    const csp = login.headers.get('content-security-policy') ?? '';
    if (csp.includes("'unsafe-eval'") || !csp.includes("'strict-dynamic'")) throw new Error('Production CSP is not strict');
    for (const file of ['auth-landscape.svg', 'auth-landscape-dark.svg']) {
      const r = await fetch('http://127.0.0.1:3000/illustrations/' + file, { signal: AbortSignal.timeout(1000) });
      if (r.status !== 200 || !r.headers.get('content-type')?.includes('image/svg+xml')) throw new Error('Missing public artwork: ' + file);
    }
    console.log('PASS: non-root standalone runtime, login, strict production CSP and both public assets');`;
  console.log(docker("exec", name, "node", "--input-type=module", "-e", check));
} finally {
  try { docker("rm", "-f", name); } catch { /* already removed */ }
}
