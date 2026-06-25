# TSEDA Governance & Delegation — Design Spec (v0.3)

> **v0.3 changelog:** resolved Q1 (master hierarchy — hodarch is the permanent
> root; senarch is a removable master) and Q5 (legacy roles kept — REVIEWER stays
> global and retains BOTH edit + delete approval; coordinators sit below). Phase 1a
> (root-master hierarchy in the role layer) + 1b (both founders recognised by the
> legacy master gates) are **implemented + tested**. See §3, §5, E5/E16, §11.


> Living blueprint for the master-admin-configurable roles, delegation, export
> templates, and entry lifecycle. Nothing here is hardcoded behaviour we want to
> ship until the **Open Decisions** (§11) are resolved. This doc is the single
> source of truth we build the phases against.
>
> **v0.2 changelog:** added §2 (reconciliation with the existing workflow engine),
> rewrote the delete lifecycle (§7) to reroute the *approved* delete path through
> quarantine, expanded the edge matrix to E1–E16 (§8), added §9 (notifications &
> audit), and surfaced four new blocking decisions in §11. Driven by a robustness
> review of v0.1 against the actual code.

---

## 1. Principles

1. **Master-configurable, not hardcoded.** Every governance variable — who can do
   what, on which data, retention windows, export formats — is data the master
   admin edits from the admin console. Code reads config; it doesn't bake rules.
2. **Least privilege + scope.** Powers are granted per *data type* (category), not
   globally. A coordinator for Case Studies cannot touch Publications.
3. **Destructive actions stay high.** Delete *approval* and permanent purge sit with
   the master admin, never delegated.
4. **Recoverability is real, not nominal.** Every delete that isn't an explicit
   permanent purge must be restorable — the entry JSON *and* its files.
5. **Everything is auditable.** Every approval, edit, delete, purge, restore, and
   *config* change (roles, types, templates, settings) is written to the admin
   action-history / WAL.
6. **Respect the existing workflow engine.** Governance layers on top of the entry
   lifecycle (§2); it does not silently contradict the one-shot request model,
   timer pausing, or `permanentlyLocked`.

---

## 2. Reconciliation with the existing workflow (MUST READ)

The app already has a strict entry lifecycle. Delegation must slot into it, not
fight it. The non-negotiable existing rules:

- **One request action ever.** Each entry gets exactly one request action in its
  life — edit **or** delete (`requestActionUsed`). After it's used, the request
  dropdown is gone.
- **Reject / cancel locks.** An admin reject, or the user cancelling their own
  request, sets `permanentlyLocked = true`.
- **Timer pauses during a pending request** and resumes only when an admin acts
  (grant/reject). A request that is never actioned **freezes the entry forever**.

What delegation changes, and the rules that result:

1. **Split routing by request type.** Edit requests route to the **coordinator(s)**
   whose type covers the entry's category; delete requests route to **masters
   only**.
2. **Mandatory master fallback.** If *no* coordinator covers the category, or the
   covering type has *zero* assignees, or the only eligible coordinator is barred by
   self-approval (§8 E1), the request **falls through to the master queue**. A
   request must never have an empty approver set — that's the freeze bug.
3. **Escalation SLA.** A pending request unactioned for `governance.requestSlaDays`
   (a master setting) auto-escalates into the master queue and raises a flagged
   notification. Prevents an absent DLC from freezing an entry indefinitely.
4. **The one-shot rule is unchanged.** Delegation only changes *who* approves, not
   *how many* requests a faculty gets. `requestActionUsed` / `permanentlyLocked`
   semantics are identical.

---

## 3. Roles & the master set

| Role | Scope | Source |
|------|-------|--------|
| **Master Admin** | Everything, all categories | Root (pinned) + config |
| **Reviewer** *(global)* | All categories | Kept — approves **edits + deletes** |
| **Export Admin** *(global)* | All categories | Kept — global export |
| **Coordinator (DLC)** | Assigned categories only | Named *coordinator types* (§4) |

- **Master hierarchy (Q1, resolved).** `hodarch@tce.edu` is the **root master** —
  permanent, never removable or demotable by anyone (auto-restored on every config
  load). `senarch@tce.edu` is a full master but **removable by the root**. Additional
  masters may be added; only the root is protected. `hodarch@` is role-based, so it
  survives a change of HOD. *(Implemented in `lib/admin/roles.ts` + `lib/admin.ts`.)*
- **Legacy roles kept (Q5, resolved).** REVIEWER stays a global role that approves
  **both edit and delete** requests (no demotion); EXPORT_ADMIN stays global export.
  The new scoped **Coordinators** sit below them. So the delete-approval set =
  **{master, reviewer}**; coordinators cannot approve deletes.
- **Admins are also faculty.** A master/coordinator can submit their own entries and
  goes through the *same* request flow for them. Their own entries are never
  self-approvable (§8 E1), including masters — a master's own delete request must be
  approved by the *other* master.
- **Single-master fallback.** If only one master is currently active and that master
  needs an action on their *own* entry, the action is blocked and surfaced as
  "needs a second master" rather than silently self-approved. (Confirm — §11 Q7.)

---

## 4. Coordinator types (DLC) — data model

A **coordinator type** is a named, reusable role the master creates, edits, renames,
and deletes. People are assigned *to a type*, not configured one-by-one.

```
CoordinatorType {
  id:         string          // stable slug, e.g. "case-studies-coord"
  label:      string          // "Case Studies Coordinator"
  categories: CategoryKey[]   // non-empty; which data types this type governs
  powers: {
    approveEdits:  boolean     // approve/reject EDIT requests in scope
    export:        boolean     // export their categories' data
    // approveDeletes is intentionally absent — deletes are master-only (§7)
    // editEntriesDirectly: deferred (see §11 Q2)
  }
  exportTemplateIds: string[]  // templates the master assigned to this type (§6)
}

CoordinatorAssignment {
  email:   string
  typeIds: string[]            // a person MAY hold several types; effective
                               // scope = UNION of categories, OR of powers
}
```

- Per your decisions: DLC powers = **approve edit-requests + export**, scoped to the
  type's categories. Delete approvals excluded by design.
- **Validation:** a type with an empty `categories[]` is rejected (a coordinator of
  nothing is a footgun). A person with multiple types gets the union of scope.
- Add/remove "types of DLC" = create/delete `CoordinatorType` records; assigning a
  person = edit their `typeIds`. Both live in the editable admin config (extends
  today's `admin-users.json`).

---

## 5. Permission matrix (role × action × scope)

| Action | Faculty (owner) | Coordinator (DLC) | Master |
|--------|----------------|-------------------|--------|
| Create / edit own draft | ✅ | — | ✅ |
| Generate / finalise own entry | ✅ | — | ✅ |
| Request edit / delete (after lock) | ✅ (one action ever) | — | n/a |
| **Approve/reject edit request** | — | ✅ *(own categories, not own entry)* | ✅ (all) |
| **Approve/reject delete request** | — | ❌ | ✅ (all, not own entry) — *also REVIEWER (global)* |
| **Admin-initiated delete** (spam/dupe) | — | ❌ *(or §11 Q8)* | ✅ → quarantine |
| Export data | — | ✅ *(own categories, assigned templates)* | ✅ (all, all templates) |
| Restore / permanently purge from quarantine | — | ❌ | ✅ |
| Define exportable scope (Layer A) | — | ❌ | ✅ |
| Create/assign export templates | — | author own? *(§11 Q3)* | ✅ create + assign |
| Manage coordinator types & assignments | — | ❌ | ✅ |
| Settings / timers / retention / backups / integrity | — | ❌ | ✅ |

---

## 6. Export system (two layers)

**Layer A — Exportability gate (master).** Master defines what is allowed to leave
the system at all: which categories, and which fields within them, are exportable.
A field not in the allowed set can never appear in any template.

**Layer B — Format templates (named, reusable).** A template is a saved column-order
+ inclusion structure, e.g. **"NAAC Format"**, **"NIRF Format"**.

```
ExportTemplate {
  id:    string
  label: string                 // "NAAC Format"
  perCategory: {
    [category]: { columns: string[] }   // ordered field keys (subset of allowed)
  }
  createdBy: string
  scope: "global"               // shared, reusable
}
```

- **Master authors templates and assigns them** to coordinator types. Templates are
  **shared/global**, so they surface in two places:
  - **Master Export Admin page** (existing, master-only): the *all-data download* —
    lists **every** template, exports **all categories, all faculty** in the chosen
    format.
  - **DLC export page**: lists only the templates the master **assigned** to that
    coordinator's type, and exports **only that type's categories**.
  - Same template, two data scopes — template controls *column order/inclusion*,
    role controls *how much data*.
- **No silent corruption (fixes v0.1 E7).** If a template references a field that
  Layer A later disallows, is renamed, or is removed by a schema change, the template
  is **flagged invalid** in the admin UI and the export **warns** rather than silently
  emitting a column-short file. Compliance exports must never lose a column quietly.
- **Schema-drift handling.** Templates store field keys; categories/fields are
  mutable. On any schema change, templates are re-validated and dangling keys are
  surfaced for the master to fix (related to §8 E4).
- **Export status filter.** Exports include only **finalised** entries by default
  (not drafts, not in-flight requests, not quarantined). Confirm scope per template
  if finer control is wanted.

---

## 7. Delete lifecycle (rewritten in v0.2)

**Code reality to fix:** today only the *nightly auto-delete* routes through
quarantine (`quarantineEntry`). The user-facing **approved delete** still hard-deletes
(`approveDelete` → `deleteEntryRaw`, removing entry + files + dir + notifications).
The recoverable promise is therefore unimplemented for the exact path faculty use.

Target lifecycle (P4 reroutes `approveDelete` through quarantine):

```
Faculty requests delete  ──or──  Master-initiated delete (§11 Q8)
        │
        ▼
Master approves   ──reject──▶  entry stays, permanentlyLocked (existing behaviour)
        │
        ▼
QUARANTINE (recoverable: entry.json + files + manifest)
        │
        ├── Master restore ──▶ entry returns to prior state (§8 E11 streak rule)
        │
        ▼  (auto, after N days — N = governance.quarantineRetentionDays, a setting)
PERMANENT PURGE  (entry + files + notifications removed; analytics invalidated)
```

- **Retention is a setting,** not the hardcoded `TRASH_RETENTION_DAYS = 30`.
- **Grandfathering (§11 Q6).** Purge currently recomputes against *current* retention,
  so lowering N would shorten the life of entries *already* quarantined. Decide
  new-only vs retroactive (mirrors the timer decision).
- **Restore ⇄ purge concurrency.** The nightly purge and a manual restore both
  `rm` the trash dir. A bundle being restored must be locked/marked so the purge
  skips it (avoid a destroy-during-restore race).
- Only a master restores or purges. DLCs never see delete approvals or quarantine.

---

## 8. Edge conditions (E1–E16)

| # | Situation | Rule |
|---|-----------|------|
| E1 | An approver (DLC **or master**) is also the entry's owner | **No self-approval.** Routes to another eligible approver; a master's own request needs the *other* master. |
| E2 | A DLC is removed / type deleted while requests are pending | Pending requests **revert to the master queue**; nothing lost or auto-approved. |
| E3 | Two coordinator types cover the same category | Either assigned coordinator may act; first action wins; both see the queue. |
| E4 | A category is deleted while a type / template references it | Auto-removed from the type's `categories` and from each template's `perCategory`; affected templates flagged. |
| E5 | Anyone tries to remove/demote the **root** master (hodarch) | **Blocked** — root is permanent (auto-restored on load). Non-root masters (senarch, others) ARE removable by the root. |
| E6 | No coordinator covers a category (no type, or zero assignees) | Edit requests **fall through to the master queue** (no empty approver set). |
| E7 | A pending request is unactioned past the SLA | Auto-escalates to the master queue + flagged notification (§2.3). Prevents frozen entries. |
| E8 | A DLC holds multiple types | Effective scope = union of categories; powers = OR. |
| E9 | A faculty who is also a DLC submits in their own category | Their entry's requests skip their own queue → master (E1). |
| E10 | Delete approved → restore | Restore re-inserts entry + files from quarantine to prior workflow state. |
| E11 | Restoring an entry that was a streak **Win** | `streakPermanentlyRemoved` was set on delete-request; decide whether restore re-grants the Win (§11 Q? — default: do **not** silently re-grant). |
| E12 | Export references a field Layer A disallows / schema removed | Template flagged invalid; export **warns**, never silently drops (§6). |
| E13 | Template assigned to a type that later loses the category | Export intersects template categories with the actor's current scope; out-of-scope categories omitted with notice. |
| E14 | Edit-request notification | Routed to the covering DLC(s) for that category (+ master on fallback/escalation), **not** broadcast to all admins (§9). |
| E15 | Two masters edit coordinator/template config simultaneously | Last-write-wins today (file store). Need optimistic check or per-section locking to avoid clobber (§9). |
| E16 | Reviewer/Export-Admin legacy users | **Resolved (Q5):** kept as global roles. Reviewer retains edit + delete approval; nothing is stripped. Coordinators are additive below them. |

---

## 9. Notifications & audit

- **Scoped notifications.** Edit-request notifications target the covering
  coordinator(s) for the entry's category; delete-requests target masters. Fallback
  and SLA escalation add the master queue. No more global admin broadcast.
- **Config-change audit.** Creating/editing/deleting coordinator types, assignments,
  templates, exportable scope, and retention writes to the admin action-history —
  principle 5, currently only partially wired.
- **Concurrent config edits.** With two masters, the file-based config store's
  last-write-wins can clobber. Add an optimistic version check (reject stale writes)
  or per-section locks.

---

## 10. Build phases

- **P1 — Foundation:** multi-master set (pin both founders); category-scoped
  permission checks replacing the global capability gates; migrate legacy
  Reviewer/Export-Admin → all-category coordinator types (§11 Q5).
- **P2 — Coordinator types + assignment UI + routing:** create/edit/delete types;
  assign people; route approval queues by category **with the master fallback +
  SLA escalation (§2)**; scoped notifications (§9).
- **P3 — Export templates:** Layer A exportability config; template CRUD with
  validation (§6); master assignment to types; DLC + master export pages render
  templates; no-silent-drop guard.
- **P4 — Delete lifecycle + edge matrix:** **reroute `approveDelete` through
  quarantine**; retention setting + grandfathering; restore/purge concurrency guard;
  streak-on-restore rule; admin-initiated delete; wire & test E1–E16.

Each phase ships with gates (lint + tsc + tests) and is independently committable.

---

## 11. Open Decisions (need Elan)

**Blocking — confirm before the phase that uses them:**

1. ✅ *(P1, RESOLVED)* **Master hierarchy** — `hodarch@tce.edu` is the permanent root
   (non-removable); `senarch@tce.edu` is a removable master. Implemented + tested.
2. *(P2)* **Direct edit by DLC?** You chose "approvals + export" — confirm DLCs may
   **not** directly edit faculty entries (only approve/reject requests).
3. *(P3)* **DLC-authored templates?** Master authors + assigns. May a DLC also create
   their own templates for their categories, or only use assigned ones?
4. *(P3)* **Template granularity** — one template = a set of *per-category* column
   orders (one "NAAC" spanning all categories), or one template per single category?
   (Spec assumes the per-category map.)
5. ✅ *(P1, RESOLVED)* **Reviewer / Export-Admin legacy roles** — kept as global roles.
   Reviewer retains edit + delete approval; coordinators are additive below them.

**New from the robustness review:**

6. *(P4)* **Quarantine retention grandfathering** — when the master lowers N, does it
   apply only to newly-quarantined entries, or retroactively shorten ones already in
   the bin? (Mirrors the timer "new-only" decision.)
7. *(P4)* **Streak-on-restore** — when a deleted streak **Win** is restored, does the
   Win come back, or stay forfeited? (E11; default proposed: stay forfeited.)
8. *(P4)* **Admin-initiated delete** — should masters be able to remove a faculty
   entry directly (spam/duplicate/error) → quarantine, in addition to faculty-requested
   deletes? (Matrix currently marks this master-only if enabled.)
9. *(P2)* **Single-master self-action fallback** — when only one master is active and
   the action is on their own entry, block with "needs a second master" (proposed), or
   allow it? (§3, E1.)

**Confirm the edge rules E1–E16 (§8)** — especially E1 (self-approval incl. masters),
E6/E7 (fallback + SLA), and E12 (no silent export drop).
