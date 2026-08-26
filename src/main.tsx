import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ReleaseErrorBoundary } from './components/ReleaseBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReleaseErrorBoundary>
      <App />
    </ReleaseErrorBoundary>
  </StrictMode>,
);
