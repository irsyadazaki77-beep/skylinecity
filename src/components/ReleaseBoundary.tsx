import React from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { createDiagnosticBundle, downloadDiagnosticBundle, hasWebGLSupport, recordDiagnosticError } from '../releaseReadiness';
import { DEFAULT_SETTINGS } from './ui/SettingsModal';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ReleaseErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    recordDiagnosticError(error, 'REACT_RENDER_ERROR');
  }

  render() {
    if (this.state.error) {
      return (
        <ReleaseFailureScreen
          title="Skyline perlu dipulihkan"
          message="Tampilan game berhenti karena error yang tidak terduga. Kota tersimpan terakhir tetap aman."
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

export function WebGLFallback() {
  return (
    <ReleaseFailureScreen
      title="Browser tidak mendukung tampilan 3D"
      message="Gunakan Chrome atau Edge terbaru, aktifkan hardware acceleration, lalu buka kembali game."
      onRetry={() => window.location.reload()}
    />
  );
}

interface ReleaseFailureScreenProps {
  title: string;
  message: string;
  onRetry: () => void;
}

function ReleaseFailureScreen({ title, message, onRetry }: ReleaseFailureScreenProps) {
  const exportDiagnostics = () => downloadDiagnosticBundle(createDiagnosticBundle(undefined, DEFAULT_SETTINGS));
  return (
    <main className="release-failure-screen" role="alert">
      <div className="release-failure-card">
        <AlertTriangle size={32} className="text-amber-300" aria-hidden="true" />
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="release-failure-actions">
          <button type="button" onClick={onRetry}><RefreshCw size={16} /> Coba lagi</button>
          <button type="button" onClick={exportDiagnostics}><Download size={16} /> Export diagnostic</button>
        </div>
        <small>WebGL: {hasWebGLSupport() ? 'tersedia' : 'tidak tersedia'}</small>
      </div>
    </main>
  );
}

