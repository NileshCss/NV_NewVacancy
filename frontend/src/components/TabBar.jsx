export default function TabBar({ tabs = [], activeTab = 0, onTabChange = () => {} }) {
  return (
    <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
      {tabs.map((tab, idx) => (
        <button
          key={idx}
          onClick={() => onTabChange(idx)}
          className={`
            px-4 py-3 whitespace-nowrap font-medium text-sm transition-all
            ${activeTab === idx
              ? 'border-b-2 border-orange-500 text-orange-600'
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          {tab.icon && <span className="mr-2">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
