export function formatMatchDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export function hashColor(name) {
  const colors = ['#1a3a5c','#1a4c3a','#3a1a4c','#4c1a1a','#1a3a3a','#3a3a1a','#2a1a4c','#1a2a3a'];
  let h = 0;
  for (const c of (name || '')) h = c.charCodeAt(0) + h * 31;
  return colors[Math.abs(h) % colors.length];
}

export function hoursFromNow(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  const hours = Math.round(diff / 3600000);
  if (hours < 0) return 'Geçmiş';
  if (hours < 1) return 'Az sonra';
  if (hours < 24) return hours + ' saat sonra';
  const days = Math.round(hours / 24);
  return days + ' gün sonra';
}

export const FORMAT_COLORS = {
  '5v5': '#00E096', '6v6': '#00D4FF',
  '7v7': '#7C3AED', '8v8': '#FFB800',
};

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
