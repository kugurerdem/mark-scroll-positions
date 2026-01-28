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
