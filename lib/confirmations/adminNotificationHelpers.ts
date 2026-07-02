// ---------------------------------------------------------------------------
// Admin Notification generation helpers — fire-and-forget, never blocks
// ---------------------------------------------------------------------------

import { addAdminNotification } from "./adminNotificationStore";
import type { AdminNotification, AdminNotificationType } from "./types";
import { canManageEditRequests } from "@/lib/admin/roles";
import { getCoordinatorScope, canCoordinatorApproveEdit } from "@/lib/admin/coordinators";

/**
 * Fire-and-forget admin notification creation. Logs errors but never throws.
 */
export async function notifyAdmins(
  type: AdminNotificationType,
  title: string,
  message: string,
  options?: {
    actionUrl?: string;
    actionLabel?: string;
    triggeredBy?: string;
    triggeredByName?: string;
    categoryKey?: string;
  },
): Promise<void> {
  try {
    await addAdminNotification({
      type,
      title,
      message,
      actionUrl: options?.actionUrl,
      actionLabel: options?.actionLabel,
      triggeredBy: options?.triggeredBy,
      triggeredByName: options?.triggeredByName,
      categoryKey: options?.categoryKey,
    });
  } catch {
    // Never block the primary operation
  }
}

/**
 * Scope the admin notification feed for a viewer.
 *
 * - Global approvers (master/reviewer) and any other admin role see everything
 *   (unchanged behaviour).
 * - A *pure* coordinator (edit-approval scope but NOT a global approver) sees
 *   ONLY edit-request notifications in their assigned categories — never delete
 *   requests, other categories, or admin-wide notices.
 */
export function filterVisibleAdminNotifications(
  notifications: AdminNotification[],
  email: string,
): AdminNotification[] {
  const scope = getCoordinatorScope(email);
  const isPureCoordinator = scope.approveEdits && !canManageEditRequests(email);
  if (!isPureCoordinator) return notifications;

  // Per-type: only edit-request notices in categories where this person actually
  // holds the approveEdits power (not merely any category they touch).
  return notifications.filter(
    (n) => n.type === "edit_request" && !!n.categoryKey && canCoordinatorApproveEdit(email, n.categoryKey),
  );
}

/** Notify admins that a user requested edit access. */
export async function notifyAdminEditRequest(
  ownerEmail: string,
  ownerName: string | undefined,
  entryTitle: string,
  categoryKey: string,
   
  _entryId: string,
): Promise<void> {
  const displayName = ownerName || ownerEmail.split("@")[0];
  await notifyAdmins(
    "edit_request",
    "Edit request",
    `${displayName} requested edit access for '${entryTitle}'`,
    {
      actionUrl: "/admin/confirmations",
      actionLabel: "Review",
      triggeredBy: ownerEmail,
      triggeredByName: displayName,
      categoryKey,
    },
  );
}

/** Notify admins that a user requested deletion. */
export async function notifyAdminDeleteRequest(
  ownerEmail: string,
  ownerName: string | undefined,
  entryTitle: string,
  categoryKey: string,
   
  _entryId: string,
): Promise<void> {
  const displayName = ownerName || ownerEmail.split("@")[0];
  await notifyAdmins(
    "delete_request",
    "Delete request",
    `${displayName} requested deletion for '${entryTitle}'`,
    {
      actionUrl: "/admin/confirmations",
      actionLabel: "Review",
      triggeredBy: ownerEmail,
      triggeredByName: displayName,
      categoryKey,
    },
  );
}

/** Notify admins that a new user registered. */
export async function notifyAdminNewUser(
  email: string,
  name?: string,
): Promise<void> {
  const displayName = name || email.split("@")[0];
  await notifyAdmins(
    "new_user",
    "New user",
    `${displayName} (${email}) signed in for the first time`,
    {
      actionUrl: `/admin/users/${encodeURIComponent(email)}`,
      actionLabel: "View profile",
      triggeredBy: email,
      triggeredByName: displayName,
    },
  );
}

/** Notify admins of a system error. */
export async function notifyAdminSystemError(
  operation: string,
  errorMessage: string,
): Promise<void> {
  await notifyAdmins(
    "system_error",
    "System error",
    `Error in ${operation}: ${errorMessage}`,
  );
}
