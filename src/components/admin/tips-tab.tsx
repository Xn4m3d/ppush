"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Check } from "lucide-react";
import { Badge, Button, Card, Textarea, cls } from "../ui";

type Tip = { id: string; en: string; fr: string; active: boolean; sortOrder: number };

export function TipsTab({ refreshKey, bump }: { refreshKey: number; bump: () => void }) {
  const t = useTranslations("admin");
  const [tips, setTips] = useState<Tip[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  const [newEn, setNewEn] = useState("");
  const [newFr, setNewFr] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tips").then(async (res) => {
      if (res.ok && !cancelled) setTips((await res.json()).tips);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, reloadKey]);

  async function add() {
    setAdding(true);
    const r = await fetch("/api/admin/tips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ en: newEn, fr: newFr }),
    });
    setAdding(false);
    if (r.ok) {
      setNewEn("");
      setNewFr("");
      reload();
      bump();
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= tips.length) return;
    const reordered = [...tips];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    setTips(reordered); // optimistic
    await fetch("/api/admin/tips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map((x) => x.id) }),
    });
  }

  const activeCount = tips.filter((x) => x.active).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-ink-dim">
        <Lightbulb className="size-4 text-accent-soft" />
        {t("tipsDesc")}
      </div>

      {/* Add */}
      <Card className="space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("tipsAddTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-ink-dim">{t("tipsEnLabel")}</span>
            <Textarea value={newEn} onChange={(e) => setNewEn(e.target.value)} rows={2} maxLength={400} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-ink-dim">{t("tipsFrLabel")}</span>
            <Textarea value={newFr} onChange={(e) => setNewFr(e.target.value)} rows={2} maxLength={400} />
          </label>
        </div>
        <Button onClick={add} loading={adding} disabled={!newEn.trim() || !newFr.trim()}>
          <Plus className="size-4" /> {t("tipsAddBtn")}
        </Button>
      </Card>

      <p className="text-xs text-ink-faint">{t("tipsCount", { total: tips.length, active: activeCount })}</p>

      {tips.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-faint">{t("tipsEmpty")}</Card>
      ) : (
        <div className="space-y-3">
          {tips.map((tip, i) => (
            <TipRow
              key={tip.id}
              tip={tip}
              first={i === 0}
              last={i === tips.length - 1}
              onMoveUp={() => move(i, -1)}
              onMoveDown={() => move(i, 1)}
              onChanged={() => {
                reload();
                bump();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TipRow({
  tip,
  first,
  last,
  onMoveUp,
  onMoveDown,
  onChanged,
}: {
  tip: Tip;
  first: boolean;
  last: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("admin");
  const [en, setEn] = useState(tip.en);
  const [fr, setFr] = useState(tip.fr);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = en !== tip.en || fr !== tip.fr;

  async function patch(data: Record<string, unknown>) {
    return fetch("/api/admin/tips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tip.id, ...data }),
    });
  }

  async function save() {
    if (!en.trim() || !fr.trim()) return;
    setSaving(true);
    const r = await patch({ en, fr });
    setSaving(false);
    if (r.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onChanged();
    }
  }

  async function toggleActive() {
    await patch({ active: !tip.active });
    onChanged();
  }

  async function remove() {
    if (!confirm(t("tipsDeleteConfirm"))) return;
    await fetch("/api/admin/tips", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tip.id }),
    });
    onChanged();
  }

  return (
    <Card className={cls("p-4", !tip.active && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-1">
          <button
            onClick={onMoveUp}
            disabled={first}
            title={t("tipsMoveUp")}
            className="grid size-7 place-items-center rounded-lg border border-line text-ink-faint transition-colors hover:text-ink disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={last}
            title={t("tipsMoveDown")}
            className="grid size-7 place-items-center rounded-lg border border-line text-ink-faint transition-colors hover:text-ink disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            <ArrowDown className="size-3.5" />
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{t("tipsEnLabel")}</span>
              <Textarea value={en} onChange={(e) => setEn(e.target.value)} rows={2} maxLength={400} className="text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{t("tipsFrLabel")}</span>
              <Textarea value={fr} onChange={(e) => setFr(e.target.value)} rows={2} maxLength={400} className="text-sm" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="subtle" className="py-2" onClick={save} loading={saving} disabled={!dirty}>
              {saved ? <Check className="size-4 text-ok" /> : null}
              {saved ? t("tipsSaved") : t("tipsSave")}
            </Button>
            <button
              onClick={toggleActive}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink cursor-pointer"
            >
              {tip.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              {tip.active ? t("tipsActiveOn") : t("tipsActiveOff")}
            </button>
            {!tip.active && <Badge tone="warn">{t("tipsHidden")}</Badge>}
            <Button variant="danger" className="py-2" onClick={remove}>
              <Trash2 className="size-4" /> {t("tipsDelete")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
