import type { ComponentMetadata } from "@pantaetl/contracts";

/**
 * Recognisable marks for the storage and service technologies a component talks to.
 *
 * Connector catalogues are far easier to scan by technology than by wording, so these
 * marks intentionally carry each technology's own associated colour rather than a
 * design-system token. They are original simplified shapes, not vendor artwork, and are
 * decorative only: every option remains fully identified by its visible name and
 * description.
 */
type LogoRenderer = () => React.ReactElement;

const csvLogo: LogoRenderer = () => (
  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <rect fill="#1D6F42" height="18" rx="3" width="18" x="3" y="3" />
    <path d="M7 9h10M7 12h10M7 15h10" stroke="#fff" strokeLinecap="round" strokeWidth="1.5" />
    <path d="M11 7v10" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
  </svg>
);

const excelLogo: LogoRenderer = () => (
  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <rect fill="#217346" height="18" rx="3" width="18" x="3" y="3" />
    <path d="m9 9 6 6M15 9l-6 6" stroke="#fff" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

const jsonLogo: LogoRenderer = () => (
  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <rect fill="#D9822B" height="18" rx="3" width="18" x="3" y="3" />
    <path
      d="M10.5 7.5c-1.4 0-1.9.7-1.9 1.8v1.3c0 .8-.4 1.4-1.1 1.4.7 0 1.1.6 1.1 1.4v1.3c0 1.1.5 1.8 1.9 1.8M13.5 7.5c1.4 0 1.9.7 1.9 1.8v1.3c0 .8.4 1.4 1.1 1.4-.7 0-1.1.6-1.1 1.4v1.3c0 1.1-.5 1.8-1.9 1.8"
      stroke="#fff"
      strokeLinecap="round"
      strokeWidth="1.4"
    />
  </svg>
);

const postgresLogo: LogoRenderer = () => (
  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <rect fill="#336791" height="18" rx="3" width="18" x="3" y="3" />
    <ellipse cx="12" cy="8.8" rx="4.6" ry="2.1" stroke="#fff" strokeWidth="1.4" />
    <path d="M7.4 8.8v6.4c0 1.2 2 2.1 4.6 2.1s4.6-.9 4.6-2.1V8.8" stroke="#fff" strokeWidth="1.4" />
    <path d="M7.4 12c0 1.2 2 2.1 4.6 2.1s4.6-.9 4.6-2.1" stroke="#fff" strokeOpacity=".6" strokeWidth="1.4" />
  </svg>
);

const parquetLogo: LogoRenderer = () => (
  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <rect fill="#3F5C7A" height="18" rx="3" width="18" x="3" y="3" />
    <path d="M12 6.5 17 12l-5 5.5L7 12z" stroke="#fff" strokeLinejoin="round" strokeWidth="1.4" />
    <path d="M7 12h10" stroke="#fff" strokeOpacity=".6" strokeWidth="1.4" />
  </svg>
);

const restLogo: LogoRenderer = () => (
  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <rect fill="#2F7ED8" height="18" rx="3" width="18" x="3" y="3" />
    <circle cx="12" cy="12" r="4.4" stroke="#fff" strokeWidth="1.4" />
    <path d="M7.6 12h8.8M12 7.6c1.6 1.7 1.6 7.1 0 8.8-1.6-1.7-1.6-7.1 0-8.8Z" stroke="#fff" strokeWidth="1.4" />
  </svg>
);

const transformLogo: LogoRenderer = () => (
  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <rect fill="var(--panta-subtle)" height="18" rx="3" width="18" x="3" y="3" />
    <path
      d="M7.5 9.5h7.2m0 0-2-2m2 2-2 2M16.5 14.5H9.3m0 0 2-2m-2 2 2 2"
      stroke="var(--panta-text)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
    />
  </svg>
);

/** Technology marks keyed by the suffix shared between a Source and Export of the same technology. */
const LOGOS_BY_TECHNOLOGY: Readonly<Record<string, LogoRenderer>> = {
  csv: csvLogo,
  json: jsonLogo,
  parquet: parquetLogo,
  postgres: postgresLogo,
  rest: restLogo,
  xlsx: excelLogo,
};

/**
 * Renders the decorative technology mark for one catalog component.
 *
 * Transform components address data shape rather than a storage technology, so they
 * share a single neutral mark drawn from design tokens.
 */
export function ComponentLogo({ component }: { readonly component: ComponentMetadata }) {
  const technology = component.type.split(".")[1] ?? "";
  const renderLogo = component.kind === "transform" ? transformLogo : LOGOS_BY_TECHNOLOGY[technology] ?? transformLogo;

  return <span className="component-logo">{renderLogo()}</span>;
}
