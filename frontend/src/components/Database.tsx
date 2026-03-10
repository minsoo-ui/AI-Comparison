import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Database as DatabaseIcon, FileText, Clock, HardDrive, ShieldCheck, MoreVertical, Plus, FolderOpen, Trash2, Loader2 } from 'lucide-react';
import axios from 'axios';

const Database: React.FC = () => {
    const [files, setFiles] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const [trashFiles, setTrashFiles] = useState<any[]>([]);
    const [selectedTrashIds, setSelectedTrashIds] = useState<number[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchFiles = async () => {
        try {
            const res = await axios.get('http://localhost:3001/database/files');
            // Sort to show latest first
            const sortedFiles = res.data.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setFiles(sortedFiles);
        } catch (error) {
            console.error('Failed to fetch files', error);
        }
    };

    useEffect(() => {
        if (showTrash) {
            fetchTrashFiles();
        } else {
            fetchFiles();
        }
    }, [showTrash]);

    const fetchTrashFiles = async () => {
        try {
            const res = await axios.get('http://localhost:3001/database/trash');
            setTrashFiles(res.data);
            setSelectedTrashIds([]);
        } catch (error) {
            console.error('Failed to fetch trash files', error);
        }
    };

    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(files.map(f => f.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelectFile = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(item => item !== id));
        } else {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const toggleSelectAllTrash = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedTrashIds(trashFiles.map(f => f.id));
        } else {
            setSelectedTrashIds([]);
        }
    };

    const toggleSelectTrashFile = (id: number) => {
        if (selectedTrashIds.includes(id)) {
            setSelectedTrashIds(prev => prev.filter(item => item !== id));
        } else {
            setSelectedTrashIds(prev => [...prev, id]);
        }
    };

    const toggleMenu = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (openMenuId === id) {
            handleCloseMenu();
            return;
        }
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setMenuPosition({
            // Đẩy menu sang trái một chút để mép phải của menu thẳng hàng với mép phải của nút 3 chấm
            x: rect.right - 160,
            y: rect.bottom + 2
        });
        setOpenMenuId(id);
    };

    const handleCloseMenu = () => {
        setOpenMenuId(null);
        setMenuPosition(null);
    };

    const handleOpenFolder = async () => {
        try {
            await axios.get('http://localhost:3001/open-database-folder');
        } catch (e) {
            console.error('Failed to open database folder', e);
        }
        handleCloseMenu();
    };

    const handleDelete = async (id: number) => {
        const fileToDelete = files.find(f => f.id === id);
        if (!fileToDelete) return;

        try {
            await axios.delete(`http://localhost:3001/upload/rule/${fileToDelete.name}`);
            setFiles(prev => prev.filter(f => f.id !== id));
            setSelectedIds(prev => prev.filter(item => item !== id));
        } catch (error) {
            console.error('Failed to delete file', error);
            alert('Lỗi khi xóa file.');
        } finally {
            handleCloseMenu();
        }
    };

    const handleMultiDelete = async () => {
        const filesToDelete = files.filter(f => selectedIds.includes(f.id)).map(f => f.name);
        if (filesToDelete.length === 0) return;

        try {
            await axios.post('http://localhost:3001/upload/rule/multi-delete', { filenames: filesToDelete });
            setFiles(prev => prev.filter(f => !selectedIds.includes(f.id)));
            setSelectedIds([]);
        } catch (error) {
            console.error('Failed to multi-delete', error);
            alert('Lỗi khi xóa nhiều file.');
        }
    };

    const handleUploadClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();
        Array.from(selectedFiles).forEach(file => {
            formData.append('files', file);
        });

        try {
            await axios.post('http://localhost:3001/upload/rule', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Re-fetch clean list from backend to assure sync
            await fetchFiles();

        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload failed. Check backend connection.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRestoreTrash = async () => {
        const filesToRestore = trashFiles.filter(f => selectedTrashIds.includes(f.id)).map(f => f.name);
        if (filesToRestore.length === 0) return;
        try {
            await axios.post('http://localhost:3001/database/trash/restore', { filenames: filesToRestore });
            fetchTrashFiles();
            alert(`Đã khôi phục ${filesToRestore.length} thư mục.`);
        } catch (error) {
            console.error('Failed to restore files', error);
        }
    };

    const handleEmptyTrash = async () => {
        if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn TOÀN BỘ file trong thùng rác? Thao tác này không thể hoàn tác.')) return;
        try {
            await axios.post('http://localhost:3001/database/trash/empty');
            fetchTrashFiles();
        } catch (error) {
            console.error('Failed to empty trash', error);
        }
    };

    return (
        <div className="animate" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                accept=".txt,.md,.pdf,.docx"
                onChange={handleFileChange}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <DatabaseIcon style={{ color: 'var(--brand-primary)' }} />
                        Cơ sở dữ liệu
                    </h2>
                    <p style={{ color: 'var(--text-dim)' }}>Quản lý các điều khoản đặc biệt và quy tắc kinh doanh để làm ngữ cảnh cho AI.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        style={{ padding: '0.8rem 1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', background: showTrash ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.4)', color: showTrash ? '#818cf8' : 'var(--text-main)', border: `1px solid ${showTrash ? '#818cf8' : 'var(--brand-border)'}`, borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        <Trash2 size={18} /> {showTrash ? 'Quay lại CSDL' : 'Đã xóa gần đây'}
                    </button>
                    {!showTrash && selectedIds.length > 0 && (
                        <button
                            onClick={handleMultiDelete}
                            style={{ padding: '0.8rem 1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '0.5rem', cursor: 'pointer' }}
                        >
                            <Trash2 size={18} /> Xóa mục đã chọn ({selectedIds.length})
                        </button>
                    )}
                    {!showTrash && (
                        <button
                            onClick={handleUploadClick}
                            className="btn-primary"
                            style={{ padding: '0.8rem 1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                            disabled={isUploading}
                        >
                            {isUploading ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
                            {isUploading ? 'Đang tải lên...' : 'Tải lên File Quy tắc'}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div className="card stat-card" style={{ borderLeft: '4px solid #10b981' }}>
                    <div className="icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <FileText size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Tổng số File</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{files.length}</p>
                    </div>
                </div>
                <div className="card stat-card" style={{ borderLeft: '4px solid #6366f1' }}>
                    <div className="icon-box" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                        <HardDrive size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Dung lượng đã dùng</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>4.5 MB</p>
                    </div>
                </div>
                <div className="card stat-card" style={{ borderLeft: '4px solid #06b6d4' }}>
                    <div className="icon-box" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Quy tắc đang Hoạt động</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{files.filter(f => f.status === 'Active').length} Models</p>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--brand-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: showTrash ? '#f43f5e' : 'white' }}>
                        {showTrash ? 'File đã xóa gần đây (Lưu trữ trong 30 ngày)' : 'Danh mục Tài liệu Kiến thức'}
                    </h3>
                    {showTrash && trashFiles.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={handleRestoreTrash}
                                disabled={selectedTrashIds.length === 0}
                                style={{
                                    padding: '0.5rem 1rem',
                                    display: 'flex',
                                    gap: '0.5rem',
                                    alignItems: 'center',
                                    background: selectedTrashIds.length > 0 ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                    color: selectedTrashIds.length > 0 ? '#10b981' : 'var(--text-dim)',
                                    border: `1px solid ${selectedTrashIds.length > 0 ? '#10b981' : 'var(--brand-border)'}`,
                                    borderRadius: '0.25rem',
                                    cursor: selectedTrashIds.length > 0 ? 'pointer' : 'not-allowed',
                                    fontSize: '0.875rem',
                                    opacity: selectedTrashIds.length > 0 ? 1 : 0.5,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <ShieldCheck size={16} /> Khôi phục {selectedTrashIds.length > 0 ? `(${selectedTrashIds.length})` : ''}
                            </button>
                            <button
                                onClick={handleEmptyTrash}
                                style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.875rem' }}
                                className="hover:bg-red-900"
                            >
                                <Trash2 size={16} /> Dọn sạch Thùng rác
                            </button>
                        </div>
                    )}
                </div>
                <div style={{ overflowX: 'auto', minHeight: '300px' }}>
                    <table style={{ minWidth: '800px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    {showTrash ? (
                                        <input
                                            type="checkbox"
                                            onChange={toggleSelectAllTrash}
                                            checked={selectedTrashIds.length === trashFiles.length && trashFiles.length > 0}
                                            style={{ cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                                        />
                                    ) : (
                                        <input
                                            type="checkbox"
                                            onChange={toggleSelectAll}
                                            checked={selectedIds.length === files.length && files.length > 0}
                                            style={{ cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                                        />
                                    )}
                                </th>
                                <th>Tên File</th>
                                <th>{showTrash ? 'Ngày xóa' : 'Mô tả'}</th>
                                <th>Dung lượng</th>
                                <th>{!showTrash && 'Cập nhật cuối'}</th>
                                <th>Trạng thái</th>
                                {!showTrash && <th style={{ width: '60px' }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {showTrash ? (
                                trashFiles.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>Thùng rác trống.</td></tr>
                                ) : (
                                    trashFiles.map((file) => (
                                        <tr key={file.id} style={{ background: selectedTrashIds.includes(file.id) ? 'rgba(244, 63, 94, 0.05)' : 'transparent' }}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTrashIds.includes(file.id)}
                                                    onChange={() => toggleSelectTrashFile(file.id)}
                                                    style={{ cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                                                />
                                            </td>
                                            <td style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textDecoration: 'line-through' }}>
                                                <div style={{ padding: '0.5rem', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '0.5rem', color: '#f43f5e' }}>
                                                    <FileText size={16} />
                                                </div>
                                                {file.name}
                                            </td>
                                            <td style={{ color: 'var(--text-dim)' }}>
                                                <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} /> {file.deletedAt}
                                            </td>
                                            <td style={{ color: 'var(--text-dim)' }}>{file.size}</td>
                                            <td></td>
                                            <td>
                                                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', borderRadius: '1rem', border: '1px solid #f43f5e' }}>
                                                    Deleted
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                files.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>Không có tài liệu nào.</td></tr>
                                ) : (
                                    files.map((file) => (
                                        <tr key={file.id} style={{ background: selectedIds.includes(file.id) ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(file.id)}
                                                    onChange={() => toggleSelectFile(file.id)}
                                                    style={{ cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                                                />
                                            </td>
                                            <td style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '0.5rem', color: '#818cf8' }}>
                                                    <FileText size={16} />
                                                </div>
                                                {file.name}
                                            </td>
                                            <td style={{ color: 'var(--text-dim)' }}>{file.description}</td>
                                            <td style={{ color: 'var(--text-dim)' }}>{file.size}</td>
                                            <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)' }}>
                                                <Clock size={14} /> {file.updatedAt}
                                            </td>
                                            <td>
                                                {file.status === 'Active' ? (
                                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '1rem', border: '1px solid #10b981' }}>
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'rgba(51, 65, 85, 0.5)', color: 'var(--text-dim)', borderRadius: '1rem', border: '1px solid var(--brand-border)' }}>
                                                        Draft
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ position: 'relative' }}>
                                                <button
                                                    onClick={(e) => toggleMenu(e, file.id)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.5rem' }}
                                                    className="hover:text-white"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Fixed Overlay & Portal Menu */}
            {openMenuId !== null && menuPosition !== null && createPortal(
                <>
                    <div
                        onClick={handleCloseMenu}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}
                    />
                    <div style={{
                        position: 'fixed',
                        left: menuPosition.x,
                        top: menuPosition.y,
                        background: 'var(--brand-dark)',
                        border: '1px solid var(--brand-border)',
                        borderRadius: '0.5rem',
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
                        zIndex: 1001
                    }}>
                        <button onClick={(e) => { e.stopPropagation(); handleOpenFolder(); }} className="context-menu-item">
                            <FolderOpen size={16} style={{ color: '#06b6d4' }} /> Mở thư mục
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(openMenuId); }} className="context-menu-item danger">
                            <Trash2 size={16} /> Xóa
                        </button>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default Database;
