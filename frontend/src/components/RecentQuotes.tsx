import React from 'react';
import { FileText, Clock, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

const mockHistory = [
    {
        id: 1,
        date: 'Today, 10:45 AM',
        files: ['fuel_rules.md', 'internal_discounts.md'],
        status: 'Completed',
        cheapest: 'Carrier X',
        amount: '$500 USD',
        route: 'SGN → LAX'
    },
    {
        id: 2,
        date: 'Yesterday, 14:20 PM',
        files: ['Q2_Logistics_Quote.pdf', 'DHL_Special_Offer.docx', 'FedEx_Standard.pdf'],
        status: 'Completed',
        cheapest: 'DHL',
        amount: '$1,200 USD',
        route: 'HAN → SIN'
    },
    {
        id: 3,
        date: 'Mar 08, 09:15 AM',
        files: ['Freight_Forwarder_NYC.pdf'],
        status: 'Failed',
        cheapest: 'N/A',
        amount: '-',
        route: 'Unknown'
    }
];

const RecentQuotes: React.FC = () => {
    return (
        <div className="animate" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white' }}>Recent Quotes</h2>
                    <p style={{ color: 'var(--text-dim)' }}>Review the history of your imported files and previous AI comparison sessions.</p>
                </div>
                <button
                    className="btn-primary"
                    style={{ padding: '0.8rem 1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                >
                    <Zap size={18} /> New Analysis
                </button>
            </div>

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '800px' }}>
                        <thead>
                            <tr>
                                <th>Session Date</th>
                                <th>Files Analyzed</th>
                                <th>Best Option</th>
                                <th>Route</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mockHistory.map((item) => (
                                <tr key={item.id}>
                                    <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                        <Clock size={16} style={{ color: 'var(--text-dim)' }} />
                                        {item.date}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {item.files.map((file, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                                                    <FileText size={14} style={{ color: 'var(--brand-primary)' }} />
                                                    {file}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 'bold', color: item.status === 'Completed' ? 'var(--brand-primary)' : 'var(--text-dim)' }}>{item.cheapest}</div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>{item.amount}</div>
                                    </td>
                                    <td style={{ color: 'var(--text-dim)' }}>{item.route}</td>
                                    <td>
                                        {item.status === 'Completed' ? (
                                            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '1rem', border: '1px solid #10b981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <CheckCircle2 size={12} /> Success
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', borderRadius: '1rem', border: '1px solid #f43f5e', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                Failed
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <button style={{ background: 'none', border: 'none', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, transition: 'color 0.2s' }} className="hover:text-white">
                                            View Report <ArrowRight size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RecentQuotes;
