# ADR 0006: Design-System Boundary

## Status
Accepted.

## Decision
Use Radix Primitives under PantaETL's `packages/ui` design system.

Feature code does not import Radix directly.

Use Tailwind and Lucide through established design-system patterns.

## Consequences
Replacing Radix should primarily affect `packages/ui`.
