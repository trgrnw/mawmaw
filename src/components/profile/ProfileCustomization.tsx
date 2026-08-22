import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import GameIcon from '@/components/GameIcon';

// Frame presets - subtle ring styles around avatar
export const FRAMES = [
  { id: 'none',   label: 'Без рамки',  className: '' },
  { id: 'gold',   label: 'Золотая',    className: 'ring-4 ring-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]' },
  { id: 'silver', label: 'Серебро',    className: 'ring-4 ring-slate-400 shadow-[0_0_15px_rgba(148,163,184,0.5)]' },
  { id: 'bronze', label: 'Бронза',     className: 'ring-4 ring-orange-700 shadow-[0_0_15px_rgba(194,65,12,0.5)]' },
  { id: 'neon',   label: 'Неон',       className: 'ring-4 ring-fuchsia-500 shadow-[0_0_25px_rgba(217,70,239,0.6)]' },
  { id: 'fire',   label: 'Огонь',      className: 'ring-4 ring-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)]' },
  { id: 'ice',    label: 'Лёд',        className: 'ring-4 ring-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.6)]' },
  { id: 'galaxy', label: 'Галактика',  className: 'ring-4 ring-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.7)]' },
  { id: 'emerald',label: 'Изумруд',    className: 'ring-4 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' },
];

// Banner presets - background gradient for top of profile
export const BANNERS = [
  { id: 'default',  label: 'Стандарт',  css: 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--card)))' },
  { id: 'sunset',   label: 'Закат',     css: 'linear-gradient(135deg, #f97316, #ec4899, #8b5cf6)' },
  { id: 'ocean',    label: 'Океан',     css: 'linear-gradient(135deg, #0891b2, #1e40af, #312e81)' },
  { id: 'forest',   label: 'Лес',       css: 'linear-gradient(135deg, #166534, #15803d, #65a30d)' },
  { id: 'fire',     label: 'Огонь',     css: 'linear-gradient(135deg, #dc2626, #ea580c, #facc15)' },
  { id: 'space',    label: 'Космос',    css: 'linear-gradient(135deg, #0c0a1e, #4c1d95, #be185d)' },
  { id: 'gold',     label: 'Золото',    css: 'linear-gradient(135deg, #ca8a04, #facc15, #fef3c7)' },
  { id: 'mint',     label: 'Мята',      css: 'linear-gradient(135deg, #10b981, #06b6d4, #6366f1)' },
  { id: 'rose',     label: 'Роза',      css: 'linear-gradient(135deg, #f43f5e, #ec4899, #d946ef)' },
];

export const getBannerCss = (id: string) => /^https?:\/\//.test(id)
  ? `url("${id.replace(/"/g, '%22')}") center / cover no-repeat`
  : BANNERS.find(b => b.id === id)?.css || BANNERS[0].css;
export const getFrameClass = (id: string) => FRAMES.find(f => f.id === id)?.className || '';

interface CustomizationData {
  banner_url: string;
  frame_id: string;
  status_text: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  current: CustomizationData;
  onSaved: (next: CustomizationData) => void;
}

const ProfileCustomization: React.FC<Props> = ({ open, onClose, current, onSaved }) => {
  const { user, avatarEmoji, avatarUrl, updateProfile } = useAuth();
  const [banner, setBanner] = useState(current.banner_url || 'default');
  const [frame, setFrame] = useState(current.frame_id || 'none');
  const [status, setStatus] = useState(current.status_text || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bannerSource, setBannerSource] = useState<string | null>(null);
  const [bannerFileType, setBannerFileType] = useState('image/jpeg');
  const [bannerZoom, setBannerZoom] = useState(1);
  const [bannerX, setBannerX] = useState(50);
  const [bannerY, setBannerY] = useState(50);

  useEffect(() => {
    if (open) {
      setBanner(current.banner_url || 'default');
      setFrame(current.frame_id || 'none');
      setStatus(current.status_text || '');
    }
  }, [open, current]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
      toast.error('Допустимы только JPG, PNG, WebP, GIF');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Файл не должен превышать 2 МБ');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600', upsert: true, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: rpcErr } = await supabase.rpc('update_profile_extras', {
        p_avatar_url: url, p_showcase: null,
      });
      if (rpcErr) throw rpcErr;
      await updateProfile({ avatarUrl: url });
      toast.success('Аватар обновлён');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !avatarUrl) return;
    setUploading(true);
    try {
      const { error: rpcErr } = await supabase.rpc('update_profile_extras', {
        p_avatar_url: '', p_showcase: null,
      });
      if (rpcErr) throw rpcErr;
      await updateProfile({ avatarUrl: '' });
      toast.success('Фото убрано');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (status.length > 360) { toast.error('Описание слишком длинное (макс. 360 символов)'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_profile_customization', {
        p_banner: banner,
        p_frame: frame,
        p_status: status,
      });
      if (error) throw error;
      onSaved({ banner_url: banner, frame_id: frame, status_text: status });
      toast.success('Профиль обновлён');
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const selectBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Для баннера допустимы только PNG, JPG или JPEG');
      return;
    }
    if (file.size > 8 * 1024 * 1024) { toast.error('Баннер не должен превышать 8 МБ'); return; }
    setBannerFileType(file.type);
    setBannerSource(URL.createObjectURL(file));
    setBannerZoom(1); setBannerX(50); setBannerY(50);
  };

  const saveCroppedBanner = async () => {
    if (!user || !bannerSource) return;
    setUploading(true);
    try {
      const image = new Image();
      image.src = bannerSource;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1500; canvas.height = 500;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Браузер не поддерживает обработку изображения');
      const cover = Math.max(canvas.width / image.width, canvas.height / image.height) * bannerZoom;
      const width = image.width * cover; const height = image.height * cover;
      const overflowX = Math.max(0, width - canvas.width); const overflowY = Math.max(0, height - canvas.height);
      ctx.drawImage(image, -overflowX * bannerX / 100, -overflowY * bannerY / 100, width, height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, bannerFileType, 0.92));
      if (!blob) throw new Error('Не удалось подготовить баннер');
      const ext = bannerFileType === 'image/png' ? 'png' : 'jpg';
      const path = `${user.id}/banner-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('profile-banners').upload(path, blob, { contentType: bannerFileType, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('profile-banners').getPublicUrl(path);
      setBanner(data.publicUrl);
      URL.revokeObjectURL(bannerSource);
      setBannerSource(null);
      toast.success('Баннер подготовлен. Нажмите «Сохранить».');
    } catch (error: any) { toast.error(error.message || 'Ошибка загрузки баннера'); }
    finally { setUploading(false); }
  };

  const renderAvatar = (frameClass: string, size = 'w-16 h-16', text = 'text-3xl') => (
    <div className={`${size} rounded-full bg-card border-4 border-card flex items-center justify-center ${text} overflow-hidden ${frameClass}`}>
      {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : avatarEmoji}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GameIcon name="diamond" size={20} themed /> Кастомизация профиля</DialogTitle>
          <DialogDescription>Настройте свой профиль — баннер, рамка аватара и статус</DialogDescription>
        </DialogHeader>

        {/* Live preview */}
        <div className="rounded-2xl overflow-hidden border">
          <div className="h-24 relative" style={{ background: getBannerCss(banner) }}>
            <div className="absolute -bottom-8 left-4">
              {renderAvatar(getFrameClass(frame))}
            </div>
          </div>
          <div className="pt-10 pb-3 px-4">
            <p className="text-xs text-muted-foreground italic min-h-[16px]">{status || '— нет статуса —'}</p>
          </div>
        </div>

        {/* Avatar photo upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Фото аватара</label>
          <div className="flex items-center gap-3">
            {renderAvatar('', 'w-14 h-14', 'text-2xl')}
            <div className="flex-1 flex flex-wrap gap-2">
              <label className={`px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : 'hover:opacity-90'}`}>
                {uploading ? 'Загрузка...' : (avatarUrl ? 'Заменить фото' : 'Загрузить фото')}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
              </label>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                  className="px-3 py-2 rounded-xl border text-xs hover:bg-muted disabled:opacity-50"
                >
                  Убрать фото
                </button>
              )}
              <p className="w-full text-[10px] text-muted-foreground">JPG/PNG/WebP/GIF, до 2 МБ. Без фото показывается эмодзи.</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Описание ({status.length}/360)</label>
          <textarea
            value={status}
            onChange={e => setStatus(e.target.value.slice(0, 360))}
            placeholder="Например: Стремлюсь к миллиарду 💰"
            rows={4}
            className="w-full resize-none px-3 py-2 rounded-xl border bg-background text-sm"
          />
        </div>

        {/* Banners */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Баннер</label>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-3">
            <label className="cursor-pointer rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              Загрузить свой баннер
              <input type="file" accept="image/png,image/jpeg,.jpg,.jpeg" className="hidden" onChange={selectBannerFile} />
            </label>
            <span className="text-[11px] text-muted-foreground">Рекомендуемый размер: 1500×500 px (3:1), PNG/JPG/JPEG, до 8 МБ</span>
          </div>
          {bannerSource && <div className="space-y-3 rounded-xl border p-3">
            <p className="text-xs font-semibold">Подкорректируйте изображение под формат 1500×500</p>
            <div className="aspect-[3/1] overflow-hidden rounded-lg bg-muted" style={{ backgroundImage: `url("${bannerSource}")`, backgroundSize: `${bannerZoom * 100}% auto`, backgroundPosition: `${bannerX}% ${bannerY}%`, backgroundRepeat: 'no-repeat' }} />
            <label className="block text-[11px]">Масштаб <input className="w-full" type="range" min="1" max="3" step="0.05" value={bannerZoom} onChange={e => setBannerZoom(Number(e.target.value))} /></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-[11px]">По горизонтали <input className="w-full" type="range" min="0" max="100" value={bannerX} onChange={e => setBannerX(Number(e.target.value))} /></label><label className="text-[11px]">По вертикали <input className="w-full" type="range" min="0" max="100" value={bannerY} onChange={e => setBannerY(Number(e.target.value))} /></label></div>
            <button onClick={saveCroppedBanner} disabled={uploading} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{uploading ? 'Обрабатываю…' : 'Применить кадрирование'}</button>
          </div>}
          <div className="grid grid-cols-3 gap-2">
            {BANNERS.map(b => (
              <button
                key={b.id}
                onClick={() => setBanner(b.id)}
                className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  banner === b.id ? 'border-primary scale-[1.02]' : 'border-transparent hover:border-foreground/20'
                }`}
                style={{ background: b.css }}
              >
                <span className="absolute bottom-1 left-1 text-[10px] font-medium text-white drop-shadow">{b.label}</span>
                {banner === b.id && (
                  <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Frames */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Рамка аватара</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {FRAMES.map(f => (
              <button
                key={f.id}
                onClick={() => setFrame(f.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                  frame === f.id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/40'
                }`}
              >
                <div className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl overflow-hidden ${f.className}`}>
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : avatarEmoji}
                </div>
                <span className="text-[10px] text-muted-foreground">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm">Отмена</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileCustomization;
