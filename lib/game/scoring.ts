export type ScoreState = {
  state_name: string;
  territory: number;
  economy: number;
  treasury: number;
  army: number;
  stability: number;
  reputation: number;
  influence: number;
  manpower: number;
  trade_power: number;
  war_exhaustion: number;
  rebellion_risk: number;
  is_defeated: boolean;
};

export function calculateScore(state: ScoreState) {
  if (state.is_defeated) {
    return -100;
  }

  return Math.round(
    state.territory * 3 +
      state.economy * 2 +
      state.treasury * 1.2 +
      state.army * 2 +
      state.stability * 1.5 +
      state.reputation * 1.5 +
      state.influence * 1.6 +
      state.manpower * 1 +
      state.trade_power * 1.2 -
      state.war_exhaustion * 2 -
      state.rebellion_risk * 2
  );
}