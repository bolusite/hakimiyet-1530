import { ALL_COUNTRIES } from "./countries";

const INTERNAL_ACTIONS = [
  "Orduyu Güçlendir",
  "Vergi Artır",
  "İç İstikrarı Artır",
  "Ticaret Gelirini Artır",
  "Pas Geç",
];

const EXTERNAL_ACTIONS = [
  "İttifak Teklif Et",
  "Ticaret Anlaşması Öner",
  "Savaş İlan Et",
  "Ültimatom Gönder",
  "Pas Geç",
];

const SECRET_ACTIONS = [
  "Casus Gönder",
  "İsyan Kışkırt",
  "Yanıltıcı Bilgi Yay",
  "Pas Geç",
];

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function createAiAction(aiStateName: string, activeStateNames: string[]) {
  const profile = ALL_COUNTRIES.find((country) => country.state_name === aiStateName);
  const personality = profile?.ai_personality || "balanced";

  const targets = activeStateNames.filter((state) => state !== aiStateName);
  const target = pickRandom(targets);

  let internal_action = pickRandom(INTERNAL_ACTIONS);
  let external_action = pickRandom(EXTERNAL_ACTIONS);
  let secret_action = pickRandom(SECRET_ACTIONS);

  if (personality === "expansionist") {
    internal_action = pickRandom(["Orduyu Güçlendir", "Vergi Artır"]);
    external_action = pickRandom(["Savaş İlan Et", "Ültimatom Gönder", "Pas Geç"]);
    secret_action = pickRandom(["Casus Gönder", "İsyan Kışkırt"]);
  }

  if (personality === "economic") {
    internal_action = pickRandom(["Ticaret Gelirini Artır", "Vergi Artır"]);
    external_action = pickRandom(["Ticaret Anlaşması Öner", "İttifak Teklif Et", "Pas Geç"]);
    secret_action = pickRandom(["Casus Gönder", "Pas Geç"]);
  }

  if (personality === "diplomatic") {
    internal_action = pickRandom(["İç İstikrarı Artır", "Ticaret Gelirini Artır"]);
    external_action = pickRandom(["İttifak Teklif Et", "Ticaret Anlaşması Öner"]);
    secret_action = pickRandom(["Casus Gönder", "Yanıltıcı Bilgi Yay", "Pas Geç"]);
  }

  if (personality === "defensive") {
    internal_action = pickRandom(["Orduyu Güçlendir", "İç İstikrarı Artır"]);
    external_action = pickRandom(["İttifak Teklif Et", "Barış Teklif Et", "Pas Geç"]);
    secret_action = pickRandom(["Casus Gönder", "Pas Geç"]);
  }

  if (personality === "alliance_builder") {
    internal_action = pickRandom(["İç İstikrarı Artır", "Orduyu Güçlendir"]);
    external_action = pickRandom(["İttifak Teklif Et", "Ticaret Anlaşması Öner"]);
    secret_action = pickRandom(["Casus Gönder", "Yanıltıcı Bilgi Yay"]);
  }

  return {
    state_name: aiStateName,
    internal_action,
    external_action,
    external_target: external_action === "Pas Geç" ? null : target,
    secret_action,
    secret_target: secret_action === "Pas Geç" ? null : target,
    army_commitment: pickRandom([25, 40, 50, 60]),
    navy_commitment: 0,
    ultimatum_territory: external_action === "Ültimatom Gönder" ? pickRandom([5, 10]) : 0,
    ultimatum_tribute: external_action === "Ültimatom Gönder" ? pickRandom([5, 10]) : 0,
    is_ai_action: true,
  };
}