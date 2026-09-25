# Changelog

## 0.1.1 — 2026-09-25
- Establish explicit application versioning.
- Keep the existing localStorage key unchanged so normal app updates retain local learning data.
- Add schema versioning and a migration layer for future data-structure changes.

## Versioning rules
- Every user-visible app modification increments the patch/minor version.
- versionName is the human-readable version, e.g. 0.1.1.
- Android versionCode must always increase for every APK update.
- APK updates must use the same application ID and release signing key.
- Never ask users to uninstall the existing APK when installing an update.
