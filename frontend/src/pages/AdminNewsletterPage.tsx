import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import ConfirmDialog from '../components/ConfirmDialog';
import { getNewsletterAudiences, listNewsletters, sendNewsletter } from '../api/newsletters';
import type { Newsletter, NewsletterAudience, NewsletterAudienceCounts } from '../types';
import { setNavigationGuard } from '../utils/navigationGuard';
import {
  TELEGRAM_MESSAGE_LIMIT,
  markupToTelegramHtml,
  visibleLength,
} from '../utils/telegramMarkup';

const DRAFT_KEY = 'admin-newsletter-draft';

const styles = {
  section: {
    padding: '0 16px 16px',
  },
  header: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--section-header)',
    textTransform: 'uppercase' as const,
    padding: '16px 0 8px',
  },
  card: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  backBtn: {
    fontSize: '14px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '8px 16px',
    marginBottom: '8px',
  },
  segmented: {
    display: 'flex',
    backgroundColor: 'var(--secondary-bg)',
    borderRadius: '10px',
    padding: '3px',
  },
  segment: {
    flex: 1,
    padding: '8px 4px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: 'var(--text)',
  },
  segmentOn: {
    backgroundColor: 'var(--bg)',
    fontWeight: 600,
  },
  segmentCount: {
    fontSize: '12px',
    color: 'var(--hint)',
    fontWeight: 400,
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    padding: '8px',
    borderBottom: '1px solid var(--secondary-bg)',
  },
  toolBtn: {
    minWidth: '34px',
    height: '32px',
    padding: '0 8px',
    borderRadius: '8px',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '14px',
  },
  textarea: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box' as const,
    minHeight: '160px',
    padding: '12px 16px',
    border: 'none',
    outline: 'none',
    resize: 'vertical' as const,
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '15px',
    lineHeight: 1.45,
    fontFamily: 'inherit',
  },
  counter: {
    fontSize: '12px',
    textAlign: 'right' as const,
    padding: '0 16px 8px',
    color: 'var(--hint)',
  },
  hint: {
    fontSize: '12px',
    color: 'var(--hint)',
    padding: '8px 4px 0',
    lineHeight: 1.5,
  },
  chat: {
    backgroundColor: 'var(--secondary-bg)',
    borderRadius: '12px',
    padding: '12px',
  },
  bubble: {
    backgroundColor: 'var(--bg)',
    borderRadius: '14px 14px 14px 4px',
    padding: '8px 12px',
    maxWidth: '90%',
    fontSize: '15px',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
  },
  bubbleEmpty: {
    color: 'var(--hint)',
    fontStyle: 'italic' as const,
  },
  buttons: {
    display: 'flex',
    gap: '8px',
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
  },
  sendBtn: {
    flex: 2,
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
  },
  disabled: {
    opacity: 0.5,
  },
  row: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    gap: '12px',
    cursor: 'pointer',
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--secondary-bg)',
    marginLeft: '16px',
  },
  logInfo: {
    flex: 1,
    minWidth: 0,
  },
  logTitle: {
    fontSize: '14px',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  logMeta: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  logStat: {
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
  },
  logBody: {
    padding: '0 16px 12px',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '20px',
    color: 'var(--hint)',
    fontSize: '14px',
  },
  error: {
    color: 'var(--destructive)',
    fontSize: '14px',
    padding: '8px 4px 0',
  },
  toast: {
    position: 'fixed' as const,
    bottom: '104px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--text)',
    color: 'var(--bg)',
    padding: '10px 20px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 500,
    zIndex: 300,
    whiteSpace: 'nowrap' as const,
  },
};

// Telegram-like rendering for the formatting tags inside preview bubbles.
const bubbleCss = `
.tg-bubble blockquote { margin: 4px 0; padding: 2px 8px; border-left: 3px solid var(--btn); background: var(--secondary-bg); border-radius: 4px; }
.tg-bubble code { font-family: ui-monospace, Menlo, monospace; font-size: 13px; background: var(--secondary-bg); padding: 0 3px; border-radius: 4px; }
.tg-bubble pre { font-family: ui-monospace, Menlo, monospace; font-size: 13px; background: var(--secondary-bg); padding: 6px 8px; border-radius: 6px; margin: 4px 0; white-space: pre-wrap; }
.tg-bubble tg-spoiler { background: var(--hint); color: transparent; border-radius: 4px; cursor: pointer; }
.tg-bubble tg-spoiler:active, .tg-bubble tg-spoiler:hover { background: transparent; color: inherit; }
.tg-bubble a { color: var(--link); }
`;

const AUDIENCE_LABELS: Record<NewsletterAudience, string> = {
  everyone: 'Everyone',
  admins: 'Admins only',
};

type Draft = { audience: NewsletterAudience; markup: string };

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<Draft>;
      return {
        audience: d.audience === 'admins' ? 'admins' : 'everyone',
        markup: typeof d.markup === 'string' ? d.markup : '',
      };
    }
  } catch {
    // storage unavailable or corrupt: start empty
  }
  return { audience: 'everyone', markup: '' };
}

function saveDraft(draft: Draft) {
  try {
    if (draft.markup.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore: the draft is a convenience only
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function firstLine(html: string): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  return text.split('\n').find((l) => l.trim()) ?? '';
}

export default function AdminNewsletterPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [initialDraft] = useState(loadDraft);
  const [audience, setAudience] = useState<NewsletterAudience>(initialDraft.audience);
  const [markup, setMarkup] = useState(initialDraft.markup);
  const [counts, setCounts] = useState<NewsletterAudienceCounts | null>(null);
  const [log, setLog] = useState<Newsletter[]>([]);
  const [logLoaded, setLogLoaded] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const html = useMemo(() => markupToTelegramHtml(markup), [markup]);
  const length = useMemo(() => visibleLength(html), [html]);
  const isDirty = markup.trim().length > 0;
  const isEmpty = length === 0 || !html.replace(/<[^>]+>/g, '').trim();
  const overLimit = length > TELEGRAM_MESSAGE_LIMIT;
  const recipientCount = counts?.[audience] ?? 0;
  const canSend = !sending && !isEmpty && !overLimit && recipientCount > 0;

  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    saveDraft({ audience, markup });
  }, [audience, markup]);

  // Ask before leaving via the bottom navigation while a message is written.
  useEffect(
    () =>
      setNavigationGuard((proceed) => {
        if (!isDirtyRef.current) return false;
        setPendingDiscard(() => proceed);
        return true;
      }),
    [],
  );

  const refreshLog = () =>
    listNewsletters()
      .then(setLog)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLogLoaded(true));

  useEffect(() => {
    if (!user?.is_admin) return;
    getNewsletterAudiences()
      .then(setCounts)
      .catch((e: Error) => setError(e.message));
    refreshLog();
  }, [user?.is_admin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!user?.is_admin) {
    return <div style={styles.empty}>Admin access required.</div>;
  }

  const applyEdit = (next: string, selStart: number, selEnd: number) => {
    setMarkup(next);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
    });
  };

  const wrapSelection = (before: string, after = before, placeholder = 'text') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    applyEdit(next, s + before.length, s + before.length + selected.length);
  };

  const insertLink = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const label = value.slice(s, e) || 'link text';
    const urlPlaceholder = 'https://';
    const next = `${value.slice(0, s)}[${label}](${urlPlaceholder})${value.slice(e)}`;
    const urlStart = s + label.length + 3;
    applyEdit(next, urlStart, urlStart + urlPlaceholder.length);
  };

  const quoteLines = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(lineStart, e);
    const quoted = block
      .split('\n')
      .map((l) => (l.startsWith('> ') ? l : `> ${l}`))
      .join('\n');
    const next = value.slice(0, lineStart) + quoted + value.slice(e);
    applyEdit(next, lineStart, lineStart + quoted.length);
  };

  const tools: { label: ReactNode; title: string; action: () => void }[] = [
    { label: <b>B</b>, title: 'Bold', action: () => wrapSelection('**') },
    { label: <i>I</i>, title: 'Italic', action: () => wrapSelection('__') },
    { label: <u>U</u>, title: 'Underline', action: () => wrapSelection('++') },
    { label: <s>S</s>, title: 'Strikethrough', action: () => wrapSelection('~~') },
    { label: '▒', title: 'Spoiler', action: () => wrapSelection('||') },
    { label: '🔗', title: 'Link', action: insertLink },
    { label: '</>', title: 'Code', action: () => wrapSelection('`', '`', 'code') },
    { label: '❝', title: 'Quote', action: quoteLines },
  ];

  const discardDraft = () => {
    setMarkup('');
    saveDraft({ audience, markup: '' });
  };

  const askDiscard = (then: () => void) => {
    if (isDirty) setPendingDiscard(() => then);
    else then();
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await sendNewsletter(audience, markup, html);
      setConfirmSend(false);
      discardDraft();
      setToast(`Sent to ${result.delivered_count} of ${result.recipient_count}`);
      refreshLog();
    } catch (e) {
      setConfirmSend(false);
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <style>{bubbleCss}</style>
      <button
        style={styles.backBtn}
        onClick={() => askDiscard(() => navigate('/admin'))}
      >
        ← Back to Admin
      </button>

      <div style={styles.section}>
        <div style={styles.segmented}>
          {(['everyone', 'admins'] as NewsletterAudience[]).map((a) => (
            <button
              key={a}
              style={{ ...styles.segment, ...(audience === a ? styles.segmentOn : {}) }}
              onClick={() => setAudience(a)}
            >
              {AUDIENCE_LABELS[a]}
              <span style={styles.segmentCount}>
                {counts ? ` · ${counts[a]} ${counts[a] === 1 ? 'person' : 'people'}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.card}>
          <div style={styles.toolbar}>
            {tools.map((t) => (
              <button
                key={t.title}
                title={t.title}
                aria-label={t.title}
                style={styles.toolBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={t.action}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={markup}
            placeholder="Write your message…"
            onChange={(e) => setMarkup(e.target.value)}
          />
          <div style={{ ...styles.counter, ...(overLimit ? { color: 'var(--destructive)' } : {}) }}>
            {length} / {TELEGRAM_MESSAGE_LIMIT}
          </div>
        </div>
        <div style={styles.hint}>
          **bold** · __italic__ · ++underline++ · ~~strike~~ · ||spoiler|| · `code` ·
          [text](https://…) · "&gt; " at line start for a quote
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.header}>Preview</div>
        <div style={styles.chat}>
          {isEmpty ? (
            <div style={{ ...styles.bubble, ...styles.bubbleEmpty }}>Your message will appear here</div>
          ) : (
            <div
              className="tg-bubble"
              style={styles.bubble}
              // html comes from markupToTelegramHtml, which escapes all user text
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
        {error && <div style={styles.error}>{error}</div>}
      </div>

      <div style={styles.section}>
        <div style={styles.buttons}>
          <button
            style={{ ...styles.cancelBtn, ...(!isDirty ? styles.disabled : {}) }}
            disabled={!isDirty}
            onClick={() => askDiscard(() => {})}
          >
            Cancel
          </button>
          <button
            style={{ ...styles.sendBtn, ...(!canSend ? styles.disabled : {}) }}
            disabled={!canSend}
            onClick={() => setConfirmSend(true)}
          >
            Send to {recipientCount} {recipientCount === 1 ? 'person' : 'people'}
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.header}>Sent messages</div>
        {!logLoaded ? (
          <div style={styles.empty}>Loading...</div>
        ) : log.length === 0 ? (
          <div style={{ ...styles.card, ...styles.empty }}>No messages sent yet</div>
        ) : (
          <div style={styles.card}>
            {log.map((n, i) => {
              const open = expandedLog === n.id;
              return (
                <div key={n.id}>
                  {i > 0 && <div style={styles.separator} />}
                  <div style={styles.row} onClick={() => setExpandedLog(open ? null : n.id)}>
                    <div style={styles.logInfo}>
                      <div style={styles.logTitle}>{firstLine(n.html)}</div>
                      <div style={styles.logMeta}>
                        {formatDate(n.created_at)} · {n.created_by_name ?? 'Unknown'} ·{' '}
                        {AUDIENCE_LABELS[n.audience]}
                      </div>
                    </div>
                    <div
                      style={{
                        ...styles.logStat,
                        color: n.failed_count > 0 ? 'var(--destructive)' : '#4caf50',
                      }}
                    >
                      {n.delivered_count}/{n.recipient_count}
                    </div>
                  </div>
                  {open && (
                    <div style={styles.logBody}>
                      <div style={styles.chat}>
                        <div
                          className="tg-bubble"
                          style={styles.bubble}
                          // html was sanitized server-side to Telegram's tag whitelist
                          dangerouslySetInnerHTML={{ __html: n.html }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmSend && (
        <ConfirmDialog
          emoji="📣"
          title="Send newsletter?"
          subtitle={`Send this message to ${recipientCount} ${
            recipientCount === 1 ? 'person' : 'people'
          } (${AUDIENCE_LABELS[audience].toLowerCase()})? This can't be undone.`}
          confirmLabel="Send"
          loadingLabel="Sending..."
          loading={sending}
          onConfirm={handleSend}
          onCancel={() => !sending && setConfirmSend(false)}
        />
      )}

      {pendingDiscard && (
        <ConfirmDialog
          emoji="🗑️"
          title="Discard this message?"
          subtitle="What you've written will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          destructive
          onConfirm={() => {
            const proceed = pendingDiscard;
            setPendingDiscard(null);
            discardDraft();
            isDirtyRef.current = false;
            proceed();
          }}
          onCancel={() => setPendingDiscard(null)}
        />
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
