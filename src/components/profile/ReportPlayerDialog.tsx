import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const CATS: { id: string; label: string }[] = [
  { id: 'cheating', label: '🤖 Читы / автокликеры' },
  { id: 'insults', label: '😡 Оскорбления / токсичность' },
  { id: 'spam', label: '📢 Спам' },
  { id: 'multi', label: '👥 Мультиаккаунт' },
  { id: 'other', label: '❓ Другое' },
];

interface Props {
  open: boolean;
  reportedUserId: string | null;
  reportedUsername?: string;
  onClose: () => void;
}

const ReportPlayerDialog: React.FC<Props> = ({ open, reportedUserId, reportedUsername, onClose }) => {
  const [category, setCategory] = useState('cheating');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reportedUserId) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('submit_player_report', {
      p_reported_user_id: reportedUserId,
      p_category: category,
      p_description: description.trim(),
    });
    setBusy(false);
    if (e) setError(e.message);
    else { setDone(true); setTimeout(() => { setDone(false); setDescription(''); onClose(); }, 1200); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Пожаловаться на игрока</DialogTitle>
          <DialogDescription>
            {reportedUsername ? `Жалоба на ${reportedUsername}` : 'Опишите нарушение'}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="py-6 text-center text-sm text-green-600">✅ Жалоба отправлена</div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Категория</label>
              <div className="grid grid-cols-1 gap-1 mt-1">
                {CATS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border text-left transition-colors ${
                      category === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Описание (опционально)</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 1000))}
                placeholder="Что произошло, когда, какие доказательства..."
                className="mt-1 min-h-[80px]"
              />
              <p className="text-[10px] text-muted-foreground text-right mt-0.5">{description.length}/1000</p>
            </div>
            {error && <div className="text-xs text-red-500 bg-red-500/10 rounded-lg p-2">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Отмена</Button>
              <Button size="sm" onClick={submit} disabled={busy}>
                {busy && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                Отправить
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReportPlayerDialog;
