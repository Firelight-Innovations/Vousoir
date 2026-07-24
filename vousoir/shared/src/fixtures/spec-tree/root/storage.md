---
id: storage
title: Spec storage
parent: root
status: built
behaviour: Reads and writes one markdown file per node under .v6r/spec/.
contracts:
  - id: c-storage-load
    kind: moduleApi
    name: SpecStore.load
    body: 'load(): Promise<SpecTree> — throws SpecStoreError naming the offending file.'
---

One file per node; nested folders mirror the hierarchy. The `parent` field is the model,
the folders are a convenience.
