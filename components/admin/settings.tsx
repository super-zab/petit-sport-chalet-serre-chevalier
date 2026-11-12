"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { ActionResult } from "@/app/admin/actions";
import {
  addAdminAction,
  addFeedAction,
  changePasswordAction,
  regenerateTokenAction,
  removeAdminAction,
  removeFeedAction,
  setDefaultPriceAction,
  syncFeedsAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Feed } from "@/lib/ical";
import { cn } from "@/lib/utils";

interface ApartmentSettingsView {
  slug: string;
  name: string;
  defaultPriceEuros: number;
  exportUrl: string;
  feeds: Feed[];
}

interface SettingsProps {
  currentAdminId: string;
  minPasswordLength: number;
  admins: Array<{ id: string; email: string; lastLoginAt: string | null }>;
  apartments: ApartmentSettingsView[];
}

const PLATFORMS = ["Airbnb", "Booking.com", "Abritel", "Autre"];

function formatDateTime(iso: string | null): string {
  if (!iso) return "jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-chalet-brown bg-white">
      <div className="border-b border-chalet-brown/20 px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {intro && <p className="mt-1 text-sm leading-relaxed text-chalet-brown/80">{intro}</p>}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export function Settings({ currentAdminId, minPasswordLength, admins, apartments }: SettingsProps) {
  const [busy, startTransition] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(apartments.map((item) => [item.slug, String(item.defaultPriceEuros).replace(".", ",")]))
  );
  const [newFeed, setNewFeed] = useState<Record<string, { name: string; url: string }>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [password, setPassword] = useState({ current: "", next: "" });
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "" });

  function perform(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      try {
        const result = await action();
        setToast(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
        if (result.ok) onSuccess?.();
      } catch {
        setToast({ ok: false, text: "Connexion perdue. Rechargez la page et réessayez." });
      }
    });
  }

  function savePrice(slug: string) {
    const value = Number((prices[slug] ?? "").trim().replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || (prices[slug] ?? "").trim() === "") {
      return setToast({ ok: false, text: "Saisissez un prix valide, par exemple 150." });
    }
    perform(() => setDefaultPriceAction(slug, value));
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setToast({ ok: false, text: "Copie impossible : sélectionnez le lien et copiez-le à la main." });
    }
  }

  const feedDraft = (slug: string) => newFeed[slug] ?? { name: PLATFORMS[0], url: "" };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Réglages</h1>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-chalet-muted" aria-label="Enregistrement" />}
      </div>

      {toast && (
        <div
          role={toast.ok ? "status" : "alert"}
          className={cn(
            "sticky top-16 z-20 flex items-start justify-between gap-3 rounded-sm border px-4 py-3 text-sm",
            toast.ok ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-800"
          )}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 underline">
            Fermer
          </button>
        </div>
      )}

      <Section
        title="Prix par défaut"
        intro="Prix d'une nuit quand aucun prix particulier n'a été fixé dans le calendrier."
      >
        <ul className="space-y-3">
          {apartments.map((apartment) => (
            <li key={apartment.slug} className="flex flex-wrap items-center gap-3">
              <label htmlFor={`price-${apartment.slug}`} className="min-w-0 flex-1 text-sm font-medium">
                {apartment.name}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={`price-${apartment.slug}`}
                  inputMode="decimal"
                  className="w-24 text-right"
                  value={prices[apartment.slug] ?? ""}
                  onChange={(event) => setPrices((current) => ({ ...current, [apartment.slug]: event.target.value }))}
                />
                <span className="text-sm">€</span>
                <Button type="button" variant="outline" disabled={busy} onClick={() => savePrice(apartment.slug)}>
                  Enregistrer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Airbnb, Booking et autres plateformes"
        intro="La synchronisation fonctionne dans les deux sens par liens de calendrier (iCal). Collez notre lien dans chaque plateforme, et collez ici le lien d'export de chaque plateforme."
      >
        <div className="mb-5">
          <Button type="button" variant="outline" disabled={busy} onClick={() => perform(() => syncFeedsAction())}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Synchroniser maintenant
          </Button>
        </div>
        <div className="space-y-8">
          {apartments.map((apartment) => {
            const draft = feedDraft(apartment.slug);
            return (
              <div key={apartment.slug} className="space-y-4 border-t border-chalet-brown/20 pt-5 first:border-t-0 first:pt-0">
                <h3 className="text-sm font-semibold uppercase tracking-wider">{apartment.name}</h3>

                <div className="space-y-2">
                  <label htmlFor={`export-${apartment.slug}`} className="text-sm font-medium">
                    Notre calendrier, à importer dans les plateformes
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id={`export-${apartment.slug}`}
                      readOnly
                      value={apartment.exportUrl}
                      onFocus={(event) => event.target.select()}
                      className="font-mono text-xs"
                    />
                    <Button type="button" variant="outline" onClick={() => copy(apartment.exportUrl, apartment.slug)}>
                      {copied === apartment.slug ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span className="sr-only">Copier le lien</span>
                    </Button>
                  </div>
                  {regenerating === apartment.slug ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>L&apos;ancien lien cessera de fonctionner sur Airbnb et Booking.</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => perform(() => regenerateTokenAction(apartment.slug), () => setRegenerating(null))}
                      >
                        Générer un nouveau lien
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRegenerating(null)}>
                        Retour
                      </Button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setRegenerating(apartment.slug)} className="text-xs text-chalet-muted underline">
                      Ce lien a fuité ? En générer un nouveau
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Calendriers des plateformes importés ici</p>
                  {apartment.feeds.length === 0 ? (
                    <p className="text-sm text-chalet-muted">Aucun pour l&apos;instant.</p>
                  ) : (
                    <ul className="space-y-2">
                      {apartment.feeds.map((feed) => (
                        <li key={feed.id} className="flex items-start justify-between gap-3 rounded-sm border border-chalet-brown/20 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold">{feed.name}</p>
                            <p className="truncate font-mono text-xs text-chalet-muted">{feed.url}</p>
                            {feed.lastError ? (
                              <p className="mt-1 text-xs text-red-700">
                                Dernière tentative en échec : {feed.lastError} Dernière réussite : {formatDateTime(feed.lastOkAt)}.
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-chalet-muted">Synchronisé le {formatDateTime(feed.lastOkAt)}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => perform(() => removeFeedAction(feed.id))}
                            aria-label={`Supprimer le calendrier ${feed.name}`}
                            className="shrink-0 rounded-sm p-2 hover:bg-chalet-cream-light disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      aria-label="Plateforme"
                      value={draft.name}
                      onChange={(event) =>
                        setNewFeed((current) => ({ ...current, [apartment.slug]: { ...draft, name: event.target.value } }))
                      }
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {PLATFORMS.map((platform) => (
                        <option key={platform}>{platform}</option>
                      ))}
                    </select>
                    <Input
                      aria-label={`Lien iCal à importer pour ${apartment.name}`}
                      placeholder="https://…  (lien d'export iCal de la plateforme)"
                      value={draft.url}
                      onChange={(event) =>
                        setNewFeed((current) => ({ ...current, [apartment.slug]: { ...draft, url: event.target.value } }))
                      }
                    />
                    <Button
                      type="button"
                      disabled={busy || draft.url.trim() === ""}
                      onClick={() =>
                        perform(
                          () => addFeedAction({ slug: apartment.slug, name: draft.name, url: draft.url }),
                          () => setNewFeed((current) => ({ ...current, [apartment.slug]: { name: draft.name, url: "" } }))
                        )
                      }
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Mot de passe" intro={`${minPasswordLength} caractères minimum. Changer le mot de passe déconnecte vos autres appareils.`}>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            perform(() => changePasswordAction(password.current, password.next), () => setPassword({ current: "", next: "" }));
          }}
        >
          <Input
            type="password"
            required
            aria-label="Mot de passe actuel"
            placeholder="Mot de passe actuel"
            autoComplete="current-password"
            value={password.current}
            onChange={(event) => setPassword((current) => ({ ...current, current: event.target.value }))}
          />
          <Input
            type="password"
            required
            minLength={minPasswordLength}
            aria-label="Nouveau mot de passe"
            placeholder="Nouveau mot de passe"
            autoComplete="new-password"
            value={password.next}
            onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))}
          />
          <Button type="submit" variant="outline" disabled={busy}>
            Modifier
          </Button>
        </form>
      </Section>

      <Section title="Comptes ayant accès au tableau de bord">
        <ul className="mb-5 space-y-2">
          {admins.map((admin) => (
            <li key={admin.id} className="flex items-center justify-between gap-3 rounded-sm border border-chalet-brown/20 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {admin.email}
                  {admin.id === currentAdminId && <span className="font-normal text-chalet-muted"> (vous)</span>}
                </p>
                <p className="text-xs text-chalet-muted">Dernière connexion : {formatDateTime(admin.lastLoginAt)}</p>
              </div>
              {admin.id !== currentAdminId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => perform(() => removeAdminAction(admin.id))}
                  aria-label={`Supprimer le compte ${admin.email}`}
                  className="shrink-0 rounded-sm p-2 hover:bg-chalet-cream-light disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            perform(() => addAdminAction(newAdmin.email, newAdmin.password), () => setNewAdmin({ email: "", password: "" }));
          }}
        >
          <Input
            type="email"
            required
            aria-label="Email du nouveau compte"
            placeholder="Email du nouveau compte"
            autoComplete="off"
            value={newAdmin.email}
            onChange={(event) => setNewAdmin((current) => ({ ...current, email: event.target.value }))}
          />
          <Input
            type="password"
            required
            minLength={minPasswordLength}
            aria-label="Mot de passe du nouveau compte"
            placeholder="Mot de passe provisoire"
            autoComplete="new-password"
            value={newAdmin.password}
            onChange={(event) => setNewAdmin((current) => ({ ...current, password: event.target.value }))}
          />
          <Button type="submit" variant="outline" disabled={busy}>
            Ajouter
          </Button>
        </form>
      </Section>
    </div>
  );
}
