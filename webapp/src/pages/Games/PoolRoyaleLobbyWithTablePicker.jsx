import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import {
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  POOL_ROYALE_TABLE_MODEL_STORAGE_KEY,
  resolvePoolRoyaleTableModel
} from '../../config/poolRoyaleTableModels.js';
import PoolRoyaleLobby from './PoolRoyaleLobbyCore.jsx';

function persistTableModel(tableModelId) {
  try {
    window.localStorage?.setItem(
      POOL_ROYALE_TABLE_MODEL_STORAGE_KEY,
      tableModelId
    );
  } catch {}
}

export default function PoolRoyaleLobbyWithTablePicker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTableModel = searchParams.get('tableModel');
  const [tableModelId, setTableModelId] = useState(() => {
    try {
      if (requestedTableModel) {
        return resolvePoolRoyaleTableModel(requestedTableModel).id;
      }
      const stored = window.localStorage?.getItem(
        POOL_ROYALE_TABLE_MODEL_STORAGE_KEY
      );
      return resolvePoolRoyaleTableModel(stored).id;
    } catch {}
    return resolvePoolRoyaleTableModel().id;
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedTableModel = useMemo(
    () => resolvePoolRoyaleTableModel(tableModelId),
    [tableModelId]
  );
  const selectedTableSize = resolveTableSize(selectedTableModel.tableSizeId);

  useEffect(() => {
    if (!requestedTableModel) return;
    const resolved = resolvePoolRoyaleTableModel(requestedTableModel);
    persistTableModel(resolved.id);
    if (resolved.id !== tableModelId) {
      setTableModelId(resolved.id);
    }
  }, [requestedTableModel, tableModelId]);

  const selectTableModel = (nextModelId) => {
    const resolved = resolvePoolRoyaleTableModel(nextModelId);
    persistTableModel(resolved.id);
    setTableModelId(resolved.id);
    setPickerOpen(false);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tableModel', resolved.id);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <>
      <PoolRoyaleLobby key={tableModelId} />

      <div className="pointer-events-none fixed bottom-24 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="pointer-events-auto rounded-2xl border border-emerald-200/40 bg-[#07111f]/95 px-4 py-3 text-left shadow-2xl shadow-black/40 backdrop-blur transition hover:border-emerald-100/70"
          aria-haspopup="dialog"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-100/75">
            Table
          </span>
          <span className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
            <span>{selectedTableModel.icon || '\uD83C\uDFB1'}</span>
            <span>{selectedTableModel.label}</span>
          </span>
        </button>
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Choose Pool Royale table"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="absolute inset-x-4 bottom-20 mx-auto max-w-md rounded-2xl border border-white/10 bg-[#08111f] p-4 text-white shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Choose Table</h3>
                <p className="text-xs text-white/55">
                  {selectedTableSize.label} selected
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {POOL_ROYALE_TABLE_MODEL_OPTIONS.map((tableOption) => {
                const active = selectedTableModel.id === tableOption.id;
                const optionSize = resolveTableSize(tableOption.tableSizeId);
                return (
                  <button
                    key={tableOption.id}
                    type="button"
                    onClick={() => selectTableModel(tableOption.id)}
                    className={`lobby-option-card ${
                      active
                        ? 'lobby-option-card-active'
                        : 'lobby-option-card-inactive'
                    }`}
                  >
                    <div className="lobby-option-thumb bg-gradient-to-br from-emerald-400/30 via-amber-500/10 to-transparent">
                      <div className="lobby-option-thumb-inner">
                        <span className="text-3xl leading-none">
                          {tableOption.icon || '\uD83C\uDFB1'}
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="lobby-option-label">{tableOption.label}</p>
                      <p className="lobby-option-subtitle">
                        {optionSize.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
