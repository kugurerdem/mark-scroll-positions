This extension saves your scroll positions, allowing you to resume reading
later with ease.

You can save as many scroll positions as you want, add notes to them, rename
them, and view all your saved spots on a separate page.

Here is an [essay](https://www.rugu.dev/en/blog/mark-scroll-positions/)
explaining my motivation, thought processes, and the implementation details of
this project.

# Development

Install the dependencies using npm:

```
npm install
```

Then, build the extension:

```
npm run typecheck
```

After that, you can load the repository directory itself as an unpacked
extension in Chrome or Firefox. No build step is required.

For development with auto-reload in Firefox, run:

```
npm run start:firefox
```

This loads the repository directly and reloads the extension when source files
change.

# Release

Use `npm version` to bump the version and create the release commit + git tag.

```
npm run release:patch
git push origin master --follow-tags
```

Also available:

```
npm run release:minor
npm run release:major
```

The local release flow runs `typecheck`, updates `package.json` and
`package-lock.json`, then syncs `manifest.json` to the same version before the
version commit and `vX.Y.Z` tag are created.

GitHub Actions creates the GitHub release when that tag is pushed by packaging
the source extension directly.
