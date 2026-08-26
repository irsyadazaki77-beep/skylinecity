import React, { useState, useEffect } from 'react';
import { SaveImportPreview, SaveSlotInfo, saveRepository } from '../saveSystem';
import { CityState } from '../types';
import { X, Save, FolderOpen, Plus, Trash2, Download, Upload, AlertTriangle, RefreshCw } from 'lucide-react';
import { useModalFocus } from './ui/useModalFocus';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: CityState;
  onLoadState: (state: CityState) => void;
  onNewGame: () => void;
}

export function SaveLoadModal({
  isOpen,
  onClose,
  gameState,
  onLoadState,
  onNewGame,
}: SaveLoadModalProps) {
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  const [cityNameInput, setCityNameInput] = useState<string>('Skyline Metropolis');
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'NEW_GAME' | 'OVERWRITE' | 'DELETE';
    slotId?: string;
    message: string;
  } | null>(null);

  const [importJsonText, setImportJsonText] = useState<string>('');
  const [showImport, setShowImport] = useState<boolean>(false);
  const [importSlotId, setImportSlotId] = useState('slot_1');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [importPreview, setImportPreview] = useState<SaveImportPreview | null>(null);
  const dialogRef = useModalFocus<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setIsLoadingSlots(true);
      void saveRepository.listSlots().then(setSlots).catch(() => setErrorMessage('Arsip save tidak dapat dibaca dari browser.')).finally(() => setIsLoadingSlots(false));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmDialog) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog, isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveToSlot = (slotId: string) => {
    const existing = slots.find((s) => s.slotId === slotId);
    if (existing?.hasData) {
      setConfirmDialog({
        type: 'OVERWRITE',
        slotId,
        message: `Overwrite existing save in ${slotId === 'autosave' ? 'Autosave' : slotId.toUpperCase()}?`,
      });
    } else {
      executeSave(slotId);
    }
  };

  const executeSave = async (slotId: string) => {
    setIsBusy(true);
    try {
      const saved = await saveRepository.save(slotId, gameState, cityNameInput.trim() || 'Skyline Metropolis');
      if (!saved) setErrorMessage('Save gagal ditulis. Pastikan browser memiliki ruang penyimpanan yang cukup.');
      setSlots(await saveRepository.listSlots());
      setConfirmDialog(null);
    } catch {
      setErrorMessage('Save gagal ditulis. Pastikan browser memiliki ruang penyimpanan yang cukup.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLoadFromSlot = async (slotId: string) => {
    setIsBusy(true);
    try {
      const loaded = await saveRepository.load(slotId);
      if (loaded && loaded.gameState) {
        onLoadState(loaded.gameState);
        onClose();
      } else {
        setErrorMessage('Save tidak dapat dibaca. Save corrupt dipindahkan ke recovery quarantine jika memungkinkan.');
      }
    } catch {
      setErrorMessage('Save tidak dapat dibaca. Save corrupt dipindahkan ke recovery quarantine jika memungkinkan.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteSlot = (slotId: string) => {
    setConfirmDialog({
      type: 'DELETE',
      slotId,
      message: `Permanently delete save file in ${slotId.toUpperCase()}?`,
    });
  };

  const handleRestoreBackup = async () => {
    setIsBusy(true);
    try {
      const restored = await saveRepository.restoreBackup(1);
      setErrorMessage(restored ? 'Autosave backup berhasil dipulihkan.' : 'Backup autosave tidak tersedia.');
      setSlots(await saveRepository.listSlots());
    } catch {
      setErrorMessage('Backup autosave tidak dapat dipulihkan.');
    } finally {
      setIsBusy(false);
    }
  };

  const executeDelete = async (slotId: string) => {
    setIsBusy(true);
    try {
      await saveRepository.delete(slotId);
      setSlots(await saveRepository.listSlots());
      setConfirmDialog(null);
    } catch {
      setErrorMessage('Save tidak dapat dihapus.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleNewGameClick = () => {
    setConfirmDialog({
      type: 'NEW_GAME',
      message: 'Start a New City? All unsaved progress in your current session will be lost.',
    });
  };

  const executeNewGame = () => {
    onNewGame();
    setConfirmDialog(null);
    onClose();
  };

  const handleExport = async (slotId: string) => {
    setIsBusy(true);
    try {
      const json = await saveRepository.export(slotId);
      if (json) {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slotId}_skyline_save.json`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setErrorMessage('Tidak ada data save untuk diekspor.');
      }
    } catch {
      setErrorMessage('Save tidak dapat diekspor.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportSubmit = async (slotId: string) => {
    setIsBusy(true);
    try {
      const result = await saveRepository.import(slotId, importJsonText);
      if (result.valid) {
        setSlots(await saveRepository.listSlots());
        setShowImport(false);
        setImportJsonText('');
        setImportPreview(null);
        setErrorMessage(null);
      } else {
        setErrorMessage(result.reason ?? 'Format save tidak valid.');
      }
    } catch {
      setErrorMessage('Import save gagal diproses.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="save-load-modal fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none" role="dialog" aria-modal="true" aria-labelledby="save-load-title">
      <div ref={dialogRef} className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[85vh] relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl text-[#D4AF37]">
              <Save size={22} />
            </div>
            <div>
              <h2 id="save-load-title" className="font-serif italic text-xl text-[#D4AF37]">City Save & Load Management</h2>
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                Session Storage & Slot Archives
              </p>
            </div>
          </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup save dan load"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* City Name Input */}
          <div className="flex items-center gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
            <span className="text-xs font-mono text-gray-400 shrink-0">City Designation:</span>
            <input
              type="text"
              value={cityNameInput}
              onChange={(e) => setCityNameInput(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#D4AF37] flex-1"
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={handleNewGameClick}
              className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-200 font-mono text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
            >
              <RefreshCw size={12} /> New Game
            </button>
          </div>

          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-cyan-200">Portable backup</h3>
                <p className="text-[10px] text-gray-400">Import divalidasi sebelum menimpa slot.</p>
              </div>
              <button type="button" onClick={() => setShowImport((value) => !value)} className="px-2.5 py-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/20">
                {showImport ? 'Tutup import' : 'Import JSON'}
              </button>
            </div>
            {showImport && (
              <div className="space-y-2">
                <select value={importSlotId} aria-label="Slot tujuan import" className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-2 py-1.5 text-xs" onChange={(event) => setImportSlotId(event.target.value)}>
                  <option value="slot_1">Save Slot 1</option>
                  <option value="slot_2">Save Slot 2</option>
                  <option value="slot_3">Save Slot 3</option>
                </select>
                <textarea
                  value={importJsonText}
                  onChange={(event) => {
                    const value = event.target.value;
                    setImportJsonText(value);
                    setImportPreview(value.trim() ? saveRepository.importPreview(value) : null);
                  }}
                  placeholder="Paste JSON save di sini..."
                  className="h-24 w-full rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-[10px] text-white"
                />
                {importPreview && <div className={`text-[10px] ${importPreview.valid ? 'text-emerald-300' : 'text-red-300'}`}>
                  {importPreview.valid ? `Valid: ${importPreview.cityName} · Hari ${importPreview.day} · Pop ${importPreview.population}` : importPreview.reason}
                </div>}
                <button type="button" disabled={isBusy || !importPreview?.valid} onClick={() => void handleImportSubmit(importSlotId)} className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-200 disabled:opacity-40">
                  {isBusy ? 'Memproses…' : `Import ke ${importSlotId.replace('_', ' ')}`}
                </button>
              </div>
            )}
          </div>

          {/* Slots List */}
          <div className="space-y-3">
            {isLoadingSlots && <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center text-xs text-slate-400">Membaca arsip save…</div>}
            {slots.map((s) => (
              <div
                key={s.slotId}
                className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#D4AF37] uppercase">
                      {s.slotId === 'autosave' ? 'Autosave Slot' : `Save Slot: ${s.slotId}`}
                    </span>
                    {s.hasData && (
                      <span className="text-[10px] font-mono text-gray-400">
                        {new Date(s.timestamp).toLocaleDateString()} {new Date(s.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                    {s.featureSet === 'experimental' && <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] text-fuchsia-200">EXPERIMENTAL</span>}
                  </div>

                  {s.hasData ? (
                    <div className="flex items-center gap-4 text-xs font-mono text-gray-300">
                      <span className="font-bold text-white">{s.cityName}</span>
                      <span>Pop: {s.population.toLocaleString()}</span>
                      <span>Treasury: ${s.money.toLocaleString()}</span>
                      <span>Day {s.day}</span>
                      {s.isAutosave && <span className="text-emerald-300">Backup {s.backupCount ?? 0}/3</span>}
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-gray-500 italic block">Empty Save Slot</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 font-mono">
                  <button
                    type="button"
                    disabled={isBusy || isLoadingSlots}
                    onClick={() => void handleSaveToSlot(s.slotId)}
                    className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <Save size={12} /> Save
                  </button>

                  {s.hasData && (
                    <>
                      {s.isAutosave && (s.backupCount ?? 0) > 0 && (
                        <button type="button" disabled={isBusy} onClick={() => void handleRestoreBackup()} title="Pulihkan backup autosave" className="p-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40">
                          <RefreshCw size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleLoadFromSlot(s.slotId)}
                        className="px-3 py-1.5 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                      >
                        <FolderOpen size={12} /> Load
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleExport(s.slotId)}
                        title="Export Save JSON"
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl transition-colors"
                      >
                        <Download size={12} />
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteSlot(s.slotId)}
                        title="Delete Save Slot"
                        className="p-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 rounded-xl transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Confirmation Modal Overlay */}
        {confirmDialog && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50">
            <div className="bg-[#0f172a] border border-red-500/40 rounded-2xl p-6 max-w-md text-center space-y-4">
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>

              <h3 className="font-serif italic text-lg font-bold text-white">Confirmation Required</h3>
              <p className="text-xs text-gray-300 leading-relaxed">{confirmDialog.message}</p>

              <div className="flex items-center justify-center gap-3 font-mono text-xs pt-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 font-bold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    if (confirmDialog.type === 'NEW_GAME') executeNewGame();
                    else if (confirmDialog.type === 'OVERWRITE' && confirmDialog.slotId)
                      void executeSave(confirmDialog.slotId);
                    else if (confirmDialog.type === 'DELETE' && confirmDialog.slotId)
                      void executeDelete(confirmDialog.slotId);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors shadow-lg"
                >
                  Confirm Action
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
