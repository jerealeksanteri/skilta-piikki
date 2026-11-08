import { useState } from 'react';
import { downloadCsv, type CsvFormat, type ExportRequest } from '../api/exports';
import { Button, Card, Chip, useToast } from '../ui';

const FORMAT_KEY = 'piikki.csvFormat';

function savedFormat(): CsvFormat {
  try {
    return localStorage.getItem(FORMAT_KEY) === 'standard' ? 'standard' : 'excel_fi';
  } catch {
    return 'excel_fi';
  }
}

export interface ExportOption {
  label: string;
  request: Omit<ExportRequest, 'format'>;
}

/** Download buttons for CSV exports, with the file format chosen next to them. */
export default function ExportButtons({ options }: { options: ExportOption[] }) {
  const showToast = useToast();
  const [format, setFormat] = useState<CsvFormat>(savedFormat);
  const [busy, setBusy] = useState<string | null>(null);

  const choose = (next: CsvFormat) => {
    setFormat(next);
    try {
      localStorage.setItem(FORMAT_KEY, next);
    } catch {
      // Remembering the choice is only a convenience.
    }
  };

  const download = async (option: ExportOption) => {
    setBusy(option.label);
    try {
      await downloadCsv({ ...option.request, format });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export failed', 3000);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card padded style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: 'var(--hint)', marginRight: '2px' }}>Format</span>
        <Chip selected={format === 'excel_fi'} onClick={() => choose('excel_fi')}>
          Excel (FI)
        </Chip>
        <Chip selected={format === 'standard'} onClick={() => choose('standard')}>
          Standard CSV
        </Chip>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map((option) => (
          <Button
            key={option.label}
            variant="secondary"
            style={{ flex: '1 1 140px' }}
            disabled={busy !== null}
            onClick={() => download(option)}
          >
            {busy === option.label ? 'Preparing…' : `⬇ ${option.label}`}
          </Button>
        ))}
      </div>
    </Card>
  );
}
