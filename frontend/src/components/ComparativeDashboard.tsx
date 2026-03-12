import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, FileText, Zap, UploadCloud, XCircle, Timer, AlertCircle, Send, Bot, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import TraceabilityModal from './TraceabilityModal';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : `http://${window.location.hostname}:3000`;

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

    // Traceability Modal State
    const [selectedTraceData, setSelectedTraceData] = useState<any>(null);
    const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);

    // Job Stats Real-time
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<string>('idle'); // idle, uploading, queued, active, completed, failed
    const socketRef = useRef<Socket | null>(null);

    // Setup Socket.io
    useEffect(() => {
        const socket = io(API_BASE);
        socketRef.current = socket;

        socket.on('connect', () => console.log('[Socket] Connected to backend'));
        socket.on('job_status', (data) => {
            console.log('[Socket] Job Update:', data);
            if (data.jobId === currentJobId) {
                setJobStatus(data.status);
                if (data.progress) setAiProgress(data.progress);
                if (data.status === 'completed' && data.result) {
                    setResult(data.result);
                    setComparing(false);
                }
            }
        });

        // Join the room for the current job to receive updates
        if (currentJobId) {
            socket.emit('join-job', { jobId: currentJobId });
        }

        return () => {
            socket.disconnect();
        };
    }, [currentJobId]);

    // Ping AI health check on mount + every 30s
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await axios.get(`${API_BASE}/health/ai`, { timeout: 5000 });
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
        setFiles(prev => prev.filter((_: File, i: number) => i !== index));
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
            setJobStatus('uploading');
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));

            const uploadRes = await axios.post(`${API_BASE}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                    setUploadProgress(percentCompleted);
                },
                signal: abortController.signal
            });

            const filePaths = uploadRes.data.paths;

            // 2. Analyze (Now Async)
            setJobStatus('queued');
            const response = await axios.post(`${API_BASE}/quote/compare`, {
                filePaths
            }, {
                signal: abortController.signal
            });

            if (response.data.jobId) {
                setCurrentJobId(response.data.jobId);
                // The rest will be handled by Socket.io
            } else {
                // Fallback if not async
                setAiProgress(100);
                setResult(response.data);
                setComparing(false);
            }

        } catch (error: any) {
            if (axios.isCancel(error)) {
                setErrorMsg('Tiến trình AI đã bị hủy bởi người dùng.');
            } else {
                console.error('Comparison failed', error);
                setErrorMsg('Xảy ra lỗi trong quá trình phân tích. Vui lòng thử lại.');
            }
            setComparing(false);
        } finally {
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
            const response = await axios.post(`${API_BASE}/quote/chat`, {
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
                                    <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {uploadProgress < 100 ? <Timer size={12} /> : <CheckCircle2 size={12} style={{ color: '#10b981' }} />}
                                        Tải file lên hệ thống
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontWeight: 600 }}>{jobStatus.toUpperCase()}</span>
                                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{uploadProgress}%</span>
                                    </div>
                                </div>
                                <div style={{ height: '4px', background: 'var(--brand-dark)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--brand-secondary)', transition: 'width 0.3s' }}></div>
                                </div>
                            </div>

                            {/* AI Processing Steps */}
                            <div style={{ opacity: uploadProgress === 100 ? 1 : 0.4, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--brand-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Zap size={12} /> Đang xử lý AI (Map-Reduce)
                                    </span>
                                    <span style={{ color: 'var(--text-main)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Timer size={12} style={{ color: 'var(--text-dim)' }} /> {formatTime(aiTime)}
                                    </span>
                                </div>

                                {/* Step Indicator */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aiProgress > 10 ? '#10b981' : 'var(--brand-border)', border: aiProgress > 0 && aiProgress <= 10 ? '2px solid #818cf8' : 'none' }}></div>
                                        <span style={{ color: aiProgress > 10 ? '#10b981' : 'var(--text-dim)' }}>OCR & Nhận diện layout</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aiProgress > 40 ? '#10b981' : 'var(--brand-border)', border: aiProgress > 10 && aiProgress <= 40 ? '2px solid #818cf8' : 'none' }}></div>
                                        <span style={{ color: aiProgress > 40 ? '#10b981' : 'var(--text-dim)' }}>Trích xuất Map (từng file)</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aiProgress > 80 ? '#10b981' : 'var(--brand-border)', border: aiProgress > 40 && aiProgress <= 80 ? '2px solid #818cf8' : 'none' }}></div>
                                        <span style={{ color: aiProgress > 80 ? '#10b981' : 'var(--text-dim)' }}>Tổng hợp Reduce (Expert Report)</span>
                                    </div>
                                </div>

                                <div style={{ height: '4px', background: 'var(--brand-dark)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.25rem' }}>
                                    <div style={{ width: `${uploadProgress === 100 ? aiProgress : 0}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #06b6d4)', transition: 'width 0.5s' }}></div>
                                </div>
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
                            <button 
                                onClick={() => {
                                    setSelectedTraceData({
                                        field: 'Cheapest Carrier',
                                        value: result.summary.cheapest_carrier,
                                        carrier: result.summary.cheapest_carrier,
                                        sourceFile: 'Generated from consolidated report',
                                        confidence: 0.95
                                    });
                                    setIsTraceModalOpen(true);
                                }}
                                style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.7rem', cursor: 'pointer', padding: 0, marginTop: '0.25rem', textDecoration: 'underline' }}
                            >
                                Xem nguồn
                            </button>
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
                            <button 
                                onClick={() => {
                                    setSelectedTraceData({
                                        field: 'Fastest Transit Time',
                                        value: `${result.summary.fastest_days} Days`,
                                        carrier: 'Various',
                                        sourceFile: 'Aggregated Analysis',
                                        confidence: 0.9
                                    });
                                    setIsTraceModalOpen(true);
                                }}
                                style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.7rem', cursor: 'pointer', padding: 0, marginTop: '0.25rem', textDecoration: 'underline' }}
                            >
                                Xem nguồn
                            </button>
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
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--brand-border)', paddingBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={20} style={{ color: '#818cf8' }} />
                            Báo cáo Phân tích Chuyên gia
                        </h3>
                        {result.file_classification && (
                            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
                                    {result.file_classification.quotes?.length || 0} báo giá
                                </span>
                                {result.file_classification.rfq > 0 && (
                                    <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
                                        {result.file_classification.rfq} yêu cầu hỏi cước
                                    </span>
                                )}
                                {result.file_classification.common_terms > 0 && (
                                    <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
                                        {result.file_classification.common_terms} thuật ngữ
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Markdown Report with Traceability Hooks */}
                    <div className="markdown-report">
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                                strong: ({node, ...props}) => {
                                    // Thử nghiệm: Nếu AI wrap giá trị trong strong, ta cho phép click để xem trace
                                    return (
                                        <strong 
                                            {...props} 
                                            onClick={() => {
                                                if (result.traceability_map && result.traceability_map[props.children as string]) {
                                                    const trace = result.traceability_map[props.children as string];
                                                    setSelectedTraceData({
                                                        field: props.children as string,
                                                        value: props.children as string,
                                                        carrier: trace.carrier,
                                                        sourceFile: trace.sourceFile,
                                                        filename: trace.filename,
                                                        bbox: trace.bbox,
                                                        confidence: trace.confidence || 0.9
                                                    });
                                                    setIsTraceModalOpen(true);
                                                }
                                            }}
                                            style={{ cursor: result.traceability_map && result.traceability_map[props.children as string] ? 'help' : 'inherit', color: result.traceability_map && result.traceability_map[props.children as string] ? '#818cf8' : 'inherit' }}
                                        />
                                    );
                                }
                            }}
                        >
                            {result.markdown_report || 'Không có báo cáo phân tích.'}
                        </ReactMarkdown>
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

            {/* TRACEABILITY MODAL */}
            <TraceabilityModal 
                isOpen={isTraceModalOpen}
                onClose={() => setIsTraceModalOpen(false)}
                data={selectedTraceData}
            />
        </div>
    );
};

export default ComparativeDashboard;
