---
id: task-store
title: Task Store
parent: vousoir-demo
status: specified
contracts:
  - id: c-store-api
    kind: moduleApi
    name: TaskStore
    body: |
      list(filter?: { status: "open" | "done" }): Promise<Task[]> — newest first.
      create(title: string): Promise<Task> — throws on an empty title.
      complete(id: string): Promise<Task> — throws when the id is unknown.
  - id: c-store-table
    kind: dbSchema
    name: tasks
    body: 'id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL'
testCases:
  - id: tc-store-order
    description: listing returns the newest task first
    expected: the first entry is the most recently created task
  - id: tc-store-unknown-id
    description: completing an unknown id throws rather than silently succeeding
    expected: the call rejects, and no row is written
---

Persists tasks and answers queries about them. The only module that touches the database.

Enforces its own invariants — a task always has a non-empty title and a status that is one
of the two allowed values — so no caller can store a malformed row.
