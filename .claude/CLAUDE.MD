# Claude Instructions

## Code Style (non-negotiables)

- Write functional, declarative code. Avoid classes and imperative mutation.
- Keep code DRY. Extract shared logic into utilities or hooks — never duplicate.
- Use modern TypeScript: generics, discriminated unions, `satisfies`, `const` assertions. Never `any`, never weak typing.
- Style exclusively with Tailwind CSS. No inline `style` props, no CSS modules, no external stylesheets unless absolutely required by a third-party.
- Every `try` block must have a `catch` that handles the error — log server-side, return safe response, never silently swallow.
- No open ends: every code path must be handled. No implicit `undefined` returns, no unguarded async calls, no fire-and-forget without error handling.
- Treat security as a first-class constraint, not an afterthought. Validate input, sanitize output, guard every route.

## TypeScript & Type Safety

- Never use `any`. Prefer concrete types, generics, discriminated unions, or `unknown` combined with proper type guards.
- If generated database types degrade to `any` (for example from incomplete `Database` stubs), define explicit local domain types instead of propagating weak typing through the codebase.
- Prefer union string literals over enums when representing fixed string states, unless an enum provides clear interoperability value.
- Remove unused imports, unused variables, and dead code immediately.
- Prefix all interfaces with `I` (e.g., `IUser`, `IProject`).
- Avoid broad index signatures such as `[key: string]: unknown` unless dynamic key access is genuinely required.
- Write modern, readable TypeScript that optimizes for maintainability first.
- Keep types DRY: extract repeated shapes into shared types or utility generics instead of duplicating definitions.
- Choose names that communicate intent clearly. Types should describe business meaning, not implementation trivia.
- Prefer explicit return types on exported functions where it improves clarity and stability.
- Keep enums, interfaces, and reusable types outside component bodies. Store them in dedicated files or shared modules when practical. Inline definitions are acceptable only when local scope is clearer and the file remains small and maintainable.

## Code Quality

- Remove dead code paths. If a function, branch, or component is unreachable or unused, delete it.
- Keep functions focused. If a function performs multiple responsibilities, split it into smaller units.
- Prefer readability over cleverness.
- Avoid deep ternary expressions. If logic becomes nested or hard to scan, replace it with `if/else`, guard clauses, extracted variables, or helper functions.
- Do not add comments that merely restate what the code does. Comments should explain intent, constraints, or _why_ a decision exists.
- Use guard clauses to reduce nesting and improve linear readability.
- Keep files organized: related logic together, unrelated concerns separated.
- Favor predictable control flow over compressed one-line syntax.
- Always use semantic HTML like <article> and <section>. Only use <div> for non contextual reasons like styling
- Write modern Typescript and use functional programming
- The code should be optimized for screen readers
- Be lighthouse compliant. We should always aim to score higher than 96+

## File Organization

- No file may exceed 250 lines. When a file grows beyond this limit, split it into multiple smaller files.
- When splitting produces more than 2 files, create a folder to group them together.

## Control Flow & Formatting

- Always use full function bodies with braces, even for single-line conditions.
- Do not write implicit one-line returns for conditionals.

Wrong:

```ts
if (true) return null;
```

Correct:

```ts
if (true) {
  return null;
}
```

- Apply the same brace discipline to loops, conditionals, and callbacks when it improves consistency and reduces mistakes.
- Prefer explicit structure over shorthand syntax when readability is improved.

## Null Safety & Data Access

- Always account for nullable and optional values.
- Provide fallback values when indexing into `Record` objects or maps with nullable keys.

Example:

```ts
labels[value ?? "default"];
```

- Narrow types before access instead of relying on unsafe assertions.
- Prefer safe defaults over runtime crashes.
