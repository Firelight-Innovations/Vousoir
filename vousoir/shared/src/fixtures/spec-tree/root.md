---
id: root
title: Vousoir
parent: null
status: specified
behaviour: The root module of the product.
contract: Owns nothing directly; children own their own contracts.
testCases:
  - id: tc-root-1
    description: opening a project shows the root node
    expected: the canvas renders one box titled "Vousoir"
---

The root module. Everything else nests inside it.
