export function formatMatchDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function calcRating(profile) {
  if (!profile || !profile.matches_played || profile.matches_played === 0) return 5.0;
  const r = 5.5 + ((profile?.goals || 0) / profile.matches_played) * 1.8 + ((profile?.assists || 0) / profile.matches_played) * 1.2;
  if (profile.matches_played >= 20) return Math.min(10, parseFloat((r + 0.3).toFixed(1)));
  return Math.min(10, parseFloat(r.toFixed(1)));
}

export function ratingColor(r) {
  if (r >= 8.5) return '#FFB800';
  if (r >= 7.0) return '#00E096';
  if (r >= 5.5) return '#00D4FF';
  return '#FF4757';
}

export function ratingLabel(r) {
  if (r >= 8.5) return 'Efsane';
  if (r >= 7.0) return 'Harika';
  if (r >= 5.5) return 'İyi';
  return 'Gelişiyor';
}

export function avatarColor(name) {
  const palette = ['#0A1628', '#7C3AED', '#DB2777', '#DC2626', '#0D9488', '#0369A1', '#C2410C', '#0F766E'];
  let hash = 0;
  for (const c of (name || '?')) hash = c.charCodeAt(0) + hash * 31;
  return palette[Math.abs(hash) % palette.length];
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function timeAgo(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60) return 'Az önce';
  if (d < 3600) return `${Math.floor(d / 60)} dk`;
  if (d < 86400) return `${Math.floor(d / 3600)} sa`;
  return `${Math.floor(d / 86400)} gün`;
}
