// ─── Paylaşılan yardımcı fonksiyonlar ────────────────────────────────────────

export function calcRating(p) {
  if (!p || !p.matches_played) return 5.0;
  const r = 5.5 + (p.goals / p.matches_played) * 1.8 + (p.assists / p.matches_played) * 1.2;
  if (p.matches_played >= 20) return Math.min(10, parseFloat((r + 0.3).toFixed(1)));
  return Math.min(10, parseFloat(r.toFixed(1)));
}

export function ratingColor(r) {
  if (r >= 8.5) return '#C9A84C';
  if (r >= 7.0) return '#10B981';
  if (r >= 5.5) return '#3B82F6';
  return '#EF4444';
}

export function avatarColor(name) {
  const p = ['#001F5B', '#7C3AED', '#DB2777', '#DC2626', '#0D9488', '#0369A1', '#C2410C', '#0F766E'];
  let h = 0;
  for (let c of (name || '?')) h = c.charCodeAt(0) + h * 31;
  return p[Math.abs(h) % p.length];
}

export function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase();
}

export function timeAgo(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60) return 'Az önce';
  if (d < 3600) return `${Math.floor(d / 60)} dk`;
  if (d < 86400) return `${Math.floor(d / 3600)} sa`;
  return `${Math.floor(d / 86400)} gün`;
}

export function getLevel(profile) {
  const m = profile?.matches_played || 0;
  const g = profile?.goals || 0;
  if (m >= 50 || g >= 50) return { title: 'Efsane', color: '#F59E0B', next: null };
  if (m >= 30 || g >= 30) return { title: 'Pro',    color: '#8B5CF6', next: 50 - m };
  if (m >= 10 || g >= 10) return { title: 'Amatör', color: '#3B82F6', next: 30 - m };
  return { title: 'Acemi', color: '#64748B', next: 10 - m };
}

export function formatMatchDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const dayStr  = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
  const timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${dayStr} · ${timeStr}`;
}

export function ratingLabel(r) {
  if (r >= 9.0) return 'Efsane';
  if (r >= 8.0) return 'Harika';
  if (r >= 7.0) return 'İyi';
  if (r >= 6.0) return 'Orta';
  return 'Acemi';
}
