import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { Link, Navigate } from 'react-router-dom';

const Auth: React.FC = () => {
  const { user, loading, signUp, signIn } = useAuth();
  const { t } = useI18n();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="text-4xl animate-pulse">🎮</span>
    </div>
  );

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (!username.trim()) { setError(t('auth.enter_name')); setSubmitting(false); return; }
      const { error } = await signUp(email, password, username.trim());
      if (error) setError(error);
      else setMessage(t('auth.check_email'));
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-5xl">🎮</span>
          <h1 className="text-2xl font-bold text-foreground mt-3">Financial Clicker</h1>
          <p className="text-sm text-muted-foreground">Business Empire</p>
        </div>

        <div className="bg-card rounded-2xl border p-6 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => { setIsLogin(true); setError(''); setMessage(''); }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${isLogin ? 'bg-primary/15 text-foreground border border-primary' : 'bg-muted/30 text-muted-foreground'}`}
            >
              {t('auth.login')}
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); setMessage(''); }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${!isLogin ? 'bg-primary/15 text-foreground border border-primary' : 'bg-muted/30 text-muted-foreground'}`}
            >
              {t('auth.signup')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <input
                type="text"
                placeholder={t('auth.username')}
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                maxLength={20}
                autoComplete="nickname"
                required
              />
            )}
            <input
              type="email"
              placeholder={t('auth.email')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
              autoComplete="email"
            />
            {!isLogin && (
              <p className="px-1 text-[11px] text-muted-foreground">{t('auth.email_hint')}</p>
            )}
            <input
              type="password"
              placeholder={t('auth.password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />

            {error && <p className="text-destructive text-xs">{error}</p>}
            {message && <p className="text-sm text-foreground/80 bg-primary/10 rounded-lg px-3 py-2">{message}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? '...' : isLogin ? t('auth.submit.login') : t('auth.submit.signup')}
            </button>
          </form>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          {t('auth.play_local')}
        </p>
        <div className="text-center">
          <Link to="/" className="text-sm text-primary hover:underline">{t('auth.play_without')}</Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
