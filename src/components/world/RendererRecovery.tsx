import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

export function RendererRecovery({ onRetry }: { onRetry: () => void }) {
  const { gl, invalidate } = useThree();
  const [lost, setLost] = useState(false);
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => { event.preventDefault(); setLost(true); };
    const onRestored = () => {
      setLost(false);
      // Recreate generated render targets (including the local environment
      // map), whose GPU contents cannot be restored by re-uploading an image.
      retryRef.current();
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, invalidate]);
  if (!lost) return null;
  return <Html fullscreen zIndexRange={[90, 90]}>
    <div className="h-full grid place-items-center bg-slate-950/85 p-6">
      <div role="status" className="max-w-sm rounded-xl border border-slate-600 bg-slate-900 p-5 text-sm text-slate-100 shadow-xl">
        <p className="font-semibold mb-2">Tampilan 3D sedang dipulihkan</p>
        <p className="text-slate-300">Koneksi grafis terputus. Data kota tetap tersedia.</p>
        <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-lg bg-teal-700 px-4 font-semibold hover:bg-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Muat ulang tampilan 3D</button>
      </div>
    </div>
  </Html>;
}
