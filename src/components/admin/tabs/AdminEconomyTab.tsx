import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AdminEconomyTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">💰 Управление экономикой</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🏗️ В разработке</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Здесь будет: настройка цен товаров, множителей заработка, глобальных модификаторов экономики.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEconomyTab;
