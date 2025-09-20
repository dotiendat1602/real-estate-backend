interface ConfigInterface {
  bonusProfitReferralNormal: number;
  bonusProfitReferralPremium: number;
  levels: { level: number; name: string; coins: number }[];
}

declare module '*.json' {
  const value: ConfigInterface;
  export default value;
}
