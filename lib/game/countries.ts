export type CountryProfile = {
  state_name: string;
  role: string;
  ai_personality: string;
  territory: number;
  economy: number;
  treasury: number;
  army: number;
  stability: number;
  reputation: number;
  influence: number;
  manpower: number;
  trade_power: number;
};

export const PLAYABLE_COUNTRIES: CountryProfile[] = [
  {
    state_name: "Osmanlı",
    role: "Kara Gücü",
    ai_personality: "expansionist",
    territory: 82,
    economy: 72,
    treasury: 95,
    army: 82,
    stability: 62,
    reputation: 72,
    influence: 78,
    manpower: 84,
    trade_power: 60,
  },
  {
    state_name: "Fransa",
    role: "Diplomasi ve Ekonomi",
    ai_personality: "diplomatic",
    territory: 70,
    economy: 80,
    treasury: 92,
    army: 68,
    stability: 66,
    reputation: 78,
    influence: 76,
    manpower: 72,
    trade_power: 72,
  },
  {
    state_name: "İspanya",
    role: "Hazine ve Nüfuz",
    ai_personality: "economic",
    territory: 74,
    economy: 82,
    treasury: 105,
    army: 64,
    stability: 60,
    reputation: 74,
    influence: 78,
    manpower: 66,
    trade_power: 78,
  },
  {
    state_name: "Avusturya",
    role: "Savunma ve İstikrar",
    ai_personality: "defensive",
    territory: 66,
    economy: 68,
    treasury: 86,
    army: 72,
    stability: 74,
    reputation: 70,
    influence: 74,
    manpower: 72,
    trade_power: 56,
  },
  {
    state_name: "Kutsal Roma",
    role: "İnsan Gücü ve Diplomasi",
    ai_personality: "alliance_builder",
    territory: 76,
    economy: 70,
    treasury: 88,
    army: 70,
    stability: 58,
    reputation: 76,
    influence: 82,
    manpower: 80,
    trade_power: 58,
  },
];

export const AI_COUNTRIES: CountryProfile[] = [
  {
    state_name: "Venedik",
    role: "Ticaret Devleti",
    ai_personality: "economic",
    territory: 34,
    economy: 72,
    treasury: 78,
    army: 34,
    stability: 68,
    reputation: 62,
    influence: 55,
    manpower: 38,
    trade_power: 84,
  },
  {
    state_name: "Lehistan",
    role: "Bölgesel Güç",
    ai_personality: "defensive",
    territory: 62,
    economy: 58,
    treasury: 70,
    army: 60,
    stability: 58,
    reputation: 58,
    influence: 55,
    manpower: 68,
    trade_power: 44,
  },
  {
    state_name: "Portekiz",
    role: "Ticaret ve Keşif",
    ai_personality: "economic",
    territory: 38,
    economy: 70,
    treasury: 82,
    army: 36,
    stability: 64,
    reputation: 66,
    influence: 58,
    manpower: 40,
    trade_power: 82,
  },
  {
    state_name: "Safevi",
    role: "Doğu Gücü",
    ai_personality: "expansionist",
    territory: 68,
    economy: 60,
    treasury: 74,
    army: 66,
    stability: 54,
    reputation: 55,
    influence: 62,
    manpower: 70,
    trade_power: 44,
  },
  {
    state_name: "İngiltere",
    role: "Ada Gücü",
    ai_personality: "diplomatic",
    territory: 56,
    economy: 72,
    treasury: 84,
    army: 48,
    stability: 62,
    reputation: 66,
    influence: 64,
    manpower: 56,
    trade_power: 76,
  },
];

export const ALL_COUNTRIES = [...PLAYABLE_COUNTRIES, ...AI_COUNTRIES];