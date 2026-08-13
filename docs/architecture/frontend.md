# Frontend Architecture

## Baseline

- TanStack Start
- Router
- Query
- Form
- Table
- TypeScript
- Zod
- Tailwind
- Radix behind `packages/ui`
- Lucide
- Vitest
- Playwright

## Design system

The design system is the UI API.

Feature code uses `packages/ui`.

Feature code does not import Radix directly.

## Visual direction

- restrained;
- professional;
- data/developer-tool feel;
- light and dark modes;
- dark mode similar in restraint/density to VS Code;
- simple primary accent;
- no excessive gradients;
- no noisy color systems;
- no emojis;
- icons only when helpful.

## Accessibility

Target WCAG 2.2 AA.

Consider:

- keyboard;
- screen readers;
- focus;
- labels;
- form errors;
- accessible tables;
- contrast;
- reduced motion;
- non-color-only status;
- semantic HTML.

Representative accessibility checks run in CI.

## Internationalization

All user-facing text is localized.

English is the first locale, not hardcoded source.

Localization covers labels, buttons, errors, empty states, runtime statuses, dates, numbers, units, relative times, and pluralization.

## Navigation

Top-level:

- Pipelines
- Runs
- Plugins
- System
- Users (admin)
- Settings

No global Connections page.

No global Schedules page.

## Pipeline screen

- Overview
- Source
- Transformations
- Export
- Trigger / Schedule
- History
- Settings

Forms are primary.

## Responsive behavior

Desktop-first, but smaller screens remain usable.

## Data tables

Accessible performant tables are first-class design-system components.
