import { useEffect } from 'react';
import { playUiSound } from '@/lib/sounds';
export default function InterfaceSounds() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const target = (event.target as Element)?.closest?.('button, a, [role="button"], [role="tab"]');
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      playUiSound(target.hasAttribute('data-clicker') ? 'click' : 'tap');
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);
  return null;
}
