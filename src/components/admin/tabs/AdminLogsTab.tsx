import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LogRow {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id: string | null;
  details: any;
  created_at: string;
  admin_name?: string;
  target_name?: string;
}

const AdminLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const { data: logsData } = await supabase
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: profiles } = await supabase.from('profiles').select('user_id, username');

    const merged = (logsData || []).map(l => ({
      ...l,
      admin_name: profiles?.find(p => p.user_id === l.admin_user_id)?.username || 'Unknown',
      target_name: l.target_user_id ? profiles?.find(p => p.user_id === l.target_user_id)?.username || '—' : '—',
    }));

    setLogs(merged);
    setLoading(false);
  };

  const getActionLabel = (action: string) => {
    const map: Record<string, string> = {
      change_balance: '💰 Изменение баланса',
      reset_progress: '🗑️ Сброс прогресса',
      assign_role: '👑 Назначение роли',
      remove_role: '❌ Удаление роли',
      create_announcement: '📢 Объявление',
    };
    return map[action] || action;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">📋 Журнал действий</h2>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-muted-foreground">Загрузка...</p>
          ) : logs.length === 0 ? (
            <p className="p-4 text-muted-foreground">Нет записей</p>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="p-4 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{getActionLabel(log.action)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Админ: <span className="font-medium">{log.admin_name}</span>
                      {log.target_name !== '—' && <> → Цель: <span className="font-medium">{log.target_name}</span></>}
                    </p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogsTab;
