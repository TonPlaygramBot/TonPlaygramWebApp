import { useEffect, useRef, useState } from 'react';
import { Check, Palette, X } from 'lucide-react';

import { APP_THEMES, applyAppTheme, getOwnedAppThemes, getStoredTheme } from '../utils/appTheme.js';

export default function ThemePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState(getStoredTheme);
  const [ownedThemes, setOwnedThemes] = useState(getOwnedAppThemes);
  const panelRef = useRef(null);

  useEffect(() => {
    applyAppTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsideTap = (event) => {
      if (!panelRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideTap);
    return () => document.removeEventListener('pointerdown', closeOnOutsideTap);
  }, [isOpen]);

  useEffect(() => {
    const syncOwnedThemes = (event) => setOwnedThemes(event.detail?.owned || getOwnedAppThemes());
    window.addEventListener('appThemeInventoryUpdate', syncOwnedThemes);
    return () => window.removeEventListener('appThemeInventoryUpdate', syncOwnedThemes);
  }, []);

  return (
    <div ref={panelRef} className="theme-picker">
      <button
        type="button"
        className="theme-picker__trigger"
        aria-label={isOpen ? 'Close theme picker' : 'Choose app theme'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X size={19} /> : <Palette size={20} />}
      </button>

      {isOpen && (
        <div className="theme-picker__panel" role="dialog" aria-label="Choose your theme">
          <div className="theme-picker__heading">
            <div>
              <strong>Choose a style</strong>
              <span>Make TonPlaygram yours</span>
            </div>
            <span className="theme-picker__count">5 COLOR TONES</span>
          </div>
          <div className="theme-picker__options" role="radiogroup" aria-label="App theme">
            {APP_THEMES.map((option) => {
              const selected = theme === option.id;
              const owned = ownedThemes.includes(option.id);
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  key={option.id}
                  className={`theme-picker__option${selected ? ' is-selected' : ''}${owned ? '' : ' is-locked'}`}
                  onClick={() => {
                    if (owned) {
                      setTheme(option.id);
                      setIsOpen(false);
                    } else {
                      return;
                    }
                  }}
                >
                  <span className="theme-picker__swatches" aria-hidden="true">
                    {option.colors.map((color) => (
                      <span key={color} style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className="theme-picker__name">{option.name}<small>Included</small></span>
                  {selected ? <Check className="theme-picker__check" size={17} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
