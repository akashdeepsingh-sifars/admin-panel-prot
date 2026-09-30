import { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useStore } from '../store';
import { Button } from './ui';

export function WriteModeBar(): JSX.Element {
  const { writeMode, setWriteMode } = useStore();
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 border px-4 py-3 ${writeMode ? 'border-destructive bg-destructive-tint text-destructive-ink' : 'border-border-strong bg-card'}`}>
        <div className="flex items-center gap-3 text-sm">
          {writeMode ? <Unlock size={18} /> : <Lock size={18} />}
          <div>
            <div className="font-semibold">{writeMode ? 'Write mode is ON' : 'Read-only mode'}</div>
            <div className={writeMode ? '' : 'text-muted-foreground'}>
              {writeMode ? 'Cells can be edited and rows deleted. Every change is written to the audit log.' : 'Tables cannot be changed. Turn on write mode to edit rows.'}
            </div>
          </div>
        </div>
        {writeMode ? (
          <Button variant="secondary" onClick={() => setWriteMode(false)}>
            Turn off write mode
          </Button>
        ) : (
          <Button onClick={() => setConfirm(true)}>Enable write mode</Button>
        )}
      </div>
      {confirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-navy-dark/60 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md border border-border-strong bg-card p-5 shadow-card-md">
            <h2 className="text-base font-semibold text-navy-dark">Enable write mode?</h2>
            <p className="mt-2 text-sm">
              You will be able to change or delete rows directly in the database. Changes cannot be undone from this screen and are recorded in the audit log under your name. In the real panel the server re-checks your write permission on every request.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setWriteMode(true);
                  setConfirm(false);
                }}
              >
                Enable write mode
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
