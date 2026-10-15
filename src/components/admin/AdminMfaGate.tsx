import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminMfaGate({ children }: { children: ReactNode }) {
  const [verified, setVerified] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState(''), [qr, setQr] = useState(''), [secret, setSecret] = useState(''), [code, setCode] = useState(''), [error, setError] = useState('');
  const check = useCallback(async()=>{
    try {
      const assurance=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if(assurance.error)throw assurance.error;
      setVerified(assurance.data.currentLevel==='aal2');
      const factors=await supabase.auth.mfa.listFactors();
      if(factors.error)throw factors.error;
      setFactorId(current=>factors.data.totp.find(factor=>factor.status==='verified')?.id||current);
    } catch(error){setError(error instanceof Error?error.message:'Не удалось проверить двухфакторный вход');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void check();const {data}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void check(),0);});return ()=>data.subscription.unsubscribe();},[check]);
  const enroll=async()=>{
    if(busy)return;setBusy(true);setError('');
    try{
      const factors=await supabase.auth.mfa.listFactors();if(factors.error)throw factors.error;
      for(const factor of factors.data.all.filter(f=>f.factor_type==='totp'&&f.status==='unverified')){const result=await supabase.auth.mfa.unenroll({factorId:factor.id});if(result.error)throw result.error;}
      const result=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'Financial Clicker Admin'});
      if(result.error)throw result.error;
      setFactorId(result.data.id);setQr(result.data.totp.qr_code);setSecret(result.data.totp.secret);
    }catch(error){setError(error instanceof Error?error.message:'Не удалось включить двухфакторный вход');}finally{setBusy(false);}
  };
  const verify=async()=>{
    if(busy||!factorId||!/^\d{6}$/.test(code))return;setBusy(true);setError('');
    try{const result=await supabase.auth.mfa.challengeAndVerify({factorId,code});if(result.error)throw result.error;setQr('');setSecret('');setCode('');await check();}
    catch(error){setError(error instanceof Error?error.message:'Неверный или просроченный код');}finally{setBusy(false);}
  };
  if(loading)return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  if(verified)return <>{children}</>;
  return <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6"><ShieldCheck className="h-10 w-10 text-primary"/><h1 className="text-2xl font-bold">Защищённый вход в админку</h1><p className="text-sm text-muted-foreground">Для административных операций нужен код из приложения-аутентификатора. Проверка действует и на сервере.</p>{!factorId?<Button onClick={enroll} disabled={busy}>Подключить аутентификатор</Button>:<>{qr&&<><img src={qr} alt="QR-код настройки аутентификатора" className="mx-auto h-52 w-52 rounded-xl bg-white p-2"/><p className="text-xs text-muted-foreground">Добавьте аккаунт в приложении-аутентификаторе. Если камера недоступна, введите ключ вручную:</p><code className="break-all rounded-lg border p-3 text-sm">{secret}</code></>}<label className="text-sm">Код из приложения<Input aria-label="Код двухфакторного входа" value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} onChange={event=>setCode(event.target.value.replace(/\D/g,''))} onKeyDown={event=>event.key==='Enter'&&void verify()} className="mt-2"/></label><Button disabled={busy||code.length!==6} onClick={verify}>{busy?'Проверка…':'Войти в админку'}</Button></>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
