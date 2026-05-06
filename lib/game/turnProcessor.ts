import { SupabaseClient } from "@supabase/supabase-js";
import { createAiAction } from "./ai";
import { calculateScore } from "./scoring";

type Game = {
  id: string;
  current_turn: number;
  end_turn: number;
  max_players: number;
};

type GamePlayer = {
  game_id: string;
  user_id: string | null;
  state_name: string;
};

type GameState = {
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
  is_ai: boolean;
};

export async function processTurnIfReady(
  supabase: SupabaseClient,
  gameId: string
) {
  const { data: gameData, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (gameError || !gameData) {
    return { ok: false, message: "Oyun bulunamadı." };
  }

  const game = gameData as Game;

  const { data: playersData } = await supabase
    .from("game_players")
    .select("*")
    .eq("game_id", gameId);

  const players = (playersData || []) as GamePlayer[];

  const { data: statesData } = await supabase
    .from("game_states")
    .select("*")
    .eq("game_id", gameId);

  const states = (statesData || []) as GameState[];

  const activeStates = states.filter((state) => !state.is_defeated);

  await ensureAiActions(supabase, game, players, activeStates);

  const { data: actionsData } = await supabase
    .from("player_actions")
    .select("*")
    .eq("game_id", gameId)
    .eq("turn", game.current_turn);

  const actions = actionsData || [];

  const activePlayerCount = activeStates.length;
  const actionStateNames = new Set(actions.map((action) => action.state_name));

  const allActiveStatesActed = activeStates.every((state) =>
    actionStateNames.has(state.state_name)
  );

  if (!allActiveStatesActed || actions.length < activePlayerCount) {
    return {
      ok: true,
      advanced: false,
      message: "Tüm aktif devletler aksiyon almadı.",
    };
  }

  await createTurnTransitionEvents(supabase, gameId, game.current_turn);

  if (game.current_turn >= game.end_turn) {
    await finishGame(supabase, gameId);
    return {
      ok: true,
      finished: true,
      message: "Oyun tamamlandı. Skorlar hesaplandı.",
    };
  }

  const nextTurn = game.current_turn + 2;

  await supabase
    .from("games")
    .update({
      current_turn: nextTurn,
      turn_started_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  return {
    ok: true,
    advanced: true,
    nextTurn,
    message: `Tur ilerledi: ${nextTurn}`,
  };
}

async function ensureAiActions(
  supabase: SupabaseClient,
  game: Game,
  players: GamePlayer[],
  activeStates: GameState[]
) {
  const aiStates = activeStates.filter((state) => state.is_ai);

  const activeStateNames = activeStates.map((state) => state.state_name);

  for (const aiState of aiStates) {
    const { data: existingAction } = await supabase
      .from("player_actions")
      .select("*")
      .eq("game_id", game.id)
      .eq("turn", game.current_turn)
      .eq("state_name", aiState.state_name)
      .maybeSingle();

    if (existingAction) continue;

    const aiAction = createAiAction(aiState.state_name, activeStateNames);

    await supabase.from("player_actions").insert([
      {
        game_id: game.id,
        turn: game.current_turn,
        ...aiAction,
      },
    ]);
  }
}

async function createTurnTransitionEvents(
  supabase: SupabaseClient,
  gameId: string,
  turn: number
) {
  const { data: actionsData } = await supabase
    .from("player_actions")
    .select("*")
    .eq("game_id", gameId)
    .eq("turn", turn);

  const actions = actionsData || [];

  for (const action of actions) {
    await supabase.from("game_events").insert([
      {
        game_id: gameId,
        turn,
        state_name: action.state_name,
        source_state: action.state_name,
        target_state: action.external_target,
        event_type: "turn_summary",
        title: "Tur Aksiyon Özeti",
        description: `İç: ${action.internal_action} | Dış: ${action.external_action}${
          action.external_target ? ` → ${action.external_target}` : ""
        } | Gizli: ${action.secret_action}${
          action.secret_target ? ` → ${action.secret_target}` : ""
        }`,
        requires_response: false,
        response_options: null,
        is_resolved: false,
        payload: {},
      },
    ]);

    if (action.external_target) {
      await supabase.from("game_events").insert([
        {
          game_id: gameId,
          turn,
          state_name: action.external_target,
          source_state: action.state_name,
          target_state: action.external_target,
          event_type: "incoming_action",
          title: "Sana Karşı Hamle",
          description: `${action.state_name}, sana karşı ${action.external_action} hamlesi yaptı.`,
          requires_response: false,
          response_options: null,
          is_resolved: false,
          payload: {},
        },
      ]);
    }
  }
}

async function finishGame(supabase: SupabaseClient, gameId: string) {
  const { data: statesData } = await supabase
    .from("game_states")
    .select("*")
    .eq("game_id", gameId);

  const states = (statesData || []) as GameState[];

  const scoredStates = states
    .map((state) => ({
      state,
      score: calculateScore(state),
    }))
    .sort((a, b) => b.score - a.score);

  for (let index = 0; index < scoredStates.length; index++) {
    const item = scoredStates[index];

    await supabase.from("game_scores").upsert(
      [
        {
          game_id: gameId,
          state_name: item.state.state_name,
          score: item.score,
          rank: index + 1,
          reason: buildScoreReason(item.state),
        },
      ],
      {
        onConflict: "game_id,state_name",
      }
    );
  }

  await supabase
    .from("games")
    .update({
      status: "finished",
      ended_at: new Date().toISOString(),
    })
    .eq("id", gameId);
}

function buildScoreReason(state: GameState) {
  if (state.is_defeated) {
    return "Devlet fethedildiği için oyun dışı kaldı.";
  }

  return `Toprak, ekonomi, hazine, ordu, istikrar, itibar, nüfuz, insan gücü ve ticaret gücü üzerinden hesaplandı. Savaş yorgunluğu ve isyan riski puanı düşürdü.`;
}