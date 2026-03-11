import React from 'react';
import { X, ExternalLink, FileText } from 'lucide-react';

interface SourceFileViewerProps {
  filename: string;
  onClose: () => void;
}

const SourceFileViewer: React.FC<SourceFileViewerProps> = ({ filename, onClose }) => {
  const fileUrl = `http://localhost:3001/database/files/${encodeURIComponent(filename)}`;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '90%',
        height: '90%',
        backgroundColor: '#1e293b',
        borderRadius: '1rem',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: '#0f172a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '0.5rem', borderRadius: '0.5rem', color: '#818cf8' }}>
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'white' }}>{filename}</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Báo giá gốc từ nhà cung cấp</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', textDecoration: 'none', transition: 'color 0.2s' }}
            >
              <ExternalLink size={16} /> Mở tab mới
            </a>
            <button 
              onClick={onClose}
              style={{ background: 'rgba(244, 63, 94, 0.1)', border: 'none', color: '#f43f5e', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div style={{ flex: 1, backgroundColor: '#334155', position: 'relative' }}>
          <iframe 
            src={`${fileUrl}#toolbar=0`} 
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="PDF Source Viewer"
          />
        </div>

        {/* Footer info */}
        <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#0f172a', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
            Đối chiếu kỹ phần text AI trích dẫn với văn bản trong file PDF này.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SourceFileViewer;
