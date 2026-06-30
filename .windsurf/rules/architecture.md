---
trigger: always_on
---

# Architecture

## Layer structure

All modules follow the strict layering:

```
gateway (interaction-create.ts, handler.ts)
  → controller.ts
    → service.ts
      → db.ts
```

Each layer knows only about the layer directly below it.

## Responsibilities per layer

- **gateway** — parses Discord interaction, checks access, calls controller, formats response strings using `Response` class
- **controller** — orchestrates service calls, returns typed results (no strings)
- **service** — business logic, throws `AppError` with only a code (no user-facing strings)
- **db** — raw Knex queries, maps DB rows to typed records

## Error handling

- `service` and `db` throw `AppError` with only an error code
- `gateway` (handler) catches `AppError` and maps codes to user-facing strings via the `Response` class
- Unknown errors in `service` are wrapped as `new AppError("INTERNAL_ERROR")`
