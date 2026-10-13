"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatRelative } from "@/lib/format";

type KeyScope = "screenshot:read" | "screenshot:write" | "jobs:read" | "webhooks:write";

interface PublicKey {
  id: string;
  name: string;
  prefix: string;
  scopes: KeyScope[];
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

const SCOPE_LABELS: Record<string, string> = {
  "screenshot:read": "Read screenshots",
  "screenshot:write": "Create screenshots",
  "jobs:read": "Read jobs",
  "webhooks:write": "Manage webhooks",
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<PublicKey[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState<{ key: PublicKey; action: "rotate" | "revoke" } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const activeKeys = keys.filter((key) => !key.revoked_at);
  const visibleKeys = keys.filter((key) => (filter === "all" || (filter === "active" ? !key.revoked_at : Boolean(key.revoked_at))) &&
    `${key.name} ${key.prefix}`.toLowerCase().includes(query.toLowerCase()));

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/keys", { cache: "no-store" });
      if (!response.ok) throw new Error("API keys could not be loaded. Please refresh the page.");
      const payload = (await response.json()) as { keys: PublicKey[]; scopes: string[] };
      setKeys(payload.keys);
      setScopes(payload.scopes);
      setSelected((previous) => previous.length === 0 ? ["screenshot:write", "jobs:read"] : previous.filter((scope) => payload.scopes.includes(scope)));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load API keys."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!confirmation) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [confirmation]);

  const create = async () => {
    if (await issueKey({ name, scopes: selected })) setName("");
  };

  const issueKey = async (body: { name: string; scopes: string[]; rotate_id?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { key?: { secret: string }; error?: string };
      if (!response.ok || !payload.key) {
        setError(payload.error ?? "Could not create key");
        return false;
      }
      setIssued(payload.key.secret);
      setCopied(false);
      await load();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create key. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (key: PublicKey) => {
    return issueKey({ name: key.name, scopes: key.scopes, rotate_id: key.id });
  };

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("The API key could not be revoked. Please try again.");
      await load();
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Could not revoke key."); return false; }
    finally { setBusy(false); }
  };

  const copyIssued = async () => {
    if (!issued) return;
    try { await navigator.clipboard.writeText(issued); setCopied(true); }
    catch { setError("Could not access the clipboard. Select and copy the key before closing this page."); }
  };

  const toggleScope = (scope: string) => {
    setSelected((previous) =>
      previous.includes(scope) ? previous.filter((value) => value !== scope) : [...previous, scope],
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access control"
        title="API keys"
        description="Connect your code or your AI assistant. Give each integration its own access, and stop it whenever you need."
      />

      <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader title="Connect with sign-in" description="For AI clients that support MCP OAuth" />
        <div className="space-y-4 p-5 text-sm text-ink-2">
          <p>Add this remote MCP URL in your AI client. Choose OAuth, sign in to ScreenshotAPI, and review the permissions before allowing access.</p>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas p-3">
            <code className="min-w-0 flex-1 break-all text-xs text-accent-ink">https://api.screenshotapi.tech/mcp</code>
            <Button variant="ghost" onClick={() => void navigator.clipboard.writeText("https://api.screenshotapi.tech/mcp").catch(() => setError("Select and copy the MCP URL manually."))}><Icon name="copy" className="size-4" /> Copy URL</Button>
          </div>
          <p className="text-xs text-ink-3">Captures and page inspection use your credits. Only approve clients you trust.</p>
          <a className="text-accent-ink underline underline-offset-4" href="https://docs.screenshotapi.tech/agents/mcp">Connection guide</a>
        </div>
      </Card>
      <Card>
        <CardHeader title="Connect with an API key" description="For code, automations, and clients with custom headers" />
        <div className="space-y-4 p-5 text-sm text-ink-2">
          <p>Create a dedicated key and add it to your integration’s secret settings. For MCP, send <code className="text-accent-ink">Authorization: Bearer YOUR_AGENT_KEY</code>.</p>
          <p className="text-xs text-ink-3">Agent keys can create captures and read their jobs. Revoke one below to stop its access.</p>
          <Button disabled={busy || loading} onClick={() => void issueKey({ name: "AI agent", scopes: ["screenshot:write", "jobs:read"] })}>
            <Icon name="key" className="size-4" /> Create agent key
          </Button>
        </div>
      </Card>
      </div>

      {error ? <div role="alert" className="rounded-lg border border-bad/30 bg-bad/10 p-4 text-sm text-bad-ink">{error}</div> : null}

      {issued ? (
        <Card className="border-accent/50 p-5">
          <div className="flex flex-wrap items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-ok/15 text-ok-ink">
              <Icon name="key" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-ink">Key issued</p>
              <p className="mt-1 text-sm text-ink-3">Copy it now — it cannot be retrieved again.</p>
              <code className="mt-3 block overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-xs text-accent-ink">
                {issued}
              </code>
            </div>
            <Button
              variant="ghost"
              aria-label="Copy API key"
              onClick={() => void copyIssued()}
            >
              <Icon name="copy" className="size-4" />
              {copied ? "Copied" : "Copy key"}
            </Button>
            <Button variant="ghost" onClick={() => setIssued(null)}>Done</Button>
            <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(JSON.stringify({
              mcpServers: { screenshotapi: { url: "https://api.screenshotapi.tech/mcp", headers: { Authorization: `Bearer ${issued}` } } },
            }, null, 2)).catch(() => setError("Could not copy MCP settings. Copy the key and configure the connection manually."))}>
              <Icon name="copy" className="size-4" /> Copy MCP settings
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Your integrations" description={loading ? "Loading your keys…" : `${activeKeys.length} active · ${keys.length - activeKeys.length} revoked`} />
          <div className="flex flex-wrap gap-3 border-b border-line p-4">
            <Input aria-label="Search keys" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or prefix" className="min-w-0 flex-1" />
            <select aria-label="Key status" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-md border border-line bg-canvas px-3 text-sm text-ink">
              <option value="active">Active</option><option value="revoked">Revoked</option><option value="all">All keys</option>
            </select>
          </div>
          {visibleKeys.length === 0 ? (
            <EmptyState
              icon="key"
              title={loading ? "Loading API keys" : keys.length ? "No matching keys" : "Connect your first integration"}
              description={keys.length ? "Try another name or change the status filter." : "Create a key with capture and job permissions to get started. You’ll see the secret once."}
            />
          ) : (
            <ul className="divide-y divide-line">
              {visibleKeys.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-raised text-ink-2">
                    <Icon name="key" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm text-ink">{key.name}</p>
                      <Badge tone={key.revoked_at ? "danger" : "neutral"}>{key.revoked_at ? "Revoked" : "Active"}</Badge>
                    </div>
                    <p className="mt-0.5 break-words font-mono text-xs text-ink-3">
                      {key.prefix}•••• • created {formatRelative(key.created_at)} •{" "}
                      {key.last_used_at ? `used ${formatRelative(key.last_used_at)}` : "never used"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} tone="neutral">
                          {SCOPE_LABELS[scope] ?? scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {key.revoked_at ? null : (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" disabled={busy} onClick={() => setConfirmation({ key, action: "rotate" })}>
                        <Icon name="refresh" className="size-4" />
                        Rotate
                      </Button>
                      <Button variant="danger" disabled={busy} onClick={() => setConfirmation({ key, action: "revoke" })}>
                        <Icon name="trash" className="size-4" />
                        Revoke
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Create key" description="One key for each integration" />
          <form className="space-y-4 p-5" onSubmit={(event) => { event.preventDefault(); if (!busy && selected.length && name.trim().length >= 2) void create(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Label</Label>
              <Input
                id="key-name"
                value={name}
                placeholder="Production worker"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => setSelected(["screenshot:write", "jobs:read"])}>Capture &amp; inspect</Button>
                <Button type="button" variant="ghost" onClick={() => setSelected(["jobs:read"])}>Read jobs only</Button>
              </div>
              {scopes.map((scope) => (
                <label
                  key={scope}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-canvas px-3 py-2.5 text-sm transition-colors hover:border-line-strong"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="size-4 accent-[var(--sf-color-primary-600)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-ink">{SCOPE_LABELS[scope] ?? scope}</span>
                    <span className="block font-mono text-[11px] text-ink-3">{scope}</span>
                  </span>
                </label>
              ))}
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={busy || loading || !selected.length || name.trim().length < 2}
            >
              <Icon name="key" className="size-4" />
              {busy ? "Creating…" : "Create key"}
            </Button>
            <p className="text-xs leading-relaxed text-ink-3">Keep keys on your server or in a secret manager. Never include them in browser code or public repositories.</p>
          </form>
        </Card>
      </div>
      {confirmation ? (
          <dialog ref={dialog} onCancel={(event) => { if (busy) event.preventDefault(); else setConfirmation(null); }} aria-labelledby="key-confirm-title" aria-describedby="key-confirm-description" className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-line bg-raised p-6 shadow-xl backdrop:bg-canvas/90">
            <h2 id="key-confirm-title" className="text-lg font-medium text-ink">{confirmation.action === "rotate" ? "Replace" : "Revoke"} {confirmation.key.name}?</h2>
            <p id="key-confirm-description" className="mt-3 text-sm leading-relaxed text-ink-2">{confirmation.action === "rotate" ? "The current key stops working immediately. Copy the new secret and update your integration to restore access." : "This integration will lose access. You can create a new key later, but this key cannot be restored."}</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button autoFocus variant="ghost" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</Button>
              <Button variant="danger" disabled={busy} onClick={() => void (confirmation.action === "rotate" ? rotate(confirmation.key) : revoke(confirmation.key.id)).then((success) => { if (success) setConfirmation(null); })}>{busy ? "Updating…" : confirmation.action === "rotate" ? "Replace key" : "Revoke key"}</Button>
            </div>
            {error ? <p role="alert" className="mt-3 text-sm text-bad-ink">{error}</p> : null}
          </dialog>
      ) : null}
    </div>
  );
}
