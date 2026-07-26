// Doctor/nurse work-schedule helpers. Côte d'Ivoire is UTC+0 year-round (no DST),
// so the server's own clock (Vercel runs in UTC) already matches clinic-local
// wall-clock time — no timezone conversion needed.
//
// work_schedule shape (JSONB column on users): array of per-day entries,
// e.g. [{ day: 1, off: false, start: '08:40', end: '17:15' }, { day: 6, off: true }, ...]
// day: 0=Sunday..6=Saturday (JS Date.getDay() convention). A day not present
// in the array is treated the same as { off: true } for that day.

// user: needs { role, work_schedule }
function isWithinSchedule(user, now = new Date()) {
  if (user.role !== 'doctor' && user.role !== 'nurse') return true;

  const schedule = user.work_schedule;
  // No schedule configured yet — don't force existing/unconfigured accounts to "away".
  if (!Array.isArray(schedule) || schedule.length === 0) return true;

  const entry = schedule.find(e => e.day === now.getDay());
  if (!entry || entry.off || !entry.start || !entry.end) return false;

  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return hhmm >= entry.start.slice(0, 5) && hhmm <= entry.end.slice(0, 5);
}

// Returns the availability status that should actually be shown/trusted:
// outside the configured schedule, a doctor/nurse is always "away" regardless
// of whatever manual status is stored (they can't be manually "available"
// outside their work hours). Within schedule, the manual status applies.
function computeEffectiveAvailability(user, now = new Date()) {
  if (user.role !== 'doctor' && user.role !== 'nurse') return user.availability_status;
  if (!isWithinSchedule(user, now)) return 'away';
  return user.availability_status || 'available';
}

module.exports = { isWithinSchedule, computeEffectiveAvailability };
