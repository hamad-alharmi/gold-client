export const LOADER_COLORS = { vanilla:'text-dark-400', fabric:'text-blue-400', forge:'text-purple-400', quilt:'text-green-400' };
export const LOADER_LABELS = { vanilla:'Vanilla', fabric:'Fabric', forge:'Forge', quilt:'Quilt' };

export function formatPlaytime(seconds) {
  if (!seconds || seconds < 60) return '< 1 min';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(isoDate) {
  if (!isoDate) return 'Never';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000), hrs = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(0)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

export function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

export function seedColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return ['#f59e0b','#3b82f6','#22c55e','#a855f7','#ef4444','#f97316','#06b6d4'][Math.abs(h) % 7];
}
