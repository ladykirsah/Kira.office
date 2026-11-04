import { API_BASE } from "@/lib/config";
import {
  fetchOwnDaysOff,
  fetchOwnProfile,
  type OwnDayOff,
  type OwnProfile,
} from "@/lib/profileApi";
import type { TeamMember } from "../staff/useTeam";
import { useRead } from "../staff/useStaffData";

/** Your own profile, read fresh each time the page comes into view and after each save. */
export function useOwnProfile(stamp = 0) {
  const r = useRead<OwnProfile>((t) => fetchOwnProfile(fetch, API_BASE, t), "me", stamp);
  return { profile: r.value, failed: r.failed, load: r.load };
}

/** Your own days off in a month. */
export function useOwnDaysOff(month: string, stamp = 0) {
  const r = useRead<OwnDayOff[]>((t) => fetchOwnDaysOff(fetch, API_BASE, t, month), month, stamp);
  return { days: r.value, failed: r.failed, load: r.load };
}

/** You, in the shape พนักงาน's pay pages read a person in. */
export const asMember = (p: OwnProfile): TeamMember => ({
  id: p.id,
  name: p.name,
  nameTh: p.nameTh,
  nameEn: p.nameEn,
  role: p.role,
  status: "active",
  lastLoginAt: null,
  lockedUntil: null,
  phone: p.phone,
  hasPhoto: false,
  dayRateSatang: p.dayRateSatang,
});
