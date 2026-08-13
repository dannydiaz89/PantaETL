import { createFileRoute, redirect } from "@tanstack/react-router";

import { getSession } from "../auth/session.js";

/** Server-side route guard for protected control-plane requests. */
export const Route = createFileRoute("/protected")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (session === null) {
      throw redirect({ to: "/login", search: { returnTo: location.href } });
    }
    return { session };
  },
  component: () => null,
});
