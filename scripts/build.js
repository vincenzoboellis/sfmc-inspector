#!/usr/bin/env node
/**
 * SFMC Inspector: build script (Node >= 18, zero dependencies)
 *
 * Reads sfmc-inspector/manifest.json (the base manifest, loadable unpacked in Chrome)
 * and writes two store-ready packages with manifest.json at the ZIP root:
 *
 *   dist/sfmc-inspector-chrome-<version>.zip   -> Chrome Web Store
 *   dist/sfmc-inspector-firefox-<version>.zip  -> addons.mozilla.org (AMO)
 *
 * Also writes the unzipped folders dist/chrome and dist/firefox for local testing.
 *
 * Usage (from the repo root):  node scripts/build.js
 */

"use strict";

var fs   = require("fs");
var path = require("path");
var zlib = require("zlib");

// The Gecko ID is PERMANENT once the add-on is submitted to AMO. Do not change it later.
var GECKO_ID          = "sfmc-inspector@vincenzoboellis.com";
// First Firefox desktop version that supports data_collection_permissions
var FIREFOX_MIN       = "140.0";

var ROOT    = path.resolve(__dirname, "..");
var SRC     = path.join(ROOT, "sfmc-inspector");
var DIST    = path.join(ROOT, "dist");
var EXCLUDE = [/^\./, /\.zip$/i, /^Thumbs\.db$/i, /^desktop\.ini$/i];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fail(msg) {
  console.error("BUILD FAILED: " + msg);
  process.exit(1);
}

function listFiles(dir, base) {
  var out = [];
  fs.readdirSync(dir).sort().forEach(function (name) {
    if (EXCLUDE.some(function (re) { return re.test(name); })) return;
    var abs = path.join(dir, name);
    var rel = base ? base + "/" + name : name;
    if (fs.statSync(abs).isDirectory()) {
      out = out.concat(listFiles(abs, rel));
    } else {
      out.push(rel);
    }
  });
  return out;
}

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

// ── Minimal ZIP writer (deflate, no external tools) ──────────────────────────

var CRC_TABLE = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function writeZip(zipPath, entries) {
  // entries: [{ name: "a/b.js", data: Buffer }]
  var DOS_TIME = 0;            // 00:00:00
  var DOS_DATE = (46 << 9) | (1 << 5) | 1; // 2026-01-01, fixed for reproducible builds
  var locals = [], centrals = [], offset = 0;

  entries.forEach(function (e) {
    var name = Buffer.from(e.name, "utf8");
    var comp = zlib.deflateRawSync(e.data, { level: 9 });
    var crc  = crc32(e.data);

    var lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);          // version needed
    lh.writeUInt16LE(0x0800, 6);      // UTF-8 names
    lh.writeUInt16LE(8, 8);           // deflate
    lh.writeUInt16LE(DOS_TIME, 10);
    lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(e.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);

    var ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);          // version made by
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(DOS_TIME, 12);
    ch.writeUInt16LE(DOS_DATE, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);     // local header offset (other fields stay 0)
    centrals.push(ch, name);

    offset += lh.length + name.length + comp.length;
  });

  var cd = Buffer.concat(centrals);
  var end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);

  fs.writeFileSync(zipPath, Buffer.concat(locals.concat([cd, end])));
}

// ── Manifest variants ────────────────────────────────────────────────────────

function chromeManifest(base) {
  var m = JSON.parse(JSON.stringify(base));
  // Chrome MV3 only uses service_worker; drop scripts to keep the package clean
  delete m.background.scripts;
  delete m.browser_specific_settings;
  return m;
}

function firefoxManifest(base) {
  var m = JSON.parse(JSON.stringify(base));
  // Firefox MV3 runs background.scripts as an event page and ignores service_worker
  delete m.background.service_worker;
  delete m.minimum_chrome_version;
  m.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: FIREFOX_MIN,
      data_collection_permissions: { required: ["none"] }
    }
  };
  return m;
}

// ── Build ────────────────────────────────────────────────────────────────────

var manifestPath = path.join(SRC, "manifest.json");
if (!fs.existsSync(manifestPath)) fail("manifest.json not found in " + SRC);

var base;
try { base = JSON.parse(fs.readFileSync(manifestPath, "utf8")); }
catch (e) { fail("manifest.json is not valid JSON: " + e.message); }

var version = base.version;
if (!/^1\.\d+(\.\d+)?$/.test(version || "")) fail("unexpected manifest version '" + version + "' (expected 1.x)");
if (!base.background || !base.background.service_worker || !base.background.scripts) {
  fail("base manifest must declare both background.scripts and background.service_worker");
}

// Version consistency check with the README badge (warning only)
var readmePath = path.join(ROOT, "README.md");
if (fs.existsSync(readmePath)) {
  var badge = fs.readFileSync(readmePath, "utf8").match(/badge\/version-([0-9.]+)-/);
  if (badge && badge[1] !== version) {
    console.warn("WARNING: README badge says " + badge[1] + " but manifest says " + version);
  }
}

var files = listFiles(SRC, "").filter(function (f) { return f !== "manifest.json"; });

rmrf(DIST);
fs.mkdirSync(DIST, { recursive: true });

[
  { target: "chrome",  manifest: chromeManifest(base) },
  { target: "firefox", manifest: firefoxManifest(base) }
].forEach(function (t) {
  var outDir = path.join(DIST, t.target);
  var manifestBuf = Buffer.from(JSON.stringify(t.manifest, null, 2) + "\n", "utf8");
  var entries = [{ name: "manifest.json", data: manifestBuf }];

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "manifest.json"), manifestBuf);

  files.forEach(function (rel) {
    var data = fs.readFileSync(path.join(SRC, rel));
    var dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    entries.push({ name: rel, data: data });
  });

  var zipName = "sfmc-inspector-" + t.target + "-" + version + ".zip";
  writeZip(path.join(DIST, zipName), entries);
  console.log("OK  dist/" + zipName + "  (" + entries.length + " files)");
});

console.log("Done. Version " + version + ".");
