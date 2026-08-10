import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setAnnouncements((data as Announcement[]) || []);
  };

  const createAnnouncement = async () => {
    if (!title.trim() || !message.trim()) return;

    const user = (await supabase.auth.getUser()).data.user;
    await supabase.from('announcements').insert({
      title: title.trim(),
      message: message.trim(),
      created_by: user?.id,
    });

    await supabase.from('admin_logs').insert({
      admin_user_id: user?.id,
      action: 'create_announcement',
      details: { title: title.trim() },
    });

    setTitle('');
    setMessage('');
    loadAnnouncements();
  };

  const toggleAnnouncement = async (id: string, isActive: boolean) => {
    await supabase.from('announcements').update({ is_active: !isActive }).eq('id', id);
    loadAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Удалить объявление?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    loadAnnouncements();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">📢 Объявления</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Новое объявление</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Заголовок"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Текст объявления..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
          />
          <Button onClick={createAnnouncement} disabled={!title.trim() || !message.trim()}>
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
                  {a.is_active ? '🔇' : '🔔'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAnnouncement(a.id)}
                >
                  🗑️
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
