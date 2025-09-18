/**
 * Centralized asset registry for all asset logos
 * Add new assets here when you add new images to assets/images/
 */

export const ASSET_IMAGES = {
  // Stock ETFs
  'VT': require('../../assets/images/VT.png'),
  'VOO': require('../../assets/images/VOO.png'),
  'VO': require('../../assets/images/VO.png'),
  'VB': require('../../assets/images/VB.png'),
  'VXUS': require('../../assets/images/VXUS.png'),
  'VWO': require('../../assets/images/VWO.png'),
  
  // Crypto Stocks
  'COIN': require('../../assets/images/COIN.png'),
  'HOOD': require('../../assets/images/HOOD.png'),
  'GLXY': require('../../assets/images/GLXY.png'),
  
  // Alternatives
  'AAAU': require('../../assets/images/AAAU.png'),
  'VNQ': require('../../assets/images/VNQ.png'),
  
  // Crypto Tokens
  'BTC': require('../../assets/images/BTC.png'),
  'ETH': require('../../assets/images/ETH.png'),
  'SOL': require('../../assets/images/SOL.png'),
  'TIA': require('../../assets/images/TIA.png'),
} as const;

/**
 * Get asset logo image source
 * Returns the logo image source or null if not found
 */
export const getAssetLogo = (assetSymbol: string) => {
  try {
    return ASSET_IMAGES[assetSymbol as keyof typeof ASSET_IMAGES] || null;
  } catch (error) {
    console.warn(`Logo not found for asset: ${assetSymbol}`);
    return null;
  }
};