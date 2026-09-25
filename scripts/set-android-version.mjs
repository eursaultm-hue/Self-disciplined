import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = String(packageJson.version || "").trim();
const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

if (!match) throw new Error("package.json version must be semver X.Y.Z");

const [, major, minor, patch] = match;
const versionCode = Number(major) * 1000000 + Number(minor) * 1000 + Number(patch);

if (!Number.isSafeInteger(versionCode) || versionCode <= 0 || versionCode > 2100000000) {
  throw new Error("Generated Android versionCode is invalid: " + versionCode);
}

const candidates = ["android/app/build.gradle", "android/app/build.gradle.kts"];
const file = candidates.find((candidate) => fs.existsSync(candidate));

if (!file) throw new Error("Android project not found. Run npx cap add android first.");

let content = fs.readFileSync(file, "utf8");

if (file.endsWith(".kts")) {
  content = content.replace(/versionCode\s*=\s*\d+/, "versionCode = " + versionCode);
  content = content.replace(/versionName\s*=\s*"[^"]*"/, 'versionName = "' + version + '"');
} else {
  content = content.replace(/versionCode\s+\d+/, "versionCode " + versionCode);
  content = content.replace(/versionName\s+"[^"]*"/, 'versionName "' + version + '"');
}

fs.writeFileSync(file, content);
console.log("Android version set to " + version + " (versionCode " + versionCode + ")");
