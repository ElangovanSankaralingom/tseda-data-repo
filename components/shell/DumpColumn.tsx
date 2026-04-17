"use client";

import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Plus, Pencil, Trash2, Check, X, Star, Zap, Feather } from "lucide-react";

/*
  ───────────────────────────────────────────────────────
   SCRATCH PAD — Quick capture

   Layout:
     1. Header — icon badge + title + count
     2. Capture card — unified surface containing:
        • The One Thing (pinned priority line, amber accent)
        • Text input (inset dark well)
     3. Notes river — accent-rotated cards

   One surface for all input. No duplicate boxes.
   All colors use CSS variable tokens from themeTokens.ts.
  ───────────────────────────────────────────────────────
*/

type DumpItem = {
  id: string;
  content: string;
  createdAt: number;
};

const NOTE_ACCENTS = [
  { bar: "#84CC16", glow: "rgba(132,204,22,0.12)", tint: "rgba(132,204,22,0.04)" },
  { bar: "#818cf8", glow: "rgba(129,140,248,0.12)", tint: "rgba(129,140,248,0.04)" },
  { bar: "#a78bfa", glow: "rgba(167,139,250,0.12)", tint: "rgba(167,139,250,0.04)" },
  { bar: "#f59e0b", glow: "rgba(245,158,11,0.12)", tint: "rgba(245,158,11,0.04)" },
  { bar: "#ec4899", glow: "rgba(236,72,153,0.12)", tint: "rgba(236,72,153,0.04)" },
  { bar: "#06b6d4", glow: "rgba(6,182,212,0.12)", tint: "rgba(6,182,212,0.04)" },
];

function accentForIndex(idx: number) {
  return NOTE_ACCENTS[idx % NOTE_ACCENTS.length];
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/* ══════════════════════════════════════════════
   SINGLE NOTE CARD
   ══════════════════════════════════════════════ */
const NoteCard = memo(function NoteCard({
  dump,
  accent,
  isFirst,
  index,
  editingId,
  editText,
  onStartEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  dump: DumpItem;
  accent: { bar: string; glow: string; tint: string };
  isFirst: boolean;
  index: number;
  editingId: string | null;
  editText: string;
  onStartEdit: (dump: DumpItem) => void;
  onEditChange: (text: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const isEditing = editingId === dump.id;
  const staggerDelay = index < 8 ? `${index * 50}ms` : "400ms";

  return (
    <div className="group/card animate-fade-in-up" style={{ marginBottom: 10, animationDelay: staggerDelay }}>
      <div
        className="relative overflow-hidden transition-all duration-250 hover:-translate-y-0.5"
        style={{
          padding: isFirst ? "13px 14px 12px 18px" : "11px 14px 10px 18px",
          borderRadius: isFirst ? 12 : 10,
          background: isFirst
            ? `linear-gradient(135deg, ${accent.tint} 0%, rgba(255,255,255,0.03) 100%)`
            : "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.02) 100%)",
          border: isFirst ? "1.5px solid var(--color-border-default)" : "1px solid var(--color-border-subtle)",
          boxShadow: isFirst
            ? `0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05), -3px 0 12px -4px ${accent.glow}`
            : "0 1px 4px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {/* Left accent bar — full height, with glow */}
        <div
          className="absolute left-0 top-0 bottom-0 transition-all duration-250 group-hover/card:opacity-100"
          style={{
            width: isFirst ? 3.5 : 3,
            background: `linear-gradient(180deg, ${accent.bar} 0%, ${accent.bar}99 100%)`,
            opacity: isFirst ? 0.9 : 0.5,
            boxShadow: isFirst ? `0 0 8px ${accent.glow}` : "none",
          }}
        />

        {isEditing ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              className="w-full resize-none rounded-md px-3 py-2.5 text-[14px] leading-relaxed outline-none"
              style={{
                fontWeight: 500,
                color: "var(--color-text-primary)",
                background: "var(--color-surface-raised)",
                border: "1.5px solid var(--color-border-default)",
              }}
              rows={3}
              value={editText || ""}
              onChange={(e) => onEditChange(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSaveEdit(dump.id); }
                if (e.key === "Escape") onCancelEdit();
              }}
            />
            <div className="flex items-center gap-1 justify-end">
              <button type="button" onClick={onCancelEdit} className="flex size-6 items-center justify-center rounded transition-colors hover:bg-[var(--color-border-subtle)]" aria-label="Cancel edit">
                <X className="size-3.5" style={{ color: "var(--color-icon-default)" }} />
              </button>
              <button type="button" onClick={() => onSaveEdit(dump.id)} className="flex size-6 items-center justify-center rounded transition-colors hover:bg-[var(--color-border-subtle)]" aria-label="Save edit">
                <Check className="size-3.5" style={{ color: "var(--color-primary)" }} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p
              className="whitespace-pre-wrap break-words"
              style={{
                fontSize: isFirst ? 15 : 14,
                fontWeight: isFirst ? 600 : 500,
                lineHeight: 1.55,
                color: "var(--color-text-primary)",
              }}
            >
              {dump.content}
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: "var(--color-text-tertiary)" }}>
                {timeAgo(dump.createdAt)}
              </span>
              <div className="flex items-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
                <button type="button" onClick={() => onStartEdit(dump)} className="flex size-6 items-center justify-center rounded transition-colors hover:bg-[var(--color-border-subtle)]" aria-label="Edit note">
                  <Pencil className="size-3" style={{ color: "var(--color-icon-muted)" }} />
                </button>
                <button type="button" onClick={() => onDelete(dump.id)} className="flex size-6 items-center justify-center rounded transition-colors hover:bg-red-500/[0.08]" aria-label="Delete note">
                  <Trash2 className="size-3" style={{ color: "var(--color-icon-muted)" }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── localStorage helpers ── */
const STORAGE_KEY_DUMPS = "tseda-scratchpad-dumps";
const STORAGE_KEY_ONE_THING = "tseda-scratchpad-one-thing";

function loadDumps(): DumpItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DUMPS);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DumpItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as DumpItem).id === "string" &&
        typeof (item as DumpItem).content === "string" &&
        typeof (item as DumpItem).createdAt === "number"
    );
  } catch {
    return [];
  }
}

function loadOneThing(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_ONE_THING) ?? "";
  } catch {
    return "";
  }
}

/* ══════════════════════════════════════════════
   SCRATCH PAD — Main
   ══════════════════════════════════════════════ */
export default function DumpColumn() {
  const [dumps, setDumps] = useState<DumpItem[]>(loadDumps);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [oneThing, setOneThing] = useState<string>(loadOneThing);
  const [editingOneThing, setEditingOneThing] = useState(false);
  const [oneThingDraft, setOneThingDraft] = useState("");
  const oneThingRef = useRef<HTMLInputElement>(null);

  /* ── Persist to localStorage on change ── */
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_DUMPS, JSON.stringify(dumps)); } catch { /* quota exceeded */ }
  }, [dumps]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_ONE_THING, oneThing); } catch { /* quota exceeded */ }
  }, [oneThing]);

  const startEditOneThing = useCallback(() => {
    setOneThingDraft(oneThing);
    setEditingOneThing(true);
    setTimeout(() => oneThingRef.current?.focus(), 50);
  }, [oneThing]);

  const saveOneThing = useCallback(() => {
    setOneThing(oneThingDraft.trim());
    setEditingOneThing(false);
  }, [oneThingDraft]);

  const addDump = useCallback(() => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setDumps((prev) => [{ id: crypto.randomUUID(), content: trimmed, createdAt: Date.now() }, ...prev]);
    setNewText("");
    inputRef.current?.focus();
  }, [newText]);

  const deleteDump = useCallback((id: string) => {
    setDumps((prev) => prev.filter((d) => d.id !== id));
    if (editingId === id) setEditingId(null);
  }, [editingId]);

  const startEdit = useCallback((dump: DumpItem) => {
    setEditingId(dump.id);
    setEditText(dump.content);
  }, []);

  const saveEdit = useCallback((id: string) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setDumps((prev) => prev.map((d) => (d.id === id ? { ...d, content: trimmed } : d)));
    setEditingId(null);
  }, [editText]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, []);

  return (
    <div className="flex flex-col h-full">

      {/* ══════════════════════════════════════
         HEADER
         ══════════════════════════════════════ */}
      <div
        className="shrink-0 flex items-center gap-2.5 mb-5 pb-3"
        style={{ borderBottom: "1.5px solid var(--color-border-default)" }}
      >
        <div
          className="flex size-7 items-center justify-center rounded-lg"
          style={{
            background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
            boxShadow: "0 2px 8px var(--color-glow-primary)",
          }}
        >
          <Zap className="size-3.5 text-[#0B0F19]" strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <span className="text-[15px] font-bold" style={{ color: "var(--color-text-primary)" }}>
            Scratch Pad
          </span>
        </div>
        {dumps.length > 0 && (
          <span
            className="flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums"
            style={{
              background: "rgba(132,204,22,0.12)",
              color: "var(--color-primary)",
              minWidth: 22,
              border: "1px solid rgba(132,204,22,0.18)",
            }}
          >
            {dumps.length}
          </span>
        )}
      </div>

      {/* ══════════════════════════════════════
         CAPTURE CARD — One Thing + Input

         Two distinct zones inside one surface:
         Top = focus line (warm when filled)
         Bottom = writing area (recessed, quiet)
         ══════════════════════════════════════ */}
      <div
        className="shrink-0 mb-5 overflow-hidden"
        style={{
          borderRadius: 14,
          background: "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        {/* ── The One Thing — focus line ── */}
        <div
          className="group/hero"
          style={{
            padding: "12px 16px",
            background: oneThing
              ? "linear-gradient(135deg, rgba(251,191,36,0.05) 0%, transparent 70%)"
              : "transparent",
          }}
        >
          {editingOneThing ? (
            <div className="flex items-center gap-3">
              <Star
                className="size-[15px] shrink-0"
                style={{ color: "rgba(251,191,36,0.85)", fill: "rgba(251,191,36,0.85)" }}
              />
              <input
                ref={oneThingRef}
                className="flex-1 bg-transparent outline-none text-[14px] font-semibold"
                style={{ color: "var(--color-text-primary)" }}
                placeholder="What's your focus today?"
                value={oneThingDraft || ""}
                onChange={(e) => setOneThingDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveOneThing();
                  if (e.key === "Escape") setEditingOneThing(false);
                }}
              />
              <button
                type="button"
                onClick={saveOneThing}
                className="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-border-subtle)]"
                aria-label="Save priority"
              >
                <Check className="size-3.5 text-amber-400" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditOneThing}
              className="w-full flex items-center gap-3 text-left"
            >
              <Star
                className="size-[15px] shrink-0"
                style={{
                  color: oneThing ? "rgba(251,191,36,0.90)" : "var(--color-icon-muted)",
                  fill: oneThing ? "rgba(251,191,36,0.90)" : "none",
                }}
              />
              {oneThing ? (
                <span className="flex-1 text-[14px] font-semibold leading-snug" style={{ color: "var(--color-text-primary)" }}>
                  {oneThing}
                </span>
              ) : (
                <span className="flex-1 text-[14px] font-medium transition-colors" style={{ color: "var(--color-text-tertiary)" }}>
                  What&#39;s your focus today?
                </span>
              )}
              {oneThing && (
                <span
                  onClick={(e) => { e.stopPropagation(); setOneThing(""); }}
                  className="flex size-5 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-border-subtle)] opacity-0 group-hover/hero:opacity-100"
                  role="button"
                  tabIndex={0}
                  aria-label="Clear priority"
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setOneThing(""); } }}
                >
                  <X className="size-3" style={{ color: "var(--color-icon-default)" }} />
                </span>
              )}
            </button>
          )}
        </div>

        {/* ── Divider with subtle fade ── */}
        <div style={{ height: 1, margin: "0 12px", background: "var(--color-border-default)" }} />

        {/* ── Text input — quiet recessed zone ── */}
        <div
          className="relative"
          style={{
            background: "rgba(0,0,0,0.08)",
          }}
        >
          <textarea
            ref={inputRef}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-9 leading-relaxed outline-none text-[14px]"
            style={{
              fontWeight: 500,
              color: "var(--color-text-primary)",
              minHeight: 56,
            }}
            placeholder="Drop a thought..."
            rows={1}
            value={newText || ""}
            onChange={(e) => setNewText(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addDump();
              }
            }}
          />

          {/* Focus state — subtle primary tint along bottom edge */}
          {inputFocused && (
            <div
              className="pointer-events-none absolute bottom-0 left-3 right-3"
              style={{
                height: 2,
                borderRadius: 2,
                background: "var(--color-primary)",
                opacity: 0.35,
              }}
            />
          )}

          <div
            className="absolute right-3 bottom-3 transition-all duration-200"
            style={{
              opacity: newText.trim() ? 1 : 0,
              transform: newText.trim() ? "scale(1)" : "scale(0.85)",
              pointerEvents: newText.trim() ? "auto" : "none",
            }}
          >
            <button
              type="button"
              onClick={addDump}
              className="flex size-7 items-center justify-center rounded-lg transition-all duration-150 hover:scale-105 active:scale-95"
              style={{
                background: "var(--color-button-primary-bg)",
                boxShadow: "0 2px 8px var(--color-glow-primary)",
              }}
              aria-label="Add note"
            >
              <Plus className="size-3.5 text-[#0B0F19]" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
         NOTES RIVER
         ══════════════════════════════════════ */}
      {dumps.length > 0 && (
        <div className="shrink-0 mb-3 flex items-center gap-2 px-0.5">
          <Feather className="size-[11px]" style={{ color: "var(--color-icon-muted)" }} />
          <span
            className="text-[11px] font-bold uppercase"
            style={{ color: "var(--color-text-tertiary)", letterSpacing: "0.08em" }}
          >
            Notes
          </span>
          <div className="flex-1" style={{ height: 1.5, background: "linear-gradient(90deg, var(--color-divider-strong) 0%, transparent 100%)" }} />
        </div>
      )}

      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {dumps.map((dump, idx) => (
          <NoteCard
            key={dump.id}
            dump={dump}
            accent={accentForIndex(idx)}
            isFirst={idx === 0}
            index={idx}
            editingId={editingId}
            editText={editText}
            onStartEdit={startEdit}
            onEditChange={setEditText}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onDelete={deleteDump}
          />
        ))}

        {dumps.length === 0 && (
          <div className="flex items-center justify-center pt-8 pb-6">
            <div className="text-center">
              <div
                className="mx-auto flex size-9 items-center justify-center rounded-lg mb-2.5"
                style={{
                  background: "var(--color-glass-bg)",
                  border: "1.5px dashed var(--color-divider-strong)",
                }}
              >
                <Feather className="size-4" style={{ color: "var(--color-icon-muted)" }} />
              </div>
              <p className="text-[13px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                Nothing here yet
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
