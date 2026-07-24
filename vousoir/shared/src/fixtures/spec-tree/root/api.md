---
id: api
title: HTTP API
parent: root
status: specified
contracts:
  - id: c-api-list
    kind: serviceApi
    name: GET /modules
    body: |
      Request: no body, no query parameters.
      Response: 200, a JSON array of { id, title, parent, status }.
      Errors: 500 only if .vousoir/spec/ cannot be read.
  - id: c-api-table
    kind: dbSchema
    name: modules
    body: 'id TEXT PRIMARY KEY, title TEXT NOT NULL, parent TEXT NULL REFERENCES modules(id)'
testCases:
  - id: tc-api-list
    description: listing modules returns the whole tree
    expected: every node under .vousoir/spec/ appears exactly once
    given: a spec directory holding three nodes
    when: GET /modules is called
    then: the response array has three entries
    snippet: 'curl -s localhost:7777/modules | jq length'
---

Serves the module tree over HTTP. Owns no storage of its own — it reads through the spec
store and returns what that returns.
