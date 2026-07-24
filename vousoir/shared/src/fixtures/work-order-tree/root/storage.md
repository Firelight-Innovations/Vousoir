---
id: storage
title: Spec storage
parent: root
status: built
behaviour: LEAKED-SIBLING-FRONTMATTER-BEHAVIOUR must not reach a neighbour's work order.
contracts:
  - id: c-storage-load
    kind: moduleApi
    name: SpecStore.load
    body: 'load(): Promise<SpecTree> — throws SpecStoreError naming the offending file.'
testCases:
  - id: tc-storage
    description: LEAKED-SIBLING-TESTCASE-DESCRIPTION
    expected: LEAKED-SIBLING-TESTCASE-EXPECTED
---

LEAKED-SIBLING-BODY must not reach a neighbour's work order.
