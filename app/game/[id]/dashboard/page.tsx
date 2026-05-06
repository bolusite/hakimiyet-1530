"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { processTurnIfReady } from "../../../../lib/game/turnProcessor";

type Game = {
  id: string;
  name: string;
  status: string;
  current_turn: number;
  end_turn: number;
  turn_started_at: string;
  turn_duration_seconds: number;
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

type GamePlayer = {
  id: string;
  game_id: string;
  user_id: string | null;
  state_name: string;
};

type PlayerAction = {
  id: string;
  turn: number;
  state_name: string;
  internal_action: string;
  external_action: string;
  external_target: string | null;
  secret_action: string;
  secret_target: string | null;
};

type GameEvent = {
  id: string;
  turn: number;
  state_name: string;
  event_type: string;
  title: string;
  description: string;
  is_resolved: boolean;
};

const INTERNAL_ACTIONS = [
  "Pas Geç",
  "Orduyu Güçlendir",
  "Vergi Artır",
  "İç İstikrarı Artır",
  "Ticaret Gelirini Artır",
];

const EXTERNAL_ACTIONS = [
  "Pas Geç",
  "İttifak Teklif Et",
  "Savaş İlan Et",
  "Ticaret Anlaşması Öner",
  "Ültimatom Gönder",
];

const SECRET_ACTIONS = [
  "Pas Geç",
  "Casus Gönder",
  "İsyan Kışkırt",
  "Yanıltıcı Bilgi Yay",
];

const COSTS: Record<string, string> = {
  "Pas Geç": "Bu alanda aksiyon alınmaz.",
  "Orduyu Güçlendir": "+4 Ordu, -7 Hazine, -3 İnsan Gücü, +1 Savaş Yorgunluğu",
  "Vergi Artır": "+8 Hazine, -4 İstikrar",
  "İç İstikrarı Artır": "+5 İstikrar, -5 Hazine",
  "Ticaret Gelirini Artır": "+4 Ticaret Gücü, +4 Hazine",
  "İttifak Teklif Et": "Kabul edilirse diplomatik güç ve savaş desteği sağlar.",
  "Savaş İlan Et": "Ordu taahhüdüne göre sefer başlatır.",
  "Ticaret Anlaşması Öner": "Kabul edilirse iki taraf ekonomi kazanır.",
  "Ültimatom Gönder": "Kabul edilirse kaynak aktarılır, reddedilirse savaş gerekçesi doğar.",
  "Casus Gönder": "Başarılı olursa hedef hakkında bilgi akışı başlar.",
  "İsyan Kışkırt": "Başarılı olursa hedefin istikrarı ve ordusu zayıflar.",
  "Yanıltıcı Bilgi Yay": "Hedefin itibarı ve istikrarı baskılanır.",
};

const INFO: Record<string, string> = {
  Toprak: "Devletin kontrol ettiği alanı temsil eder. Final skorda yüksek etkilidir.",
  Ekonomi: "Savaş sürdürülebilirliği, gelir ve uzun vadeli güç için kullanılır.",
  Hazine: "Aksiyonların maliyetini karşılar. Savaş ve diplomasi için gereklidir.",
  Ordu: "Savaşlarda ana güç unsurudur.",
  İstikrar: "İsyan, savaş yorgunluğu ve iç krizlere karşı dayanıklılığı gösterir.",
  İtibar: "Diplomasi, ittifak ve tehditlerde etkili olur.",
  Nüfuz: "Bölgesel baskı ve diplomatik ağırlığı temsil eder.",
  "İnsan Gücü": "Ordu kurma ve uzun savaşlarda dayanıklılık sağlar.",
  Ticaret: "Ekonomi ve hazine üretimini destekler.",
  "Savaş Yorg.": "Savaşların devlete bindirdiği baskıdır. Skoru düşürür.",
  "İsyan Riski": "Toprak büyüdükçe ve istikrar düştükçe kritik hale gelir.",
};

export default function DashboardPage() {
  const params = useParams();
  const gameId = params.id as string;

  const [userId, setUserId] = useState("");
  const [game, setGame] = useState<Game | null>(null);
  const [myStateName, setMyStateName] = useState("");
  const [myState, setMyState] = useState<GameState | null>(null);
  const [allStates, setAllStates] = useState<GameState[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [myActions, setMyActions] = useState<PlayerAction[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [internalAction, setInternalAction] = useState("Pas Geç");
  const [externalAction, setExternalAction] = useState("Pas Geç");
  const [externalTarget, setExternalTarget] = useState("");
  const [secretAction, setSecretAction] = useState("Pas Geç");
  const [secretTarget, setSecretTarget] = useState("");
  const [armyCommitment, setArmyCommitment] = useState(50);
  const [ultimatumTerritory, setUltimatumTerritory] = useState(5);
  const [ultimatumTribute, setUltimatumTribute] = useState(5);

  const availableTargets = useMemo(
    () =>
      allStates
        .filter((state) => state.state_name !== myStateName && !state.is_defeated)
        .map((state) => state.state_name),
    [allStates, myStateName]
  );

  const fetchData = async () => {
    setLoading(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      window.location.href = "/login";
      return;
    }

    setUserId(userData.user.id);

    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !gameData) {
      alert("Oyun bulunamadı.");
      window.location.href = "/lobby";
      return;
    }

    const loadedGame = gameData as Game;
    setGame(loadedGame);

    if (loadedGame.status !== "active" && loadedGame.status !== "finished") {
      window.location.href = `/game/${gameId}`;
      return;
    }

    const { data: playersData } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameId);

    const loadedPlayers = (playersData || []) as GamePlayer[];
    setPlayers(loadedPlayers);

    const myPlayer = loadedPlayers.find(
      (player) => player.user_id === userData.user.id
    );

    if (!myPlayer) {
      alert("Bu oyunda seçilmiş ülken bulunamadı.");
      window.location.href = `/game/${gameId}`;
      return;
    }

    setMyStateName(myPlayer.state_name);

    const { data: statesData } = await supabase
      .from("game_states")
      .select("*")
      .eq("game_id", gameId);

    const loadedStates = (statesData || []) as GameState[];
    setAllStates(loadedStates);

    const loadedMyState =
      loadedStates.find((state) => state.state_name === myPlayer.state_name) ||
      null;

    setMyState(loadedMyState);

    const { data: actionsData } = await supabase
      .from("player_actions")
      .select("*")
      .eq("game_id", gameId)
      .eq("state_name", myPlayer.state_name)
      .order("turn", { ascending: false })
      .limit(5);

    setMyActions((actionsData || []) as PlayerAction[]);

    const { data: eventsData } = await supabase
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .eq("state_name", myPlayer.state_name)
      .order("turn", { ascending: false })
      .limit(10);

    setEvents((eventsData || []) as GameEvent[]);

    setLoading(false);
  };

  const saveActions = async () => {
    if (!game || !myState) return;

    if (game.status === "finished") {
      window.location.href = `/game/${gameId}/results`;
      return;
    }

    if (myState.is_defeated) {
      alert("Ülken fethedildiği için aksiyon alamazsın.");
      return;
    }

    const needsExternalTarget = externalAction !== "Pas Geç";
    const needsSecretTarget = secretAction !== "Pas Geç";

    if (needsExternalTarget && !externalTarget) {
      alert("Dış aksiyon için hedef seçmelisin.");
      return;
    }

    if (needsSecretTarget && !secretTarget) {
      alert("Gizli aksiyon için hedef seçmelisin.");
      return;
    }

    const { error } = await supabase.from("player_actions").insert([
      {
        game_id: gameId,
        state_name: myState.state_name,
        turn: game.current_turn,
        internal_action: internalAction,
        external_action: externalAction,
        external_target: needsExternalTarget ? externalTarget : null,
        secret_action: secretAction,
        secret_target: needsSecretTarget ? secretTarget : null,
        army_commitment: armyCommitment,
        navy_commitment: 0,
        ultimatum_territory:
          externalAction === "Ültimatom Gönder" ? ultimatumTerritory : 0,
        ultimatum_tribute:
          externalAction === "Ültimatom Gönder" ? ultimatumTribute : 0,
        is_ai_action: false,
      },
    ]);

    if (error) {
      if (error.code === "23505") {
        alert("Bu tur için aksiyonlarını zaten kaydettin.");
        return;
      }

      alert("Aksiyon kaydedilemedi: " + error.message);
      return;
    }

    const result = await processTurnIfReady(supabase, gameId);

    if (!result.ok) {
      alert(result.message || "Tur işlenemedi.");
      return;
    }

    if (result.finished) {
      alert("Oyun tamamlandı. Skorlar hesaplandı.");
      window.location.href = `/game/${gameId}/results`;
      return;
    }

    if (result.advanced) {
      alert(result.message || "Tur ilerledi.");
      window.location.reload();
      return;
    }

    alert(result.message || "Diğer oyuncuların aksiyonları bekleniyor.");
    await fetchData();
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`dashboard-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        fetchData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_actions" },
        fetchData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_events" },
        fetchData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading || !game || !myState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-100">
        Yükleniyor...
      </main>
    );
  }

  if (game.status === "finished") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-100">
        <div className="rounded-2xl border border-stone-700 bg-stone-900 p-8">
          <h1 className="text-3xl font-bold">Oyun Tamamlandı</h1>
          <a
            href={`/game/${gameId}/results`}
            className="mt-6 inline-block rounded-xl bg-amber-500 px-6 py-3 font-semibold text-stone-950"
          >
            Sonuçları Gör
          </a>
        </div>
      </main>
    );
  }

  if (myState.is_defeated) {
    return (
      <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-800 bg-red-950/30 p-8">
          <h1 className="text-3xl font-bold text-red-300">
            Ülken Fethedildi
          </h1>

          <p className="mt-4 text-red-100">
            {myState.state_name} artık karar gücüne sahip değil. Bu lobide
            aksiyon alamazsın.
          </p>

          <a
            href="/lobby"
            className="mt-6 inline-block rounded-xl border border-red-700 px-6 py-3 text-red-200"
          >
            Lobiye Dön
          </a>
        </div>
      </main>
    );
  }

  const stats = [
    ["Toprak", myState.territory],
    ["Ekonomi", myState.economy],
    ["Hazine", myState.treasury],
    ["Ordu", myState.army],
    ["İstikrar", myState.stability],
    ["İtibar", myState.reputation],
    ["Nüfuz", myState.influence],
    ["İnsan Gücü", myState.manpower],
    ["Ticaret", myState.trade_power],
    ["Savaş Yorg.", myState.war_exhaustion],
    ["İsyan Riski", myState.rebellion_risk],
  ];

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-8 text-stone-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <a
              href="/lobby"
              className="mb-3 inline-block text-sm text-stone-400 hover:text-stone-200"
            >
              ← Lobiye dön
            </a>

            <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
              Hâkimiyet: 1530
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              {myState.state_name} · {game.name}
            </h1>

            <p className="mt-2 text-stone-400">
              Tur: {game.current_turn}–{game.current_turn + 2}
            </p>
          </div>

          <a
            href={`/game/${gameId}`}
            className="rounded-xl border border-stone-600 px-5 py-3 text-sm text-stone-200 hover:bg-stone-800"
          >
            Oda Ekranı
          </a>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          <section className="lg:col-span-3 rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <h2 className="text-xl font-semibold">Bu Tur Aksiyonların</h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm text-stone-400">
                  İç Aksiyon
                </label>
                <select
                  value={internalAction}
                  onChange={(e) => setInternalAction(e.target.value)}
                  className="w-full rounded-lg bg-stone-800 px-3 py-3 outline-none"
                >
                  {INTERNAL_ACTIONS.map((action) => (
                    <option key={action}>{action}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-stone-500">
                  {COSTS[internalAction]}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm text-stone-400">
                  Dış Aksiyon
                </label>
                <select
                  value={externalAction}
                  onChange={(e) => setExternalAction(e.target.value)}
                  className="w-full rounded-lg bg-stone-800 px-3 py-3 outline-none"
                >
                  {EXTERNAL_ACTIONS.map((action) => (
                    <option key={action}>{action}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-stone-500">
                  {COSTS[externalAction]}
                </p>
              </div>

              {externalAction !== "Pas Geç" && (
                <div>
                  <label className="mb-2 block text-sm text-stone-400">
                    Dış Hedef
                  </label>
                  <select
                    value={externalTarget}
                    onChange={(e) => setExternalTarget(e.target.value)}
                    className="w-full rounded-lg bg-stone-800 px-3 py-3 outline-none"
                  >
                    <option value="">Hedef seç</option>
                    {availableTargets.map((target) => (
                      <option key={target}>{target}</option>
                    ))}
                  </select>
                </div>
              )}

              {externalAction === "Savaş İlan Et" && (
                <div className="rounded-xl border border-stone-700 bg-stone-950 p-4">
                  <label className="text-sm text-stone-400">
                    Ordu Taahhüdü: %{armyCommitment}
                  </label>
                  <input
                    type="range"
                    min="25"
                    max="100"
                    step="25"
                    value={armyCommitment}
                    onChange={(e) => setArmyCommitment(Number(e.target.value))}
                    className="mt-3 w-full"
                  />
                </div>
              )}

              {externalAction === "Ültimatom Gönder" && (
                <div className="rounded-xl border border-stone-700 bg-stone-950 p-4">
                  <label className="text-sm text-stone-400">
                    Toprak Talebi: {ultimatumTerritory}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="5"
                    value={ultimatumTerritory}
                    onChange={(e) =>
                      setUltimatumTerritory(Number(e.target.value))
                    }
                    className="mt-3 w-full"
                  />

                  <label className="mt-4 block text-sm text-stone-400">
                    Hazine Talebi: {ultimatumTribute}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="5"
                    value={ultimatumTribute}
                    onChange={(e) =>
                      setUltimatumTribute(Number(e.target.value))
                    }
                    className="mt-3 w-full"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-stone-400">
                  Gizli Aksiyon
                </label>
                <select
                  value={secretAction}
                  onChange={(e) => setSecretAction(e.target.value)}
                  className="w-full rounded-lg bg-stone-800 px-3 py-3 outline-none"
                >
                  {SECRET_ACTIONS.map((action) => (
                    <option key={action}>{action}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-stone-500">
                  {COSTS[secretAction]}
                </p>
              </div>

              {secretAction !== "Pas Geç" && (
                <div>
                  <label className="mb-2 block text-sm text-stone-400">
                    Gizli Hedef
                  </label>
                  <select
                    value={secretTarget}
                    onChange={(e) => setSecretTarget(e.target.value)}
                    className="w-full rounded-lg bg-stone-800 px-3 py-3 outline-none"
                  >
                    <option value="">Hedef seç</option>
                    {availableTargets.map((target) => (
                      <option key={target}>{target}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={saveActions}
                className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-stone-950 hover:bg-amber-400"
              >
                Aksiyonları Kaydet
              </button>
            </div>
          </section>

          <section className="lg:col-span-6 rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <h2 className="text-xl font-semibold">Devlet Güç Paneli</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {stats.map(([label, value]) => (
                <div
                  key={label}
                  title={INFO[label] || ""}
                  className="rounded-xl bg-stone-800 p-4"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-300">{label}</span>
                    <span className="font-semibold text-amber-400">
                      {value}
                    </span>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-stone-700">
                    <div
                      className="h-2 rounded-full bg-amber-500"
                      style={{
                        width: `${Math.min(Number(value), 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-stone-700 bg-stone-950 p-5">
              <h3 className="font-semibold">Devletler</h3>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {allStates.map((state) => (
                  <div
                    key={state.state_name}
                    className={`rounded-lg border p-3 text-sm ${
                      state.state_name === myState.state_name
                        ? "border-amber-500 bg-amber-950/20"
                        : "border-stone-700 bg-stone-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{state.state_name}</span>
                      <span className="text-xs text-stone-400">
                        {state.is_ai ? "AI" : "Oyuncu"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-stone-400">
                      Toprak {state.territory} · Ordu {state.army} · Ekonomi{" "}
                      {state.economy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="lg:col-span-3 grid gap-5">
            <div className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
              <h2 className="text-xl font-semibold">Sonuçlar ve Olaylar</h2>

              <div className="mt-4 grid max-h-[360px] gap-3 overflow-auto">
                {events.length === 0 ? (
                  <p className="text-sm text-stone-400">Henüz olay yok.</p>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl bg-stone-800 p-3 text-sm"
                    >
                      <p className="text-xs text-amber-400">
                        {event.turn} · {event.event_type}
                      </p>
                      <h3 className="mt-1 font-semibold">{event.title}</h3>
                      <p className="mt-1 text-xs text-stone-300">
                        {event.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
              <h2 className="text-xl font-semibold">Önceki Aksiyonların</h2>

              <div className="mt-4 grid max-h-[280px] gap-3 overflow-auto">
                {myActions.length === 0 ? (
                  <p className="text-sm text-stone-400">Henüz aksiyon yok.</p>
                ) : (
                  myActions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-xl bg-stone-800 p-3 text-sm"
                    >
                      <p className="text-xs text-amber-400">
                        {action.turn}
                      </p>
                      <p>{action.internal_action}</p>
                      <p>
                        {action.external_action} →{" "}
                        {action.external_target || "-"}
                      </p>
                      <p>
                        {action.secret_action} → {action.secret_target || "-"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}