export default function CardChip({ text, type = 'matched', icon = '' }) {
  const baseClass = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium mr-2 mb-2'
  
  const colorMap = {
    matched:  'bg-green-100 text-green-700 border border-green-300',
    missing:  'bg-red-100 text-red-700 border border-red-300',
    neutral:  'bg-gray-100 text-gray-700 border border-gray-300',
    high:     'bg-red-100 text-red-700 border border-red-300',
    medium:   'bg-yellow-100 text-yellow-700 border border-yellow-300',
    low:      'bg-blue-100 text-blue-700 border border-blue-300',
  }

  return (
    <span className={`${baseClass} ${colorMap[type] || colorMap.neutral}`}>
      {icon && <span>{icon}</span>}
      {text}
    </span>
  )
}
