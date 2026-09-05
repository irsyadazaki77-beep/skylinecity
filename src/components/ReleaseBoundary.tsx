import React from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { createDiagnosticBundle, downloadDiagnosticBundle, hasWebGLSupport, recordDiagnosticError } from '../releaseReadiness';
import { DEFAULT_SETTINGS } from './ui/SettingsModal';
import type { RendererFallbackKind } from '../rendererStatus';

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

export function RendererFailureBoundary({ children, rendererWasReady, onFailure }: {
  children: React.ReactNode;
  rendererWasReady: boolean;
  onFailure: (error: Error, rendererWasReady: boolean) => void;
}) {
  return <RendererFailureBoundaryInner rendererWasReady={rendererWasReady} onFailure={onFailure}>{children}</RendererFailureBoundaryInner>;
}

class RendererFailureBoundaryInner extends React.Component<{
  children: React.ReactNode;
  rendererWasReady: boolean;
  onFailure: (error: Error, rendererWasReady: boolean) => void;
}, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    recordDiagnosticError(error, 'RENDERER_ERROR');
    this.props.onFailure(error, this.props.rendererWasReady);
  }

  render() {
    return this.state.error ? null : this.props.children;
  }
}

export function WebGLFallback({ kind = 'webgl-unavailable', onUse2D }: { kind?: RendererFallbackKind; onUse2D?: () => void }) {
  const content = {
    'webgl-unavailable': {
      title: 'Tampilan 3D tidak tersedia',
      message: 'Perangkat ini tidak menyediakan WebGL. Anda tetap dapat membangun dan menjalankan kota dengan mode 2D.',
    },
    'initialization-failed': {
      title: 'Tampilan 3D tidak dapat dimulai',
      message: 'WebGL tersedia, tetapi kanvas 3D gagal diinisialisasi. Coba lagi atau lanjutkan bermain dalam mode 2D.',
    },
    'runtime-error': {
      title: 'Tampilan 3D berhenti',
      message: 'Renderer 3D mengalami masalah saat berjalan. Simulasi kota tetap aman; Anda dapat melanjutkan dalam mode 2D.',
    },
  }[kind];
  return (
    <ReleaseFailureScreen
      title={content.title}
      message={content.message}
      onRetry={() => window.location.reload()}
      onUse2D={onUse2D}
    />
  );
}

interface ReleaseFailureScreenProps {
  title: string;
  message: string;
  onRetry: () => void;
  onUse2D?: () => void;
}

function ReleaseFailureScreen({ title, message, onRetry, onUse2D }: ReleaseFailureScreenProps) {
  const exportDiagnostics = () => downloadDiagnosticBundle(createDiagnosticBundle(undefined, DEFAULT_SETTINGS));
  return (
    <main className="release-failure-screen" role="alert">
      <div className="release-failure-card">
        <AlertTriangle size={32} className="text-amber-300" aria-hidden="true" />
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="release-failure-actions">
          <button type="button" onClick={onRetry}><RefreshCw size={16} /> Coba lagi</button>
          {onUse2D && <button type="button" onClick={onUse2D}>Gunakan mode 2D</button>}
          <button type="button" onClick={exportDiagnostics}><Download size={16} /> Export diagnostic</button>
        </div>
        <small>WebGL: {hasWebGLSupport() ? 'tersedia' : 'tidak tersedia'}</small>
      </div>
    </main>
  );
}
