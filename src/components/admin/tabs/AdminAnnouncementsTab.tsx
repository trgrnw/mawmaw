import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

interface Announcement {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

const AdminAnnouncementsTab: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.error(error.message); return; }
    setAnnouncements((data as Announcement[]) || []);
  };

  const createAnnouncement = async () => {
    if (!title.trim() || !message.trim()) return;

    if (busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('admin_save_announcement', { p_id: null, p_title: title.trim(), p_message: message.trim(), p_active: true, p_delete: false });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Объявление опубликовано');
    setTitle('');
    setMessage('');
    loadAnnouncements();
  };

  const toggleAnnouncement = async (id: string, isActive: boolean) => {
    if (busy) return; setBusy(true);
    const { error } = await supabase.rpc('admin_save_announcement', { p_id:id,p_title:null,p_message:null,p_active:!isActive,p_delete:false });
    setBusy(false); if (error) { toast.error(error.message); return; }
    loadAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Удалить объявление?')) return;
    if (busy) return; setBusy(true);
    const { error } = await supabase.rpc('admin_save_announcement', { p_id:id,p_title:null,p_message:null,p_active:null,p_delete:true });
    setBusy(false); if (error) { toast.error(error.message); return; }
    loadAnnouncements();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4"><p className="text-sm font-semibold">Объявление увидят игроки</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">После публикации текст появится в баннере игры и во входящих аккаунтов при следующей проверке уведомлений (обычно в течение 10 секунд). После прочтения сообщение останется в архиве. Выключение скрывает баннер, сохраняя историю.</p></div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Новое объявление</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            maxLength={120} placeholder="Заголовок"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Textarea
            maxLength={2000} placeholder="Текст объявления..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
          />
          <Button onClick={createAnnouncement} disabled={busy || title.trim().length < 3 || !message.trim()}>
            Опубликовать
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {announcements.map(a => (
          <Card key={a.id} className={!a.is_active ? 'opacity-50' : ''}>
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
                <p className="text-xs text-muted-foreground mt-2">{new Date(a.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAnnouncement(a.id, a.is_active)}
                >
                  {a.is_active ? 'Скрыть' : 'Показать'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAnnouncement(a.id)}
                >
                  Удалить
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminAnnouncementsTab;
