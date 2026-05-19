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

# Finding a custom scroll container selector

Some web apps do not scroll the document itself. Instead, they keep the page
fixed and scroll a specific element inside the page. Chat apps and pages with
large comment panels often work this way.

If saved marks always look like they are at `100% scrolled`, or jumping does
not move the visible content, you may need to add a custom scroll container rule
in the extension settings.

To find the selector:

1. Open the page where scrolling is not detected correctly.
2. Open the browser developer tools.
3. Open the Console tab.
4. Paste and run this script:

```js
(() => {
  const selectorFor = (element) => {
    if (element.id) return `#${CSS.escape(element.id)}`

    const parts = []
    let current = element

    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tagName = current.tagName.toLowerCase()
      const className = [...current.classList]
        .slice(0, 3)
        .map((name) => `.${CSS.escape(name)}`)
        .join('')

      parts.unshift(`${tagName}${className}`)
      current = current.parentElement
    }

    return parts.join(' > ')
  }

  const before = new Map(
    [...document.querySelectorAll('*')]
      .filter((element) => element.scrollHeight > element.clientHeight)
      .map((element) => [element, element.scrollTop])
  )

  console.log('Scroll the page now, then run: findChangedScrollContainers()')

  window.findChangedScrollContainers = () => {
    const changed = [...before]
      .map(([element, scrollTop]) => ({
        selector: selectorFor(element),
        before: scrollTop,
        after: element.scrollTop,
        element,
      }))
      .filter(({before, after}) => before !== after)

    console.table(changed.map(({selector, before, after}) => ({selector, before, after})))
    return changed
  }
})()
```

5. Scroll the page content that you want the extension to track.
6. Run this in the Console:

```js
findChangedScrollContainers()
```

The table shows elements whose `scrollTop` changed while you scrolled. Copy the
most specific-looking selector from the `selector` column, then add it in:

`Settings -> Scroll Container Rules`

Use a URL prefix such as `chatgpt.com` or `example.com/comments`, and paste the
selector into the CSS selector field.

If the selector stops matching later, the extension falls back to normal
document scrolling. In that case, repeat the steps above and update the rule.
