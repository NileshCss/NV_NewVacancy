export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const mins = Math.floor(diff/60000), hrs = Math.floor(mins/60), days = Math.floor(hrs/24);
  if(mins < 60) return `${mins}m ago`;
  if(hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}
export function daysLeft(dateStr) {
  if(!dateStr) return null;
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
}
export function fmtDate(dateStr) {
  if(!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}
