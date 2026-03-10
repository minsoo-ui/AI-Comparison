import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, FileText, Zap, UploadCloud, XCircle, Timer, AlertCircle, Send, Bot } from 'lucide-react';
import axios from 'axios';

const ComparativeDashboard: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [comparing, setComparing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [aiProgress, setAiProgress] = useState(0);
    const [aiTime, setAiTime] = useState(0);

    // Init state from localStorage - survives F5 refresh
    const [result, setResult] = useState<any>(() => {
        try {
            const saved = localStorage.getItem('comparative_result');
            if (saved) {
                console.log('[Dashboard] Restored result from localStorage');
                return JSON.parse(saved);
            }
        } catch (e) { console.warn('[Dashboard] Failed to parse saved result:', e); }
        return null;
    });
    const [savedFileNames, setSavedFileNames] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('comparative_files');
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return [];
    });
    const [errorMsg, setErrorMsg] = useState('');
    const [isConfirmingClear, setIsConfirmingClear] = useState(false);

    // AI Chat State
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', content: string }[]>(() => {
        try {
            const saved = localStorage.getItem('comparative_chat');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Clean out old Mock Mode messages from cache
                const cleaned = parsed.filter((m: any) =>
                    !m.content.toLowerCase().includes('mock mode') &&
                    !m.content.toLowerCase().includes('chế độ thử nghiệm')
                );
                if (cleaned.length > 0) return cleaned;
            }
        } catch (e) { /* ignore */ }
        return [
            { role: 'ai', content: 'Xin chào! Tôi là Logistics Co-Pilot. Bạn cần hỏi gì về báo giá?' }
        ];
    });
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // AI Health Status
    const [aiStatus, setAiStatus] = useState<{ online: boolean; model: string }>({ online: false, model: 'unknown' });

    // Traceability Panel State
    const [tracePanelData, setTracePanelData] = useState<any>(null);

    // Ping AI health check on mount + every 30s
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await axios.get('http://localhost:3001/health/ai', { timeout: 5000 });
                setAiStatus(res.data);
            } catch {
                setAiStatus({ online: false, model: 'unreachable' });
            }
        };
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    // Save result to localStorage (only when result actually has data)
    useEffect(() => {
        if (result) {
            try {
                localStorage.setItem('comparative_result', JSON.stringify(result));
                console.log('[Dashboard] Saved result to localStorage');
            } catch (e) { console.warn('[Dashboard] Failed to save result:', e); }
        }
    }, [result]);

    // Save file names separately - only when files are present (avoid overwriting with empty)
    useEffect(() => {
        if (files.length > 0) {
            const names = files.map(f => f.name);
            localStorage.setItem('comparative_files', JSON.stringify(names));
            setSavedFileNames(names);
        }
    }, [files]);

    // Save chat messages
    useEffect(() => {
        if (chatMessages.length > 1) {
            localStorage.setItem('comparative_chat', JSON.stringify(chatMessages));
        }
    }, [chatMessages]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Auto-scroll chat
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    // Chặn F5 (Refresh) hoặc tắt tab khi AI đang xử lý dở dang
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (comparing) {
                e.preventDefault();
                e.returnValue = ''; // Trigger browser's native warning dialog
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [comparing]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const startCompare = async () => {
        if (files.length === 0) {
            setErrorMsg('Vui lòng chọn ít nhất 1 file báo giá (PDF/Word).');
            return;
        }

        setComparing(true);
        setUploadProgress(0);
        setAiProgress(0);
        setAiTime(0);
        setResult(null);
        setErrorMsg('');

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const startTime = Date.now();
        timerRef.current = setInterval(() => {
            setAiTime(Math.floor((Date.now() - startTime) / 1000));
            setAiProgress(prev => {
                if (prev >= 95) return 95;
                return prev + (95 - prev) * 0.05; // Tăng chậm dần
            });
        }, 1000);

        try {
            // 1. Upload Files
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));

            const uploadRes = await axios.post('http://localhost:3001/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                    setUploadProgress(percentCompleted);
                },
                signal: abortController.signal
            });

            const filePaths = uploadRes.data.paths;

            // 2. Analyze
            const response = await axios.post('http://localhost:3001/quote/compare', {
                filePaths
            }, {
                signal: abortController.signal
            });

            setAiProgress(100);
            if (timerRef.current) clearInterval(timerRef.current);
            setResult(response.data);

        } catch (error: any) {
            if (axios.isCancel(error)) {
                setErrorMsg('Tiến trình AI đã bị hủy bởi người dùng.');
            } else {
                console.error('Comparison failed', error);
                setErrorMsg('Xảy ra lỗi trong quá trình phân tích. Vui lòng thử lại.');
            }
        } finally {
            if (timerRef.current) clearInterval(timerRef.current);
            setComparing(false);
            abortControllerRef.current = null;
        }
    };

    const handleClearData = () => {
        if (!isConfirmingClear) {
            setIsConfirmingClear(true);
            setTimeout(() => {
                setIsConfirmingClear(false);
            }, 3000); // Tự hủy trạng thái xác nhận sau 3 giây
            return;
        }

        console.log('[Dashboard] Clearing localStorage and state...');
        localStorage.removeItem('comparative_result');
        localStorage.removeItem('comparative_files');
        localStorage.removeItem('comparative_chat');
        setResult(null);
        setFiles([]);
        setSavedFileNames([]);
        setChatMessages([{ role: 'ai', content: 'Xin chào! Tôi là Logistics Co-Pilot. Bạn cần hỏi gì về báo giá?' }]);
        setUploadProgress(0);
        setAiProgress(0);
        setAiTime(0);
        setIsConfirmingClear(false);
        console.log('[Dashboard] Clear complete');
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setChatInput('');
        setIsChatting(true);

        try {
            const response = await axios.post('http://localhost:3001/quote/chat', {
                message: userMsg,
                history: chatMessages.slice(-6),
                context: result || null,
            });
            setChatMessages(prev => [...prev, { role: 'ai', content: response.data.reply }]);
        } catch (error) {
            console.error('Chat failed', error);
            setChatMessages(prev => [...prev, { role: 'ai', content: 'Xin lỗi, hệ thống AI đang bận. Vui lòng thử lại sau.' }]);
        } finally {
            setIsChatting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="animate" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>Phân tích & So sánh Báo giá</h2>
                    <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem' }}>Tải lên nhiều file báo giá để so sánh chi phí và hiệu suất tức thì bằng AI.</p>

                    {/* File Upload Area */}
                    <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '2px dashed var(--brand-border)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '50%', color: '#818cf8' }}>
                                <UploadCloud size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <input type="file" multiple id="file-upload" style={{ display: 'none' }} onChange={handleFileChange} disabled={comparing} />
                                <label htmlFor="file-upload" style={{ cursor: comparing ? 'not-allowed' : 'pointer', fontWeight: 600, color: '#818cf8', display: 'inline-block' }}>
                                    Nhấp để Chọn File
                                </label>
                                <span style={{ color: 'var(--text-dim)', marginLeft: '0.5rem', fontSize: '0.875rem' }}>hoặc kéo thả file vào đây.</span>
                            </div>
                        </div>

                        {files.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                {files.map((f, i) => (
                                    <div key={`file-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--brand-dark)', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <FileText size={16} style={{ color: 'var(--brand-primary)' }} />
                                            <span style={{ color: 'var(--text-main)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                            <span style={{ color: 'var(--text-dim)' }}>({(f.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                        {!comparing && (
                                            <button onClick={() => removeFile(i)} style={{ color: '#f43f5e', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                <XCircle size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Show saved files from previous session if no active files selected */}
                        {files.length === 0 && savedFileNames.length > 0 && result && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem', fontStyle: 'italic' }}>File đã dùng ở lần phân tích trước (Đã khôi phục):</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {savedFileNames.map((name, i) => (
                                        <div key={`saved-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--brand-dark)', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.8125rem', opacity: 0.7 }}>
                                            <FileText size={14} style={{ color: 'var(--brand-primary)' }} />
                                            <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {errorMsg && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                            <AlertCircle size={18} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{errorMsg}</span>
                        </div>
                    )}
                </div>

                <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '2rem' }}>
                    {!comparing ? (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button
                                onClick={startCompare}
                                disabled={comparing || files.length === 0}
                                className="btn-primary"
                                style={{ padding: '0.8rem 2rem', width: '100%', opacity: files.length === 0 ? 0.5 : 1 }}
                            >
                                <Zap size={20} /> Phân tích Báo giá
                            </button>
                            {result && (
                                <button
                                    onClick={handleClearData}
                                    style={{
                                        padding: '0.5rem',
                                        width: '100%',
                                        background: isConfirmingClear ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
                                        color: isConfirmingClear ? '#f43f5e' : 'var(--text-dim)',
                                        border: isConfirmingClear ? '1px solid #f43f5e' : '1px solid var(--brand-border)',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.8125rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem',
                                        fontWeight: isConfirmingClear ? 'bold' : 'normal'
                                    }}
                                    className="hover:border-rose-500 hover:text-rose-500"
                                >
                                    <XCircle size={14} /> {isConfirmingClear ? 'Nhấn lần nữa để Xóa' : 'Xóa Kết quả & Cache'}
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={handleCancel}
                            style={{ padding: '0.8rem 2rem', width: '100%', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            <XCircle size={20} /> Dừng Tiến trình
                        </button>
                    )}

                    {/* Progress States */}
                    {comparing && (
                        <div style={{ width: '100%', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--brand-border)' }}>
                            {/* Upload Progress */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                    <span style={{ color: 'var(--text-dim)' }}>Uploading Files</span>
                                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{uploadProgress}%</span>
                                </div>
                                <div style={{ height: '4px', background: 'var(--brand-dark)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--brand-secondary)', transition: 'width 0.3s' }}></div>
                                </div>
                            </div>

                            {/* AI Progress */}
                            <div style={{ opacity: uploadProgress === 100 ? 1 : 0.4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--brand-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Zap size={12} /> AI Processing
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                                            {Math.round(aiProgress)}%
                                        </span>
                                        <span style={{ color: 'var(--text-main)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Timer size={12} style={{ color: 'var(--text-dim)' }} /> {formatTime(aiTime)}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ height: '4px', background: 'var(--brand-dark)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: `${uploadProgress === 100 ? aiProgress : 0}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #06b6d4)', transition: 'width 0.5s' }}></div>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.5rem', fontStyle: 'italic', textAlign: 'center' }}>
                                    {aiProgress === 100 ? 'Đã hoàn tất phân tích!' : aiProgress > 80 ? 'Đang tổng hợp thông tin...' : aiProgress > 30 ? 'Đang phân tích điều khoản...' : 'Đang trích xuất dữ liệu...'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Output */}
            {result && result.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }} className="animate">
                    <div className="card stat-card" style={{ borderLeft: '4px solid #10b981' }}>
                        <div className="icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Lựa chọn Rẻ nhất</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{result.summary.cheapest_carrier || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="card stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                        <div className="icon-box" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                            <Zap size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Tiết kiệm Tiềm năng</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                                ${result.summary.saving_potential?.toFixed(2)} {result.summary.currency}
                            </p>
                        </div>
                    </div>
                    <div className="card stat-card" style={{ borderLeft: '4px solid #06b6d4' }}>
                        <div className="icon-box" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
                            <Zap size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Vận chuyển Nhanh nhất</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{result.summary.fastest_days || '?'} Ngày</p>
                        </div>
                    </div>
                    {result.summary.outlier_warnings && result.summary.outlier_warnings.length > 0 && (
                        <div className="card stat-card" style={{ borderLeft: '4px solid #f43f5e' }}>
                            <div className="icon-box" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Cảnh báo Giá cao</p>
                                <p style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f43f5e' }}>
                                    {result.summary.outlier_warnings.join(', ')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>

                    {/* LEFT COLUMN: COMPARISON TABLE */}
                    <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--brand-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>Quote Comparison <span style={{ color: 'var(--text-dim)', fontWeight: 'normal', fontSize: '0.9rem' }}>| AI Optimized Rates</span></h3>
                        </div>

                        <div style={{ padding: '1rem', flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {/* Table Header Equivalent */}
                                <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 1.5fr 1.5fr 150px', padding: '0 1rem 0.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.8125rem', fontWeight: 600, borderBottom: '1px solid var(--brand-border)' }}>
                                    <div>#</div>
                                    <div>Hãng vận chuyển</div>
                                    <div>Lộ trình</div>
                                    <div>Thời gian / Nguồn</div>
                                    <div>Giá cước</div>
                                    <div style={{ textAlign: 'right' }}>Hành động</div>
                                </div>

                                {/* Table Rows */}
                                {result.quotes && result.quotes.length > 0 ? result.quotes.map((quote: any, idx: number) => {
                                    const isCheapest = result.summary?.cheapest_carrier === quote.carrier;
                                    const isFastest = result.summary?.fastest_days === quote.transit_time_days;

                                    return (
                                        <div key={idx} style={{
                                            display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 1.5fr 1.5fr 150px', alignItems: 'center',
                                            background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '0.75rem',
                                            border: isCheapest ? '1px solid #10b981' : '1px solid var(--brand-border)'
                                        }}>
                                            <div style={{ color: 'var(--text-dim)' }}>{idx + 1}</div>
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '0.375rem', background: 'var(--brand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '0.75rem' }}>
                                                    {quote.carrier?.substring(0, 2).toUpperCase() || 'CX'}
                                                </div>
                                                <div>
                                                    <div>{quote.carrier || "Carrier X"}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 'normal' }}>Vận chuyển Nhanh</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.875rem' }}>
                                                <div>{quote.origin || "Gốc"}</div>
                                                <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>→ {quote.destination || "Đích"}</div>
                                            </div>
                                            <div style={{ fontSize: '0.875rem' }}>
                                                <div>{quote.transit_time_days || 'N/A'} Ngày</div>
                                                <div style={{ color: '#818cf8', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setTracePanelData(quote)}>
                                                    {quote.sourceFile ? "Xem Nguồn" : ""}
                                                </div>
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                {isFastest && <div style={{ position: 'absolute', top: '-18px', left: 0, fontSize: '0.65rem', background: '#10b981', color: '#111827', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 'bold' }}>Nhanh nhất</div>}
                                                <div style={{ color: isCheapest ? '#10b981' : 'white', fontWeight: 'bold', fontSize: '1.125rem' }}>{quote.total_amount || 0} <span style={{ fontSize: '0.875rem', fontWeight: 'normal' }}>{quote.currency || 'USD'}</span></div>
                                                {isCheapest && <div style={{ color: '#10b981', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.05em' }}>GIÁ RẺ NHẤT</div>}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                                                <button style={{ width: '100%', padding: '0.4rem 0', background: '#10b981', color: '#111827', border: 'none', borderRadius: '0.375rem', fontWeight: 'bold', fontSize: '0.8125rem', cursor: 'pointer' }}>Đặt ngay</button>
                                                <button style={{ width: '100%', padding: '0.3rem 0', background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--text-dim)', borderRadius: '0.375rem', fontSize: '0.75rem', cursor: 'pointer' }}>Chi tiết</button>
                                            </div>
                                        </div>
                                    )
                                }) : (
                                    <div style={{ textAlign: 'center', padding: '3rem', fontStyle: 'italic', color: 'var(--text-dim)' }}>No structured data extracted.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: INSIGHTS (only when result exists) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Analytic Insights */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white' }}>Phân tích Chuyên sâu</h3>
                                <FileText size={16} style={{ color: 'var(--text-dim)' }} />
                            </div>

                            {/* Dynamic Cost Comparison Chart */}
                            <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                    <span>So sánh Giá</span>
                                    <span>Hãng vs Trung bình</span>
                                </div>
                                <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                    {result.quotes.map((q: any, i: number) => (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                                            <div style={{
                                                width: '100%',
                                                background: q.total_amount <= result.summary.average_price ? '#10b981' : '#f43f5e',
                                                height: `${Math.min(100, (q.total_amount / result.summary.average_price) * 50)}%`,
                                                borderRadius: '2px 2px 0 0',
                                                transition: 'height 1s ease-out'
                                            }} />
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                                                {q.carrier}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AI Verdicts & Negotiation Strategies */}
                            <div style={{ marginTop: '0.5rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>Đánh giá từ AI</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {result.ai_analysis.verdicts?.map((v: any, i: number) => (
                                        <div key={i} className="card" style={{ padding: '0.75rem', borderLeft: `4px solid ${v.verdict === 'Recommend' ? '#10b981' : v.verdict === 'Negotiate' ? '#f59e0b' : '#f43f5e'}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{v.carrier}</span>
                                                <span style={{
                                                    fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                                                    background: v.verdict === 'Recommend' ? 'rgba(16, 185, 129, 0.1)' : v.verdict === 'Negotiate' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                                                    color: v.verdict === 'Recommend' ? '#10b981' : v.verdict === 'Negotiate' ? '#f59e0b' : '#f43f5e',
                                                    fontWeight: 'bold', textTransform: 'uppercase'
                                                }}>{v.verdict}</span>
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 0 }}>{v.reason}</p>
                                        </div>
                                    ))}
                                </div>

                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', marginTop: '1.5rem', marginBottom: '1rem' }}>Kế hoạch Đàm phán</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {result.ai_analysis.negotiation_strategies?.map((s: any, i: number) => (
                                        <div key={i} className="card" style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <Zap size={14} style={{ color: '#818cf8' }} />
                                                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#818cf8' }}>{s.title}</span>
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginBottom: 0 }}>{s.point}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* AI CHAT - ALWAYS VISIBLE */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: result ? '320px' : '360px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Bot size={22} style={{ color: aiStatus.online ? '#10b981' : '#f43f5e' }} />
                            <div style={{
                                position: 'absolute', bottom: -2, right: -2,
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: aiStatus.online ? '#10b981' : '#f43f5e',
                                border: '2px solid var(--brand-dark)',
                                animation: aiStatus.online ? 'pulse 2s infinite' : 'none'
                            }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', margin: 0, lineHeight: 1.2 }}>Logistics Co-Pilot</h3>
                            <span style={{ fontSize: '0.65rem', color: aiStatus.online ? '#10b981' : '#f43f5e', fontWeight: 500 }}>
                                {aiStatus.online ? `● Online — ${aiStatus.model}` : `● Offline — ${aiStatus.model}`}
                            </span>
                        </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '1rem', background: result ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)', color: result ? '#10b981' : '#818cf8' }}>
                        {result ? 'Đã tải Dữ liệu' : 'Chưa có báo giá'}
                    </span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem', marginBottom: '1rem' }}>
                    {chatMessages.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.75rem', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                            {msg.role === 'ai' && (
                                <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '0.25rem', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', fontSize: '0.65rem', fontWeight: 'bold' }}>AI</div>
                            )}
                            <div style={{ background: msg.role === 'user' ? '#4f46e5' : 'rgba(30, 41, 59, 0.8)', padding: '0.75rem', borderRadius: '0.5rem', borderTopRightRadius: msg.role === 'user' ? '0' : '0.5rem', borderTopLeftRadius: msg.role === 'ai' ? '0' : '0.5rem', color: msg.role === 'user' ? 'white' : 'var(--text-main)', fontSize: '0.8125rem', lineHeight: '1.5', border: msg.role === 'ai' ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isChatting && (
                        <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
                            <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '0.25rem', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', fontSize: '0.65rem', fontWeight: 'bold' }}>AI</div>
                            <div style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '0.75rem', borderRadius: '0.5rem', borderTopLeftRadius: '0', color: 'var(--text-dim)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <div className="typing-dot" style={{ width: '4px', height: '4px', background: 'currentColor', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both' }}></div>
                                <div className="typing-dot" style={{ width: '4px', height: '4px', background: 'currentColor', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
                                <div className="typing-dot" style={{ width: '4px', height: '4px', background: 'currentColor', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.8)', padding: '0.4rem 0.5rem', borderRadius: '1.5rem', border: '1px solid var(--brand-border)' }}>
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={result ? "Hỏi bất cứ gì về báo giá..." : "Upload file rồi hỏi tôi nhé..."}
                        style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', padding: '0.5rem 0.75rem', outline: 'none', fontSize: '0.8125rem' }}
                        disabled={isChatting}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim() || isChatting}
                        style={{ background: 'var(--brand-dark)', color: 'var(--text-dim)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: chatInput.trim() && !isChatting ? 'pointer' : 'not-allowed', opacity: chatInput.trim() && !isChatting ? 1 : 0.5 }}
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>

            {/* TRACEABILITY SIDE PANEL (DRAWER) */}
            {tracePanelData && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, width: '400px', height: '100vh',
                    background: '#0f172a', borderLeft: '1px solid var(--brand-border)',
                    boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', flexDirection: 'column',
                    animation: 'slideInRight 0.3s ease-out'
                }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--brand-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Truy xuất Nguồn dữ liệu</h3>
                        <button onClick={() => setTracePanelData(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                            <XCircle size={24} />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source Carrier</p>
                            <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>{tracePanelData.carrier}</p>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source File</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--brand-dark)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                <FileText size={18} style={{ color: 'var(--brand-primary)' }} />
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tracePanelData.sourceFile}</span>
                            </div>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Extracted Metadata</p>
                            <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '0.75rem', padding: '1rem', fontSize: '0.8125rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <pre style={{ whiteSpace: 'pre-wrap', color: '#818cf8', fontFamily: 'monospace' }}>
                                    {JSON.stringify(tracePanelData.traceability || {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                    <div style={{ padding: '1.5rem', borderTop: '1px solid var(--brand-border)', background: 'rgba(15, 23, 42, 0.5)' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            Thông tin trích xuất bằng AI OCR (PaddleOCR). Để có kết quả chính xác nhất, vui lòng đối chiếu trực tiếp với file PDF gốc.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComparativeDashboard;
