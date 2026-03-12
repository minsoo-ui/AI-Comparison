import React, { useState, useEffect } from 'react';
import { FileText, Clock, ArrowRight, Zap, CheckCircle2, Inbox } from 'lucide-react';

interface HistoryEntry {
    id: number;
    date: string;
    files: string[];
    status: string;
    summary: any; // Full analysis result object
}

const RecentQuotes: React.FC<{ setActiveTab?: (tab: string) => void }> = ({ setActiveTab }) => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('quote_history') || '[]');
            setHistory(stored);
        } catch {
            setHistory([]);
        }
    }, []);

    return (
        <div className="animate" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white' }}>Lịch sử Báo giá</h2>
                    <p style={{ color: 'var(--text-dim)' }}>Xem lại lịch sử các phiên so sánh AI trước đó.</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setActiveTab && setActiveTab('dashboard')}
                    style={{ padding: '0.8rem 1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                >
                    <Zap size={18} /> Phân tích Mới
                </button>
            </div>

            {selectedEntry ? (
                // Detail view
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ color: 'white', fontWeight: 700, fontSize: '1.125rem' }}>Chi tiết Phân tích</h3>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>{selectedEntry.date}</p>
                        </div>
                        <button
                            onClick={() => setSelectedEntry(null)}
                            style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid #6366f1', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                            ← Quay lại danh sách
                        </button>
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        <strong style={{ color: 'var(--text-main)' }}>Files đã phân tích:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {selectedEntry.files.map((f, i) => (
                                <span key={i} style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <FileText size={12} /> {f}
                                </span>
                            ))}
                        </div>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-main)', fontSize: '0.8125rem', background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--brand-border)', maxHeight: '500px', overflowY: 'auto' }}>
                        {JSON.stringify(selectedEntry.summary, null, 2)}
                    </pre>
                </div>
            ) : history.length === 0 ? (
                // Empty state
                <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                    <Inbox size={48} style={{ color: 'var(--text-dim)', margin: '0 auto 1rem' }} />
                    <h3 style={{ color: 'white', fontWeight: 600, marginBottom: '0.5rem' }}>Chưa có lịch sử nào</h3>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Thực hiện phân tích báo giá và nhấn <strong>"Lưu vào Lịch sử & Xem"</strong> để lưu kết quả tại đây.
                    </p>
                    <button
                        className="btn-primary"
                        onClick={() => setActiveTab && setActiveTab('dashboard')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}
                    >
                        <Zap size={18} /> Bắt đầu Phân tích
                    </button>
                </div>
            ) : (
                // Table with real data
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ minWidth: '800px' }}>
                            <thead>
                                <tr>
                                    <th>Ngày thực hiện</th>
                                    <th>File đã Phân tích</th>
                                    <th>Số file</th>
                                    <th>Trạng thái</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item) => (
                                    <tr key={item.id}>
                                        <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                            <Clock size={16} style={{ color: 'var(--text-dim)' }} />
                                            {item.date}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                {item.files.slice(0, 3).map((file, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                                                        <FileText size={14} style={{ color: 'var(--brand-primary)' }} />
                                                        <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</span>
                                                    </div>
                                                ))}
                                                {item.files.length > 3 && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>+{item.files.length - 3} file khác</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                            {item.files.length} file
                                        </td>
                                        <td>
                                            {item.status === 'Completed' ? (
                                                <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '1rem', border: '1px solid #10b981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <CheckCircle2 size={12} /> Thành công
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', borderRadius: '1rem', border: '1px solid #f43f5e' }}>
                                                    Thất bại
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => setSelectedEntry(item)}
                                                style={{ background: 'none', border: 'none', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, transition: 'color 0.2s' }}
                                                className="hover:text-white"
                                            >
                                                Xem Báo cáo <ArrowRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecentQuotes;
