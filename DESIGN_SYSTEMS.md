# TSEDA Design System — UI/UX Style Guide

---

## Design Philosophy

**Core identity:** TSEDA is a gamification-driven data collection tool for an engineering college. The design must feel **motivating but professional** — not a toy game, not a boring enterprise form. Think of it like Duolingo meets a clean SaaS dashboard.

**Three design pillars:**

1. **Calm productivity** — Users are doing data entry (inherently boring). The UI should make it feel effortless, not overwhelming. White space, clear hierarchy, minimal cognitive load.

2. **Earned reward** — Gamification elements (streaks, badges, progress) should feel meaningful and satisfying. Subtle animations, warm colors for achievements, a sense of forward momentum.

3. **Institutional trust** — This is for a real college. It needs to look credible to faculty and administrators. No childish gradients, no excessive animations, no gimmicks.

---

## Color System

### Brand Colors
```
Primary:       #1E3A5F  (deep navy)        — Headers, primary buttons, trust/authority
Primary Light: #2D5F8A  (medium blue)      — Hover states, secondary elements
Accent:        #F59E0B  (amber-500)        — Gamification, streaks, calls to action
Accent Warm:   #EF4444  (red-500)          — Flame/streak active, urgent states
```

### Semantic Colors
```
Success:       #10B981  (emerald-500)      — Approved, completed, positive progress
Warning:       #F59E0B  (amber-500)        — Pending, needs attention
Danger:        #EF4444  (red-500)          — Rejected, errors, streak broken
Info:          #3B82F6  (blue-500)         — Informational, neutral stats
```

### Surface Colors
```
Background:    #FAFBFC                     — Page background (not pure white)
Card:          #FFFFFF                     — Card surfaces
Card Hover:    #F8FAFC                     — Card hover state
Border:        #E2E8F0  (slate-200)       — Card borders, dividers
Text Primary:  #0F172A  (slate-900)       — Headings, primary text
Text Secondary:#64748B  (slate-500)       — Descriptions, metadata
Text Muted:    #94A3B8  (slate-400)       — Timestamps, hints
```

### Gamification Gradient Palette
```
Streak Active:    from-amber-500 to-orange-600     — Fire theme
Streak Record:    from-yellow-400 to-amber-500     — Gold/trophy theme
Progress:         from-blue-500 to-indigo-600      — Forward momentum
Achievement:      from-emerald-500 to-teal-600     — Completion/success
Level Up:         from-purple-500 to-violet-600    — Special milestones
```

### Tailwind Config Mapping
```css
/* Apply in globals.css or tailwind config */
--color-brand: #1E3A5F;
--color-brand-light: #2D5F8A;
--color-accent: #F59E0B;
--color-surface: #FAFBFC;
```

---

## Typography

### Font Stack
- **Headings:** Geist Sans (already loaded via next/font) — weight 600-700
- **Body:** Geist Sans — weight 400-500
- **Mono/Code:** Geist Mono — for entry IDs, timestamps, technical info

### Scale
```
Page title:      text-2xl font-bold text-slate-900        (24px)
Section header:  text-lg font-semibold text-slate-800     (18px)
Card title:      text-base font-semibold text-slate-900   (16px)
Body:            text-sm text-slate-700                    (14px)
Caption/meta:    text-xs text-slate-500                    (12px)
Stat number:     text-3xl font-bold                        (30px) — for dashboard numbers
```

### Rules
- Never use more than 3 font sizes on one page
- Stat numbers are always bold and large — they're the hero
- Metadata (dates, IDs, status labels) is always small and muted
- No ALL CAPS except for status badges

---

## Component Patterns

### 1. Cards (the primary UI unit)

**Standard Card** — for data, stats, entries:
```
bg-white rounded-xl border border-slate-200 p-5 shadow-sm
hover:shadow-md hover:border-slate-300 transition-all duration-200
```

**Gamification Card** — for streaks, achievements:
```
rounded-xl p-5 shadow-sm text-white
background: gradient (from palette above)
Optional: subtle glow ring on active state
ring-2 ring-amber-400/30 (when streak is active)
```

**Entry Card** — for entry list items:
```
bg-white rounded-lg border border-slate-200 p-4
Left accent border for status:
  border-l-4 border-l-slate-300    (DRAFT)
  border-l-4 border-l-blue-500     (GENERATED)
  border-l-4 border-l-amber-500    (EDIT_REQUESTED)
  border-l-4 border-l-red-500      (DELETE_REQUESTED)
  border-l-4 border-l-emerald-500  (EDIT_GRANTED)
  border-l-4 border-l-zinc-300     (ARCHIVED)
```

**Inactive/Empty State Card:**
```
bg-slate-50 rounded-xl border border-dashed border-slate-300 p-5
text-slate-400 text-center
```

### 2. Status Badges

Consistent across ALL pages — entries, dashboard, lists:
```
DRAFT:             bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-medium
GENERATED:         bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-medium
EDIT_REQUESTED:    bg-amber-100 text-amber-700 text-xs px-2.5 py-0.5 rounded-full font-medium
DELETE_REQUESTED:  bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-full font-medium
EDIT_GRANTED:      bg-emerald-100 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-medium
ARCHIVED:          bg-zinc-100 text-zinc-500 text-xs px-2.5 py-0.5 rounded-full font-medium
```

### 3. Buttons

**Primary** (main action — Save, Submit, Generate):
```
bg-brand text-white hover:bg-brand-light
rounded-lg px-4 py-2 text-sm font-medium
shadow-sm hover:shadow transition-all
```

**Secondary** (Save Draft, Cancel):
```
bg-white text-slate-700 border border-slate-300
hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium
```

**Ghost** (navigation, minor actions):
```
text-slate-600 hover:text-slate-900 hover:bg-slate-100
rounded-lg px-3 py-2 text-sm font-medium
```

**Danger** (Delete, Reject):
```
bg-red-500 text-white hover:bg-red-600
rounded-lg px-4 py-2 text-sm font-medium
```

### 4. Form Fields

Consistent across ALL category entry pages:
```
Input:   bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm
         focus:ring-2 focus:ring-brand/20 focus:border-brand
         placeholder:text-slate-400
Label:   text-sm font-medium text-slate-700 mb-1.5
Helper:  text-xs text-slate-500 mt-1
Error:   text-xs text-red-600 mt-1 + border-red-500 on input
```

### 5. Icons

**Usage rules:**
- Every stat card gets an icon (top-left or inline with title)
- Icons are 16-20px, matching text color (not standalone color)
- Gamification icons can be colored:
  - Flame (amber-500) for streaks
  - Trophy (yellow-500) for wins
  - Target (blue-500) for progress
  - CheckCircle (emerald-500) for approvals
  - Clock (slate-400) for pending
  - XCircle (red-500) for rejected
- Navigation icons are 18px, slate-500

### 6. Section Separators

Between dashboard groups, between form sections:
```
<div className="space-y-1 mb-6">
  <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
  <p className="text-sm text-slate-500">{description}</p>
</div>
```
No horizontal rules (`<hr>`). Use spacing and headers only.

---

## Page Layout Templates

### Global Layout

```
┌─────────────────────────────────────────────────┐
│  Header (sticky)                                │
│  [T'SEDA Data Repository]         [Data Entry]  │
│  h-14, bg-white, border-b border-slate-200      │
│  shadow-sm, z-50                                 │
├─────────────────────────────────────────────────┤
│                                                  │
│  Page Content                                    │
│  max-w-5xl mx-auto px-4 py-6                    │
│  (centered, consistent padding)                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

- Max width 5xl (1024px) for content — prevents ultra-wide unreadable lines
- Consistent horizontal padding px-4 (mobile) / px-6 (desktop)
- Consistent vertical rhythm: py-6 page padding, space-y-8 between sections

### Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│  Header                                          │
├─────────────────────────────────────────────────┤
│                                                  │
│  Welcome back, [Name]           [streak flame]   │
│  text-2xl, with motivational subtext             │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Streak   │ │ Streak   │ │ Current  │        │
│  │ Active   │ │ Wins     │ │ Streak   │        │
│  │ 🔥 grad  │ │ 🏆 grad  │ │ # days   │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│  Section: "Your Streak"                          │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Entries  │ │ Approved │ │ Pending  │        │
│  │ Total    │ │ Count    │ │ Count    │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│  Section: "Your Progress"                        │
│                                                  │
│  ┌─────────────────────────────────────┐        │
│  │ Category progress bars              │        │
│  │ FDP: ████████░░ 80%                 │        │
│  │ Journal: ███░░░░░ 30%               │        │
│  └─────────────────────────────────────┘        │
│  Section: "Categories"                           │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Data Entry List Layout

```
┌─────────────────────────────────────────────────┐
│  Header                                          │
├─────────────────────────────────────────────────┤
│                                                  │
│  [Category Name]                    [+ New Entry]│
│  text-2xl + description                          │
│                                                  │
│  Filter: [All] [Draft] [Pending] [Approved]      │
│  Tabs or pill buttons, subtle                    │
│                                                  │
│  ┌─────────────────────────────────────┐        │
│  │ ▎ Entry Title                       │  Status│
│  │ ▎ Subtitle / date        [Edit →]   │  Badge │
│  └─────────────────────────────────────┘        │
│  ┌─────────────────────────────────────┐        │
│  │ ▎ Entry Title                       │  Status│
│  │ ▎ Subtitle / date        [Edit →]   │  Badge │
│  └─────────────────────────────────────┘        │
│                                                  │
│  Empty state (if no entries):                    │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐        │
│  │  No entries yet. Start your first!  │        │
│  │  [+ Create Entry]                   │        │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘        │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Entry Editor Layout

```
┌─────────────────────────────────────────────────┐
│  Header                                          │
├─────────────────────────────────────────────────┤
│                                                  │
│  [← Back]  Entry Title           [Save] [Done]   │
│  Sticky action bar, bg-white border-b            │
│                                                  │
│  ┌─────────────────────────────────────┐        │
│  │ Section: Basic Information          │        │
│  │ ┌─────────┐ ┌─────────┐            │        │
│  │ │ Field 1 │ │ Field 2 │            │        │
│  │ └─────────┘ └─────────┘            │        │
│  │ ┌───────────────────────┐           │        │
│  │ │ Field 3 (full width)  │           │        │
│  │ └───────────────────────┘           │        │
│  └─────────────────────────────────────┘        │
│                                                  │
│  ┌─────────────────────────────────────┐        │
│  │ Section: Upload Documents           │        │
│  │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐         │        │
│  │ │  Drop files here        │         │        │
│  │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘         │        │
│  └─────────────────────────────────────┘        │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Animation & Motion

### Principles
- Motion is **functional**, not decorative
- Only animate things that change state
- Keep durations short: 150-300ms
- Use `transition-all duration-200 ease-out` as default

### Allowed Animations
```
Card hover:      shadow-sm → shadow-md, border color shift (200ms)
Button press:    scale-95 active state (100ms)
Page load:       fade-in-up on card groups (300ms, staggered 50ms)
Streak active:   subtle pulse glow on streak count (2s loop, very subtle)
Status change:   background color transition (200ms)
Toast/notif:     slide-in from top-right (200ms)
Progress bar:    width transition (500ms ease-out)
```

### Forbidden
- No bouncing
- No spinning (except loading spinners)
- No shake effects
- No confetti (tempting for gamification, but no)
- No auto-playing complex animations

---

## Responsive Breakpoints

```
Mobile:   < 640px   — single column, stacked cards, hamburger if needed
Tablet:   640-1024  — 2 column grids, side-by-side where sensible
Desktop:  > 1024    — 3 column grids for dashboard, 2 column for forms
```

### Mobile-Specific Rules
- Dashboard stat cards: full width, stacked
- Entry list: full width cards
- Form fields: always full width (never side-by-side on mobile)
- Header: title truncates if needed, Data Entry button uses icon only
- Action buttons: full width at bottom (sticky) on mobile

---

## Gamification Visual Language

### Streak States
```
No streak (0):       Muted gray card, dashed border, slate-400 icon
                     "Start your streak!"

Active streak (1+):  Gradient card (amber→orange), white text
                     Flame icon with subtle pulse
                     "X days — keep it going!"

Streak record:       Gold gradient card, Trophy icon
                     Slight ring glow
                     "Personal best!"

Streak broken:       Red-tinted card briefly on load, then muted
                     "Streak ended. Start again!"
```

### Progress Visualization
```
Category progress:   Horizontal bar, rounded-full, h-2
                     bg-slate-200 track, colored fill
                     Color matches category theme or generic blue-500
                     Label on left, percentage on right

Overall progress:    Circular or larger bar at top of dashboard
                     Shows total completion across all categories
```

### Achievement Moments
When a user hits a milestone (first entry, 7-day streak, etc.):
- Brief toast notification (top-right)
- Card briefly highlights with a ring glow
- No modal/popup interrupting workflow

---

## Dark Mode (Future)

Not implementing now, but prepare by:
- Using Tailwind's semantic color classes (slate-X) rather than hardcoded hex
- Using `bg-white` / `bg-slate-50` for surfaces (easy to swap with dark: prefix later)
- Avoiding pure black (#000) or pure white (#FFF) in custom values

