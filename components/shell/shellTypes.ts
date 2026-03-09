export type ProfileSummary = {
  email?: string;
  officialName?: string;
  userPreferredName?: string;
  googleName?: string;
  googlePhotoURL?: string;
  designation?: string;
};

export function getInitials(name: string, email: string) {
  const source = name.trim() || email.split("@")[0] || "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
