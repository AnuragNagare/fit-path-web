import { useEffect, useRef } from 'react';
import { X, Star } from 'lucide-react';
import { FEATURE_CATEGORIES, SUPPORTED_FEATURE_IDS } from '@/data/features';

interface Props {
  open: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function FilterPanel({ open, selected, onToggle, onClear, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // focus trap – keep scroll inside panel
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const totalSelected = selected.size;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fp-backdrop${open ? ' fp-backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={panelRef}
        className={`fp-drawer${open ? ' fp-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filter by features"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="fp-header">
          <div className="fp-header-left">
            <span className="fp-title">Features</span>
            <span className="fp-count">See All ({FEATURE_CATEGORIES.reduce((a, c) => a + c.features.length, 0)})</span>
          </div>
          <div className="fp-header-right">
            {totalSelected > 0 && (
              <button className="fp-clear" onClick={onClear}>
                Clear all ({totalSelected})
              </button>
            )}
            <button className="fp-close" onClick={onClose} aria-label="Close filters">
              <X size={22} />
            </button>
          </div>
        </div>
        <p className="fp-sub">Star what matters. Greyed-out features have no data yet.</p>

        {/* Scrollable body */}
        <div className="fp-body">
          {FEATURE_CATEGORIES.map(cat => (
            <section key={cat.title} className="fp-section">
              <h3 className="fp-section-title">{cat.title.toUpperCase()}</h3>
              <div className="fp-grid">
                {cat.features.map(feat => {
                  const active = selected.has(feat.id);
                  const supported = SUPPORTED_FEATURE_IDS.has(feat.id);
                  return (
                    <button
                      key={feat.id}
                      className={`fp-chip${active ? ' fp-chip--active' : ''}${supported ? '' : ' fp-chip--disabled'}`}
                      onClick={() => onToggle(feat.id)}
                      disabled={!supported}
                      title={supported ? undefined : 'No data available for this feature yet'}
                      type="button"
                    >
                      <feat.Icon size={18} className="fp-chip-icon" />
                      <span className="fp-chip-label">{feat.label}</span>
                      <Star
                        size={16}
                        className="fp-chip-star"
                        fill={active ? 'currentColor' : 'none'}
                        strokeWidth={active ? 0 : 1.8}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="fp-footer">
          <button className="pill-button fp-apply" onClick={onClose}>
            Show results{totalSelected > 0 ? ` · ${totalSelected} filters` : ''}
          </button>
        </div>
      </div>
    </>
  );
}
