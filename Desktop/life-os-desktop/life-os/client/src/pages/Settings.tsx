import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, X, Download, Upload, Check, Bell, BellOff, Link2, Unlink } from "lucide-react";
import { api } from "../lib/api";
import type { Settings as SettingsType, ThemeName, Quote } from "../types";
import { Card, PageHeader } from "../components/ui";

const THEMES: { id: ThemeName; label: string; swatch: string[] }[] = [
  { id: "meadow", label: "Meadow", swatch: ["#edeee9", "#3f5d4e", "#c4592f"] },
  { id: "midnight", label: "Midnight", swatch: ["#14181a", "#6fa98a", "#e0805a"] },
  { id: "slate", label: "Slate", swatch: ["#eef1f4", "#35618c", "#b54b3c"] },
  { id: "sand", label: "Sand", swatch: ["#f3ece2", "#b4622e", "#8a3b2e"] },
];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saved, setSaved] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState("");
  const [newQuoteAuthor, setNewQuoteAuthor] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleStatus, setGoogleStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.settings.get().then((s) => {
      setSettings(s);
      setKeyInput(s.geminiApiKey || "");
      setGoogleClientId(s.googleClientId || "");
    });

    const googleParam = searchParams.get("google");
    if (googleParam === "connected") setGoogleStatus("Google Calendar connected.");
    if (googleParam === "error") setGoogleStatus("Couldn't connect to Google Calendar — check your Client ID/Secret and try again.");
    if (googleParam) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!settings) return null;

  async function save(patch: Partial<SettingsType>) {
    const updated = await api.settings.update(patch);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function setTheme(theme: ThemeName) {
    document.documentElement.dataset.theme = theme;
    await save({ theme });
  }

  async function handleImportFile(file: File) {
    const confirmed = window.confirm(
      "Importing a backup replaces ALL current data (tasks, projects, documents, notes, events, settings) with the contents of this zip. This can't be undone. Continue?"
    );
    if (!confirmed) {
      if (importInputRef.current) importInputRef.current.value = "";
      return;
    }
    setImporting(true);
    setImportMessage(null);
    try {
      await api.backupImport(file);
      setImportMessage("Backup restored. Reloading…");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setImportMessage("That file doesn't look like a Life OS backup, or the import failed. Nothing was changed.");
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function addQuote() {
    const text = newQuoteText.trim();
    const author = newQuoteAuthor.trim() || "Unknown";
    if (!text || !settings) return;
    const quote: Quote = { text, author };
    await save({ customQuotes: [...(settings.customQuotes || []), quote] });
    setNewQuoteText("");
    setNewQuoteAuthor("");
  }

  async function removeQuote(i: number) {
    if (!settings) return;
    const next = (settings.customQuotes || []).filter((_, idx) => idx !== i);
    await save({ customQuotes: next });
  }

  async function saveKey() {
    await save({ geminiApiKey: keyInput.trim() });
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1500);
  }

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") await save({ notifyTimeBlocks: true });
  }

  async function toggleNotifications(checked: boolean) {
    if (checked && notifPermission !== "granted") {
      await requestNotifPermission();
      return;
    }
    await save({ notifyTimeBlocks: checked });
  }

  async function saveGoogleCredentials() {
    await save({ googleClientId: googleClientId.trim(), googleClientSecret: googleClientSecret.trim() || undefined });
    setGoogleClientSecret("");
  }

  async function connectGoogle() {
    await saveGoogleCredentials();
    const { url } = await api.google.authUrl();
    window.location.href = url;
  }

  async function disconnectGoogle() {
    await api.google.disconnect();
    const updated = await api.settings.get();
    setSettings(updated);
    setGoogleStatus("Google Calendar disconnected.");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <PageHeader title="Settings" subtitle="Tune Life OS to fit how you actually work." />

      <Card className="mb-5 space-y-4 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-dusk">Your name</label>
          <input
            defaultValue={settings.name}
            onBlur={(e) => save({ name: e.target.value })}
            placeholder="Used for the dashboard greeting"
            className="w-full rounded-md border border-dusk-light px-3 py-2 text-sm outline-none focus:border-moss"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-dusk">Weather location</label>
          <input
            defaultValue={settings.weatherLocation}
            onBlur={(e) => save({ weatherLocation: e.target.value })}
            placeholder="e.g. Portland, Oregon — leave blank to use your device location"
            className="w-full rounded-md border border-dusk-light px-3 py-2 text-sm outline-none focus:border-moss"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={settings.quoteOfDay}
            onChange={(e) => save({ quoteOfDay: e.target.checked })}
            className="h-4 w-4 accent-moss"
          />
          Show quote of the day on the dashboard
        </label>
        {saved && (
          <p className="flex items-center gap-1 text-xs text-moss">
            <Check size={12} /> Saved
          </p>
        )}
      </Card>

      {/* Notifications */}
      <Card className="mb-5 p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-base text-ink">
          {settings.notifyTimeBlocks ? <Bell size={16} /> : <BellOff size={16} />} Time-block notifications
        </h2>
        <p className="mb-3 text-xs text-dusk">
          Get a quiet browser notification the moment a time-blocked task's start time arrives. Only checked
          while this tab is open.
        </p>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={settings.notifyTimeBlocks}
            onChange={(e) => toggleNotifications(e.target.checked)}
            className="h-4 w-4 accent-moss"
          />
          Notify me when a time-blocked task starts
        </label>
        {notifPermission === "denied" && (
          <p className="mt-2 text-xs text-ember">
            Notifications are blocked for this site in your browser settings — enable them there to use this.
          </p>
        )}
        {notifPermission === "unsupported" && (
          <p className="mt-2 text-xs text-dusk">Your browser doesn't support notifications.</p>
        )}
      </Card>

      {/* Appearance */}
      <Card className="mb-5 p-5">
        <h2 className="mb-1 font-display text-base text-ink">Appearance</h2>
        <p className="mb-3 text-xs text-dusk">Pick the palette that feels right for how you use this every day.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`rounded-lg border p-2.5 text-left transition ${
                settings.theme === t.id ? "border-moss ring-1 ring-moss" : "border-dusk-light hover:border-dusk"
              }`}
            >
              <div className="mb-2 flex overflow-hidden rounded">
                {t.swatch.map((c, i) => (
                  <div key={i} className="h-5 flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="text-xs font-medium text-ink-soft">{t.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Custom quotes */}
      <Card className="mb-5 p-5">
        <h2 className="mb-1 font-display text-base text-ink">Quote of the day</h2>
        <p className="mb-3 text-xs text-dusk">
          20 quotes come built in. Add your own favorites and they'll be mixed into the daily rotation.
        </p>
        <div className="mb-3 space-y-2">
          <input
            value={newQuoteText}
            onChange={(e) => setNewQuoteText(e.target.value)}
            placeholder="Quote text…"
            className="w-full rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
          />
          <div className="flex gap-2">
            <input
              value={newQuoteAuthor}
              onChange={(e) => setNewQuoteAuthor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuote()}
              placeholder="Author"
              className="flex-1 rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
            />
            <button onClick={addQuote} className="rounded-md bg-moss px-3 text-paper hover:bg-moss/90">
              <Plus size={15} />
            </button>
          </div>
        </div>
        {(settings.customQuotes || []).length === 0 ? (
          <p className="text-xs text-dusk">No custom quotes added yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {settings.customQuotes.map((q, i) => (
              <li key={i} className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fog">
                <div className="min-w-0">
                  <p className="truncate italic text-ink-soft">“{q.text}”</p>
                  <p className="text-xs text-dusk">— {q.author}</p>
                </div>
                <button onClick={() => removeQuote(i)} className="shrink-0 text-dusk hover:text-ember">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Support / AI assistant */}
      <Card className="mb-5 p-5">
        <h2 className="mb-1 font-display text-base text-ink">Support — AI assistant</h2>
        <p className="mb-3 text-xs text-dusk">
          Connect a free Google Gemini API key to ask quick questions from the Support page. The key is stored
          only in your local <code className="rounded bg-fog px-1 py-0.5 font-mono text-[11px]">server/data/settings.json</code> and
          sent directly from your browser to Google — it never touches anyone else's server. Get a free key at{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-moss hover:underline"
          >
            aistudio.google.com/apikey
          </a>
          .
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveKey()}
            placeholder="Paste your Gemini API key…"
            className="flex-1 rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
          />
          <button onClick={saveKey} className="rounded-md bg-moss px-3 py-1.5 text-sm text-paper hover:bg-moss/90">
            Save
          </button>
        </div>
        {keySaved && (
          <p className="mt-2 flex items-center gap-1 text-xs text-moss">
            <Check size={12} /> Key saved
          </p>
        )}
      </Card>

      {/* Google Calendar */}
      <Card className="mb-5 p-5">
        <h2 className="mb-1 font-display text-base text-ink">Google Calendar</h2>
        <p className="mb-3 text-xs text-dusk">
          Pull your Google Calendar events into the Calendar page (read-only). This needs your own free OAuth
          client from Google Cloud Console — see the README for the exact steps, including the redirect URI to
          register: <code className="rounded bg-fog px-1 py-0.5 font-mono text-[11px]">http://localhost:4310/api/google/callback</code>.
        </p>

        {googleStatus && (
          <p className={`mb-3 text-xs ${settings.googleConnected ? "text-moss" : "text-ember"}`}>{googleStatus}</p>
        )}

        {settings.googleConnected ? (
          <div className="flex items-center justify-between rounded-md border border-moss/30 bg-moss-light px-3 py-2">
            <span className="flex items-center gap-1.5 text-sm text-moss">
              <Link2 size={14} /> Connected
            </span>
            <button
              onClick={disconnectGoogle}
              className="flex items-center gap-1.5 text-xs text-dusk hover:text-ember"
            >
              <Unlink size={12} /> Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              placeholder="Google OAuth Client ID"
              className="w-full rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
            />
            <input
              type="password"
              value={googleClientSecret}
              onChange={(e) => setGoogleClientSecret(e.target.value)}
              placeholder={settings.googleClientSecretSet ? "Client secret saved (leave blank to keep it)" : "Google OAuth Client Secret"}
              className="w-full rounded-md border border-dusk-light px-3 py-1.5 text-sm outline-none focus:border-moss"
            />
            <button
              onClick={connectGoogle}
              disabled={!googleClientId || (!googleClientSecret && !settings.googleClientSecretSet)}
              className="flex items-center gap-1.5 rounded-md bg-moss px-3.5 py-2 text-sm font-medium text-paper hover:bg-moss/90 disabled:opacity-40"
            >
              <Link2 size={14} /> Connect Google Calendar
            </button>
          </div>
        )}
      </Card>

      {/* Data & backup */}
      <Card className="p-5">
        <h2 className="mb-2 font-display text-base text-ink">Your data</h2>
        <p className="mb-3 text-sm text-dusk">
          Everything lives in plain JSON files on your machine, under{" "}
          <code className="rounded bg-fog px-1 py-0.5 font-mono text-xs">server/data/</code>. Download a full
          backup any time — it's a zip of that exact folder. Deleted items go to{" "}
          <code className="rounded bg-fog px-1 py-0.5 font-mono text-xs">Trash</code> for 30 days before being
          erased for good.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={api.backupUrl()}
            className="inline-flex items-center gap-1.5 rounded-md bg-moss px-3.5 py-2 text-sm font-medium text-paper hover:bg-moss/90"
          >
            <Download size={14} /> Download backup
          </a>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 rounded-md border border-dusk-light px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-fog disabled:opacity-60"
          >
            <Upload size={14} /> {importing ? "Restoring…" : "Import backup"}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
            }}
          />
        </div>
        {importMessage && <p className="mt-2 text-xs text-dusk">{importMessage}</p>}
        <p className="mt-2 text-xs text-dusk">
          Importing a backup zip (downloaded from here, on this or another machine) fully replaces your current
          data — make sure you actually want that before confirming.
        </p>
      </Card>
    </div>
  );
}
