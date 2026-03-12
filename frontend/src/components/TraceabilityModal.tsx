import React, { useEffect, useRef, useState } from 'react';
import { X, Search, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

// Cần cấu hình worker cho pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface TraceabilityData {
    carrier: string;
    sourceFile: string; // Tên file hiển thị
    filename?: string;  // Tên file thực tế trên server
    field: string;
    value: any;
    confidence: number;
    bbox?: { x: number; y: number; w: number; h: number; page: number };
}

interface TraceabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: TraceabilityData | null;
}

const TraceabilityModal: React.FC<TraceabilityModalProps> = ({ isOpen, onClose, data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && data && data.bbox && data.filename) {
            renderPDF();
        }
    }, [isOpen, data]);

    const renderPDF = async () => {
        if (!data || !data.bbox || !data.filename || !canvasRef.current) return;

        setLoading(true);
        setError(null);

        try {
            const url = `http://localhost:3000/uploads/${data.filename}`;
            const loadingTask = pdfjs.getDocument(url);
            const pdf = await loadingTask.promise;
            
            // Lấy trang tương ứng
            const pageNumber = data.bbox.page || 1;
            const page = await pdf.getPage(pageNumber);
            
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            if (!context) return;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext: any = {
                canvasContext: context,
                viewport: viewport,
            };

            await page.render(renderContext).promise;

            // Vẽ Bounding Box highlight
            // Lưu ý: Tọa độ từ PaddleOCR thường là pixel hoặc tỷ lệ. 
            // Ở đây ta giả định là tọa độ viewport hoặc cần scale.
            // Để đơn giản, ta vẽ một lớp phủ nửa trong suốt.
            const { x, y, w, h } = data.bbox;
            
            context.strokeStyle = '#818cf8';
            context.lineWidth = 3;
            context.fillStyle = 'rgba(99, 102, 241, 0.2)';
            
            // Vẽ hình chữ nhật
            context.strokeRect(x, y, w, h);
            context.fillRect(x, y, w, h);

            // Vẽ nhãn nhỏ bên cạnh
            context.fillStyle = '#818cf8';
            context.font = 'bold 12px Inter, sans-serif';
            context.fillText(`AI MATCH: ${data.field}`, x, y - 5);

            setLoading(false);
        } catch (err: any) {
            console.error('Error rendering PDF:', err);
            setError('Không thể tải hoặc hiển thị file PDF.');
            setLoading(false);
        }
    };

    if (!isOpen || !data) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                background: '#0f172a', width: '90%', maxWidth: '800px', maxHeight: '90vh',
                borderRadius: '1.25rem', border: '1px solid var(--brand-border)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--brand-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: '#818cf8' }}>
                            <Search size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', margin: 0 }}>Xác minh Dữ liệu Gốc</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>Kiểm tra tọa độ và nguồn trích xuất của AI</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.5rem', transition: 'color 0.2s' }} className="hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
                    {/* Left: Info Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '0.75rem', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Field / Trường dữ liệu</p>
                            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--brand-primary)' }}>{data.field}</p>
                        </div>

                        <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '0.75rem', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Extracted Value / Giá trị AI trích xuất</p>
                            <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white' }}>{typeof data.value === 'object' ? JSON.stringify(data.value) : data.value}</p>
                        </div>

                        <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '0.75rem', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Confidence / Độ tin cậy</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ flex: 1, height: '6px', background: 'var(--brand-dark)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        width: `${data.confidence * 100}%`, 
                                        height: '100%', 
                                        background: data.confidence > 0.8 ? '#10b981' : data.confidence > 0.5 ? '#f59e0b' : '#f43f5e' 
                                    }}></div>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: data.confidence > 0.8 ? '#10b981' : 'var(--text-dim)' }}>
                                    {(data.confidence * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--brand-dark)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                            <FileText size={16} style={{ color: 'var(--brand-primary)' }} />
                            <div style={{ overflow: 'hidden' }}>
                                <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', margin: 0 }}>Source File</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-main)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{data.sourceFile}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Visual Bbox Preview */}
                    <div style={{ background: 'var(--brand-dark)', borderRadius: '0.75rem', border: '1px solid var(--brand-border)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
                        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--brand-border)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>MINH BẠCH AI (TRỰC QUAN HÓA)</span>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>AI Matched</span>
                        </div>
                        
                        <div style={{ flex: 1, position: 'relative', overflow: 'auto', background: '#1e293b', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem' }}>
                            {loading && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.8)', zIndex: 10 }}>
                                    <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', marginBottom: '1rem' }} />
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>Đang render trang tài liệu...</p>
                                </div>
                            )}

                            {error ? (
                                <div style={{ textAlign: 'center', color: '#f43f5e', padding: '2rem' }}>
                                    <AlertCircle size={32} style={{ marginBottom: '1rem' }} />
                                    <p style={{ fontSize: '0.875rem' }}>{error}</p>
                                    <button onClick={renderPDF} style={{ marginTop: '1rem', background: 'none', border: '1px solid #f43f5e', color: '#f43f5e', padding: '0.4rem 1rem', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}>Thử lại</button>
                                </div>
                            ) : data.bbox ? (
                                <canvas ref={canvasRef} style={{ maxWidth: '100%', boxShadow: '0 0 20px rgba(0,0,0,0.5)', borderRadius: '2px' }} />
                            ) : (
                                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                                    <AlertCircle size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                    <p style={{ fontSize: '0.8125rem' }}>Không tìm thấy tọa độ trích xuất cho trường này.</p>
                                </div>
                            )}
                        </div>
                        
                        <div style={{ padding: '0.75rem', fontSize: '0.7rem', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--brand-border)' }}>
                            <CheckCircle size={10} style={{ marginRight: '0.25rem', color: '#10b981' }} /> 
                            Chứng thực bởi PaddleOCR & Qwen3 Pipeline.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--brand-border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(15, 23, 42, 0.5)' }}>
                    <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1.5rem' }}>Đóng</button>
                    <button className="btn-primary" style={{ padding: '0.5rem 1.5rem', marginLeft: '1rem' }} onClick={() => window.print()}>In Chứng minh</button>
                </div>
            </div>
        </div>
    );
};

export default TraceabilityModal;
