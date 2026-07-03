'use client';

import { useState } from 'react';
import type { RenderWarning } from 'emailmd';
import { EmailPreview } from '../email-preview.js';
import { Button, Popover, Tip, cx } from './ui.js';
import { CopyButton } from './copy-button.js';
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  InfoIcon,
  MonitorIcon,
  Share2Icon,
  SmartphoneIcon,
  TriangleAlertIcon,
} from './icons.js';
import { writeShareToLocation } from './share.js';

type Tab = 'preview' | 'html' | 'text';

// Gmail clips messages over ~102KB. Warn a bit before we hit the cliff.
const GMAIL_CLIP_BYTES = 102 * 1024;
const GMAIL_WARN_BYTES = 90 * 1024;

interface OutputPaneProps {
  markdown: string;
  html: string;
  minifiedHtml: string;
  text: string;
  warnings: RenderWarning[];
  error: Error | null;
  share?: boolean;
}

export function OutputPane({
  markdown,
  html,
  minifiedHtml,
  text,
  warnings,
  error,
  share,
}: OutputPaneProps) {
  const [tab, setTab] = useState<Tab>('preview');
  const [mobile, setMobile] = useState(false);
  const [minified, setMinified] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'preview', label: 'Preview' },
    { id: 'html', label: 'HTML Source' },
    { id: 'text', label: 'Plain Text' },
  ];

  const shownHtml = minified ? minifiedHtml : html;
  const byteSize = new Blob([shownHtml]).size;

  return (
    <div className="emd-output">
      <WarningsBanner warnings={warnings} error={error} />
      <div className="emd-output-bar">
        {tabs.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx('emd-output-tab', tab === t.id && 'emd-output-tab-active')}
          >
            {t.label}
          </button>
        ))}

        <div className="emd-output-actions">
          {tab === 'preview' && (
            <>
              <Tip label="Desktop">
                <Button
                  size="icon-sm"
                  aria-label="Desktop preview"
                  className={cx(!mobile && 'emd-btn-active')}
                  onClick={() => setMobile(false)}
                >
                  <MonitorIcon />
                </Button>
              </Tip>
              <Tip label="Mobile">
                <Button
                  size="icon-sm"
                  aria-label="Mobile preview"
                  className={cx(mobile && 'emd-btn-active')}
                  onClick={() => setMobile(true)}
                >
                  <SmartphoneIcon />
                </Button>
              </Tip>
            </>
          )}
          {tab === 'html' && (
            <>
              <span
                className={cx(
                  'emd-bytes',
                  byteSize >= GMAIL_CLIP_BYTES
                    ? 'emd-bytes-over'
                    : byteSize >= GMAIL_WARN_BYTES && 'emd-bytes-warn'
                )}
              >
                {formatBytes(byteSize)}
              </span>
              <div className="emd-segmented">
                <button
                  type="button"
                  className={cx('emd-segmented-item', !minified && 'emd-segmented-active')}
                  onClick={() => setMinified(false)}
                >
                  Pretty
                </button>
                <button
                  type="button"
                  className={cx('emd-segmented-item', minified && 'emd-segmented-active')}
                  onClick={() => setMinified(true)}
                >
                  Minified
                </button>
              </div>
              <Popover
                align="end"
                className="emd-popup-info"
                trigger={({ toggle }) => (
                  <Button size="icon-sm" aria-label="About HTML output" onClick={toggle}>
                    <InfoIcon />
                  </Button>
                )}
              >
                Gmail clips messages over 102 KB. Minified output strips whitespace. Template
                placeholders written as <code>{'{{ var }}'}</code> or <code>{'[[ var ]]'}</code>{' '}
                are preserved. Other delimiters may break — use the npm package with a custom{' '}
                <code>templateSyntax</code> if you need them.
              </Popover>
              <CopyButton text={shownHtml} label="Copy HTML" />
            </>
          )}
          {tab === 'text' && <CopyButton text={text} />}
          {share && <ShareButton markdown={markdown} />}
          <DownloadButton html={html} />
        </div>
      </div>

      {tab === 'preview' && (
        <div className={cx('emd-preview-host', mobile && 'emd-preview-host-mobile')}>
          <EmailPreview
            html={html}
            device={mobile ? 'mobile' : 'desktop'}
            className={cx('emd-preview-frame', mobile && 'emd-preview-frame-mobile')}
          />
        </div>
      )}
      {tab === 'html' && <pre className="emd-source">{shownHtml}</pre>}
      {tab === 'text' && <pre className="emd-source emd-source-text">{text}</pre>}
    </div>
  );
}

function ShareButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = await writeShareToLocation(markdown);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // URL is in the address bar regardless.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Tip label={copied ? 'Link copied' : 'Share link'}>
      <Button size="icon-sm" aria-label="Share link" onClick={handleShare}>
        {copied ? <CheckIcon /> : <Share2Icon />}
      </Button>
    </Tip>
  );
}

function DownloadButton({ html }: { html: string }) {
  function handleDownload() {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Tip label="Download HTML">
      <Button size="icon-sm" aria-label="Download HTML" onClick={handleDownload}>
        <DownloadIcon />
      </Button>
    </Tip>
  );
}

function WarningsBanner({
  warnings,
  error,
}: {
  warnings: RenderWarning[];
  error: Error | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (error) {
    return (
      <div className="emd-warnings emd-warnings-error">
        <TriangleAlertIcon />
        <span>
          <strong>Render error:</strong> <code>{error.message}</code>
        </span>
      </div>
    );
  }

  if (warnings.length === 0) return null;

  const [first] = warnings;
  return (
    <div className="emd-warnings">
      <button
        type="button"
        className="emd-warnings-summary"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        disabled={warnings.length === 1}
      >
        <TriangleAlertIcon />
        <span className="emd-warnings-text">
          {warnings.length === 1 ? (
            <>
              <strong>{capitalize(first.stage)}:</strong> {first.message}
            </>
          ) : (
            <>
              {warnings.length} render warnings — <strong>{capitalize(first.stage)}:</strong>{' '}
              {first.message}
            </>
          )}
        </span>
        {warnings.length > 1 && (
          <ChevronDownIcon
            className={cx('emd-warnings-caret', expanded && 'emd-warnings-caret-open')}
          />
        )}
      </button>
      {expanded && warnings.length > 1 && (
        <ul className="emd-warnings-list">
          {warnings.map((w, i) => (
            <li key={i}>
              <strong>{capitalize(w.stage)}:</strong> {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}
