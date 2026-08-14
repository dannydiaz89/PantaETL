import { useState } from "react";

import type { ComponentConfiguration, ComponentKind, ComponentMetadata } from "@pantaetl/contracts";
import { Button, Field, Input } from "@pantaetl/ui";

import { useComponentCapabilityListQuery } from "../../data/components/index.js";
import { useI18n } from "../../locale-provider.js";
import type { TranslationKey } from "../../locales/en.js";
import { ComponentConfigurationForm } from "./component-configuration-form.js";
import { ComponentLogo } from "./component-logo.js";

/** Safe presentation state for one capability that the caller has determined cannot be selected. */
export interface ComponentPickerOptionState {
  /** Prevents selection when the component cannot join the current partial pipeline. */
  readonly disabled: boolean;
  /** Localized explanation announced with the disabled component option. */
  readonly reason: string | undefined;
}

/** Props for a catalog-backed component picker limited to one component role. */
export interface ComponentCapabilityPickerProps {
  /** Optional compatibility state lookup supplied by the surrounding builder. */
  readonly getOptionState?: (component: ComponentMetadata) => ComponentPickerOptionState;
  /** Component role to request from the centralized capability query. */
  readonly kind: ComponentKind;
  /** Receives the selected canonical metadata entry. */
  readonly onSelect: (component: ComponentMetadata) => void;
  /** Current component selection, if one exists. */
  readonly selected: ComponentMetadata | undefined;
}

/** Reads the catalog through the centralized query layer and presents its picker states. */
export function ComponentCapabilityPicker({
  getOptionState,
  kind,
  onSelect,
  selected,
}: ComponentCapabilityPickerProps) {
  const { t } = useI18n();
  const query = useComponentCapabilityListQuery({ kind });

  if (query.isPending) {
    return <p className="component-picker__status" role="status">{t("component.picker.loading")}</p>;
  }

  if (query.isError) {
    return (
      <div className="component-picker__status" role="alert">
        <p>{t("component.picker.unavailable")}</p>
        <Button onClick={() => { void query.refetch(); }} type="button" variant="secondary">{t("component.picker.retry")}</Button>
      </div>
    );
  }

  return (
    <ComponentPicker
      capabilities={query.data.components}
      getOptionState={getOptionState}
      kind={kind}
      onSelect={onSelect}
      selected={selected}
    />
  );
}

/** Props that bind a catalog picker selection directly to the generic non-secret configuration renderer. */
export interface ComponentPickerConfigurationProps extends ComponentCapabilityPickerProps {
  /** Prevents configuration edits while retaining the selected metadata details. */
  readonly disabled?: boolean;
  /** Numbers and titles the two sections when the surrounding step presents them as an ordered sequence. */
  readonly sectionLabels?: {
    readonly configure: TranslationKey;
    readonly select: TranslationKey;
  };
  /** Current selected component's ordinary configuration values. */
  readonly values: ComponentConfiguration["values"];
  /** Receives generic configuration values for the current selected component. */
  readonly onValuesChange: (values: ComponentConfiguration["values"]) => void;
}

/** Combines kind-aware selection and metadata-driven ordinary configuration without defining component-specific forms. */
export function ComponentPickerConfiguration({
  disabled = false,
  getOptionState,
  kind,
  onSelect,
  onValuesChange,
  sectionLabels,
  selected,
  values,
}: ComponentPickerConfigurationProps) {
  const { t } = useI18n();
  const picker = (
    <ComponentCapabilityPicker
      getOptionState={getOptionState}
      kind={kind}
      onSelect={onSelect}
      selected={selected}
    />
  );
  const configuration = selected?.kind !== kind ? null : (
    <ComponentConfigurationForm
      disabled={disabled}
      metadata={selected}
      onChange={onValuesChange}
      values={values}
    />
  );

  if (sectionLabels === undefined) {
    return <div className="component-picker-configuration">{picker}{configuration}</div>;
  }

  return (
    <div className="component-picker-configuration">
      <section className="pipeline-builder__section">
        <h2 className="pipeline-builder__section-title">{t(sectionLabels.select)}</h2>
        {picker}
      </section>
      {configuration === null || selected === undefined ? null : (
        <section className="pipeline-builder__section">
          <h2 className="pipeline-builder__section-title">
            {t(sectionLabels.configure)}
            <span className="pipeline-builder__section-subject">{translateMetadataKey(t, selected.displayNameKey)}</span>
          </h2>
          {configuration}
        </section>
      )}
    </div>
  );
}

/** Renders a searchable keyboard-accessible list from already validated capability metadata. */
export function ComponentPicker({
  capabilities,
  getOptionState = () => ({ disabled: false, reason: undefined }),
  kind,
  onSelect,
  selected,
}: ComponentCapabilityPickerProps & { readonly capabilities: readonly ComponentMetadata[] }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const available = capabilities.filter((component) => component.kind === kind);
  const filtered = filterComponentCapabilities(available, search, t);

  return (
    <div className="component-picker">
      <Field label={t("component.picker.searchLabel")}>
        {({ describedBy, id, invalid }) => (
          <Input
            aria-describedby={describedBy}
            aria-invalid={invalid}
            id={id}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("component.picker.searchPlaceholder")}
            type="search"
            value={search}
          />
        )}
      </Field>
      {filtered.length === 0 ? <p className="component-picker__status" role="status">{t("component.picker.noMatches")}</p> : (
        <ul className="component-picker__grid">
          {filtered.map((component) => {
            const optionState = getOptionState(component);
            const reasonId = `component-reason-${component.type.replaceAll(".", "-")}`;
            const isSelected = selected?.type === component.type && selected.version === component.version;

            return (
              <li key={`${component.type}@${component.version}`}>
                <Button
                  aria-describedby={optionState.reason === undefined ? undefined : reasonId}
                  aria-pressed={isSelected}
                  className="component-picker__option"
                  disabled={optionState.disabled}
                  onClick={() => onSelect(component)}
                  type="button"
                  variant="secondary"
                >
                  <ComponentLogo component={component} />
                  <span className="component-picker__option-copy">
                    <strong>{translateMetadataKey(t, component.displayNameKey)}</strong>
                    <span>{translateMetadataKey(t, component.descriptionKey)}</span>
                  </span>
                  <span className="component-picker__version">{component.version}</span>
                </Button>
                {optionState.reason === undefined ? null : <p className="component-picker__reason" id={reasonId}>{optionState.reason}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Filters by translated capability name and description without maintaining a browser-side component list. */
export function filterComponentCapabilities(
  capabilities: readonly ComponentMetadata[],
  search: string,
  t: (key: TranslationKey) => string,
): readonly ComponentMetadata[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (normalizedSearch.length === 0) return capabilities;

  return capabilities.filter((component) => [
    translateMetadataKey(t, component.displayNameKey),
    translateMetadataKey(t, component.descriptionKey),
  ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)));
}

/** Resolve component metadata keys through the typed locale catalog. */
function translateMetadataKey(t: (key: TranslationKey) => string, key: string): string {
  return t(key as TranslationKey);
}
