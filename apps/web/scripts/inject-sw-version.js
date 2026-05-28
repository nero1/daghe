// Runs automatically before `next build` via the "prebuild" npm script.
// Replaces the VERSION constant in sw.js with the current git commit SHA
// (or a timestamp fallback), so every deployment produces a unique service
// worker that triggers the update prompt for returning users.
const fs = require("fs");
const path = require("path");

const swPath = path.join(__dirname, "../public/sw.js");

// Vercel injects VERCEL_GIT_COMMIT_SHA automatically.
// Locally (or on other CI), fall back to a timestamp.
const sha = process.env.VERCEL_GIT_COMMIT_SHA
  ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8)
  : Date.now().toString(36);

const version = `asibi-shell-${sha}`;

let sw = fs.readFileSync(swPath, "utf8");
sw = sw.replace(/const VERSION = "asibi-shell-[^"]+";/, `const VERSION = "${version}";`);
fs.writeFileSync(swPath, sw);

console.log(`[sw-version] Injected VERSION = "${version}" into sw.js`);
