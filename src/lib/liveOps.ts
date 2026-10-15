import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
export type ReleaseKind = 'car' | 'plate' | 'username' | 'nft' | 'achievement';
export type ReleaseStatus = 'draft' | 'scheduled' | 'paused' | 'archived';
export interface LimitedRelease { id: string; kind: ReleaseKind; title: string; description: string; image_url: string | null; icon: string; price: number; total_limit: number; issued_count: number; starts_at: string; ends_at: string | null; status: ReleaseStatus; payload: Json; created_at: string; updated_at: string; created_by: string | null }
export interface LimitedClaim { id: string; release_id: string; user_id?: string; serial: number; claimed_at: string; item_snapshot: { kind: ReleaseKind; title: string; description: string; image_url: string | null; icon: string; price: number; edition_size: number; text?: string; country?: string; asset_id?: string } }
export interface PlayerNotification { id: string; user_id: string; kind: string; title: string; message: string; target: string | null; dedupe_key: string; created_at: string; read_at: string | null; archived_at: string | null }
export const releaseKinds: Record<ReleaseKind, string> = { car:'Автомобиль',plate:'Номерной знак',username:'Username',nft:'NFT',achievement:'Достижение' };
export const releaseStatuses: Record<ReleaseStatus, string> = { draft:'Черновик',scheduled:'По расписанию',paused:'Приостановлен',archived:'В архиве' };
export const achievementMetrics: Record<string,string> = { totalEarnedClick:'Заработано кликами',totalEarnedBusiness:'Доход предприятий',totalEarnedRent:'Доход аренды',totalEarnedDividends:'Дивиденды',totalEarnedTrading:'Прибыль от акций',totalEarnedCrypto:'Прибыль от криптовалют',businessCount:'Количество предприятий',balance:'Баланс',playerXp:'Опыт' };
export function releasePhase(release: Pick<LimitedRelease,'status'|'starts_at'|'ends_at'|'issued_count'|'total_limit'>, now=Date.now()) {
 if (release.status !== 'scheduled') return releaseStatuses[release.status];
 if (new Date(release.starts_at).getTime()>now) return 'Запланирован';
 if (release.ends_at && new Date(release.ends_at).getTime()<=now) return 'Завершён';
 return release.issued_count>=release.total_limit ? 'Все экземпляры выданы' : 'Доступен';
}
export const rpcError = (error: unknown) => error && typeof error==='object' && 'message' in error ? String(error.message) : 'Не удалось выполнить действие';
export async function uploadReleaseImage(file: File, userId: string) {
 if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>5*1024*1024) throw Error('Загрузите PNG, JPEG или WebP размером до 5 МБ');
 const extension = file.type==='image/png' ? 'png' : file.type==='image/webp' ? 'webp' : 'jpg';
 const path = `${userId}/${crypto.randomUUID()}.${extension}`;
 const {error} = await supabase.storage.from('release-media').upload(path,file,{contentType:file.type,upsert:false});
 if (error) throw error;
 return supabase.storage.from('release-media').getPublicUrl(path).data.publicUrl;
}
