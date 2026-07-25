---
id: task-api
title: Task API
parent: vousoir-demo
status: specified
contracts:
  - id: c-task-list
    kind: serviceApi
    name: GET /tasks
    body: |
      Request: optional `status` query parameter, one of `open` or `done`.
      Response: 200, a JSON array of { id, title, status }, newest first.
      Errors: 400 if `status` is present and not one of the two allowed values.
  - id: c-task-create
    kind: serviceApi
    name: POST /tasks
    body: |
      Request: { title: string, non-empty }.
      Response: 201 with the created { id, title, status: "open" }.
      Errors: 400 when title is missing or empty.
testCases:
  - id: tc-list-empty
    description: listing tasks with no tasks stored returns an empty array
    expected: the response body is [] with status 200
    given: an empty task store
    when: GET /tasks is called
    then: the response is 200 and the body is an empty array
  - id: tc-create-then-list
    description: a created task appears in the next listing
    expected: the listing contains exactly the created task
    given: an empty task store
    when: POST /tasks with title "write the spec", then GET /tasks
    then: the listing has one entry whose title is "write the spec" and status is "open"
    snippet: 'curl -s -XPOST localhost:8080/tasks -d ''{"title":"write the spec"}'''
  - id: tc-create-rejects-empty
    description: creating a task with an empty title is refused
    expected: the response is 400 and nothing is stored
---

Serves the task list over HTTP. Validates every request at the boundary and returns the
documented status codes.

Owns no storage of its own: it reads and writes through the task store, and returns what
that returns.
