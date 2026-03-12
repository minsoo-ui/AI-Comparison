import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ComparativeDashboard from './components/ComparativeDashboard'
import RecentQuotes from './components/RecentQuotes'
import HSCodeSearch from './components/HSCodeSearch'
import Database from './components/Database'
import { Bell } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard'
  })

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="main-content">
        <header className="header glass p-4 rounded-2xl mb-8 flex justify-between items-center">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>Pages /</span>
            <span style={{ fontWeight: 600 }}>
              {activeTab === 'dashboard' ? 'Bảng điều khiển So sánh' :
                activeTab === 'history' ? 'Lịch sử Báo giá' :
                  activeTab === 'hscode' ? 'Tra cứu HS Code' : 'Cơ sở dữ liệu'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ color: 'var(--text-dim)', position: 'relative', cursor: 'pointer' }}>
              <Bell size={20} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', background: '#f43f5e', borderRadius: '50%', border: '2px solid var(--brand-dark)' }}></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(51, 65, 85, 0.3)', padding: '0.4rem 1rem', borderRadius: '2rem', border: '1px solid var(--brand-border)', cursor: 'pointer' }}>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'linear-gradient(45deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                TP
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Anh Toàn</span>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Keep ComparativeDashboard always mounted - use CSS to show/hide */}
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <ComparativeDashboard setActiveTab={setActiveTab} />
          </div>
          {activeTab === 'history' && <RecentQuotes setActiveTab={setActiveTab} />}
          {activeTab === 'hscode' && <HSCodeSearch />}
          {activeTab === 'database' && <Database />}
        </div>
      </main>
    </div>
  )
}

export default App

