import { useEffect, useState, type FormEvent } from "react";

import { DEFAULT_ARTIFACT_RETENTION_DAYS } from "@pantaetl/contracts";
import { Button, Field, Input } from "@pantaetl/ui";

import { useI18n } from "../locale-provider.js";
import {
  getGlobalSettings,
  updateRunLogRetention,
  type GlobalSettingsView,
} from "../system/settings.js";

interface SettingsLoadState {
  readonly settings: GlobalSettingsView | null;
  readonly status: "error" | "loading" | "ready";
}

const initialSettingsLoadState: SettingsLoadState = { settings: null, status: "loading" };

/** Shows retention policy and reserves global changes for authenticated administrators. */
export function SettingsWorkspace() {
  const { formatPlural, t } = useI18n();
  const [loadState, setLoadState] = useState<SettingsLoadState>(initialSettingsLoadState);
  const [retentionDays, setRetentionDays] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<"error" | "idle" | "saved">("idle");

  useEffect(() => {
    void getGlobalSettings()
      .then((settings) => {
        setRetentionDays(String(settings.runLogRetentionDays));
        setLoadState({ settings, status: "ready" });
      })
      .catch(() => setLoadState({ settings: null, status: "error" }));
  }, []);

  async function saveRetention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveState("idle");
    try {
      const settings = await updateRunLogRetention({ data: { runLogRetentionDays: Number(retentionDays) } });
      setRetentionDays(String(settings.runLogRetentionDays));
      setLoadState({ settings, status: "ready" });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    } finally {
      setIsSaving(false);
    }
  }

  const settings = loadState.settings;
  return (
    <section aria-labelledby="settings-retention-title" className="settings-workspace">
      <div>
        <h2 id="settings-retention-title">{t("settings.retention.title")}</h2>
        <p>{t("settings.retention.description")}</p>
      </div>
      {loadState.status === "error" ? <p className="settings-workspace__message" role="status">{t("settings.retention.unavailable")}</p> : null}
      {settings === null ? null : (
        <>
          <dl className="settings-policy">
            <div><dt>{t("settings.retention.artifacts")}</dt><dd>{formatRetentionDays(DEFAULT_ARTIFACT_RETENTION_DAYS)}</dd></div>
            <div><dt>{t("settings.retention.runLog")}</dt><dd>{formatRetentionDays(settings.runLogRetentionDays)}</dd></div>
          </dl>
          {settings.canManageGlobalSettings ? (
            <form className="settings-retention-form" onSubmit={saveRetention}>
              <Field description={t("settings.retention.inputDescription")} label={t("settings.retention.inputLabel")} required>
                {({ describedBy, id, invalid }) => <Input aria-describedby={describedBy} aria-invalid={invalid} id={id} min="1" name="runLogRetentionDays" onChange={(event) => setRetentionDays(event.target.value)} required step="1" type="number" value={retentionDays} />}
              </Field>
              <Button disabled={isSaving} type="submit">{isSaving ? t("settings.retention.saving") : t("settings.retention.save")}</Button>
              {saveState === "saved" ? <p className="settings-workspace__message" role="status">{t("settings.retention.saved")}</p> : null}
              {saveState === "error" ? <p className="settings-workspace__message" role="alert">{t("settings.retention.saveError")}</p> : null}
            </form>
          ) : <p className="settings-workspace__message">{t("settings.retention.adminOnly")}</p>}
        </>
      )}
    </section>
  );

  function formatRetentionDays(days: number): string {
    return formatPlural(days, {
      one: t("settings.retention.dayCount.one"),
      other: t("settings.retention.dayCount.other"),
    });
  }
}
