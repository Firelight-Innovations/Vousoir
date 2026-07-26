---
id: api
title: 'HTTP API: the module tree'
parent: root
status: specified
contracts:
  - id: c-api-list
    kind: serviceApi
    name: GET /modules
    body: |
      Request: no body, no query parameters.
      Response: 200, a JSON array of { id, title, parent, status }.
      Errors: 500 only if the spec directory cannot be read.
  - id: c-api-table
    kind: dbSchema
    name: modules
    body: 'id TEXT PRIMARY KEY, title TEXT NOT NULL, parent TEXT NULL REFERENCES modules(id)'
testCases:
  - id: tc-api-list
    description: listing modules returns the whole tree
    expected: every node under the spec directory appears exactly once
    given: a spec directory holding four nodes
    when: GET /modules is called
    then: the response array has four entries
    snippet: 'curl -s localhost:7777/modules | jq length'
  - id: tc-api-empty
    description: an empty spec directory returns an empty array
    expected: the response body is []
---

Serves the module tree over HTTP. Responses map `key: value` pairs into JSON, and this sentence is deliberately longer than eighty columns so that a regression in the YAML serialiser's line folding would show up as a mangled work order rather than as a silent rewrite.

Owns no storage of its own — it reads through the spec store and returns what that returns.
