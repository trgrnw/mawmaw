import React from 'react';

// Map of asset IDs to their logo file paths
const LOGO_MAP: Record<string, string> = {
  // Stocks
  aapl: '/images/logos/aapl.png',
  googl: '/images/logos/googl.png',
  tsla: '/images/logos/tsla.png',
  amzn: '/images/logos/amzn.png',
  msft: '/images/logos/msft.png',
  nvda: '/images/logos/nvda.png',
  jpm: '/images/logos/jpm.png',
  ko: '/images/logos/ko.png',
  dis: '/images/logos/dis.png',
  ba: '/images/logos/ba.png',
  xom: '/images/logos/xom.png',
  pfe: '/images/logos/pfe.png',
  // Crypto
  btc: '/images/logos/btc.png',
  eth: '/images/logos/eth.png',
  sol: '/images/logos/sol.png',
  bnb: '/images/logos/bnb.png',
  ada: '/images/logos/ada.png',
  xrp: '/images/logos/xrp.png',
  doge: '/images/logos/doge.png',
  dot: '/images/logos/dot.png',
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
