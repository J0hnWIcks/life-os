// scripts/build-server.js
//
// Bundles server/index.js (and everything it requires — store.js,
// recurrence.js, and every npm package like express/cors/multer/archiver/
// nanoid, transitively) into a single self-contained file at
// server-dist/index.js.
//
// Why: electron-builder's file-matching glob patterns are fragile with
// deeply nested node_modules trees (a transitive dependency can quietly get
// left out of the packaged app, which is exactly what happened before this
// script existed — see the "Cannot find module 'archiver-utils'" bug).
// Bundling everything into one file with esbuild removes the need to ship
// node_modules at all: there is nothing left for the packager to miss.
//
// Node's own built-in modules (fs, path, http, crypto, etc.) are left as
// real `require()` calls automatically by esbuild for `platform: "node"" —
// only third-party packages get inlined.

const esbuild = require("esbuild");
const path = require("path");

esbuild
  .build({
    entryPoints: [path.join(__dirname, "..", "server", "index.js")],
    outfile: path.join(__dirname, "..", "server-dist", "index.js"),
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    logLevel: "info",
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
