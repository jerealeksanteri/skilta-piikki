import { apiRequest } from './client';
import type { TransactionStatus } from '../types';

export type CsvFormat = 'excel_fi' | 'standard';
export type ExportKind = 'report_summary' | 'report_transactions' | 'fiscal_periods' | 'fiscal_debts';

export interface ExportRequest {
  kind: ExportKind;
  format: CsvFormat;
  start?: string;
  end?: string;
  statuses?: TransactionStatus[];
  period_id?: number;
}

/**
 * Download a CSV export. The backend hands out a short-lived signed link,
 * because Telegram's in-app download can't send our auth header. Inside
 * Telegram (Bot API 8.0+) the app's own download sheet saves it; elsewhere a
 * plain link does.
 */
export async function downloadCsv(request: ExportRequest): Promise<void> {
  const link = await apiRequest<{ url: string; file_name: string }>('/admin/exports', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  const url = new URL(link.url, window.location.origin).href;
  const tg = window.Telegram?.WebApp;
  if (tg?.downloadFile && tg.isVersionAtLeast?.('8.0')) {
    tg.downloadFile({ url, file_name: link.file_name });
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = link.file_name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
