# Troubleshoot Spark

A GitHub Pages field guide to **40 classic PySpark-on-YARN scenarios**. Search by symptom,
error, or component, play a three-step trace, then reproduce the behavior and verify the fix.
Each case links back to the Spark source. The lifecycle and full scenarios readers also work
without JavaScript. Animations illustrate behavior, not production measurements.

## Build and update content

The two maintained Markdown guides belong to `NuthanReddy/reading-list` under `Data Engineering`:
`pyspark-on-yarn.md` and `pyspark-on-yarn-scenarios.md`. This repository contains the application,
its generator, and generated site files, not independently edited copies of the guides.

With `reading-list` checked out beside this repository:

```shell
npm ci
npm run build
npm test
```

Or supply the path: `node tools/build.mjs "/path/to/reading-list/Data Engineering"`.
To also update the three inline animated illustrations in the source guides' directory,
append `--write-guide-media` after the path. Building needs Node.js; **serving does not**.
Serve `docs/` with a static HTTP server, or publish the `main` branch's `/docs` folder in
GitHub Pages. Commit regenerated files when the guides change.

The site is independently written and is not affiliated with Apache Spark. Diagnostic topics
were informed by the [Spark Advanced Topics Working Group](https://holdenk.github.io/spark-flowchart/);
the interactive teaching format was inspired by [Protocol Explorer](https://nuthanreddy.github.io/protocol-explorer/).
