# T'SEDA UI REDESIGN — Master Plan

> **Design Philosophy:** Premium dark-first SaaS dashboard inspired by Salesforce Invoicing UI.
> Deep charcoal-navy backgrounds, lime-green neon accents, full glassmorphism, maximum fluid animations, Plus Jakarta Sans typography. Every pixel feels liquid, modern, and alive.

> **Safety Principle:** ZERO functional changes. Only visual/CSS/animation/typography changes. All workflow engine logic, API routes, auth, schemas, i18n, and business logic remain COMPLETELY untouched.

---

## PHASE 0 — DESIGN SYSTEM FOUNDATION

These are the foundational changes that cascade across the entire app. Do these FIRST — everything else builds on them.

### 0.1 Typography: Plus Jakarta Sans

**File:** `app/layout.tsx`

- Replace `GeistSans` / `GeistMono` with `Plus Jakarta Sans` (Google Fonts via `next/font/google`)
- Keep a mono font for data values (tabular numbers) — use `JetBrains Mono` or keep `GeistMono`
- Set CSS variables: `--font-sans: 'Plus Jakarta Sans'`, `--font-mono: 'JetBrains Mono'`
- Update `globals.css` `@theme inline` block to reference new font variables

**File:** `app/globals.css`

- Update `--font-sans` and `--font-mono` references in `@theme inline`
- Add font-weight utilities: use `font-bold` (700) for metric numbers, `font-semibold` (600) for headings, `font-medium` (500) for labels

**Typography Scale (Salesforce-inspired):**
- Hero metrics: `text-4xl font-bold tabular-nums` (dashboard stat numbers)
- Page titles: `text-2xl font-bold`
- Section headers: `text-lg font-semibold`
- Card titles: `text-base font-semibold`
- Body text: `text-sm font-normal`
- Captions/badges: `text-xs font-medium`
- Micro text: `text-[11px] font-medium uppercase tracking-wider`

### 0.2 Color System Overhaul

**File:** `lib/theme/themeTokens.ts`

**New DARK_BASE (the PRIMARY experience):**

```
Body background:     #0B0F19  (deep space navy — NOT pure black)
Card background:     rgba(255, 255, 255, 0.03)  (barely-there glass)
Card border:         rgba(255, 255, 255, 0.06)  (ghost border)
Header background:   rgba(11, 15, 25, 0.8)  (glass header)
Sidebar background:  rgba(15, 20, 35, 0.95)  (deep sidebar)
Input background:    rgba(255, 255, 255, 0.05)
Input border:        rgba(255, 255, 255, 0.08)
Divider:             rgba(255, 255, 255, 0.06)
Dropdown bg:         rgba(20, 25, 40, 0.95)
Modal overlay:       rgba(0, 0, 0, 0.6)
Modal bg:            rgba(20, 25, 40, 0.95)

Text primary:        #F1F5F9  (crisp white)
Text secondary:      #94A3B8  (slate-400)
Text muted:          #4B5563  (gray-600)

Primary:             #84CC16  (LIME-500 — the hero accent)
Primary light:       #A3E635  (LIME-400 — hover states)
Primary hover:       #65A30D  (LIME-600)
Accent:              #84CC16  (unified with primary)
Accent light:        rgba(132, 204, 22, 0.1)

Button primary bg:   #84CC16
Button primary text: #0B0F19  (dark text on lime)
Button primary hover:#65A30D
Generate bg:         #84CC16
Generate hover:      #65A30D

Badge bg:            rgba(132, 204, 22, 0.15)
Badge text:          #A3E635

Gradient from:       #0B0F19
Gradient to:         #131A2B
Header tint:         rgba(132, 204, 22, 0.04)

Skeleton base:       rgba(255, 255, 255, 0.04)
Skeleton shine:      rgba(255, 255, 255, 0.08)
```

**New LIGHT_BASE (secondary, still premium):**

Light mode keeps a clean, professional look but with the lime accent instead of navy:

```
Body background:     #F8FAFC
Card background:     #FFFFFF
Primary:             #4D7C0F  (LIME-700 for readability on white)
Accent:              #84CC16
Button primary bg:   #4D7C0F
Generate bg:         #65A30D
```

**New Color Palette Options:** Replace existing palettes with:
- `midnight-lime` (default — the Salesforce look)
- `deep-ocean` (navy + cyan accent)
- `carbon-violet` (charcoal + purple accent)
- `obsidian-amber` (warm dark + gold accent)

### 0.3 Glass Design Tokens

**File:** `app/globals.css` — add new utility classes:

```css
/* Glass card — the PRIMARY card style */
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 1rem;
}

/* Glass card hover — lift + glow */
.glass-card-hover:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(132, 204, 22, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(132, 204, 22, 0.06);
  transform: translateY(-2px);
}

/* Glass surface — for headers, sidebars, dropdowns */
.glass-surface {
  background: rgba(15, 20, 35, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

/* Glass input — form fields */
.glass-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.75rem;
}

.glass-input:focus {
  border-color: rgba(132, 204, 22, 0.4);
  box-shadow: 0 0 0 3px rgba(132, 204, 22, 0.1);
}

/* Glass pill — for badges, tabs */
.glass-pill {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
}

/* Glow accent — lime glow behind important elements */
.glow-lime {
  box-shadow: 0 0 20px rgba(132, 204, 22, 0.15), 0 0 60px rgba(132, 204, 22, 0.05);
}

/* Glow dot — status indicator with glow */
.glow-dot {
  box-shadow: 0 0 8px currentColor;
}
```

### 0.4 Animation System Upgrade

**File:** `app/globals.css` — add new keyframes:

```css
/* Page-level transition */
@keyframes pageEnter {
  from { opacity: 0; transform: translateY(12px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-page-enter {
  animation: pageEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Card reveal — glass cards fade in with a slight scale */
@keyframes cardReveal {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-card-reveal {
  animation: cardReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
}

/* Shimmer — for skeleton loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.animate-shimmer {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.04) 0%,
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.04) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

/* Glow pulse — for active/important elements */
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 12px rgba(132, 204, 22, 0.2); }
  50% { box-shadow: 0 0 24px rgba(132, 204, 22, 0.4); }
}
.animate-glow-pulse {
  animation: glowPulse 2s ease-in-out infinite;
}

/* Slide up — for toasts and notifications */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slide-up {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Count up number transition — combine with useCountUp hook */
@keyframes numberPop {
  0% { transform: scale(0.8); opacity: 0; }
  60% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}
.animate-number-pop {
  animation: numberPop 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Stagger delays — extend to 12 */
.stagger-9 { animation-delay: 450ms; }
.stagger-10 { animation-delay: 500ms; }
.stagger-11 { animation-delay: 550ms; }
.stagger-12 { animation-delay: 600ms; }
```

### 0.5 Background Treatment

**File:** `app/globals.css`

Replace the current dot-grid pattern with a premium dark ambient effect:

```css
html, body {
  background-color: var(--color-body-bg);
  color: var(--color-text-primary);
  /* Remove dot pattern in dark mode, replace with subtle gradient mesh */
  background-image: none;
}

/* Dark ambient background layer — applied via a pseudo or component */
.dark-ambient-bg {
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(132, 204, 22, 0.03), transparent),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(59, 130, 246, 0.02), transparent),
    var(--color-body-bg);
}
```

**Safety note:** The `background-image` on `html, body` in `@layer base` needs to be conditional — keep the dot pattern for light mode, remove for dark.

### 0.6 Scrollbar Styling (Dark Premium)

**File:** `app/globals.css`

```css
.dark ::-webkit-scrollbar { width: 6px; }
.dark ::-webkit-scrollbar-track { background: transparent; }
.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

### 0.7 Default Theme Mode

**File:** `lib/theme/ThemeProvider.tsx`

Change the default `mode` from `"light"` to `"dark"` for new users. Existing users keep their saved preference.

---

## PHASE 1 — APP SHELL (Header + Sidebar + Navigation)

The shell wraps every authenticated page. Getting this right sets the tone for everything.

### 1.1 Header Bar

**File:** `app/ShellClient.tsx`

**Current:** Navy solid bg (`--color-header-bg`), 56px height, basic blur on scroll
**Target:** Full glass header floating above content

Changes:
- Background: `glass-surface` class (translucent dark with backdrop-blur-xl)
- Remove solid `--color-header-bg` background — use `rgba(11, 15, 25, 0.8)` with `backdrop-filter: blur(20px)`
- Bottom border: `border-b border-white/[0.06]` (ghost border)
- Height: Keep `h-14` but add `px-6` for more breathing room
- Logo/brand mark: Lime gradient glow behind the icon (`shadow-[0_0_20px_rgba(132,204,22,0.2)]`)
- Navigation pills: `glass-pill` style with lime active state
  - Active: `bg-lime-500/15 text-lime-400 border-lime-500/20`
  - Hover: `bg-white/[0.06]`
  - Inactive: `text-slate-400`
- Hamburger icon: `text-slate-400` lines, transitions stay
- Profile avatar: Add lime ring on hover (`ring-2 ring-lime-500/30`)
- Notification bells: Lime dot indicator with `glow-dot` effect
- Search trigger: Glass pill with subtle lime border on hover
- On scroll: Increase `backdrop-blur` to `blur(24px)`, add `shadow-lg shadow-black/20`
- Transition: All changes animate over `300ms ease`

### 1.2 Sidebar Drawer

**File:** `components/shell/SidebarDrawer.tsx`

**Current:** White/dark bg, basic slide-in
**Target:** Full glass panel with depth

Changes:
- Background: `rgba(11, 15, 25, 0.95)` with `backdrop-filter: blur(24px)`
- Overlay: `bg-black/40 backdrop-blur-sm` (frosted overlay behind sidebar)
- Width: Keep `sm:w-80`
- Navigation items:
  - Normal: `text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]`
  - Active: `text-lime-400 bg-lime-500/10 border-l-2 border-lime-500`
  - Icon size: `size-5` with lime accent on active
- Section dividers: `border-white/[0.06]` (ghost lines)
- Profile section at top: Glass card treatment with avatar, name, designation
- Slide-in animation: Enhance to `transform: translateX(-100%) → translateX(0)` with `cubic-bezier(0.16, 1, 0.3, 1)` easing over `400ms`
- Staggered nav item reveal: Each item fades in 50ms apart using existing stagger classes
- Close animation: Reverse slide with `200ms` duration
- Bottom section (settings/signout): Sticky, with top ghost border

### 1.3 Profile Dropdown

**File:** `components/shell/ProfileDropdown.tsx`

Changes:
- Background: `glass-surface` with `backdrop-blur-xl`
- Border: `border border-white/[0.06]`
- Shadow: `shadow-2xl shadow-black/40`
- Menu items: `hover:bg-white/[0.06]` with smooth transitions
- Entry animation: `animate-scale-in` (already exists, keep it)
- Sign out button: `text-red-400 hover:bg-red-500/10`

### 1.4 Navigation Pills

**File:** `components/shell/HeaderNavPill.tsx`

Changes:
- Active state: `bg-lime-500/15 text-lime-400 border border-lime-500/20 shadow-[0_0_12px_rgba(132,204,22,0.1)]`
- Hover state: `bg-white/[0.06] text-slate-200`
- Transition on active change: smooth background + color over `200ms`
- Icon: `size-4` with matching color

### 1.5 Search Trigger + Command Palette

**Files:** `components/shell/SearchTrigger.tsx`, `components/search/CommandPalette.tsx`

Changes:
- Search trigger button: Glass pill, `Cmd+K` badge in lime
- Command palette overlay: Full glass treatment
  - Background: `rgba(11, 15, 25, 0.95)` with `backdrop-blur-2xl`
  - Input: Glass input with lime focus ring
  - Results: Glass cards with hover highlights
  - Active result: `bg-lime-500/10 border-l-2 border-lime-500`
  - Entry animation: `animate-scale-in` on modal, staggered results

### 1.6 Notification Bells

**Files:** `components/confirmations/NotificationBell.tsx`, `components/confirmations/AdminNotificationBell.tsx`

Changes:
- Bell icon: `text-slate-400` default
- Badge: Lime dot with `glow-dot` class (subtle glow pulse)
- Dropdown: Full glass treatment matching Profile dropdown
- Notification items: Glass card treatment with hover state
- Unread indicator: Left border `border-l-2 border-lime-500`

### 1.7 Toast Notifications

**File:** `components/ui/Toast.tsx`

Changes:
- Background: Glass surface treatment
- Border: `border border-white/[0.06]`
- Shadow: `shadow-xl shadow-black/30`
- Success variant: Left border lime, lime icon
- Error variant: Left border red, red icon
- Animation: `animate-slide-in-right` (keep existing) but add exit animation `slide-out-right`
- Progress bar (auto-dismiss): Lime gradient bar at bottom, animating width from 100% to 0%

---

## PHASE 2 — SIGN-IN PAGE

### 2.1 Sign-In Page Redesign

**File:** `app/signin/page.tsx`

**Current:** Light gradient background, white card with float animation
**Target:** Cinematic dark landing with glass card

Changes:
- Full page background: Deep space navy `#0B0F19`
- Ambient effects:
  - Large lime glow orb: `radial-gradient(600px at 50% 30%, rgba(132, 204, 22, 0.06), transparent)`
  - Secondary blue orb: `radial-gradient(400px at 70% 70%, rgba(59, 130, 246, 0.04), transparent)`
  - Both animate with `animate-glow-drift` (already exists)
- Card: Full glass treatment
  - `background: rgba(255, 255, 255, 0.03)`
  - `backdrop-filter: blur(16px)`
  - `border: 1px solid rgba(255, 255, 255, 0.08)`
  - `rounded-3xl` (keep)
  - `shadow-2xl shadow-black/40`
- Logo images: Keep, but add subtle glow behind them
- Title: `text-white font-bold`
- Accent line: Lime gradient `from-lime-500 to-lime-400` with `animate-grow-width`
- Subtitle: `text-slate-400`
- Google sign-in button:
  - Glass pill style: `bg-white/[0.06] border border-white/[0.08]`
  - Text: `text-white`
  - Hover: `bg-lime-500 text-black` — dramatic color flip
  - Active: `scale-[0.97]` (keep)
  - Google icon in white circle
- Footer text: `text-slate-500`
- Error message: Glass card with `border-red-500/20 bg-red-500/10`
- Float animation on card: Keep but make subtler — `translateY(±1px)` instead of `±2px`

---

## PHASE 3 — DASHBOARD

### 3.1 Dashboard Page

**File:** `app/(protected)/dashboard/page.tsx` + `components/dashboard/DashboardClient.tsx`

**Current:** Standard card grid with gradient stat cards
**Target:** Premium metric dashboard like Salesforce top bar

Changes:
- Page wrapper: Add `animate-page-enter` class
- Welcome greeting: Larger, bolder — `text-2xl font-bold text-white` with time-appropriate greeting
- Greeting subtext: `text-slate-400 text-sm`

### 3.2 Stat Cards (Metrics Row)

**File:** `components/dashboard/StatCard.tsx`

**Target:** Large metric display cards like Salesforce's "Overdue / Due within / Average time" row

Changes:
- Card wrapper: `glass-card glass-card-hover` classes
- Remove gradient variants — ALL cards use glass now
- Remove `accent` (border-top color) — replace with subtle left-side glow dot
- Layout:
  - Icon: `size-10 glass-pill` container, lime icon color
  - Metric number: `text-4xl font-bold text-white tabular-nums` with `animate-number-pop`
  - Label: `text-xs font-medium uppercase tracking-wider text-slate-400`
  - Description: `text-xs text-slate-500`
- Hover effect:
  - Card lifts `translateY(-4px)`
  - Border glows lime `border-lime-500/12`
  - Shadow deepens
  - Hidden description expands (keep existing pattern)
- Remove `hoverRing` prop — all cards share the same glass hover
- Add count-up animation for numbers (already using `useCountUp` hook — keep it)

### 3.3 Streak Cards

**File:** `components/dashboard/StreakCard.tsx`

**Target:** Premium glass cards with colored glow

Changes:
- Active streak (flame):
  - Glass card base
  - Left border: `border-l-2 border-amber-400`
  - Icon container: `bg-amber-500/15` glass pill
  - Flame icon: `text-amber-400` with `animate-flame` (keep)
  - Glow: `shadow-[0_0_20px_rgba(251,191,36,0.1)]`
- Wins (trophy):
  - Glass card base
  - Left border: `border-l-2 border-lime-500`
  - Icon container: `bg-lime-500/15` glass pill
  - Trophy icon: `text-lime-400`
  - Glow: `shadow-[0_0_20px_rgba(132,204,22,0.1)]`
- Zero state: Glass card with dashed border `border-dashed border-white/[0.08]`

### 3.4 Category Cards

**File:** `components/dashboard/CategoryCard.tsx`

Changes:
- Full glass treatment
- Category accent: Left glow dot (colored circle, 8px) instead of border-top
- Entry count: `text-2xl font-bold text-white`
- Category name: `text-sm text-slate-400`
- Status pills: Glass pill style with category color
- Hover: Glass-card-hover + subtle category-color border glow
- Icon: Category-specific color, `size-8` in glass circle

### 3.5 Section Headers

**File:** `components/dashboard/SectionHeader.tsx`

Changes:
- Title: `text-lg font-semibold text-white`
- Description: `text-sm text-slate-400`
- Divider between sections: Replace solid line with `gradient-to-r from-transparent via-white/[0.06] to-transparent`

### 3.6 Dashboard Skeleton

**File:** `components/data-entry/EntryListSkeleton.tsx`

Changes:
- Replace solid skeleton colors with `animate-shimmer` glass effect
- Card shapes: Glass card outline with shimmer fill
- Metric placeholder: `rounded-lg h-10 w-24 animate-shimmer`
- Labels: `rounded h-3 w-16 animate-shimmer`

---

## PHASE 4 — DATA ENTRY HOME

### 4.1 Categories Grid

**File:** `components/data-entry/DataEntryClient.tsx`

**Target:** Premium category selector like Salesforce's nav tabs

Changes:
- Page wrapper: `animate-page-enter`
- Page title: `text-2xl font-bold text-white`
- Category cards: Full glass treatment
  - Large icon in glass circle with category accent color
  - Category name: `text-base font-semibold text-white`
  - Entry count with count-up animation
  - Last updated relative time in `text-xs text-slate-500`
  - Status badges: Glass pills
  - Hover: Lift + category-colored glow border
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Empty state card: Glass with dashed border, lime CTA button

---

## PHASE 5 — ENTRY LIST (Category View)

### 5.1 Entry List Page

**File:** `app/(protected)/data-entry/[category]/page.tsx`

Changes:
- Page wrapper: `animate-page-enter`
- Breadcrumb: `text-slate-500` with lime active item
- "New Entry" button: Lime CTA (`bg-lime-500 text-black hover:bg-lime-400`) with `glow-lime` on hover

### 5.2 Grouped Entry Sections

**File:** `components/data-entry/GroupedEntrySections.tsx`

Changes:
- Group header: `text-sm font-semibold uppercase tracking-wider text-slate-500`
- Group icon: Category-group color
- Empty group: Collapsible with glass empty state
- Stagger animation: Cards appear sequentially within each group

### 5.3 Entry List Card Shell

**File:** `components/data-entry/EntryListCardShell.tsx`

**This is the most important card in the app — users see it constantly.**

**Target:** Salesforce invoice list item — clean, scannable, glass

Changes:
- Card: `glass-card glass-card-hover` with `animate-card-reveal`
- Group-specific styling:
  - `streak_runners`: Left glow `border-l-2 border-amber-400` + amber shadow
  - `on_the_clock`: Left glow `border-l-2 border-blue-400` + blue shadow
  - `unlocked`: Left glow `border-l-2 border-purple-400` + purple shadow
  - `in_the_works`: Left glow `border-l-2 border-slate-500`
  - `under_review`: Left glow `border-l-2 border-amber-400`
  - `locked_in`: Left glow `border-l-2 border-lime-500` + lime shadow
- Row 1 (Identity):
  - Group icon: Colored, `size-4`
  - Title link: `text-white font-semibold hover:text-lime-400`
  - Status badge: Glass pill with group color
- Row 2 (Details): `text-xs text-slate-400`
- Row 3 (Footer):
  - Time info: `text-xs text-slate-500` with Clock icon
  - Urgent time: `text-red-400` with glow-pulse clock
  - Actions: Slide in from right on hover (keep existing pattern)
- Progress bar (bottom): Keep but use lime-based colors
  - Normal: `bg-lime-500/40`
  - Warning: `bg-amber-400`
  - Urgent: `bg-red-400`
  - Track: `bg-white/[0.04]`
- Footer divider: `border-white/[0.06]` instead of solid

### 5.4 Entry Card Styles

**File:** `components/entry/entryCardStyles.ts`

Complete overhaul of `getGroupCardClass()` to return glass-based classes per group.

---

## PHASE 6 — ENTRY FORM (New + Edit)

### 6.1 Form Page Shell

**File:** `components/data-entry/CategoryEntryPageShell.tsx`

Changes:
- Page wrapper: `animate-page-enter`
- Form container: Glass card, large, `rounded-2xl`
- Section dividers: Ghost gradient lines
- Page title: `text-xl font-bold text-white`

### 6.2 Form Controls

**All files in `components/controls/`:**

Every control gets the glass treatment:

- **TextInput, TextArea:** `glass-input` class, lime focus ring, `transition-all duration-200`
- **DateField:** Glass input with custom picker styling, lime accent
- **CurrencyField:** Glass input with currency symbol in `text-lime-400`
- **SelectDropdown:** Glass dropdown, glass menu, lime active option
  - Menu: `glass-surface rounded-xl shadow-2xl shadow-black/40`
  - Options: `hover:bg-white/[0.06]`
  - Active: `bg-lime-500/10 text-lime-400`
  - Arrow keys: Smooth highlight transition
- **FacultySelect:** Same glass treatment as SelectDropdown
- **File upload areas:** Glass card with dashed `border-white/[0.08]`, lime accent on drag-over
  - Drag over state: `border-lime-500/40 bg-lime-500/5`
  - Upload progress: Lime progress bar

### 6.3 Field Wrapper

**File:** `components/data-entry/Field.tsx`

Changes:
- Label: `text-sm font-medium text-slate-300`
- Required asterisk: `text-lime-400` (instead of red)
- Error: `text-red-400 text-xs` with subtle shake animation
- Helper text: `text-xs text-slate-500`
- Spacing: `space-y-1.5` between label and input

### 6.4 Entry Actions Bar

**File:** `components/entry/EntryActionsBar.tsx`

Changes:
- Bar: Sticky bottom, glass surface treatment
- Save button: Glass button, `hover:bg-white/[0.06]`
- Generate button: Lime CTA — `bg-lime-500 text-black font-semibold hover:bg-lime-400 glow-lime`
- Finalise button: Lime CTA with confetti (keep existing celebration animation)
- Request Action dropdown: Glass dropdown
- Disabled state: `opacity-40 cursor-not-allowed`
- Button hover: Subtle lift `translateY(-1px)` + shadow increase

### 6.5 PDF Preview Modal

**File:** `components/data-entry/PdfPreviewModal.tsx`

Changes:
- Overlay: `bg-black/60 backdrop-blur-sm`
- Modal: Glass surface, `rounded-2xl`, `shadow-2xl shadow-black/50`
- Close button: `text-slate-400 hover:text-white hover:bg-white/[0.06]`
- PDF viewer area: Dark inner container
- Download button: Lime CTA

### 6.6 Upload Field

**File:** `components/entry/UploadField.tsx` + `components/uploads/MultiPhotoUpload.tsx`

Changes:
- Upload zone: Glass card, dashed border, lime drag-over
- File preview cards: Glass mini-cards
- Progress bar: Lime fill
- Delete button: `text-red-400 hover:bg-red-500/10`
- File type icon: Colored per type (PDF red, image purple, etc.)

---

## PHASE 7 — ACCOUNT & SETTINGS

### 7.1 Account Page

**File:** `app/(protected)/account/page.tsx` + `components/account/*.tsx`

Changes:
- Tab navigation: Glass pills
  - Active: `bg-lime-500/15 text-lime-400 border-lime-500/20`
  - Hover: `bg-white/[0.06]`
- Profile header: Glass card with avatar (large, round, lime ring on hover)
- Info sections: Glass cards with section headers
- Edit mode fields: Glass inputs
- Save buttons: Lime CTA
- Print button: Glass button

### 7.2 Appearance Settings

**File:** `app/(protected)/settings/appearance/page.tsx`

Changes:
- Theme mode selector: Visual glass cards showing preview of each mode
- Color palette selector: Circular swatches with glass ring on selected
- Language selector: Glass dropdown
- Selected indicators: Lime checkmark or lime ring

---

## PHASE 8 — ADMIN CONSOLE (All Sections)

Same premium glass treatment across all admin pages. No separate admin theme — unified design language.

### 8.1 Admin Dashboard Hub

**File:** `components/admin/AdminConsoleDashboard.tsx`

Changes:
- Tool cards: Glass cards in grid
- Icon containers: Glass circles with tool-specific accent colors
- Health indicators: Glow dots (green/amber/red with `glow-dot`)
- Badge alerts: Lime pill with `animate-subtle-pulse`
- Hover: Glass-card-hover + icon scale

### 8.2 Users Page

**File:** `components/admin/UserManagement.tsx`

Changes:
- Table: Glass surface with glass rows
- Table header: `text-xs uppercase tracking-wider text-slate-500 bg-white/[0.02]`
- Row hover: `bg-white/[0.04]`
- Row borders: `border-white/[0.04]`
- Sort indicators: Lime arrows
- Pagination: Glass pills
- Avatar column: Rounded with colored rings

### 8.3 Analytics Dashboard

**File:** `components/admin/AnalyticsDashboard.tsx` + `components/admin/analytics/AnalyticsChartsCore.tsx`

Changes:
- Chart containers: Glass cards
- Chart background: Transparent (charts float on glass)
- Chart colors: Lime primary, with category-specific colors from registry `chartHex`
- Chart gridlines: `rgba(255, 255, 255, 0.04)`
- Chart labels: `text-slate-400`
- Metric cards (stale PDFs etc.): Glass stat cards matching dashboard style

### 8.4 Confirmations Page

**File:** `app/(protected)/admin/confirmations/page.tsx`

Changes:
- Pending request cards: Glass cards with left border per request type
  - Edit requested: `border-l-2 border-amber-400`
  - Delete requested: `border-l-2 border-red-400`
- Action buttons: Approve (lime CTA), Reject (glass with red text)
- History tab: Glass table rows
- Filters: Glass pills

### 8.5 Audit Dashboard

**File:** `components/admin/AuditDashboard.tsx`

Changes:
- Log entries: Glass rows in timeline layout
- Timestamp: `text-xs text-slate-500 font-mono tabular-nums`
- Action type pills: Glass with color per action
- Filter dropdowns: Glass surface
- Pagination: Glass pills

### 8.6 Export Center

**File:** `app/(protected)/admin/export/page.tsx`

Changes:
- Template cards: Glass cards
- Custom export form: Glass card with glass inputs
- Export button: Lime CTA
- Download history: Glass table

### 8.7 Search (Admin + User)

**Files:** `app/(protected)/admin/search/page.tsx`, `app/(protected)/data-entry/search/page.tsx`

Changes:
- Search input: Large glass input, lime focus, `text-lg`
- Filter chips: Glass pills, lime active
- Results: Glass entry cards
- Empty state: Glass card with search illustration

### 8.8 Remaining Admin Pages

**Files:** Integrity, Maintenance, Backups, Settings, Reset

All follow the same pattern:
- Glass page container
- Glass form cards for actions
- Glass tables for data
- Lime CTAs, ghost borders, slate text hierarchy
- Confirmation dialogs: Glass with backdrop blur
- Danger actions: Red glow instead of lime

---

## PHASE 9 — GLOBAL COMPONENTS

### 9.1 Confirm Dialog

**File:** `components/ui/ConfirmDialog.tsx`

Changes:
- Overlay: `bg-black/60 backdrop-blur-md`
- Dialog: Glass surface, `rounded-2xl shadow-2xl shadow-black/50`
- Title: `text-lg font-semibold text-white`
- Body: `text-sm text-slate-400`
- Cancel button: Glass button
- Confirm button: Lime CTA (or red for destructive)
- Danger variant: Red glow + `animate-dialog-shake` (keep existing)

### 9.2 Error Boundary

**File:** `components/ErrorBoundaryFallback.tsx`

Changes:
- Glass card with red left border
- Error icon: `text-red-400`
- Retry button: Glass button

### 9.3 Network Status Banner

**File:** `components/NetworkStatus.tsx`

Changes:
- Offline: `bg-red-500/15 border-red-500/20 text-red-400` glass bar
- Reconnecting: Amber variant
- Animation: Slide down from top

### 9.4 Navigation Progress Bar

**File:** `components/ui/NavigationProgress.tsx`

Changes:
- Color: Lime gradient `from-lime-500 to-lime-400`
- Glow: `shadow-[0_0_8px_rgba(132,204,22,0.3)]`
- Height: `2px`
- Position: Fixed top, z-[999]

### 9.5 Empty States

All empty states across the app:
- Glass card with dashed `border-white/[0.08]`
- Illustration/icon: `text-slate-600` (muted)
- Text: `text-sm text-slate-500`
- CTA: Lime button or lime text link

---

## PHASE 10 — MICRO-INTERACTIONS & POLISH

### 10.1 Button Ripple Effect

Add a CSS ripple animation to all CTA buttons (lime buttons):
- On click, a radial lime glow expands from click point
- Implemented via `::after` pseudo-element + JS for click position

### 10.2 Page Transitions

All page navigations get:
- Old page: Quick fade out (150ms)
- New page: `animate-page-enter` (400ms fade-in-up with scale)
- Achieved via layout-level transition wrapper

### 10.3 Number Animations

All numeric displays:
- Use `useCountUp` hook (already exists)
- Add `animate-number-pop` when value changes
- Tabular-nums font feature for stable layout

### 10.4 Hover State Audit

Every interactive element:
- Cards: `translateY(-2px)` + shadow increase + border glow
- Buttons: `translateY(-1px)` + shadow + brightness increase
- Links: Color transition to lime
- Icons: Scale 110% on hover
- All transitions: `200ms cubic-bezier(0.16, 1, 0.3, 1)`

### 10.5 Focus States

All focusable elements:
- `focus-visible:ring-2 focus-visible:ring-lime-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]`
- Consistent across inputs, buttons, cards, links

### 10.6 Selection Color

```css
::selection {
  background: rgba(132, 204, 22, 0.25);
  color: #F1F5F9;
}
```

### 10.7 Skeleton Loading States

All loading states use `animate-shimmer` glass effect instead of solid skeleton blocks.

---

## EXECUTION ORDER

This is the safest execution sequence. Each phase is independently deployable.

| Phase | Scope | Risk | Estimated Changes |
|-------|-------|------|-------------------|
| **0** | Design system foundation | LOW — CSS/tokens only | 4 files |
| **1** | App shell | LOW — visual only | 6 files |
| **2** | Sign-in page | ZERO — isolated page | 1 file |
| **3** | Dashboard | LOW — visual only | 5 files |
| **4** | Data entry home | LOW — visual only | 1 file |
| **5** | Entry list cards | LOW — visual only | 4 files |
| **6** | Entry forms | MEDIUM — many controls | 12 files |
| **7** | Account/settings | LOW — visual only | 4 files |
| **8** | Admin pages | LOW — visual only | 10 files |
| **9** | Global components | LOW — visual only | 6 files |
| **10** | Micro-interactions | LOW — CSS/animation | 3 files |

**Total estimated files:** ~56 files (visual/CSS changes only)

---

## SAFETY GUARDRAILS

### Files we NEVER touch:
- `lib/workflow/` — workflow engine
- `lib/entries/` — entry CRUD logic
- `lib/security/` — CSRF, rate limiting, validation
- `lib/api/` — route handlers
- `app/api/` — API routes
- `data/schemas/` — field definitions
- `data/categoryRegistry.ts` — category config (structure only)
- `lib/pdfSnapshot.ts` — hash logic
- `lib/pdf/` — PDF generation
- `lib/jobs/` — nightly jobs
- `lib/auth.ts` — authentication
- `lib/admin/roles.ts` — RBAC
- `hooks/useWorkflowState.ts` — workflow hook
- `lib/data/dataLayer.ts` — storage
- `tests/` — test files

### Rules during redesign:
1. ALL changes are visual (CSS classes, colors, animations, font, spacing)
2. NO changes to component props, state management, or data flow
3. NO changes to i18n keys or translation dictionaries
4. NO changes to API calls, fetch patterns, or SWR hooks
5. NO changes to auth flow, session handling, or redirects
6. KEEP all existing aria-labels, roles, and accessibility attributes
7. KEEP prefers-reduced-motion support for all new animations
8. `npm run build && npm run lint` must pass after every phase
9. Test both light and dark modes after each phase
10. Test mobile responsiveness after each phase

### New CSS variables to add (not replacing, extending):
- `--color-glass-bg`
- `--color-glass-border`
- `--color-glass-hover`
- `--color-glow-primary`
- `--color-glow-success`
- `--color-glow-warning`
- `--color-glow-danger`

---

## VERIFICATION CHECKLIST (per phase)

After each phase:
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Dark mode renders correctly
- [ ] Light mode renders correctly (if applicable)
- [ ] Mobile layout works (320px–768px)
- [ ] Tablet layout works (768px–1024px)
- [ ] Desktop layout works (1024px+)
- [ ] All animations respect `prefers-reduced-motion`
- [ ] No hardcoded colors (all via CSS variables)
- [ ] No hardcoded strings (all via i18n)
- [ ] Focus states visible on all interactive elements
- [ ] Keyboard navigation works
- [ ] No console errors
