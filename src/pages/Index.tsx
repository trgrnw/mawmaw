import { GameProvider } from '@/context/GameContext';
import GameLayout from '@/components/GameLayout';
import BannedScreen from '@/components/BannedScreen';
import { useAuth } from '@/context/AuthContext';

const Index = () => {
  const { user, loading, isBanned, banChecked, refreshBan } = useAuth();

  // Do not mount the game under the guest save key while Supabase is still
  // restoring an authenticated session. That identity race could overwrite
  // the player's save with an empty guest snapshot during refresh.
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user && !banChecked) return <div className="flex min-h-screen items-center justify-center p-6"><div className="max-w-sm rounded-2xl border bg-card p-6 text-center"><p className="font-medium">Проверяем доступ к аккаунту</p><p className="mt-2 text-sm text-muted-foreground">Для начала онлайн-игры нужно подтверждение сервера.</p><button onClick={()=>void refreshBan()} className="mt-4 rounded-xl border px-4 py-2 text-sm">Повторить проверку</button></div></div>;

  // Show ban screen if logged-in user is banned
  if (user && banChecked && isBanned) {
    return <BannedScreen />;
  }

  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
};

export default Index;
