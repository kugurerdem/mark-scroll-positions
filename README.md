# Mark Scroll Positions

<p>
  <a href="https://addons.mozilla.org/firefox/addon/mark-scroll-positions/">
    <img alt="Get Mark Scroll Positions for Firefox" src="https://img.shields.io/badge/Get%20it%20for-Firefox-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white">
  </a>
  <a href="https://chromewebstore.google.com/detail/mark-scroll-positions/echejfhmdgnabmbihbmkdgeajmbojald">
    <img alt="Get Mark Scroll Positions for Chrome" src="https://img.shields.io/badge/Get%20it%20for-Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white">
  </a>
</p>

This extension saves your scroll positions, allowing you to resume reading
later with ease.

You can save as many scroll positions as you want, add notes to them, rename
them, and view all your saved spots on a separate page.

Here is an [essay](https://www.rugu.dev/en/blog/mark-scroll-positions/)
explaining my motivation, thought processes, and the implementation details of
this project.

# Development

This extension ships directly from the source tree. Runtime dependencies are
vendored in [`vendor/`](./vendor), including `Preact`, `preact/hooks`, and `HTM`.
npm is only used to make developer tooling available, such as TypeScript for
JSDoc-based type checking and `web-ext`. It is not required to build a bundle
before shipping.

If you want the developer tooling, install the npm dependencies:

```
npm install
```

Then, type-check the code:

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

Releases are tag-driven.

1. Update `package.json` and `manifest.json` to the same version.
2. Commit that version bump on `master`.
3. Create and push a matching `vX.Y.Z` tag.

GitHub Actions then installs the developer dependencies, runs
`npm run typecheck`, packages `manifest.json`, `public`, `src`, and `vendor`
into `build.zip`, and creates the GitHub release from that tag.
