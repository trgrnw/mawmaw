import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    isLoading, 
    isStaff, 
    role,
  } = useAdminAuth();

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">🔐 Доступ запрещён</CardTitle>
            <CardDescription>Войдите в аккаунт для доступа к админ-панели</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Войти в аккаунт
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading role check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Проверка прав доступа...</p>
        </div>
      </div>
    );
  }

  // Not staff
  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">⛔ Нет доступа</CardTitle>
            <CardDescription>У вас нет прав для доступа к админ-панели</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Если вы считаете это ошибкой, обратитесь к владельцу проекта.
            </p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Вернуться в игру
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authorization is enforced by the server-backed user_roles table and RLS.
  return <AdminLayout role={role!} />;
};

export default Admin;
