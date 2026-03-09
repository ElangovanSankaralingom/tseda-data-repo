# TSEDA REPO — RAW URL INDEX
# Paste any section below into Claude chat to unlock those files
# Base: https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main
# Total sections: 25


============================================================
## ROOT CONFIG & DOCS
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/CLAUDE.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/ARCHITECTURE.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/API.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/AUDIT.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/CHANGELOG.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/CONTRIBUTING.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/DATA_MODEL.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/DESIGN_SYSTEMS.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/PROMPT-ENGINEERING-FRAMEWORK.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/README.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/STREAK-SPECIFICATION.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/tseda-url-index.md
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/package.json
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/tsconfig.json
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/next.config.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/middleware.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/eslint.config.mjs
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/postcss.config.mjs
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/.env.example
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/.gitignore
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components.json

============================================================
## ENTRY LIFECYCLE (source of truth)
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entries/workflow.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entries/internal/engine.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entries/lifecycle.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entries/postSave.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entries/generate.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entries/summary.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entries/types.ts

============================================================
## STREAK SYSTEM
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/streakProgress.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/streakDeadline.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/streakState.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/streakTiming.ts

============================================================
## PDF SYSTEM
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/pdf/pdfService.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/pdfSnapshot.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entry-pdf.ts

============================================================
## DASHBOARD
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/dashboard/getDashboardSummary.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/dashboard/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/dashboard/loading.tsx

============================================================
## ENTRY CATEGORIZATION & GROUPING
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entryCategorization.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entryNavigation.ts

============================================================
## 5 CATEGORY API ROUTES (must stay in sync)
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/me/fdp-attended/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/me/fdp-conducted/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/me/guest-lectures/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/me/case-studies/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/me/workshops/route.ts

============================================================
## 5 CATEGORY ADAPTERS (must stay in sync)
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/data-entry/adapters/fdp-attended.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/data-entry/adapters/fdp-conducted.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/data-entry/adapters/guest-lectures.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/data-entry/adapters/case-studies.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/data-entry/adapters/workshops.tsx

============================================================
## UI COMPONENTS — Entry Editor
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/entry/EntryActionsBar.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/data-entry/CategoryEntryRecordCard.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/data-entry/GroupedEntrySections.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/data-entry/EditorProgressHeader.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/data-entry/EditorStatusBanner.tsx

============================================================
## HOOKS
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useCategoryEntryPageController.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useEntryWorkflow.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useEntryEditor.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useEntryViewMode.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useEntryFormAccess.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useEntryPrimaryActions.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useEntryConfirmation.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useGenerateEntry.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useCommitDraft.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useDirtyTracker.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useAutoSave.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useConfirmAction.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useCountUp.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useOptimisticAction.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useRefreshOnFocus.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useRequestDelete.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useRequestEdit.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useRevalidate.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useSeedEntry.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useUnsavedChanges.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useUnsavedChangesGuard.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useUploadController.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/hooks/useEntryPageModeTelemetry.ts

============================================================
## LIB — Core Utilities
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/auth.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/admin.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/categories.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/categoryRequirements.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/categoryStore.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/confirmation.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/crosspost.server.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/dataStore.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/errors.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/logger.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/mergeWithNulls.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/normalize.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/pendingImmutability.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/profileStore.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/requestEditWindow.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/result.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/safeAction.ts
# (directory — list individual files as needed): lib/security/
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/storage.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/student-academic.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/time.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/uploadStore.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/userStore.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/utils.ts
# (directory — list individual files as needed): lib/validation/
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/validationStages.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/generateEntryPipeline.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/entrySharing.server.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/faculty-directory.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/facultyDirectory.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/institutions-in.ts

============================================================
## LIB — Admin
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/admin/auditLog.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/admin/integrity.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/admin/pendingConfirmations.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/admin/roles.ts

============================================================
## LIB — Analytics & Telemetry
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/analytics/cache.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/analytics/compare.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/analytics/compute.ts

============================================================
## LIB — Backup & Export & Maintenance
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/lib/backup/backupService.ts
# (directory — list individual files as needed): lib/export/
# (directory — list individual files as needed): lib/maintenance/
# (directory — list individual files as needed): lib/migrations/

============================================================
## LIB — Confirmations & Gamification
============================================================
# (directory — list individual files as needed): lib/confirmations/
# (directory — list individual files as needed): lib/gamification/

============================================================
## LIB — Types
============================================================
# (directory — list individual files as needed): lib/types/

============================================================
## LIB — Data & Server & Settings
============================================================
# (directory — list individual files as needed): lib/data/
# (directory — list individual files as needed): lib/server/
# (directory — list individual files as needed): lib/settings/
# (directory — list individual files as needed): lib/search/

============================================================
## LIB — UI & Upload
============================================================
# (directory — list individual files as needed): lib/ui/
# (directory — list individual files as needed): lib/upload/

============================================================
## ADMIN API ROUTES
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/dashboard/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/confirmations/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/analytics/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/audit/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/reset/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/notifications/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/notifications/unread-count/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/notifications/read-all/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/notifications/announce/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/entries/archive/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/entries/restore/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/export/entries/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/export/preview/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/export/templates/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/integrity/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/integrity/scan/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/integrity/repair/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/maintenance/backup/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/maintenance/cleanup/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/maintenance/migrate/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/admin/settings/route.ts

============================================================
## OTHER API ROUTES
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/me/[category]/overview/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/auth/[...nextauth]/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/cron/nightly/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/debug/session/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/faculty/route.ts
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/api/file/route.ts

============================================================
## ADMIN PAGES
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/layout.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/confirmations/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/confirmations/AdminConfirmationsClient.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/analytics/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/audit/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/export/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/integrity/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/maintenance/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/search/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/settings/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/users/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/admin/backups/page.tsx

============================================================
## DATA ENTRY PAGES
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/fdp-attended/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/fdp-attended/[id]/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/fdp-attended/new/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/fdp-conducted/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/fdp-conducted/[id]/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/fdp-conducted/new/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/guest-lectures/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/guest-lectures/[id]/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/guest-lectures/new/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/case-studies/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/case-studies/[id]/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/case-studies/new/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/workshops/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/workshops/[id]/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/workshops/new/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/data-entry/search/page.tsx

============================================================
## OTHER PAGES & SHELL
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/layout.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/error.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/shell.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/account/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/account/print/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/(protected)/reset/page.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/app/ShellClient.tsx

============================================================
## COMPONENTS — Admin
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/admin/AdminConsoleDashboard.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/admin/AdminExportForm.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/admin/AdminPageShell.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/admin/AnalyticsDashboard.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/admin/AuditDashboard.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/admin/ExportDashboard.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/admin/IntegrityDashboard.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/admin/MaintenanceDashboard.tsx
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/admin/SettingsDashboard.tsx

============================================================
## COMPONENTS — Other
============================================================
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/components/AvatarMenu.tsx
# (directory — list individual files as needed): components/confirmations/
# (directory — list individual files as needed): components/controls/
# (directory — list individual files as needed): components/dashboard/
# (directory — list individual files as needed): components/faculty/
# (directory — list individual files as needed): components/gamification/
# (directory — list individual files as needed): components/layout/
# (directory — list individual files as needed): components/nav/
# (directory — list individual files as needed): components/search/
# (directory — list individual files as needed): components/upload/
# (directory — list individual files as needed): components/uploads/
# (directory — list individual files as needed): components/ui/


# TOTAL FILES: 190
# TIP: Paste a whole section at once to unlock all files in that group