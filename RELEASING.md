# Release process

1. Update the package version, lockfile, README compatibility notes, and changelog
   on a branch. Use an immutable version such as `v1.0.0`.
2. Run `npm ci`, `npm run check`, and `npm run bench`. Commit all `dist` outputs
   and their third-party notice. Rebuild and require `git diff --exit-code -- dist`.
3. Open a pull request. Inspect the diff and all six CI jobs: quality and action
   execution on Linux, macOS, and Windows. Merge only after they pass.
4. Wait for main CI to pass. Tag that exact verified commit with the immutable
   version, push the tag, and create a GitHub release with meaningful notes.
5. Create the `v1` major tag for the first release. For later compatible releases,
   deliberately move the existing major tag to the verified release commit. Never
   move an immutable version tag. Breaking behavior belongs in a new major.
6. Dispatch `release-smoke.yml` and require all three imported-action jobs to pass.
   It must use `Melbourneandrew/skills-schema-lint@v1`, not a local checkout action.
7. Include the immutable commit SHA and verification run links in the release.

## Marketplace

Direct `uses: Melbourneandrew/skills-schema-lint@v1` works with the public release
without a Marketplace listing. To list the action, follow GitHub's
[publishing instructions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace).
The owner must accept the Marketplace terms and select the publication option
when editing/drafting the release. Confirm the action display name is available.
Do not claim Marketplace publication until the listing exists.
