import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Report {
  id: string;
  reporter_user_id: string;
  reported_user_id: string;
  category: string;
  description: string;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  created_at: string;
  staff_note: string | null;
}

const CAT: Record<string, string> = {
  cheating: '🤖 Читы',
  insults: '😡 Оскорбления',
  spam: '📢 Спам',
  multi: '👥 Мульти',
  other: '❓ Другое',
};

const STATUS_FILTERS = ['pending', 'accepted', 'rejected'] as const;

const AdminReportsTab: React.FC = () => {
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>('pending');
  const [reports, setReports] = useState<Report[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('player_reports').select('*')
      .eq('status', filter).order('created_at', { ascending: false }).limit(200);
    const list = (data as any) || [];
    setReports(list);
    const ids = Array.from(new Set(list.flatMap((r: Report) => [r.reporter_user_id, r.reported_user_id]))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, username').in('user_id', ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.username; });
      setUsernames(map);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: 'accepted' | 'rejected') => {
    setBusy(id);
    await supabase.rpc('update_report_status', { p_report_id: id, p_status: status, p_note: null });
    setBusy(null);
    load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">🚩 Жалобы на игроков</h2>
      <div className="flex gap-2">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}>
            {s === 'pending' ? 'Ожидают' : s === 'accepted' ? 'Приняты' : 'Отклонены'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Нет жалоб</p>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="bg-card border rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs">
                  <div className="font-semibold">
                    {usernames[r.reporter_user_id] || '—'} → {usernames[r.reported_user_id] || '—'}
                  </div>
                  <div className="text-muted-foreground mt-0.5">{CAT[r.category]} · {new Date(r.created_at).toLocaleString()}</div>
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'rejected')} disabled={busy === r.id}>Отклонить</Button>
                    <Button size="sm" onClick={() => setStatus(r.id, 'accepted')} disabled={busy === r.id}>Принять</Button>
                  </div>
                )}
              </div>
              {r.description && <p className="text-xs whitespace-pre-wrap break-words bg-muted/30 rounded-lg p-2">{r.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReportsTab;
