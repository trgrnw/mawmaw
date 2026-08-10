import { GameProvider } from '@/context/GameContext';
import GameLayout from '@/components/GameLayout';
import BannedScreen from '@/components/BannedScreen';
import { useAuth } from '@/context/AuthContext';

const Index = () => {
  const { user, isBanned, banChecked } = useAuth();

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
