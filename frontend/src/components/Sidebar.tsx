import React from 'react';
import { LayoutDashboard, Search, FileText, Settings, Database as DatabaseIcon } from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
    const menuItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Comparative Dashboard' },
        { id: 'history', icon: FileText, label: 'Recent Quotes' },
        { id: 'hscode', icon: Search, label: 'HSCode Search' },
        { id: 'database', icon: DatabaseIcon, label: 'Database' },
    ];

    return (
        <div className="sidebar glass">
            <div className="logo-area">
                <div className="logo-icon">
                    <LayoutDashboard size={20} />
                </div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>QuoteAgent</h1>
            </div>

            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                    >
                        <item.icon size={20} />
                        <span style={{ fontSize: '0.9375rem' }}>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--brand-border)' }}>
                <button className="nav-item">
                    <Settings size={20} />
                    <span>Settings</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
