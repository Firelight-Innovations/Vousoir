---
v6r-node: api
v6r-title: "HTTP API: the module tree"
v6r-status: specified
---

# Work order — HTTP API: the module tree

## How to use this work order

This is the complete specification for one module. It is self-contained: everything you need
is below, and there is no other file to open.

**Stamp `v6r-node: api` into every file you create or modify for this work order.**
Put it in a comment at the top of the file, in whatever comment syntax that language uses.
This is a hard requirement, not a nicety: Vousoir guarantees that generated code traces back
to the spec node that produced it, and that guarantee is only true if the marker is present.

- **Implement only this module.** Later sections describe other modules so you can call them
  correctly. Do not modify them.
- **The contracts and test cases are the requirement.** Satisfy every contract and make every
  test case pass. How you do that inside this module is entirely your decision.

## Module — HTTP API: the module tree

**Status:** specified

### Behaviour

Serves the module tree over HTTP. Responses map `key: value` pairs into JSON, and this sentence is deliberately longer than eighty columns so that a regression in the YAML serialiser's line folding would show up as a mangled work order rather than as a silent rewrite.

Owns no storage of its own — it reads through the spec store and returns what that returns.

### Contracts

#### GET /modules — `serviceApi`

Request: no body, no query parameters.
Response: 200, a JSON array of { id, title, parent, status }.
Errors: 500 only if the spec directory cannot be read.

#### modules — `dbSchema`

id TEXT PRIMARY KEY, title TEXT NOT NULL, parent TEXT NULL REFERENCES modules(id)

### Test cases

#### tc-api-list — listing modules returns the whole tree

- **Given:** a spec directory holding four nodes
- **When:** GET /modules is called
- **Then:** the response array has four entries
- **Expected:** every node under the spec directory appears exactly once

```
curl -s localhost:7777/modules | jq length
```

#### tc-api-empty — an empty spec directory returns an empty array

- **Expected:** the response body is []

## Where this module sits

The modules this one nests inside, outermost first. One paragraph of orientation each —
deliberately not their full specifications.

1. **Vousoir** (`root`) — A spatial canvas on which an engineer diagrams an application as nested modules.

## Neighbouring contracts

The boundaries of the modules around this one — their edges, not their substance. You are
given what crosses their boundary and nothing about how they work inside. Call them through
these contracts; do not implement or modify them.

### Parent — Vousoir (`root`)

_Declared with the deprecated free-form `contract` field, so it carries no kind._

The product owns nothing directly; every child owns its own boundary.

### Sibling — Spec storage (`storage`) · SpecStore.load — `moduleApi`

load(): Promise<SpecTree> — throws SpecStoreError naming the offending file.

### Child — Users endpoint (`users`) · GET /modules/{id}/users — `serviceApi`

Response: 200 with a JSON array of user ids; 404 when the module is unknown.
