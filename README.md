This extension saves your scroll positions, allowing you to resume reading
later with ease.

You can save as many scroll positions as you want, add notes to them, rename
them, and view all your saved spots on a separate page.

Here is an [essay](https://www.rugu.dev/en/blog/mark-scroll-positions/)
explaining my motivation, thought processes, and the implementation details of
this project.

# Development

Install the dependencies using npm,

`npm run install`

Then, build the dist folder:

`npm run build`

After running `npm run build`, you can use `npm run start` to benefit from the
hot-reloading feature while building/contributing to this extension. Note that
if you change static files such as assets, etc., you need to re-run `npm run
build` for the changes to apply.

To release a distributable zip, run `npm run release`
