---
name: release
description: Release a new version of the develocity-actions. Use when asked to release, cut or tag a new version of the action.
---

# Release the action

Ask for the version `vX.Y` if not given (latest: `git tag --sort=-creatordate | head -1`).

1. **Update release notes** (PR): fill `release/changelog.md` from the commits since the last tag (`git log <last-tag>..main --oneline`), one bullet per change with its PR link, dependency updates as `name:version`. Remove empty sections. Bump the version of newly added actions in `README.md` usage examples. Open a PR titled `Update release notes` and wait for it to be merged.
2. **Tag** the head of `main` once the `Update dist` workflow triggered by the merge has completed (`gh run list --workflow update-dist.yml -L 1`), so the tag includes any `[bot] Update dist directory` commit. Confirm with the user before pushing: the tag triggers `.github/workflows/release.yml`, which publishes the GitHub release using `release/changelog.md` as body:
   ```bash
   git checkout main && git pull
   git tag -a -m "vX.Y" vX.Y
   git push origin vX.Y
   ```
   Check the release workflow run succeeded (`gh run list --workflow release.yml -L 1`).
3. **Prepare next development iteration** (PR): reset `release/changelog.md` to the empty template below and open a PR titled `Prepare next development iteration`.
   ```markdown
   # 🚀 Improvements
   -

   # 🐛 Bug fixes
   -

   # 📦 Dependency updates
   -
   ```
