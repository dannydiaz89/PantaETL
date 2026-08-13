import {
  builtInComponentCapabilities,
  componentCapabilityListRequestSchema,
  componentCapabilityListResponseSchema,
  filterComponentCapabilities,
} from "@pantaetl/contracts";

/** Minimal authenticated identity required by the component capability route. */
export interface ComponentCapabilitySession {
  readonly user: {
    readonly id: string;
  };
}

/** Dependencies for the authenticated component capability collection route. */
export interface ComponentCapabilityRouteDependencies {
  /** Resolves the signed-in user from request session headers. */
  readonly getSession: (request: Request) => Promise<ComponentCapabilitySession | null>;
}

/** Request context required by the capability collection route's server handler. */
export interface ComponentCapabilityRouteContext {
  readonly request: Request;
}

/** Builds the authenticated handler that serves the release's static component capability catalog. */
export function createComponentCapabilityRouteHandlers(dependencies: ComponentCapabilityRouteDependencies) {
  return {
    /** Returns safe built-in component metadata, optionally narrowed to one component kind. */
    GET: async ({ request }: ComponentCapabilityRouteContext): Promise<Response> => {
      const session = await dependencies.getSession(request);
      if (session === null) {
        return new Response(null, { status: 401 });
      }

      const parsedRequest = componentCapabilityListRequestSchema.safeParse(readCapabilityRequest(request.url));
      if (!parsedRequest.success) {
        return invalidCapabilityRequestResponse();
      }

      const response = componentCapabilityListResponseSchema.parse({
        components: filterComponentCapabilities(
          builtInComponentCapabilities,
          parsedRequest.data.kind,
        ),
      });
      return Response.json(response, { headers: { "cache-control": "no-store" } });
    },
  };
}

/** Parse a strict, optional kind query without accepting repeated or unknown parameters. */
function readCapabilityRequest(url: string): unknown {
  const search = new URL(url).searchParams;
  if (Array.from(search.keys()).some((key) => key !== "kind") || search.getAll("kind").length > 1) {
    return null;
  }

  const kind = search.get("kind");
  return kind === null ? {} : { kind };
}

/** Return a safe bad-request response without echoing user-controlled query values. */
function invalidCapabilityRequestResponse(): Response {
  return Response.json({ code: "invalid_component_capability_request" }, { status: 400 });
}
