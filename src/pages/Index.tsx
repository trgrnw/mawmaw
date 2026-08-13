import { GameProvider } from '@/context/GameContext';
import GameLayout from '@/components/GameLayout';
import BannedScreen from '@/components/BannedScreen';
import { useAuth } from '@/context/AuthContext';

const Index = () => {
  const { user, loading, isBanned, banChecked } = useAuth();

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
