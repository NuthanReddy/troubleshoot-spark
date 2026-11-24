# Troubleshoot Spark

A GitHub Pages diagnostic workbench with two entry points:

1. [Explore the flowchart](https://nuthanreddy.github.io/troubleshoot-spark/#map) if you know the symptom.
2. [Select an error or paste a log fragment](https://nuthanreddy.github.io/troubleshoot-spark/#errors) if you know the signature. Matching is local to the browser; the site does not send or save pasted logs.

Both paths open the **same investigation**: where to collect evidence, what each observation means, what change it supports, and how to verify the outcome. A negative or unknown answer does not claim a resolution. See the [implementation plan](IMPLEMENTATION.md) and [source coverage](https://nuthanreddy.github.io/troubleshoot-spark/#sources) for scope and provenance.

The catalog includes **40 classic PySpark-on-YARN case replays**. For example,
[watch a failed shuffle fetch](https://nuthanreddy.github.io/troubleshoot-spark/#case-11).
Each replay moves a message or block between the components that own that operation.
Use Pause, the event numbers, or the speed control to examine the failure and recovery.
The decision view shows the alternative outcome; Complete case retains the original
walkthrough, reproduction, evidence, resolution and citations.

The lifecycle, scenarios, and component readers have static SVG sequence, state and
flow diagrams and work without JavaScript. Animations are illustrative, not packet
captures or measurements from a live Spark application.

## Build and update content

The two maintained Markdown guides belong to `NuthanReddy/reading-list` under `Data Engineering`:
`pyspark-on-yarn.md` and `pyspark-on-yarn-scenarios.md`, alongside the
`pyspark-on-yarn-components` reference directory. This repository contains the application,
its generator, and generated site files, not independently edited copies of the guides.

With `reading-list` checked out beside this repository:

```shell
npm ci
npm run build
npm test
```

For browser regression checks, install a test Chromium with `npx playwright-core install chromium`
and run `npm run test:browser`, or set `BROWSER_CHANNEL=msedge` for an installed Microsoft Edge.
The test serves the generated site on loopback by default. Set `TEST_SITE_URL` to verify a Pages
deployment instead.

Or supply the path: `node tools/build.mjs "/path/to/reading-list/Data Engineering"`.
To also update the three inline animated illustrations in the source guides' directory,
append `--write-guide-media` after the path. Building needs Node.js; **serving does not**.
Serve `docs/` with a static HTTP server, or publish the `main` branch's `/docs` folder in
GitHub Pages. Commit regenerated files when the guides change.

Scenario evidence and full text come from Markdown. `tools/traces.mjs` describes
the sender, receiver, operation, resulting state and decision alternatives for each
illustration. `tools/diagnostics.mjs` maintains diagnostic hypotheses, aliases, remedies
and upstream mappings. `docs/triage.js` defines the symptom tree. `node tools/inventory.mjs`
is an explicit online source refresh using GitHub CLI, **not** a build prerequisite.
The checked-in publication inventory pins 53 detail pages and four graph files by blob
hash. Tests check that every article and branch is mapped, all diagnoses are reachable
from both entry points, and all component and diagram links resolve.

The site is independently written and is not affiliated with Apache Spark. Diagnostic topics
were informed by the [Spark Advanced Topics Working Group](https://holdenk.github.io/spark-flowchart/);
the interactive teaching format was inspired by [Protocol Explorer](https://nuthanreddy.github.io/protocol-explorer/).
