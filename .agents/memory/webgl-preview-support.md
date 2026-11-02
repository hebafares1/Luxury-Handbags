---
name: WebGL preview support
description: The preview browser may be unable to create a WebGL context even when the app's 3D feature is correct.
---

Keep interactive Three.js experiences usable when the browser cannot create a WebGL context. Catch renderer initialization failures and show a lightweight visual fallback that preserves the relevant controls where possible.

**Why:** The Replit screenshot browser in this project could not create a WebGL context, and an uncaught Three.js renderer error hid the whole interface.

**How to apply:** When working on 3D viewers or scenes, verify that a WebGL initialization failure does not take down the surrounding page.
