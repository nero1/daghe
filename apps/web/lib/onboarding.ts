export type CHWProfile = {
  clinicCode?: string;
  chwId?: string;
  consentedAt: string;
};

const CONSENT_KEY = "asibi_consent_v1";
const PROFILE_KEY = "asibi_profile_v1";

export function hasConsented(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CONSENT_KEY) === "true";
}

export function saveProfile(profile: CHWProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, "true");
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getSavedProfile(): CHWProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as CHWProfile; } catch { return null; }
}
