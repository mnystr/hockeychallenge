// Wrapper around `next dev -H 0.0.0.0` that prints the machine's actual
// LAN IPv4 addresses, since Next prints "Network: http://0.0.0.0:3000"
// literally — which isn't a URL you can paste into a phone browser.

import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";

const PORT = process.env.PORT ?? "3000";

function lanAddresses() {
  const ifaces = networkInterfaces();
  const out = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs ?? []) {
      if (a.family !== "IPv4") continue;
      if (a.internal) continue;
      // Skip Docker/WSL bridge ranges that won't help a phone reach the
      // host. Heuristic only — surface them under a separate header so
      // the user can pick if they really want one.
      const isLikelyVirtual =
        /vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V/i.test(name);
      out.push({ name, address: a.address, virtual: isLikelyVirtual });
    }
  }
  return out;
}

const addrs = lanAddresses();
const real = addrs.filter((a) => !a.virtual);
const virtual = addrs.filter((a) => a.virtual);

console.log("");
console.log("[36m[1mLAN dev server[0m");
if (real.length === 0 && virtual.length === 0) {
  console.log("  (no non-loopback IPv4 interfaces detected)");
} else {
  for (const a of real) {
    console.log(`  http://${a.address}:${PORT}  [2m(${a.name})[0m`);
  }
  if (virtual.length > 0) {
    console.log("[2m  Virtual / sandbox interfaces:[0m");
    for (const a of virtual) {
      console.log(
        `  [2mhttp://${a.address}:${PORT}  (${a.name})[0m`,
      );
    }
  }
}
console.log("");

const child = spawn(
  "npx",
  ["next", "dev", "-H", "0.0.0.0", "-p", PORT],
  { stdio: "inherit", shell: process.platform === "win32" },
);

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
