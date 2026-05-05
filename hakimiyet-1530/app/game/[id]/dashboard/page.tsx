"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type GameState = {
  state_name: string;
  treasury: number;
  army: number;
  navy: number;
  stability: number;
  reputation: number;
  spy_network: number;
  trade_power: number;
  manpower: number;
  technology: number;
  territory: number;
  influence: number;
  war_exhaustion: number;
  is_vassal: boolean;
  overlord_state: string | null;
};

type Game = {
  id: string;
  current_turn: number;
  max_players: number;
  end_turn: number;
  turn_started_at: string;
  turn_duration_seconds: number;
  is_demo: boolean;
};

type GamePlayer = {
  id: string;
  game_id: string;
  user_id: string | null;
  state_name: string;
};

type PlayerAction = {
  id: string;
  game_id: string;
  state_name: string;
  turn: number;
  internal_action: string;
  external_action: string;
  external_target: string | null;
  secret_action: string;
  secret_target: string | null;
  army_commitment: number;
  navy_commitment: number;
  ultimatum_territory: number;
  ultimatum_tribute: number;
};

type GameEvent = {
  id: string;
  turn: number;
  state_name: string;
  source_state: string | null;
  target_state: string | null;
  event_type: string;
  title: string;
  description: string;
  requires_response: boolean;
  response_options: string[] | null;
  is_resolved: boolean;
  payload: any;
};

type Conflict = {
  id: string;
  game_id: string;
  attacker: string;
  defender: string;
  status: string;
  declared_turn: number;
  last_updated_turn: number;
  attacker_army_commitment: number;
  attacker_navy_commitment: number;
  defender_army_commitment: number;
  defender_navy_commitment: number;
  battle_round: number;
};

type DiplomaticRelation = {
  id: string;
  game_id: string;
  state_a: string;
  state_b: string;
  relation_type: string;
  created_turn: number;
  is_active: boolean;
};

const INTERNAL_ACTIONS = [
  "Pas Geç",
  "Orduyu Güçlendir",
  "Vergi Artır",
  "İç İstikrarı Artır",
  "Donanmayı Geliştir",
  "Ticaret Gelirini Artır",
];

const EXTERNAL_ACTIONS = [
  "Pas Geç",
  "İttifak Teklif Et",
  "İttifakı Boz",
  "Savaş İlan Et",
  "Barış Teklif Et",
  "Ticaret Anlaşması Öner",
  "Ültimatom Gönder",
];

const SECRET_ACTIONS = [
  "Pas Geç",
  "Casus Gönder",
  "Anlaşma Sızdır",
  "Ordu Hareketini Öğren",
  "İsyan Kışkırt",
  "Yanıltıcı Bilgi Yay",
  "Müttefiki Kışkırt",
];

const MAP_POINTS: Record<string, { x: number; y: number }> = {
  Fransa: { x: 18, y: 36 },
  İspanya: { x: 14, y: 74 },
  Avusturya: { x: 53, y: 33 },
  Macaristan: { x: 63, y: 54 },
  Osmanlı: { x: 78, y: 72 },
};

const COSTS: Record<string, string> = {
  "Pas Geç": "Bu tur bu alanda aksiyon alınmaz.",
  "Orduyu Güçlendir": "+4 Ordu, -7 Hazine, -3 İnsan Gücü, +1 Savaş Yorgunluğu",
  "Vergi Artır": "+8 Hazine, -4 İç İstikrar",
  "İç İstikrarı Artır": "+5 İç İstikrar, -5 Hazine",
  "Donanmayı Geliştir": "+4 Donanma, -6 Hazine",
  "Ticaret Gelirini Artır": "+4 Ticaret Gücü, +4 Hazine",
  "İttifak Teklif Et": "Karşı taraf kabul ederse savaşlarda destek bonusu oluşur.",
  "İttifakı Boz": "-5 İtibar, ittifak sona erer.",
  "Savaş İlan Et": "Sefer süreci başlar. Ordu/donanma taahhüdüne göre sonuç hesaplanır.",
  "Barış Teklif Et": "Aktif savaş/gerilim varsa karşı tarafa barış çağrısı gönderilir.",
  "Ticaret Anlaşması Öner": "Kabul edilirse iki tarafa +5 Hazine ve +4 Ticaret Gücü.",
  "Ültimatom Gönder": "Kabul edilirse kaynak aktarılır; reddedilirse savaş gerekçesi oluşur.",
  "Casus Gönder": "%75 başarı; başarılı olursa hedef hakkında rapor akışı başlar.",
  "Anlaşma Sızdır": "Hedef ülkenin diplomatik eğilimleri hakkında bilgi üretir.",
  "Ordu Hareketini Öğren": "Hedef ülkenin savaş hazırlığı hakkında rapor üretir.",
  "İsyan Kışkırt": "%65 başarı; hedefte -6 İstikrar, -3 Ordu.",
  "Yanıltıcı Bilgi Yay": "Hedefte -4 İtibar, -2 İstikrar.",
  "Müttefiki Kışkırt": "Müttefik ülkede güven azaltıcı gizli hamle; yakalanırsa kriz çıkar.",
};

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function relationKey(a: string, b: string) {
  return [a, b].sort().join("__");
}

function committedPower(
  state: GameState,
  armyCommitment: number,
  navyCommitment: number,
  allyBonus: number
) {
  return (
    state.army * (armyCommitment / 100) * 0.95 +
    state.navy * (navyCommitment / 100) * 0.25 +
    state.manpower * 0.25 +
    state.technology * 0.35 +
    state.stability * 0.15 +
    state.influence * 0.15 +
    allyBonus -
    state.war_exhaustion * 0.4 +
    Math.floor(Math.random() * 17) -
    8
  );
}

export default function DashboardPage() {
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [previousState, setPreviousState] = useState<GameState | null>(null);
  const [stateName, setStateName] = useState("");
  const [availableTargets, setAvailableTargets] = useState<string[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [incomingEvents, setIncomingEvents] = useState<GameEvent[]>([]);
  const [myLastActions, setMyLastActions] = useState<PlayerAction[]>([]);
  const [relations, setRelations] = useState<DiplomaticRelation[]>([]);
  const [allStates, setAllStates] = useState<GameState[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const [internalAction, setInternalAction] = useState("Pas Geç");
  const [externalAction, setExternalAction] = useState("Pas Geç");
  const [externalTarget, setExternalTarget] = useState("");
  const [secretAction, setSecretAction] = useState("Pas Geç");
  const [secretTarget, setSecretTarget] = useState("");
  const [armyCommitment, setArmyCommitment] = useState(50);
  const [navyCommitment, setNavyCommitment] = useState(30);
  const [ultimatumTerritory, setUltimatumTerritory] = useState(5);
  const [ultimatumTribute, setUltimatumTribute] = useState(5);
  const [remainingSeconds, setRemainingSeconds] = useState(300);

  const myAllies = useMemo(() => {
    return relations
      .filter(
        (r) =>
          r.relation_type === "alliance" &&
          r.is_active &&
          (r.state_a === stateName || r.state_b === stateName)
      )
      .map((r) => (r.state_a === stateName ? r.state_b : r.state_a));
  }, [relations, stateName]);

  const createEvent = async (
    turn: number,
    ownerState: string,
    eventType: string,
    title: string,
    description: string,
    requiresResponse = false,
    responseOptions: string[] | null = null,
    sourceState: string | null = null,
    targetState: string | null = null,
    payload: any = {}
  ) => {
    await supabase.from("game_events").insert([
      {
        game_id: gameId,
        turn,
        state_name: ownerState,
        source_state: sourceState,
        target_state: targetState,
        event_type: eventType,
        title,
        description,
        requires_response: requiresResponse,
        response_options: responseOptions,
        is_resolved: false,
        payload,
      },
    ]);
  };

  const fetchGame = async () => {
    const { data, error } = await supabase.from("games").select("*").eq("id", gameId).single();
    if (error) return alert("Oyun bilgisi alınamadı: " + error.message);
    setGame(data);
  };

  const fetchRelations = async () => {
    const { data } = await supabase
      .from("diplomatic_relations")
      .select("*")
      .eq("game_id", gameId)
      .eq("is_active", true);
    setRelations((data || []) as DiplomaticRelation[]);
  };

  const fetchConflicts = async () => {
    const { data } = await supabase
      .from("conflicts")
      .select("*")
      .eq("game_id", gameId)
      .neq("status", "resolved");
    setConflicts((data || []) as Conflict[]);
  };

  const fetchEvents = async (ownerState: string) => {
    const { data } = await supabase
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .eq("state_name", ownerState)
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .limit(10);

    setEvents((data || []) as GameEvent[]);

    const { data: incomingData } = await supabase
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .eq("state_name", ownerState)
      .eq("is_resolved", false)
      .in("event_type", ["war_alert", "diplomacy_alert", "counter_spy", "internal_crisis", "ultimatum"])
      .order("created_at", { ascending: false })
      .limit(8);

    setIncomingEvents((incomingData || []) as GameEvent[]);
  };

  const fetchMyActions = async (ownerState: string) => {
    const { data } = await supabase
      .from("player_actions")
      .select("*")
      .eq("game_id", gameId)
      .eq("state_name", ownerState)
      .order("turn", { ascending: false })
      .limit(4);
    setMyLastActions((data || []) as PlayerAction[]);
  };

  const fetchUserStateAndTargets = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      alert("Oturum bulunamadı. Lütfen tekrar giriş yap.");
      window.location.href = "/login";
      return;
    }

    const { data: playerData, error: playerError } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameId)
      .eq("user_id", userData.user.id)
      .single();

    if (playerError) {
      alert("Bu oyunda seçilmiş devletin bulunamadı.");
      window.location.href = `/game/${gameId}`;
      return;
    }

    const player = playerData as GamePlayer;
    setStateName(player.state_name);

    const { data: stateData, error: stateError } = await supabase
      .from("game_states")
      .select("*")
      .eq("game_id", gameId)
      .eq("state_name", player.state_name)
      .single();

    if (stateError) return alert("Devlet verileri alınamadı: " + stateError.message);
    setGameState(stateData as GameState);

    const { data: allStateData } = await supabase.from("game_states").select("*").eq("game_id", gameId);
    setAllStates((allStateData || []) as GameState[]);

    const { data: previousData } = await supabase
      .from("game_state_snapshots")
      .select("*")
      .eq("game_id", gameId)
      .eq("state_name", player.state_name)
      .order("turn", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousData) setPreviousState(previousData as GameState);

    const { data: playersData } = await supabase.from("game_players").select("*").eq("game_id", gameId);
    const targets = ((playersData || []) as GamePlayer[])
      .map((p) => p.state_name)
      .filter((target) => target !== player.state_name);

    setAvailableTargets(targets);
    await fetchEvents(player.state_name);
    await fetchMyActions(player.state_name);
    await fetchRelations();
    await fetchConflicts();
  };

  const createSnapshot = async (turn: number) => {
    const { data } = await supabase.from("game_states").select("*").eq("game_id", gameId);
    for (const state of (data || []) as GameState[]) {
      await supabase.from("game_state_snapshots").upsert(
        [
          {
            game_id: gameId,
            turn,
            state_name: state.state_name,
            treasury: state.treasury,
            army: state.army,
            navy: state.navy,
            stability: state.stability,
            reputation: state.reputation,
            spy_network: state.spy_network,
            trade_power: state.trade_power,
            manpower: state.manpower,
            technology: state.technology,
            territory: state.territory,
            influence: state.influence,
            war_exhaustion: state.war_exhaustion,
          },
        ],
        { onConflict: "game_id,turn,state_name" }
      );
    }
  };

  const hasAlliance = (a: string, b: string) =>
    relations.some(
      (r) =>
        r.relation_type === "alliance" &&
        r.is_active &&
        relationKey(r.state_a, r.state_b) === relationKey(a, b)
    );

  const getAllyBonus = (ownerState: string) =>
    relations.filter(
      (r) =>
        r.relation_type === "alliance" &&
        r.is_active &&
        (r.state_a === ownerState || r.state_b === ownerState)
    ).length * 8;

  const applyWarExhaustionDecay = async () => {
    const { data: statesData } = await supabase.from("game_states").select("*").eq("game_id", gameId);
    const { data: activeConflictData } = await supabase
      .from("conflicts")
      .select("*")
      .eq("game_id", gameId)
      .neq("status", "resolved");

    const active = (activeConflictData || []) as Conflict[];

    for (const state of (statesData || []) as GameState[]) {
      const atWar = active.some((c) => c.attacker === state.state_name || c.defender === state.state_name);
      if (!atWar && state.war_exhaustion > 0) {
        await supabase
          .from("game_states")
          .update({ war_exhaustion: clamp(state.war_exhaustion - 4) })
          .eq("game_id", gameId)
          .eq("state_name", state.state_name);
      }
    }
  };

  const applyInternalAction = async (action: PlayerAction) => {
    if (action.internal_action === "Pas Geç") return;

    const { data } = await supabase
      .from("game_states")
      .select("*")
      .eq("game_id", gameId)
      .eq("state_name", action.state_name)
      .single();

    if (!data) return;
    const state = data as GameState;

    const changes: Partial<GameState> =
      action.internal_action === "Orduyu Güçlendir"
        ? { army: clamp(state.army + 4), treasury: clamp(state.treasury - 7), manpower: clamp(state.manpower - 3), war_exhaustion: clamp(state.war_exhaustion + 1) }
        : action.internal_action === "Vergi Artır"
        ? { treasury: clamp(state.treasury + 8), stability: clamp(state.stability - 4) }
        : action.internal_action === "İç İstikrarı Artır"
        ? { stability: clamp(state.stability + 5), treasury: clamp(state.treasury - 5) }
        : action.internal_action === "Donanmayı Geliştir"
        ? { navy: clamp(state.navy + 4), treasury: clamp(state.treasury - 6) }
        : action.internal_action === "Ticaret Gelirini Artır"
        ? { trade_power: clamp(state.trade_power + 4), treasury: clamp(state.treasury + 4) }
        : {};

    await supabase.from("game_states").update(changes).eq("game_id", gameId).eq("state_name", action.state_name);
    await createEvent(action.turn, action.state_name, "internal", action.internal_action, COSTS[action.internal_action] || "Aksiyon uygulandı.");
  };

  const applyExternalAction = async (action: PlayerAction) => {
    if (action.external_action === "Pas Geç") return;
    if (!action.external_target) return;

    if (action.external_action === "İttifakı Boz") {
      const { data: relation } = await supabase
        .from("diplomatic_relations")
        .select("*")
        .eq("game_id", gameId)
        .eq("relation_type", "alliance")
        .eq("is_active", true)
        .or(`and(state_a.eq.${action.state_name},state_b.eq.${action.external_target}),and(state_a.eq.${action.external_target},state_b.eq.${action.state_name})`)
        .maybeSingle();

      if (relation) {
        await supabase.from("diplomatic_relations").update({ is_active: false }).eq("id", relation.id);
      }

      const { data: self } = await supabase
        .from("game_states")
        .select("*")
        .eq("game_id", gameId)
        .eq("state_name", action.state_name)
        .single();

      if (self) {
        await supabase
          .from("game_states")
          .update({ reputation: clamp((self as GameState).reputation - 5) })
          .eq("game_id", gameId)
          .eq("state_name", action.state_name);
      }

      await createEvent(action.turn, action.state_name, "diplomacy", "İttifak Bozuldu", `${action.external_target} ile ittifakı bozdun. İtibar -5.`);
      await createEvent(action.turn, action.external_target, "diplomacy_alert", "İttifak Bozuldu", `${action.state_name} seninle olan ittifakı bozdu.`);
      return;
    }

    if (action.external_action === "İttifak Teklif Et") {
      await createEvent(action.turn, action.state_name, "diplomacy", "İttifak Teklifi Gönderildi", `${action.external_target} devletine ittifak teklif edildi.`);
      await createEvent(action.turn, action.external_target, "diplomacy_alert", "İttifak Teklifi Aldın", `${action.state_name} sana ittifak teklif etti.`, true, ["Kabul Et", "Reddet"], action.state_name, action.external_target);

      if (game?.is_demo) {
        const accepted = Math.random() > 0.25;
        if (accepted) {
          await supabase.from("diplomatic_relations").insert([
            { game_id: gameId, state_a: action.state_name, state_b: action.external_target, relation_type: "alliance", created_turn: action.turn, is_active: true },
          ]);
          await createEvent(action.turn, action.state_name, "diplomacy", "İttifak Kabul Edildi", `${action.external_target} ittifak teklifini kabul etti.`);
        } else {
          await createEvent(action.turn, action.state_name, "diplomacy", "İttifak Reddedildi", `${action.external_target} ittifak teklifini reddetti.`);
        }
      }
      return;
    }

    if (action.external_action === "Ticaret Anlaşması Öner") {
      await createEvent(action.turn, action.state_name, "trade", "Ticaret Teklifi Gönderildi", `${action.external_target} ile ticaret önerildi. Kabul edilirse iki tarafa +5 Hazine, +4 Ticaret.`);
      await createEvent(action.turn, action.external_target, "diplomacy_alert", "Ticaret Anlaşması Teklifi", `${action.state_name} ticaret anlaşması önerdi.`, true, ["Kabul Et", "Reddet"], action.state_name, action.external_target);
      return;
    }

    if (action.external_action === "Ültimatom Gönder") {
      await createEvent(
        action.turn,
        action.state_name,
        "ultimatum_sent",
        "Ültimatom Gönderildi",
        `${action.external_target} devletinden ${action.ultimatum_territory} toprak ve ${action.ultimatum_tribute} hazine talep edildi.`,
        false,
        null,
        action.state_name,
        action.external_target,
        { territory: action.ultimatum_territory, tribute: action.ultimatum_tribute }
      );

      await createEvent(
        action.turn,
        action.external_target,
        "ultimatum",
        "Ültimatom Aldın",
        `${action.state_name}, ${action.ultimatum_territory} toprak ve ${action.ultimatum_tribute} hazine talep ediyor. Reddedersen savaş riski doğar.`,
        true,
        ["Kabul Et", "Reddet"],
        action.state_name,
        action.external_target,
        { territory: action.ultimatum_territory, tribute: action.ultimatum_tribute }
      );
      return;
    }

    if (action.external_action === "Savaş İlan Et") {
      const directAlliance = hasAlliance(action.state_name, action.external_target);

      if (directAlliance) {
        await createEvent(
          action.turn,
          action.state_name,
          "diplomacy_warning",
          "Müttefike Saldırı Seçildi",
          `${action.external_target} ile ittifak halindesin; yine de saldırı kararı alındı. İttifak bozuldu ve itibar kaybı oluştu.`
        );

        await supabase
          .from("diplomatic_relations")
          .update({ is_active: false })
          .eq("game_id", gameId)
          .eq("relation_type", "alliance")
          .eq("is_active", true)
          .or(`and(state_a.eq.${action.state_name},state_b.eq.${action.external_target}),and(state_a.eq.${action.external_target},state_b.eq.${action.state_name})`);
      }

      const { data: existingConflict } = await supabase
        .from("conflicts")
        .select("*")
        .eq("game_id", gameId)
        .eq("attacker", action.state_name)
        .eq("defender", action.external_target)
        .neq("status", "resolved")
        .maybeSingle();

      if (!existingConflict) {
        await supabase.from("conflicts").insert([
          {
            game_id: gameId,
            attacker: action.state_name,
            defender: action.external_target,
            status: "declared",
            declared_turn: action.turn,
            last_updated_turn: action.turn,
            attacker_army_commitment: action.army_commitment,
            attacker_navy_commitment: action.navy_commitment,
            defender_army_commitment: 60,
            defender_navy_commitment: 40,
            battle_round: 0,
          },
        ]);
      }

      for (const ally of relations.filter((r) => r.is_active && r.relation_type === "alliance" && (r.state_a === action.state_name || r.state_b === action.state_name))) {
        const allyState = ally.state_a === action.state_name ? ally.state_b : ally.state_a;
        if (allyState !== action.external_target) {
          await createEvent(action.turn, allyState, "war_alert", "Müttefikin Savaşa Girdi", `${action.state_name}, ${action.external_target} devletine savaş ilan etti.`, true, ["Yanında Ol", "Karşısında Ol", "Karışma"], action.state_name, allyState, { enemy: action.external_target });
        }
      }

      await createEvent(action.turn, action.state_name, "war", "Savaş İlan Edildi", `${action.external_target} devletine savaş ilan ettin. Ordu %${action.army_commitment}, donanma %${action.navy_commitment}.`, false, null, action.state_name, action.external_target);
      await createEvent(action.turn, action.external_target, "war_alert", "Sana Savaş İlan Edildi", `${action.state_name} sana savaş ilan etti.`, true, ["Savunmaya Geç", "Barış Teklif Et", "Karşı Saldırı Hazırla"], action.state_name, action.external_target);
    }
  };

  const applySecretAction = async (action: PlayerAction) => {
    if (action.secret_action === "Pas Geç") return;
    if (!action.secret_target) return;

    const { data: targetData } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", action.secret_target).single();
    const { data: ownerData } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", action.state_name).single();

    const target = targetData as GameState | null;
    const owner = ownerData as GameState | null;

    if (action.secret_action === "Casus Gönder") {
      if (Math.random() < 0.75) {
        await supabase.from("spy_networks").insert([{ game_id: gameId, owner_state: action.state_name, target_state: action.secret_target, strength: 1, is_active: true, created_turn: action.turn, last_report_turn: null }]);
        await createEvent(action.turn, action.state_name, "spy", "Casus Ağı Kuruldu", `${action.secret_target} içinde aktif casus ağı kuruldu.`);
      } else {
        if (owner) await supabase.from("game_states").update({ reputation: clamp(owner.reputation - 5) }).eq("game_id", gameId).eq("state_name", action.state_name);
        await createEvent(action.turn, action.state_name, "spy_failed", "Casus Yakalandı", `${action.secret_target} içine gönderilen casus yakalandı. İtibar -5.`);
        await createEvent(action.turn, action.secret_target, "counter_spy", "Yabancı Casus Yakalandı", `${action.state_name} tarafından gönderilen bir casus yakalandı.`, true, ["Diplomatik Krizi Büyüt", "Karşı Casusluk Başlat"], action.state_name, action.secret_target);
      }
      return;
    }

    if (action.secret_action === "İsyan Kışkırt" && target) {
      if (Math.random() < 0.65) {
        await supabase.from("game_states").update({ stability: clamp(target.stability - 6), army: clamp(target.army - 3), reputation: clamp(target.reputation - 2) }).eq("game_id", gameId).eq("state_name", action.secret_target);
        await createEvent(action.turn, action.state_name, "secret", "İsyan Kışkırtıldı", `${action.secret_target} içinde huzursuzluk artırıldı.`);
        await createEvent(action.turn, action.secret_target, "internal_crisis", "İç Huzursuzluk", `Ülkende dış destekli olabilecek iç huzursuzluk başladı. İstikrar -6, ordu -3.`, true, ["İsyanı Bastır", "İç İstikrarı Artır", "Karşı Casusluk Başlat"], action.state_name, action.secret_target);
      }
      return;
    }

    if (action.secret_action === "Yanıltıcı Bilgi Yay" && target) {
      await supabase.from("game_states").update({ reputation: clamp(target.reputation - 4), stability: clamp(target.stability - 2) }).eq("game_id", gameId).eq("state_name", action.secret_target);
      await createEvent(action.turn, action.state_name, "secret", "Yanıltıcı Bilgi Yayıldı", `${action.secret_target} üzerinde itibar ve istikrar baskısı oluşturuldu.`);
      return;
    }

    if (action.secret_action === "Müttefiki Kışkırt") {
      const isAlly = hasAlliance(action.state_name, action.secret_target);
      if (!isAlly) {
        await createEvent(action.turn, action.state_name, "secret_failed", "Kışkırtma Uygulanamadı", `${action.secret_target} ile ittifakın olmadığı için bu gizli aksiyon sonuç üretmedi.`);
        return;
      }

      if (Math.random() < 0.7 && target) {
        await supabase.from("game_states").update({ reputation: clamp(target.reputation - 3), stability: clamp(target.stability - 2) }).eq("game_id", gameId).eq("state_name", action.secret_target);
        await createEvent(action.turn, action.state_name, "secret", "Müttefik Kışkırtıldı", `${action.secret_target} içinde ittifak güvenini zayıflatacak söylentiler yayıldı.`);
      } else {
        await createEvent(action.turn, action.secret_target, "counter_spy", "Müttefikten Şüpheli Hamle", `${action.state_name} tarafından yürütülen gizli kışkırtma girişimi fark edildi.`, true, ["İttifakı Boz", "Görmezden Gel"], action.state_name, action.secret_target);
      }
    }
  };

  const generateSpyReports = async (turn: number) => {
    const { data } = await supabase.from("spy_networks").select("*").eq("game_id", gameId).eq("is_active", true);

    for (const spy of data || []) {
      if (spy.last_report_turn === turn) continue;

      const { data: targetStateData } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", spy.target_state).single();
      const target = targetStateData as GameState | null;

      await createEvent(turn, spy.owner_state, "spy_report", "Casus Raporu", pickRandom([
        `${spy.target_state} ordu seviyesi yaklaşık ${target?.army ?? "bilinmiyor"}.`,
        `${spy.target_state} iç istikrarı yaklaşık ${target?.stability ?? "bilinmiyor"}.`,
        `${spy.target_state} savaş yorgunluğu yaklaşık ${target?.war_exhaustion ?? "bilinmiyor"}.`,
        `${spy.target_state} toprak kontrolü yaklaşık ${target?.territory ?? "bilinmiyor"}.`,
      ]));

      await supabase.from("spy_networks").update({ last_report_turn: turn }).eq("id", spy.id);
    }
  };

  const resolveBattle = async (conflict: Conflict, turn: number) => {
    const { data: attackerData } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", conflict.attacker).single();
    const { data: defenderData } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", conflict.defender).single();

    if (!attackerData || !defenderData) return;

    const attacker = attackerData as GameState;
    const defender = defenderData as GameState;

    const attackerPower = committedPower(attacker, conflict.attacker_army_commitment, conflict.attacker_navy_commitment, getAllyBonus(conflict.attacker));
    const defenderPower = committedPower(defender, conflict.defender_army_commitment, conflict.defender_navy_commitment, getAllyBonus(conflict.defender));

    const ratio = attackerPower / Math.max(defenderPower, 1);
    const diff = attackerPower - defenderPower;

    let attackerUpdates: Partial<GameState> = {};
    let defenderUpdates: Partial<GameState> = {};
    let titleA = "";
    let titleD = "";
    let descA = "";
    let descD = "";
    let shouldResolve = true;

    if (ratio >= 2.5) {
      titleA = "Tam Fetih";
      titleD = "Devlet Çöktü";
      descA = `${conflict.defender} ezici üstünlükle yenildi. Toprak +18, nüfuz +12.`;
      descD = `${conflict.attacker} karşısında ağır yenilgi alındı. Toprak -18, ordu -28.`;

      attackerUpdates = { territory: clamp(attacker.territory + 18), influence: clamp(attacker.influence + 12), reputation: clamp(attacker.reputation + 8), army: clamp(attacker.army - 5), navy: clamp(attacker.navy - 2), treasury: clamp(attacker.treasury - 8), war_exhaustion: clamp(attacker.war_exhaustion + 6) };
      defenderUpdates = { territory: clamp(defender.territory - 18), army: clamp(defender.army - 28), navy: clamp(defender.navy - 8), treasury: clamp(defender.treasury - 18), stability: clamp(defender.stability - 20), reputation: clamp(defender.reputation - 10), war_exhaustion: clamp(defender.war_exhaustion + 16), is_vassal: defender.territory - 18 <= 10, overlord_state: defender.territory - 18 <= 10 ? conflict.attacker : defender.overlord_state };
    } else if (ratio >= 1.5) {
      titleA = "Büyük Zafer";
      titleD = "Ağır Yenilgi";
      descA = `${conflict.defender} cephesinde büyük üstünlük kuruldu. Toprak +10, nüfuz +7.`;
      descD = `${conflict.attacker} karşısında ağır kayıp verildi. Toprak -10, ordu -18.`;

      attackerUpdates = { territory: clamp(attacker.territory + 10), influence: clamp(attacker.influence + 7), reputation: clamp(attacker.reputation + 5), army: clamp(attacker.army - 7), treasury: clamp(attacker.treasury - 9), war_exhaustion: clamp(attacker.war_exhaustion + 7) };
      defenderUpdates = { territory: clamp(defender.territory - 10), army: clamp(defender.army - 18), treasury: clamp(defender.treasury - 12), stability: clamp(defender.stability - 12), reputation: clamp(defender.reputation - 6), war_exhaustion: clamp(defender.war_exhaustion + 12) };
    } else if (ratio >= 0.85 && ratio < 1.5 && conflict.battle_round < 1) {
      shouldResolve = false;

      await supabase.from("game_states").update({ army: clamp(attacker.army - 7), treasury: clamp(attacker.treasury - 7), war_exhaustion: clamp(attacker.war_exhaustion + 8) }).eq("game_id", gameId).eq("state_name", conflict.attacker);
      await supabase.from("game_states").update({ army: clamp(defender.army - 7), treasury: clamp(defender.treasury - 6), war_exhaustion: clamp(defender.war_exhaustion + 8) }).eq("game_id", gameId).eq("state_name", conflict.defender);
      await supabase.from("conflicts").update({ status: "ongoing", battle_round: conflict.battle_round + 1, last_updated_turn: turn }).eq("id", conflict.id);

      await createEvent(turn, conflict.attacker, "war_ongoing", "Savaş Uzadı", `${conflict.defender} cephesinde güçler denk. Savaş sonuçlanmadı; iki taraf yıprandı.`);
      await createEvent(turn, conflict.defender, "war_ongoing", "Savaş Uzadı", `${conflict.attacker} saldırısı kesin sonuç vermedi. İki taraf yıprandı.`);
    } else if (diff >= 0) {
      titleA = "Kısmi Zafer";
      titleD = "Kısmi Yenilgi";
      descA = `${conflict.defender} cephesinde sınırlı kazanım sağlandı. Toprak +5, nüfuz +3.`;
      descD = `${conflict.attacker} karşısında sınırlı kayıp verildi. Toprak -5.`;

      attackerUpdates = { territory: clamp(attacker.territory + 5), influence: clamp(attacker.influence + 3), army: clamp(attacker.army - 9), treasury: clamp(attacker.treasury - 9), war_exhaustion: clamp(attacker.war_exhaustion + 8) };
      defenderUpdates = { territory: clamp(defender.territory - 5), army: clamp(defender.army - 11), stability: clamp(defender.stability - 6), treasury: clamp(defender.treasury - 8), war_exhaustion: clamp(defender.war_exhaustion + 9) };
    } else {
      titleA = "Sefer Başarısız";
      titleD = "Savunma Başarılı";
      descA = `${conflict.defender} cephesinde başarı sağlanamadı. Ordu -14, itibar -4.`;
      descD = `${conflict.attacker} saldırısı püskürtüldü. Nüfuz +4, itibar +5.`;

      attackerUpdates = { army: clamp(attacker.army - 14), treasury: clamp(attacker.treasury - 10), stability: clamp(attacker.stability - 5), reputation: clamp(attacker.reputation - 4), war_exhaustion: clamp(attacker.war_exhaustion + 10) };
      defenderUpdates = { army: clamp(defender.army - 7), treasury: clamp(defender.treasury - 6), influence: clamp(defender.influence + 4), reputation: clamp(defender.reputation + 5), war_exhaustion: clamp(defender.war_exhaustion + 5) };
    }

    if (!shouldResolve) return;

    await supabase.from("game_states").update(attackerUpdates).eq("game_id", gameId).eq("state_name", conflict.attacker);
    await supabase.from("game_states").update(defenderUpdates).eq("game_id", gameId).eq("state_name", conflict.defender);

    await createEvent(turn, conflict.attacker, "war_result", titleA, descA);
    await createEvent(turn, conflict.defender, "war_result", titleD, descD);
    await supabase.from("conflicts").update({ status: "resolved", last_updated_turn: turn }).eq("id", conflict.id);
  };

  const processConflicts = async (turn: number) => {
    const { data } = await supabase.from("conflicts").select("*").eq("game_id", gameId).neq("status", "resolved");

    for (const conflict of (data || []) as Conflict[]) {
      const age = Math.floor((turn - conflict.declared_turn) / 2);

      if (conflict.status === "declared" && age >= 1) {
        await supabase.from("conflicts").update({ status: "preparing", last_updated_turn: turn }).eq("id", conflict.id);
        await createEvent(turn, conflict.attacker, "war", "Sefer Hazırlığı Başladı", `${conflict.defender} cephesinde sefer hazırlığı başladı.`);
        await createEvent(turn, conflict.defender, "war_alert", "Düşman Sefer Hazırlığında", `${conflict.attacker} sefer hazırlığında.`, true, ["Savunmaya Geç", "Barış Teklif Et", "Karşı Saldırı Hazırla"], conflict.attacker, conflict.defender);
      }

      if ((conflict.status === "preparing" && age >= 2) || conflict.status === "ongoing") {
        await resolveBattle(conflict, turn);
      }
    }
  };

  const resolveTurn = async (activeGame: Game) => {
    await createSnapshot(activeGame.current_turn);

    const { data, error } = await supabase.from("player_actions").select("*").eq("game_id", gameId).eq("turn", activeGame.current_turn);
    if (error || !data) return alert("Tur aksiyonları alınamadı.");

    const actions = data as PlayerAction[];

    for (const action of actions) await applyInternalAction(action);
    for (const action of actions) await applyExternalAction(action);
    for (const action of actions) await applySecretAction(action);

    await processConflicts(activeGame.current_turn);
    await generateSpyReports(activeGame.current_turn);
    await applyWarExhaustionDecay();
  };

  const createDemoBotActions = async (activeGame: Game) => {
    if (!activeGame.is_demo) return true;

    const { data: playersData, error: playersError } = await supabase.from("game_players").select("*").eq("game_id", gameId).is("user_id", null);
    if (playersError) return false;

    for (const bot of (playersData || []) as GamePlayer[]) {
      const targets = [stateName, ...availableTargets].filter((target) => target && target !== bot.state_name);
      const target = pickRandom(targets);
      const safeExternalActions = EXTERNAL_ACTIONS.filter((a) => {
        if (a === "Pas Geç") return true;
        if (hasAlliance(bot.state_name, target)) return !["Savaş İlan Et", "Ültimatom Gönder"].includes(a);
        return true;
      });

      const { error } = await supabase.from("player_actions").insert([
        {
          game_id: gameId,
          state_name: bot.state_name,
          turn: activeGame.current_turn,
          internal_action: pickRandom(INTERNAL_ACTIONS),
          external_action: pickRandom(safeExternalActions),
          external_target: target,
          secret_action: pickRandom(SECRET_ACTIONS),
          secret_target: pickRandom(targets),
          army_commitment: pickRandom([25, 40, 50, 60]),
          navy_commitment: pickRandom([10, 25, 40]),
          ultimatum_territory: pickRandom([0, 5, 10]),
          ultimatum_tribute: pickRandom([0, 5, 10]),
        },
      ]);

      if (error && error.code !== "23505") return false;
    }

    return true;
  };

  const checkAndAdvanceTurn = async (activeGame: Game) => {
    const { count: playerCount } = await supabase.from("game_players").select("*", { count: "exact", head: true }).eq("game_id", gameId);
    const { count: actionCount } = await supabase.from("player_actions").select("*", { count: "exact", head: true }).eq("game_id", gameId).eq("turn", activeGame.current_turn);

    if (playerCount !== activeGame.max_players || actionCount !== activeGame.max_players) return;

    await resolveTurn(activeGame);

    const nextTurn = activeGame.current_turn + 2;
    await createSnapshot(nextTurn);

    if (nextTurn > activeGame.end_turn) {
      await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
      alert("Oyun tamamlandı.");
      return;
    }

    await supabase.from("games").update({ current_turn: nextTurn, turn_started_at: new Date().toISOString() }).eq("id", gameId);
    alert(`Tur çözümlendi. Yeni tur: ${nextTurn}`);
    window.location.reload();
  };

  const saveActions = async () => {
    if (!stateName || !game) return alert("Oyun veya devlet bilgisi bulunamadı.");

    const needsExternalTarget = externalAction !== "Pas Geç";
    const needsSecretTarget = secretAction !== "Pas Geç";

    if (needsExternalTarget && !externalTarget) return alert("Dış aksiyon hedefi seçmelisin.");
    if (needsSecretTarget && !secretTarget) return alert("Gizli aksiyon hedefi seçmelisin.");

    const { error } = await supabase.from("player_actions").insert([
      {
        game_id: gameId,
        state_name: stateName,
        turn: game.current_turn,
        internal_action: internalAction,
        external_action: externalAction,
        external_target: needsExternalTarget ? externalTarget : null,
        secret_action: secretAction,
        secret_target: needsSecretTarget ? secretTarget : null,
        army_commitment: armyCommitment,
        navy_commitment: navyCommitment,
        ultimatum_territory: externalAction === "Ültimatom Gönder" ? ultimatumTerritory : 0,
        ultimatum_tribute: externalAction === "Ültimatom Gönder" ? ultimatumTribute : 0,
      },
    ]);

    if (error) {
      if (error.code === "23505") return alert("Bu tur için aksiyonlarını zaten kaydettin.");
      return alert("Aksiyonlar kaydedilemedi: " + error.message);
    }

    const demoBotActionsCreated = await createDemoBotActions(game);
    if (!demoBotActionsCreated) return;

    await checkAndAdvanceTurn(game);
  };

  const handleEventResponse = async (event: GameEvent, response: string) => {
    if (!game || !stateName) return;

    const source = event.source_state || event.description.split(" ")[0];

    if (response === "Reddet") {
      await createEvent(game.current_turn, source, "diplomacy", "Teklif Reddedildi", `${stateName} teklifini reddetti.`);
    }

    if (response === "Kabul Et" && event.title.includes("İttifak")) {
      await supabase.from("diplomatic_relations").insert([{ game_id: gameId, state_a: source, state_b: stateName, relation_type: "alliance", created_turn: game.current_turn, is_active: true }]);
      await createEvent(game.current_turn, stateName, "diplomacy", "İttifak Kabul Edildi", `${source} ile ittifak kuruldu.`);
      await createEvent(game.current_turn, source, "diplomacy", "İttifak Kabul Edildi", `${stateName} ittifak teklifini kabul etti.`);
    }

    if (response === "Kabul Et" && event.title.includes("Ticaret")) {
      const { data: selfData } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", stateName).single();
      const { data: sourceData } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", source).single();

      if (selfData) await supabase.from("game_states").update({ treasury: clamp((selfData as GameState).treasury + 5), trade_power: clamp((selfData as GameState).trade_power + 4) }).eq("game_id", gameId).eq("state_name", stateName);
      if (sourceData) await supabase.from("game_states").update({ treasury: clamp((sourceData as GameState).treasury + 5), trade_power: clamp((sourceData as GameState).trade_power + 4) }).eq("game_id", gameId).eq("state_name", source);

      await createEvent(game.current_turn, stateName, "trade", "Ticaret Kabul Edildi", `${source} ile ticaret başladı. Hazine +5, ticaret +4.`);
      await createEvent(game.current_turn, source, "trade", "Ticaret Kabul Edildi", `${stateName} ticaret teklifini kabul etti.`);
    }

    if (response === "Kabul Et" && event.title.includes("Ültimatom")) {
      const territory = Number(event.payload?.territory || 0);
      const tribute = Number(event.payload?.tribute || 0);

      const { data: selfData } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", stateName).single();
      const { data: sourceData } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", source).single();

      if (selfData) await supabase.from("game_states").update({ territory: clamp((selfData as GameState).territory - territory), treasury: clamp((selfData as GameState).treasury - tribute), reputation: clamp((selfData as GameState).reputation - 3) }).eq("game_id", gameId).eq("state_name", stateName);
      if (sourceData) await supabase.from("game_states").update({ territory: clamp((sourceData as GameState).territory + territory), treasury: clamp((sourceData as GameState).treasury + tribute), influence: clamp((sourceData as GameState).influence + 3) }).eq("game_id", gameId).eq("state_name", source);

      await createEvent(game.current_turn, stateName, "ultimatum", "Ültimatom Kabul Edildi", `${source} taleplerini kabul ettin. Toprak -${territory}, hazine -${tribute}.`);
      await createEvent(game.current_turn, source, "ultimatum", "Ültimatom Kabul Edildi", `${stateName} taleplerini kabul etti. Toprak +${territory}, hazine +${tribute}.`);
    }

    if (response === "Reddet" && event.title.includes("Ültimatom")) {
      await createEvent(game.current_turn, source, "war", "Ültimatom Reddedildi", `${stateName} ültimatomunu reddetti. Savaş gerekçesi oluştu.`);
    }

    if (response === "Savunmaya Geç") {
      const { data } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", stateName).single();
      const state = data as GameState;
      await supabase.from("game_states").update({ army: clamp(state.army + 3), stability: clamp(state.stability + 2), treasury: clamp(state.treasury - 5) }).eq("game_id", gameId).eq("state_name", stateName);
      await supabase.from("conflicts").update({ defender_army_commitment: 90, defender_navy_commitment: 60 }).eq("game_id", gameId).eq("defender", stateName).neq("status", "resolved");
      await createEvent(game.current_turn, stateName, "response", "Savunmaya Geçildi", "Savunma hazırlığı alındı. Ordu +3, istikrar +2, hazine -5.");
    }

    if (response === "Yanında Ol" || response === "Karşısında Ol" || response === "Karışma") {
      await createEvent(game.current_turn, stateName, "war_response", "Savaş Pozisyonu Belirlendi", `${response} seçildi.`);
    }

    if (response === "İsyanı Bastır") {
      const { data } = await supabase.from("game_states").select("*").eq("game_id", gameId).eq("state_name", stateName).single();
      const state = data as GameState;
      await supabase.from("game_states").update({ stability: clamp(state.stability + 5), army: clamp(state.army - 2), treasury: clamp(state.treasury - 4) }).eq("game_id", gameId).eq("state_name", stateName);
      await createEvent(game.current_turn, stateName, "response", "İsyan Bastırıldı", "İstikrar +5, ordu -2, hazine -4.");
    }

    if (response === "İttifakı Boz") {
      await supabase
        .from("diplomatic_relations")
        .update({ is_active: false })
        .eq("game_id", gameId)
        .eq("relation_type", "alliance")
        .eq("is_active", true)
        .or(`and(state_a.eq.${stateName},state_b.eq.${source}),and(state_a.eq.${source},state_b.eq.${stateName})`);

      await createEvent(game.current_turn, stateName, "diplomacy", "İttifak Bozuldu", `${source} ile ittifakı bozdun.`);
    }

    await supabase.from("game_events").update({ is_resolved: true }).eq("id", event.id);
    alert(`${response} uygulandı.`);
    window.location.reload();
  };

  useEffect(() => {
    fetchGame();
    fetchUserStateAndTargets();
  }, []);

  useEffect(() => {
    if (!game) return;
    const calculateRemaining = () => {
      const startedAt = new Date(game.turn_started_at).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startedAt) / 1000);
      setRemainingSeconds(Math.max(game.turn_duration_seconds - elapsed, 0));
    };
    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [game]);

  if (!game || !gameState) {
    return <main className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-100">Yükleniyor...</main>;
  }

  const stats: [keyof GameState, string, number][] = [
    ["treasury", "Hazine", gameState.treasury],
    ["army", "Ordu", gameState.army],
    ["navy", "Donanma", gameState.navy],
    ["stability", "İstikrar", gameState.stability],
    ["reputation", "İtibar", gameState.reputation],
    ["spy_network", "Casus", gameState.spy_network],
    ["trade_power", "Ticaret", gameState.trade_power],
    ["manpower", "İnsan Gücü", gameState.manpower],
    ["technology", "Teknoloji", gameState.technology],
    ["territory", "Toprak", gameState.territory],
    ["influence", "Nüfuz", gameState.influence],
    ["war_exhaustion", "Savaş Yorg.", gameState.war_exhaustion],
  ];

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <main className="h-screen overflow-hidden bg-stone-950 p-4 text-stone-100">
      <div className="grid h-full grid-cols-12 gap-4">
        <section className="col-span-3 flex min-h-0 flex-col gap-4">
          <div className="rounded-2xl border border-stone-700 bg-stone-900 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-400">Hâkimiyet: 1530</p>
            <h1 className="mt-2 text-2xl font-bold">{gameState.state_name}</h1>
            <p className="mt-1 text-sm text-stone-400">
              Tur: {game.current_turn}–{game.current_turn + 2} · {minutes}:{seconds.toString().padStart(2, "0")}
            </p>
            {myAllies.length > 0 && (
              <p className="mt-2 text-xs text-emerald-400">İttifak: {myAllies.join(", ")}</p>
            )}
          </div>

          <div className="rounded-2xl border border-stone-700 bg-stone-900 p-4">
            <h2 className="font-semibold">Bu Tur Aksiyonların</h2>

            <div className="mt-4 grid gap-3">
              <select value={internalAction} onChange={(e) => setInternalAction(e.target.value)} className="rounded-lg bg-stone-800 px-3 py-2 text-sm outline-none">
                {INTERNAL_ACTIONS.map((action) => <option key={action}>{action}</option>)}
              </select>
              <p className="text-xs text-stone-400">{COSTS[internalAction]}</p>

              <select value={externalAction} onChange={(e) => setExternalAction(e.target.value)} className="rounded-lg bg-stone-800 px-3 py-2 text-sm outline-none">
                {EXTERNAL_ACTIONS.map((action) => <option key={action}>{action}</option>)}
              </select>
              <p className="text-xs text-stone-400">{COSTS[externalAction]}</p>

              {externalAction !== "Pas Geç" && (
                <select value={externalTarget} onChange={(e) => setExternalTarget(e.target.value)} className="rounded-lg bg-stone-800 px-3 py-2 text-sm outline-none">
                  <option value="">Dış hedef seç</option>
                  {availableTargets.map((target) => <option key={target}>{target}</option>)}
                </select>
              )}

              {externalAction === "Savaş İlan Et" && (
                <div className="grid gap-2 rounded-xl border border-stone-700 bg-stone-950 p-3">
                  <label className="text-xs text-stone-400">Ordu Taahhüdü %{armyCommitment}</label>
                  <input type="range" min="25" max="100" step="25" value={armyCommitment} onChange={(e) => setArmyCommitment(Number(e.target.value))} />
                  <label className="text-xs text-stone-400">Donanma Taahhüdü %{navyCommitment}</label>
                  <input type="range" min="0" max="100" step="25" value={navyCommitment} onChange={(e) => setNavyCommitment(Number(e.target.value))} />
                </div>
              )}

              {externalAction === "Ültimatom Gönder" && (
                <div className="grid gap-2 rounded-xl border border-stone-700 bg-stone-950 p-3">
                  <label className="text-xs text-stone-400">Toprak Talebi: {ultimatumTerritory}</label>
                  <input type="range" min="0" max="20" step="5" value={ultimatumTerritory} onChange={(e) => setUltimatumTerritory(Number(e.target.value))} />
                  <label className="text-xs text-stone-400">Hazine Talebi: {ultimatumTribute}</label>
                  <input type="range" min="0" max="20" step="5" value={ultimatumTribute} onChange={(e) => setUltimatumTribute(Number(e.target.value))} />
                </div>
              )}

              <select value={secretAction} onChange={(e) => setSecretAction(e.target.value)} className="rounded-lg bg-stone-800 px-3 py-2 text-sm outline-none">
                {SECRET_ACTIONS.map((action) => <option key={action}>{action}</option>)}
              </select>
              <p className="text-xs text-stone-400">{COSTS[secretAction]}</p>

              {secretAction !== "Pas Geç" && (
                <select value={secretTarget} onChange={(e) => setSecretTarget(e.target.value)} className="rounded-lg bg-stone-800 px-3 py-2 text-sm outline-none">
                  <option value="">Gizli hedef seç</option>
                  {availableTargets.map((target) => <option key={target}>{target}</option>)}
                </select>
              )}

              <button onClick={saveActions} className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-400">
                Aksiyonları Kaydet
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-stone-700 bg-stone-900 p-4">
            <h2 className="font-semibold">Önceki Aksiyonların</h2>
            <div className="mt-3 grid gap-2">
              {myLastActions.length === 0 ? (
                <p className="text-sm text-stone-400">Henüz aksiyon yok.</p>
              ) : (
                myLastActions.map((action) => (
                  <div key={action.id} className="rounded-lg bg-stone-800 p-3 text-xs text-stone-300">
                    <p className="text-amber-400">{action.turn}</p>
                    <p>{action.internal_action}</p>
                    <p>{action.external_action} → {action.external_target || "-"}</p>
                    <p>{action.secret_action} → {action.secret_target || "-"}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="col-span-6 min-h-0 overflow-hidden rounded-2xl border border-stone-700 bg-stone-900 p-4">
          <h2 className="text-xl font-semibold">Devlet Güç Paneli</h2>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {stats.map(([key, label, value]) => {
              const previousValue = previousState ? Number(previousState[key]) : value;
              const diff = value - previousValue;

              return (
                <div key={label} className="rounded-xl bg-stone-800 p-3">
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <span>{label}</span>
                    <div className="flex items-center gap-2">
                      {diff !== 0 && <span className={diff > 0 ? "text-emerald-400" : "text-red-400"}>{diff > 0 ? `+${diff}` : diff}</span>}
                      <span>{value}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-stone-700">
                    <div className="h-2 rounded-full bg-amber-500" style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative mt-5 h-[330px] rounded-xl border border-stone-700 bg-stone-950 p-4">
            <h3 className="font-semibold">Stratejik Harita</h3>

            <div className="absolute inset-8 top-14 rounded-xl border border-stone-800 bg-[radial-gradient(circle_at_center,_#1c1917,_#0c0a09)]">
              {conflicts.map((conflict) => {
                const a = MAP_POINTS[conflict.attacker];
                const b = MAP_POINTS[conflict.defender];
                if (!a || !b) return null;
                return (
                  <svg key={conflict.id} className="pointer-events-none absolute inset-0 h-full w-full">
                    <line x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} stroke="#ef4444" strokeWidth="3" strokeDasharray="7 7" />
                  </svg>
                );
              })}

              {relations.map((relation) => {
                const a = MAP_POINTS[relation.state_a];
                const b = MAP_POINTS[relation.state_b];
                if (!a || !b) return null;
                return (
                  <svg key={relation.id} className="pointer-events-none absolute inset-0 h-full w-full">
                    <line x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} stroke="#22c55e" strokeWidth="3" />
                  </svg>
                );
              })}

              {allStates.map((state) => {
                const point = MAP_POINTS[state.state_name] || { x: 50, y: 50 };
                const isMine = state.state_name === stateName;

                return (
                  <div
                    key={state.state_name}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 text-xs shadow-lg ${
                      isMine ? "border-amber-400 bg-amber-500 text-stone-950" : state.is_vassal ? "border-red-500 bg-red-950 text-red-100" : "border-stone-600 bg-stone-800 text-stone-200"
                    }`}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  >
                    <p className="font-semibold">{state.state_name}</p>
                    <p className="opacity-70">Toprak {state.territory}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="col-span-3 flex min-h-0 flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-stone-700 bg-stone-900 p-4">
            <h2 className="font-semibold">Sana Karşı Hamleler</h2>
            <div className="mt-3 grid gap-3">
              {incomingEvents.length === 0 ? (
                <p className="text-sm text-stone-400">Aktif tehdit yok.</p>
              ) : (
                incomingEvents.map((event) => (
                  <div key={event.id} className="rounded-xl bg-stone-800 p-3 text-sm">
                    <p className="text-xs text-amber-400">{event.turn} · {event.event_type}</p>
                    <h3 className="mt-1 font-semibold">{event.title}</h3>
                    <p className="mt-1 text-xs text-stone-300">{event.description}</p>

                    {event.requires_response && event.response_options && (
                      <div className="mt-3 grid gap-2">
                        {event.response_options.map((option) => (
                          <button key={option} onClick={() => handleEventResponse(event, option)} className="rounded-lg border border-amber-700 px-3 py-2 text-xs text-amber-300 hover:bg-amber-950/30">
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-stone-700 bg-stone-900 p-4">
            <h2 className="font-semibold">Sana Ait Sonuçlar</h2>
            <div className="mt-3 grid gap-3">
              {events.length === 0 ? (
                <p className="text-sm text-stone-400">Henüz olay yok.</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="rounded-xl bg-stone-800 p-3 text-sm">
                    <p className="text-xs text-amber-400">{event.turn} · {event.event_type}</p>
                    <h3 className="mt-1 font-semibold">{event.title}</h3>
                    <p className="mt-1 text-xs text-stone-300">{event.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}