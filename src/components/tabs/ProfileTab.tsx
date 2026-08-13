import React, { useState } from 'react';
import ProfileTabLegacy from './ProfileTabLegacy';

type ProfileDesign = 'modern' | 'classic';
const DESIGN_KEY = 'profile_design_preference';

const ProfileTab: React.FC = () => {
  const [design, setDesign] = useState<ProfileDesign>(() => localStorage.getItem(DESIGN_KEY) === 'classic' ? 'classic' : 'modern');
  const selectDesign = (next: ProfileDesign) => {
    localStorage.setItem(DESIGN_KEY, next);
    setDesign(next);
  };

  return <div className="max-w-5xl space-y-4">
    <div className="flex justify-start">
      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        <button onClick={() => selectDesign('modern')} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${design === 'modern' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Новый дизайн</button>
        <button onClick={() => selectDesign('classic')} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${design === 'classic' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Классический</button>
      </div>
    </div>
    <ProfileTabLegacy variant={design} />
  </div>;
};

export default ProfileTab;
