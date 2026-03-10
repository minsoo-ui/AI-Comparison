import React, { useState } from 'react';
import { Search, Loader2, Calculator, ShieldCheck } from 'lucide-react';
import axios from 'axios';

const HSCodeSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        setLoading(true);
        try {
            const response = await axios.get(`http://localhost:3001/hscode/search?q=${query}`);
            setResult(response.data);
        } catch (error) {
            console.error('Search failed', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white' }}>Tra cứu HS Code Thông minh</h2>
                <p style={{ color: 'var(--text-dim)' }}>Tìm mã HS chính xác nhất và tính thuế nhập khẩu tức thì.</p>
            </div>

            <div className="card" style={{ maxWidth: '40rem' }}>
                <form onSubmit={handleSearch} style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} size={20} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Mô tả mặt hàng (Vd: Laptop, Linh kiện điện tử...)"
                        className="input-search"
                    />
                    <button
                        disabled={loading}
                        className="btn-primary"
                        style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Tìm kiếm'}
                    </button>
                </form>
            </div>

            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }} className="animate">
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-secondary)', fontWeight: 600, marginBottom: '1.5rem' }}>
                            <ShieldCheck size={20} />
                            <span>Kết quả Phù hợp</span>
                        </div>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontStyle: 'italic', marginBottom: '0.25rem' }}>Mô tả Mặt hàng</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{result.item}</p>

                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--brand-border)', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Mã HS gợi ý</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--brand-primary)', fontFamily: 'monospace' }}>{result.suggestedHSCode}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Độ tin cậy</p>
                                <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>{(result.confidence * 100).toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', fontWeight: 600, marginBottom: '1.5rem' }}>
                            <Calculator size={20} />
                            <span>Ước tính Thuế</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <span style={{ color: 'var(--text-dim)' }}>Thuế Nhập khẩu Tiêu chuẩn</span>
                            <span style={{ fontWeight: 'bold' }}>{result.taxRate}</span>
                        </div>
                        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--brand-border)' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textDecoration: 'underline' }}>Ví dụ tính toán (Giá trị 1,000 USD)</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                <span>Tổng cộng sau thuế:</span>
                                <span style={{ color: 'var(--brand-primary)' }}>1,100 USD</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HSCodeSearch;
