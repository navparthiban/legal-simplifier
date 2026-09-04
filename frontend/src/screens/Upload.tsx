import { useRef, useState } from 'react';
import { Screen } from '../components/Screen';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Ported from index.html #upload-screen.
 *
 * The disclaimer wrap keeps the original structure exactly: the wrap's onClick
 * toggles the checkbox, the checkbox's onClick stops propagation, and the
 * `<label htmlFor>` is associated. (As in the original, a click that lands on
 * the label text both toggles via the label and re-toggles via the wrap, so it
 * nets to no change — clicking the checkbox or the wrap padding is what flips
 * it. Preserved for parity.)
 */
export function Upload() {
  const { showScreen, handleFile, loadSampleContract, error } = useApp();
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const locked = !accepted;

  return (
    <Screen id="upload-screen">
      <div className="upload-wrapper">
        <button className="upload-back" onClick={() => showScreen('home')}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          <span>{t('nav-back')}</span>
        </button>

        <div className="upload-heading">
          <h2>{t('upload-h2')}</h2>
          <p>{t('upload-p')}</p>
        </div>

        {error && (
          <div id="errorBanner" className="error-banner visible">
            {error}
          </div>
        )}

        <div className="disclaimer-wrap" onClick={() => setAccepted((a) => !a)}>
          <input
            type="checkbox"
            id="disclaimerCheck"
            checked={accepted}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <label htmlFor="disclaimerCheck">
            I understand that this app is not a substitute for professional legal advice and that the
            analysis provided should not be relied upon as such.
          </label>
        </div>

        <div
          className={`drop-zone${locked ? ' locked' : ''}${dragover ? ' dragover' : ''}`}
          id="dropZone"
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDragover(true);
          }}
          onDragLeave={() => setDragover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragover(false);
            if (locked) return;
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
        >
          <input
            type="file"
            accept=".pdf,image/*"
            id="fileInput"
            ref={fileInputRef}
            disabled={locked}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />

          <div className="drop-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>

          <h3>{t('upload-drop-h3')}</h3>
          <p>{t('upload-or')}</p>

          <button
            className="btn-browse"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <span>{t('upload-browse')}</span>
          </button>
        </div>

        <div className="accepted-types">
          <span className="label">{t('upload-formats-label')}</span>
          <span className="type-tag">PDF</span>
          <span className="type-tag">JPG</span>
          <span className="type-tag">PNG</span>
          <span className="type-tag">WEBP</span>
        </div>

        <div className="sample-row">
          <span className="sample-divider">or</span>
          <button
            className="btn-sample"
            id="btnSample"
            disabled={locked}
            onClick={() => void loadSampleContract()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
              />
            </svg>
            Try a Sample Contract
          </button>
        </div>
      </div>
    </Screen>
  );
}
