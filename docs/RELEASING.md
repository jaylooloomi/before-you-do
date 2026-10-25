# Release completion contract

When the user requests an update/release, completion means the public GitHub Release and downloads are updated. A local build, running app or push to main alone is not a completed release. Do not restart the user's app or discard drafts to publish downloads.

1. Update package.json/package-lock.json, Cargo.toml/Cargo.lock, tauri.conf.json and the displayed version together.
2. Update both README languages and write `docs/releases/vX.Y.Z.md` with real changes, upgrade guidance and testing limits.
3. Run appropriate checks. Keep the existing app and all user data outside packaging.
4. Commit scoped changes, preserve unrelated drafts, push main, then push the matching stable version tag.
5. Desktop builds creates Windows x64, Mac Apple Silicon and Intel packages. For tags, it validates archive contents/architecture/version, calculates checksums and publishes only after every build passes.
6. Wait for the release job. Diagnose failures and finish publication; do not report success based on a local executable.
7. Read back the public latest release. Check the tag, commit, three platform ZIPs and SHA256SUMS.txt; compare remote asset digests or downloaded checksums.
8. Report the public URL and material limits. Automatic app updating is not implemented; a Release does not replace a running app.

Only publish when authorized by a user release request. This document does not authorize unrelated future publication. Never move or overwrite an already published tag. Recover a failed draft publication and revalidate its assets before publishing.
