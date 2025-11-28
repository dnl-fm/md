# Project Instructions

## Versioning

When creating a new version:
- Update version in `src-tauri/tauri.conf.json`
- Update version in `src-tauri/Cargo.toml`
- Update version in `package.json`
- Update `CHANGELOG.md` with release notes
- Create git tag: `git tag vX.Y.Z`

### Patch vs Minor version
Use branch name as first indicator:
- `fix/*` branch → patch bump (0.0.x) - bug fixes, behavior improvements
- `feat/*` branch → minor bump (0.x.0) - new features, new functionality
