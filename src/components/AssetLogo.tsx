import React from 'react';
import { assetUrl } from '@/lib/assets';

// Map of asset IDs to their logo file paths
const LOGO_MAP: Record<string, string> = {
  // Stocks
  aapl: assetUrl('/images/logos/aapl.png'),
  googl: assetUrl('/images/logos/googl.png'),
  tsla: assetUrl('/images/logos/tsla.png'),
  amzn: assetUrl('/images/logos/amzn.png'),
  msft: assetUrl('/images/logos/msft.png'),
  nvda: assetUrl('/images/logos/nvda.png'),
  jpm: assetUrl('/images/logos/jpm.png'),
  ko: assetUrl('/images/logos/ko.png'),
  dis: assetUrl('/images/logos/dis.png'),
  ba: assetUrl('/images/logos/ba.png'),
  xom: assetUrl('/images/logos/xom.png'),
  pfe: assetUrl('/images/logos/pfe.png'),
  // Crypto
  btc: assetUrl('/images/logos/btc.png'),
  eth: assetUrl('/images/logos/eth.png'),
  sol: assetUrl('/images/logos/sol.png'),
  bnb: assetUrl('/images/logos/bnb.png'),
  ada: assetUrl('/images/logos/ada.png'),
  xrp: assetUrl('/images/logos/xrp.png'),
  doge: assetUrl('/images/logos/doge.png'),
  dot: assetUrl('/images/logos/dot.png'),
};

interface AssetLogoProps {
  assetId: string;
  size?: number;
  className?: string;
  /** Fallback text if logo not found */
  fallback?: string;
}

const AssetLogo: React.FC<AssetLogoProps> = ({ assetId, size = 24, className = '', fallback }) => {
  const logoPath = LOGO_MAP[assetId];

  if (!logoPath) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground font-bold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {(fallback || assetId).slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={logoPath}
      alt={assetId}
      className={`rounded-full object-contain ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
};

export default AssetLogo;
export { LOGO_MAP };
