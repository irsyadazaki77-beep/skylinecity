import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ReleaseErrorBoundary } from './components/ReleaseBoundary';

// Suppress harmless Three.js r185 internal Clock deprecation warning triggered by third-party canvas loops
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && (args[0].includes('Clock: This module has been deprecated') || args[0].includes('THREE.Clock:'))) return;
    originalWarn.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReleaseErrorBoundary>
      <App />
    </ReleaseErrorBoundary>
  </StrictMode>,
);
