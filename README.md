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
npm run build
```

For development with hot-reloading in Firefox, run these commands in two
separate terminals:

```
npm run watch
npm run start:firefox
```

The first command watches for file changes and rebuilds automatically. The
second command opens Firefox with the extension loaded and reloads it whenever
the build output changes.

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

The local release flow runs `typecheck` and `build`, updates `package.json` and
`package-lock.json`, then syncs `public/manifest.json` to the same version
before the version commit and `vX.Y.Z` tag are created.

GitHub Actions creates the GitHub release when that tag is pushed.
