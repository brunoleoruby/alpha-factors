/**
 * Starts the local Next server if needed, then opens the desktop window.
 */
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const PORT = process.env.DESK_PORT || "43123";
const HOST = "127.0.0.1";
const electronBin = require("electron");

function ping() {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port: PORT, path: "/", timeout: 800 }, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitUntilUp(ms = 90_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await ping()) return resolve();
      if (Date.now() - start > ms) return reject(new Error("Desk server did not start in time."));
      setTimeout(tick, 400);
    };
    tick();
  });
}

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function main() {
  let child = null;
  const alreadyUp = await ping();
  if (!alreadyUp) {
    const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
    const cmd = fs.existsSync(nextBin) ? process.execPath : npmCmd();
    const args = fs.existsSync(nextBin)
      ? [nextBin, "dev", "--port", PORT, "--hostname", HOST]
      : ["run", "dev", "--", "--port", PORT, "--hostname", HOST];
    child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, BROWSER: "none" },
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
      if (code && code !== 0 && code !== null) {
        console.error("Local desk server exited", code);
      }
    });
    await waitUntilUp();
  }

  const electron = spawn(electronBin, [path.join(root, "electron", "main.cjs")], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DESK_PORT: PORT },
  });

  electron.on("exit", (code) => {
    if (child && !alreadyUp) child.kill();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error("Install Node.js 20+, run npm install, then npm run desktop");
  process.exit(1);
});
