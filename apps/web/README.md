# web

PantaETL's TanStack Start control plane.

```bash
cp ../../.env.example ../../.env
pnpm --dir ../.. dev
```

The Vite configuration reads server-side values from the repository root `.env`.
Database credentials and Better Auth secrets must never be prefixed with `VITE_`.
`VITE_` variables are intentionally exposed to browser code by Vite.

Set `DATABASE_URL` to a running PostgreSQL instance for authentication and other
database-backed routes. The pipeline and run fixture screens can render without
one while the control-plane API remains under construction.

Build the production app with:

```bash
pnpm build
```
