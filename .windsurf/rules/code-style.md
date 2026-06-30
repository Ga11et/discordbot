---
trigger: always_on
---

# Code Style

## Prefer classes over standalone functions

Use class syntax instead of collections of exported functions.
This applies to all layers: db, service, controller, response, handler, etc.

Good:
```ts
export class BirthResponse {
  notFound(): string { ... }
  unexpectedError(): string { ... }
}
export const birthResponse = new BirthResponse();
```

Bad:
```ts
export function buildNotFoundResponse(): string { ... }
export function buildUnexpectedError(): string { ... }
```
