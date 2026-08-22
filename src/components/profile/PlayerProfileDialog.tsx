import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import GameIcon from '@/components/GameIcon';
import { getBannerCss, getFrameClass } from '@/components/profile/ProfileCustomization';
import { Heart, Star, Trash2, Loader2, Flag } from 'lucide-react';
import ReportPlayerDialog from '@/components/profile/ReportPlayerDialog';

interface Review {
  id: string;
  author_user_id: string;
  author_username: string;
  rating: number;
  text: string;
  created_at: string;
}

interface ShowcaseItem { cat: string; id: string; name: string; image: string }

interface PublicProfile {
  user_id: string;
  player_id: number;
  username: string;
  avatar_emoji: string;
  avatar_url: string | null;
  banner_url: string | null;
  frame_id: string | null;
  status_text: string | null;
  showcase_items: ShowcaseItem[] | null;
  joined_at: string;
  net_worth: number;
  last_seen_at: string | null;
  likes_count: number;
  reviews_count: number;
  avg_rating: number | null;
}

interface FullData {
  profile: PublicProfile;
  usernames: string[];
  reviews: Review[];
  i_liked: boolean;
  my_review: Review | null;
}

const formatRelative = (iso: string | null): string => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
};

interface Props {
  userId: string | null;
  onClose: () => void;
}

const PlayerProfileDialog: React.FC<Props> = ({ userId, onClose }) => {
  const { user } = useAuth();
  const [data, setData] = useState<FullData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'info' | 'showcase' | 'reviews'>('info');
  const [reportOpen, setReportOpen] = useState(false);

  // Review form
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const { data: res, error: rpcErr } = await supabase.rpc('get_player_public_profile', {
      p_profile_user_id: userId,
    });
    if (rpcErr) setError(rpcErr.message);
    else if (res) {
      const fd = res as unknown as FullData;
      setData(fd);
      if (fd.my_review) {
        setReviewText(fd.my_review.text);
        setReviewRating(fd.my_review.rating);
      } else {
        setReviewText('');
        setReviewRating(5);
      }
      setEditing(false);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) load();
    else setData(null);
  }, [userId, load]);

  const isSelf = user?.id === userId;

  const toggleLike = async () => {
    if (!userId || !user || isSelf || busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('toggle_profile_like', { p_profile_user_id: userId });
    if (e) setError(e.message);
    else await load();
    setBusy(false);
  };

  const submitReview = async () => {
    if (!userId || !user || isSelf || busy) return;
    if (!reviewText.trim()) { setError('Введите текст отзыва'); return; }
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('post_profile_review', {
      p_profile_user_id: userId,
      p_rating: reviewRating,
      p_text: reviewText.trim(),
    });
    if (e) setError(e.message);
    else await load();
    setBusy(false);
  };

  const deleteReview = async (id: string) => {
    if (busy) return;
    setBusy(true);
    const { error: e } = await supabase.rpc('delete_profile_review', { p_review_id: id });
    if (e) setError(e.message);
    else await load();
    setBusy(false);
  };

  const p = data?.profile;

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Профиль игрока</DialogTitle>
          <DialogDescription>Полная общедоступная информация</DialogDescription>
        </DialogHeader>

        {loading || !data || !p ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Banner + Avatar */}
            <div className="rounded-2xl overflow-hidden border bg-card">
              <div className="h-24 relative" style={{ background: getBannerCss(p.banner_url || 'default') }}>
                <div className="absolute -bottom-8 left-4">
                  <div className={`w-16 h-16 rounded-full bg-card border-4 border-card flex items-center justify-center text-3xl overflow-hidden ${getFrameClass(p.frame_id || 'none')}`}>
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />
                    ) : (
                      p.avatar_emoji
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-10 pb-3 px-4 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold truncate">{p.username}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono">#{p.player_id?.toLocaleString()}</p>
                  </div>
                  <button
                    onClick={toggleLike}
                    disabled={isSelf || !user || busy}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      data.i_liked ? 'bg-red-500/15 text-red-500' : 'bg-muted hover:bg-muted/70 text-muted-foreground'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={isSelf ? 'Нельзя лайкать себя' : data.i_liked ? 'Убрать лайк' : 'Поставить лайк'}
                  >
                    <Heart className="w-3.5 h-3.5" fill={data.i_liked ? 'currentColor' : 'none'} />
                    {p.likes_count}
                  </button>
                </div>
                {p.status_text && <p className="text-xs italic text-muted-foreground">"{p.status_text}"</p>}
                {data.usernames.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {data.usernames.map(u => (
                      <span key={u} className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">@{u}</span>
                    ))}
                  </div>
                )}
                {!isSelf && user && (
                  <button
                    onClick={() => setReportOpen(true)}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Flag className="w-3 h-3" /> Пожаловаться
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-muted/40 rounded-lg p-0.5">
              <button onClick={() => setTab('info')}
                className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${tab === 'info' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}>
                📊 Статистика
              </button>
              <button onClick={() => setTab('reviews')}
                className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${tab === 'reviews' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}>
                💬 Отзывы ({p.reviews_count})
              </button>
              <button onClick={() => setTab('showcase')}
                className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${tab === 'showcase' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}>
                🏆 Витрина ({p.showcase_items?.length ?? 0})
              </button>
            </div>

            {error && <div className="text-xs text-red-500 bg-red-500/10 rounded-lg p-2">{error}</div>}

            {tab === 'info' ? (
              <div className="space-y-2">
                <Stat icon="wallet" label="Состояние" value={`$${formatMoney(p.net_worth)}`} />
                <Stat icon="forbes" label="Лайков" value={p.likes_count.toString()} />
                <Stat icon="star" label="Средний рейтинг"
                  value={p.avg_rating ? `${p.avg_rating} / 5` : '—'} />
                <Stat icon="profile" label="В игре с" value={new Date(p.joined_at).toLocaleDateString()} />
                <Stat icon="time" label="Был онлайн" value={formatRelative(p.last_seen_at)} />
              </div>
            ) : tab === 'showcase' ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.isArray(p.showcase_items) && p.showcase_items.length ? p.showcase_items.map((it, idx) => <div key={`${it.cat}-${it.id}-${idx}`} className="overflow-hidden rounded-2xl border bg-card">
                  {it.image ? <div className="aspect-[4/3] relative overflow-hidden"><img src={it.image} alt={it.name} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-3"><p className="truncate text-sm font-bold text-white">{it.name}</p><p className="text-[10px] uppercase text-white/60">{it.cat}</p></div></div> : <div className="p-5"><p className="text-xs text-muted-foreground">{it.cat}</p><p className="font-semibold">{it.name}</p></div>}
                </div>) : <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Игрок пока ничего не добавил в витрину</div>}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Write/edit review */}
                {user && !isSelf && (
                  <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{data.my_review ? 'Ваш отзыв' : 'Оставить отзыв'}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => setReviewRating(n)} type="button">
                            <Star className={`w-4 h-4 ${n <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value.slice(0, 500))}
                      placeholder="Напишите что-нибудь о игроке..."
                      className="text-sm min-h-[60px]"
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{reviewText.length}/500</span>
                      <button onClick={submitReview} disabled={busy || !reviewText.trim()}
                        className="bg-primary text-primary-foreground rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50">
                        {data.my_review ? 'Обновить' : 'Опубликовать'}
                      </button>
                    </div>
                  </div>
                )}
                {isSelf && <p className="text-xs text-muted-foreground text-center py-2">Это ваш профиль — отзывы оставляют другие</p>}

                {/* Reviews list */}
                {data.reviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Пока нет отзывов</p>
                ) : (
                  <div className="space-y-2">
                    {data.reviews.map(r => (
                      <div key={r.id} className="bg-card border rounded-xl p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold truncate">{r.author_username}</span>
                            <div className="flex gap-0.5 flex-shrink-0">
                              {[1, 2, 3, 4, 5].map(n => (
                                <Star key={n} className={`w-3 h-3 ${n <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground">{formatRelative(r.created_at)}</span>
                            {(r.author_user_id === user?.id) && (
                              <button onClick={() => deleteReview(r.id)} disabled={busy}
                                className="text-muted-foreground hover:text-red-500 disabled:opacity-50">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-foreground whitespace-pre-wrap break-words">{r.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
      <ReportPlayerDialog
        open={reportOpen}
        reportedUserId={userId}
        reportedUsername={p?.username}
        onClose={() => setReportOpen(false)}
      />
    </Dialog>
  );
};

const Stat: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between bg-card border rounded-xl px-3 py-2">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <GameIcon name={icon} size={14} themed /> {label}
    </div>
    <span className="text-xs font-semibold font-mono-game text-foreground">{value}</span>
  </div>
);

export default PlayerProfileDialog;
