---
id: task-validation
title: Request Validation
parent: task-api
status: specified
contracts:
  - id: c-validate
    kind: moduleApi
    name: validateCreateTask
    body: |
      validateCreateTask(body: unknown): { title: string }
      Throws ValidationError with a field-by-field message when the body is not
      { title: non-empty string }. Never returns a partially-valid result.
testCases:
  - id: tc-validate-ok
    description: a well-formed body passes through unchanged
    expected: the returned title equals the input title
  - id: tc-validate-names-field
    description: a missing title names the field rather than dumping the raw error
    expected: the error message contains "title" and does not contain "ZodError"
---

The nested module: validates request bodies at the Task API boundary before anything
reaches the store.

This is the one node nested two levels deep, so the canvas has a three-level tree to draw.
