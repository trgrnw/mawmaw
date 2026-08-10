import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AdminCasinoTab: React.FC = () => {
  const [stats, setStats] = useState({ totalBets: 0, totalWins: 0, totalLosses: 0, totalProfit: 0 });
  const [recentBets, setRecentBets] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: bets } = await supabase
      .from('casino_bets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (bets) {
      const wins = bets.filter(b => b.result === 'win').length;
      const losses = bets.filter(b => b.result === 'loss').length;
      const profit = bets.reduce((sum, b) => sum + (b.profit || 0), 0);
      setStats({ totalBets: bets.length, totalWins: wins, totalLosses: losses, totalProfit: profit });
      setRecentBets(bets.slice(0, 20));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">🎰 Статистика казино</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.totalBets}</p>
            <p className="text-xs text-muted-foreground">Ставок</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.totalWins}</p>
            <p className="text-xs text-muted-foreground">Выигрышей</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.totalLosses}</p>
            <p className="text-xs text-muted-foreground">Проигрышей</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${stats.totalProfit.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Профит игроков</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Последние ставки</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentBets.map(bet => (
              <div key={bet.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{bet.username}</p>
                  <p className="text-xs text-muted-foreground">{bet.game_type} • {new Date(bet.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono">${bet.bet_amount.toLocaleString()}</p>
                  <p className={`text-xs font-medium ${bet.result === 'win' ? 'text-green-500' : 'text-red-500'}`}>
                    {bet.result === 'win' ? `+$${bet.profit?.toLocaleString()}` : bet.result}
                  </p>
                </div>
              </div>
            ))}
            {recentBets.length === 0 && <p className="text-muted-foreground">Нет данных</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCasinoTab;
