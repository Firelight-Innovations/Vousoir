---
id: users
title: Users endpoint
parent: api
status: specified
behaviour: LEAKED-CHILD-FRONTMATTER-BEHAVIOUR must not reach a neighbour's work order.
contracts:
  - id: c-users-get
    kind: serviceApi
    name: GET /modules/{id}/users
    body: 'Response: 200 with a JSON array of user ids; 404 when the module is unknown.'
testCases:
  - id: tc-users
    description: LEAKED-CHILD-TESTCASE-DESCRIPTION
    expected: LEAKED-CHILD-TESTCASE-EXPECTED
---

LEAKED-CHILD-BODY must not reach a neighbour's work order. Only this module's contracts
cross its boundary.
