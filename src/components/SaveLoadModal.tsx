import React, { useState, useEffect } from 'react';
import { SaveImportPreview, SaveSlotInfo, saveRepository } from '../saveSystem';
import { CityState } from '../types';
import { X, Save, FolderOpen, Plus, Trash2, Download, Upload, AlertTriangle, RefreshCw } from 'lucide-react';
import { useModalFocus } from './ui/useModalFocus';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../localization';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: CityState;
  onLoadState: (state: CityState, slotId?: string) => void;
  onNewGame: () => void;
  language?: SupportedLanguage;
}

export function SaveLoadModal({
  isOpen,
  onClose,
  gameState,
  onLoadState,
  onNewGame,
  language = 'id',
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
  const catalog = createLocalizationCatalog(language);
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
        message: language === 'en'
          ? `Overwrite existing save in ${slotId === 'autosave' ? 'Autosave' : slotId.toUpperCase()}?`
          : `Timpa save yang ada di ${slotId === 'autosave' ? 'Autosave' : slotId.toUpperCase()}?`,
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
        onLoadState(loaded.gameState, slotId);
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
      message: language === 'en'
        ? `Permanently delete save file in ${slotId.toUpperCase()}?`
        : `Hapus permanen file save di ${slotId.toUpperCase()}?`,
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
      message: language === 'en'
        ? 'Start a New City? All unsaved progress in your current session will be lost.'
        : 'Mulai Kota Baru? Semua progres yang belum disimpan di sesi ini akan hilang.',
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
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--accent-cyan)]/15 border border-[var(--accent-cyan)]/30 rounded-xl text-[var(--accent-cyan)]">
              <Save size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="save-load-title" className="text-lg font-bold text-white tracking-tight">{translate(catalog, 'save.title')}</h2>
              <p className="text-xs text-slate-400">
                {translate(catalog, 'save.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela simpan dan muat kota"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* City Name Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-black/30 p-3 rounded-xl border border-white/5">
            <label htmlFor="city-name-input" className="text-xs font-semibold text-slate-300 shrink-0">{translate(catalog, 'save.designation')}:</label>
            <input
              id="city-name-input"
              type="text"
              value={cityNameInput}
              onChange={(e) => setCityNameInput(e.target.value)}
              className="h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-xs text-white focus:outline-none focus:border-[var(--accent-cyan)] flex-1"
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={handleNewGameClick}
              className="min-h-[44px] px-3.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              <RefreshCw size={13} aria-hidden="true" /> 
              <span>{translate(catalog, 'save.newGame')}</span>
            </button>
          </div>

          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="rounded-xl border border-[var(--accent-cyan)]/20 bg-[var(--accent-cyan)]/5 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[var(--accent-cyan)]">{translate(catalog, 'save.portableBackup')}</h3>
                <p className="text-[11px] text-slate-400">{translate(catalog, 'save.importValidated')}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowImport((value) => !value)} 
                className="min-h-[36px] px-3 rounded-lg border border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 text-xs font-bold text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/20 transition-colors"
              >
                {showImport ? translate(catalog, 'save.closeImport') : translate(catalog, 'save.importJson')}
              </button>
            </div>
            {showImport && (
              <div className="space-y-2 pt-1">
                <select value={importSlotId} aria-label="Slot tujuan import" className="w-full h-10 rounded-lg border border-white/10 bg-[#1e293b] px-3 text-xs text-white" onChange={(event) => setImportSlotId(event.target.value)}>
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
                  placeholder="Tempel JSON save di sini..."
                  className="h-24 w-full rounded-lg border border-white/10 bg-black/30 p-2.5 font-mono text-xs text-white"
                />
                {importPreview && <div className={`text-xs ${importPreview.valid ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {importPreview.valid ? `Valid: ${importPreview.cityName} · Hari ${importPreview.day} · Populasi ${importPreview.population}` : importPreview.reason}
                </div>}
                <button type="button" disabled={isBusy || !importPreview?.valid} onClick={() => void handleImportSubmit(importSlotId)} className="min-h-[44px] px-4 rounded-xl bg-[var(--accent-cyan)] text-slate-950 text-xs font-bold disabled:opacity-40 shadow-sm">
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
                className="p-4 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--accent-cyan)] uppercase">
                      {s.slotId === 'autosave' ? (language === 'en' ? 'Autosave Slot' : 'Slot Autosave') : `${language === 'en' ? 'Save Slot' : 'Slot Simpan'}: ${s.slotId}`}
                    </span>
                    {s.hasData && (
                      <span className="text-[10px] text-slate-400">
                        {new Date(s.timestamp).toLocaleDateString()} {new Date(s.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                    {s.featureSet === 'experimental' && <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] text-fuchsia-200">EXPERIMENTAL</span>}
                  </div>

                  {s.hasData ? (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <span className="font-bold text-white">{s.cityName}</span>
                      <span>{language === 'en' ? 'Pop' : 'Populasi'}: <b className="font-mono">{s.population.toLocaleString()}</b></span>
                      <span>{language === 'en' ? 'Treasury' : 'Kas'}: <b className="font-mono text-amber-300">${s.money.toLocaleString()}</b></span>
                      <span>{language === 'en' ? 'Day' : 'Hari'} <b className="font-mono">{s.day}</b></span>
                      {s.isAutosave && <span className="text-emerald-300">{language === 'en' ? 'Backup' : 'Cadangan'} {s.backupCount ?? 0}/3</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic block">{translate(catalog, 'save.emptySlot')}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={isBusy || isLoadingSlots}
                    onClick={() => void handleSaveToSlot(s.slotId)}
                    className="min-h-[44px] px-3 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Save size={14} aria-hidden="true" /> 
                    <span>{translate(catalog, 'save.save')}</span>
                  </button>

                  {s.hasData && (
                    <>
                      {s.isAutosave && (s.backupCount ?? 0) > 0 && (
                        <button 
                          type="button" 
                          disabled={isBusy} 
                          onClick={() => void handleRestoreBackup()} 
                          title="Pulihkan backup autosave" 
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
                        >
                          <RefreshCw size={14} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleLoadFromSlot(s.slotId)}
                        className="min-h-[44px] px-3.5 bg-[var(--accent-cyan)] text-slate-950 text-xs font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
                      >
                        <FolderOpen size={14} aria-hidden="true" /> 
                        <span>{translate(catalog, 'save.load')}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleExport(s.slotId)}
                        title={translate(catalog, 'save.export')}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl transition-colors"
                      >
                        <Download size={14} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteSlot(s.slotId)}
                        title={translate(catalog, 'save.delete')}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 rounded-xl transition-colors"
                      >
                        <Trash2 size={14} aria-hidden="true" />
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
            <div className="bg-[#0d1420] border border-rose-500/40 rounded-2xl p-6 max-w-md text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={24} aria-hidden="true" />
              </div>

              <h3 className="text-lg font-bold text-white">{translate(catalog, 'save.confirmation')}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.message}</p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setConfirmDialog(null)}
                  className="min-h-[44px] px-4 bg-white/10 hover:bg-white/20 rounded-xl text-slate-300 font-bold text-xs transition-colors"
                >
                  {translate(catalog, 'save.cancel')}
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
                  className="min-h-[44px] px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors shadow-lg"
                >
                  {translate(catalog, 'save.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
