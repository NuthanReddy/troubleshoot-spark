# Implementation plan: two paths to a Spark diagnosis

## 1. Establish the source boundary

Inventory every Markdown detail page and routing file at
[`holdenk/spark-flowchart@4f046b7`](https://github.com/holdenk/spark-flowchart/tree/4f046b70c9bf83f4e51b7381512c6a6c8480110e/docs).
The snapshot contains 53 detail pages and four flowchart files. Include topics that appear
only as graph nodes (for example lost nodes, serialization, and oversized frames mentioned in
the shuffle article). Exclude binary editor backups and images from the article count.
Classify routing pages, aliases and heading-only stubs. Link each to a maintained diagnostic
entry or an explicitly identified navigation function. Do not reprint the third-party articles.

Cross-check terminology against the local Spark source revision used by the scenarios and
Apache's SQL error catalog, configuration, tuning, SQL performance, and cloud guides. Mark
version-, connector- and cluster-specific advice. An exit code or an upstream tuning example
is not proof of cause, a universal default, or a safe value to apply.

## 2. Normalize the catalog

Maintain one record per distinct troubleshooting path, with a stable ID, error or symptom
kind, names and log fragments, evidence owner, source articles, scope, related diagnoses,
and applicable case replays. Merge synonymous spellings; do not merge different mechanisms
just because they share an exception superclass. In particular keep driver heap, result-size
guard, Kryo buffer, task launch size, container memory, and giant single row distinct.

Each investigation has ordered, discriminating probes: **what to inspect, where to inspect it,
what finding supports a change, what change fits that finding, and how to verify it**.
Negative evidence advances to the next hypothesis; unknown evidence asks for an observation.
Exhausting the probes produces a diagnostic handoff, not a pretend resolution.

## 3. Build the two interfaces

- **Flowchart:** begin with an observable symptom, traverse branches and select a case or
  diagnosis. Keep keyboard-operable links, browser Back, stable URLs, and an explicit fork at
  the point where superficially similar errors diverge.
- **Error lookup:** type or paste an exception class, structured error condition, or log line;
  alternatively select a catalog entry. Rank exact/specific fragments before broad family
  matches. Show ambiguous matches rather than prescribing a fix from `OutOfMemoryError`.
  Matching happens locally, without transmitting logs. Each result opens the same investigation
  used by the flowchart.
- **Evidence and teaching:** link case-specific component replays, complete runbooks, static
  sequence/decision diagrams and component internals. Label illustrations as such. Keep fast
  controls, pause/step/replay, reduced motion, and text alternatives.

## 4. Prove coverage and publish

Build from the two maintained guides and component directory. Fail validation for unmapped
sources, dangling graph edges, duplicate IDs, unreachable entries, missing checks/remedies,
broken diagram links, and missing case replays. Exercise both entry paths, searches with noisy
stack traces, ambiguous OOMs, yes/no/unknown transitions, recovered and unresolved cases,
deep links, playback and narrow-screen navigation. Publish only the generated static site from
`main:/docs` in `NuthanReddy/troubleshoot-spark`; verify the public deployment and assets.

## Maintenance

Version the source manifest independently from Spark. When the upstream revision changes,
compare file lists and graph-node coverage, review new or materially changed pages, and update
the original diagnostic advice before changing the revision pin. Coverage is of this upstream
snapshot plus the 40 maintained scenarios, **not every error possible in every Spark release**.
