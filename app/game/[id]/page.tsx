"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { AI_COUNTRIES, PLAYABLE_COUNTRIES } from "../../../lib/game/countries";

type Game = {
  id: string;
  name: string;
  status: string;
  current_turn: number;
  max_players: number;
  is_demo: boolean;
  owner_user_id: string | null;
};

type GamePlayer = {
  id: string;
  game_id: string;
  user_id: string | null;
  state_name: string;
};

type StartVote = {
  id: string;
  game_id: string;
  user_id: string;
  vote: boolean;
};

export default function GameRoomPage() {
  const params = useParams();
  const gameId = params.id as string;

  const [userId, setUserId] = useState("");
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [votes, setVotes] = useState<StartVote[]>([]);
  const [loading, setLoading] = useState(true);

  const realPlayers = useMemo(
    () => players.filter((player) => player.user_id !== null),
    [players]
  );

  const myPlayer = useMemo(
    () => players.find((player) => player.user_id === userId),
    [players, userId]
  );

  const selectedCountries = useMemo(
    () => players.map((player) => player.state_name),
    [players]
  );

  const availablePlayableCountries = useMemo(
    () =>
      PLAYABLE_COUNTRIES.filter(
        (country) => !selectedCountries.includes(country.state_name)
      ),
    [selectedCountries]
  );

  const voteCount = votes.filter((vote) => vote.vote).length;
  const requiredRealPlayers = game?.is_demo ? 1 : 3;

const canStartVoting = realPlayers.length >= requiredRealPlayers;

const everyoneVoted =
  realPlayers.length >= requiredRealPlayers && voteCount >= realPlayers.length;
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

    setGame(gameData as Game);

    const { data: playersData } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameId);

    setPlayers((playersData || []) as GamePlayer[]);

    const { data: votesData } = await supabase
      .from("game_start_votes")
      .select("*")
      .eq("game_id", gameId);

    setVotes((votesData || []) as StartVote[]);

    setLoading(false);
  };

  const createStateIfMissing = async (stateName: string, isAi = false) => {
    const profile = [...PLAYABLE_COUNTRIES, ...AI_COUNTRIES].find(
      (country) => country.state_name === stateName
    );

    if (!profile) return;

    await supabase.from("game_states").upsert(
      [
        {
          game_id: gameId,
          state_name: profile.state_name,
          treasury: profile.treasury,
          army: profile.army,
          navy: 0,
          stability: profile.stability,
          reputation: profile.reputation,
          spy_network: 10,
          trade_power: profile.trade_power,
          manpower: profile.manpower,
          technology: 50,
          territory: profile.territory,
          influence: profile.influence,
          war_exhaustion: 0,
          economy: profile.economy,
          rebellion_risk: 10,
          is_defeated: false,
          is_ai: isAi,
          ai_personality: isAi ? profile.ai_personality : null,
          is_vassal: false,
          overlord_state: null,
          score: 0,
        },
      ],
      {
        onConflict: "game_id,state_name",
      }
    );
  };

  const selectCountry = async (stateName: string) => {
    if (!game) return;

    if (game.status === "active" || game.status === "finished") {
      alert("Oyun başladıktan sonra ülke seçilemez.");
      return;
    }

    if (myPlayer) {
      alert("Bu odada zaten bir ülke seçtin.");
      return;
    }

    const alreadyTaken = players.some(
      (player) => player.state_name === stateName
    );

    if (alreadyTaken) {
      alert("Bu ülke başka bir oyuncu tarafından seçilmiş.");
      return;
    }

    const { error } = await supabase.from("game_players").insert([
      {
        game_id: gameId,
        user_id: userId,
        state_name: stateName,
      },
    ]);

    if (error) {
      alert("Ülke seçilemedi: " + error.message);
      return;
    }

    await createStateIfMissing(stateName, false);
    await fetchData();
  };

  const addAiCountriesAndStart = async () => {
    if (!game) return;

    const { data: currentPlayersData } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameId);

    const currentPlayers = (currentPlayersData || []) as GamePlayer[];
    const takenCountries = currentPlayers.map((player) => player.state_name);

    const aiCountriesToAdd = AI_COUNTRIES.filter(
      (country) => !takenCountries.includes(country.state_name)
    );

    for (const country of aiCountriesToAdd) {
      await supabase.from("game_players").insert([
        {
          game_id: gameId,
          user_id: null,
          state_name: country.state_name,
        },
      ]);

      await createStateIfMissing(country.state_name, true);
    }

    const finalPlayerCount = currentPlayers.length + aiCountriesToAdd.length;

    const { error } = await supabase
      .from("games")
      .update({
        status: "active",
        max_players: finalPlayerCount,
        started_at: new Date().toISOString(),
        turn_started_at: new Date().toISOString(),
        current_turn: 1530,
        end_turn: 1590,
      })
      .eq("id", gameId);

    if (error) {
      alert("Oyun başlatılamadı: " + error.message);
      return;
    }

    alert("Oyun başladı. Eksik devletler yapay zekâ kontrolüne geçti.");
    window.location.href = `/game/${gameId}/dashboard`;
  };

  const voteStart = async () => {
    if (!game) return;

    if (!myPlayer) {
      alert("Başlatma oyu vermek için önce ülke seçmelisin.");
      return;
    }

const requiredRealPlayers = game.is_demo ? 1 : 3;

if (realPlayers.length < requiredRealPlayers) {
  alert(
    game.is_demo
      ? "Demo oyunu başlatmak için en az 1 oyuncu gerekir."
      : "Oyunu başlatmak için en az 3 gerçek oyuncu gerekir."
  );
  return;
}

    const { error } = await supabase.from("game_start_votes").upsert(
      [
        {
          game_id: gameId,
          user_id: userId,
          vote: true,
        },
      ],
      {
        onConflict: "game_id,user_id",
      }
    );

    if (error) {
      alert("Oy kaydedilemedi: " + error.message);
      return;
    }

    const { data: latestVotesData } = await supabase
      .from("game_start_votes")
      .select("*")
      .eq("game_id", gameId)
      .eq("vote", true);

    const latestVotes = (latestVotesData || []) as StartVote[];

    if (latestVotes.length >= realPlayers.length) {
      await addAiCountriesAndStart();
      return;
    }

    alert("Başlatma oyun kaydedildi. Diğer oyuncular bekleniyor.");
    await fetchData();
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`game-room-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players" },
        fetchData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_start_votes" },
        fetchData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        fetchData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading || !game) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-100">
        Yükleniyor...
      </main>
    );
  }

  if (game.status === "active") {
    return (
      <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
        <div className="mx-auto max-w-4xl rounded-2xl border border-stone-700 bg-stone-900 p-8">
          <a
            href="/lobby"
            className="mb-8 inline-block text-sm text-stone-400 hover:text-stone-200"
          >
            ← Lobiye dön
          </a>

          <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
            Hâkimiyet: 1530
          </p>

          <h1 className="mt-3 text-3xl font-bold">{game.name}</h1>

          <p className="mt-4 text-stone-400">
            Oyun başladı. Ülken üzerinden aksiyon almak için dashboard’a geç.
          </p>

          <div className="mt-6 flex gap-3">
            <a
              href="/lobby"
              className="rounded-xl border border-stone-600 px-5 py-3 text-stone-200 hover:bg-stone-800"
            >
              Lobiye Dön
            </a>

            <a
              href={`/game/${gameId}/dashboard`}
              className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-stone-950 hover:bg-amber-400"
            >
              Dashboard’a Git
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <a
          href="/lobby"
          className="mb-8 inline-block text-sm text-stone-400 hover:text-stone-200"
        >
          ← Lobiye dön
        </a>

        <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
          Hâkimiyet: 1530
        </p>

        <h1 className="mt-3 text-4xl font-bold">{game.name}</h1>

        <p className="mt-3 text-stone-400">
          Oyun henüz başlamadı. Normal odalarda en az 3 gerçek oyuncu gerekir.
          Demo odalarda tek oyuncu ile başlatılabilir.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-sm text-stone-400">Gerçek Oyuncu</p>
            <p className="mt-2 text-3xl font-bold text-amber-400">
              {realPlayers.length}
            </p>
          </div>

          <div className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-sm text-stone-400">Başlatma Oyları</p>
            <p className="mt-2 text-3xl font-bold text-amber-400">
              {voteCount}/{realPlayers.length}
            </p>
          </div>

          <div className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-sm text-stone-400">Durum</p>
            <p className="mt-2 text-xl font-semibold text-amber-400">
              {canStartVoting ? "Oylama Hazır" : "Oyuncular Bekleniyor"}
            </p>
          </div>

          <div className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-sm text-stone-400">Senin Ülken</p>
            <p className="mt-2 text-xl font-semibold text-amber-400">
              {myPlayer ? myPlayer.state_name : "Seçilmedi"}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-stone-700 bg-stone-900 p-6">
          <h2 className="text-2xl font-semibold">Ülke Seçimi</h2>

          {myPlayer ? (
            <p className="mt-3 rounded-xl border border-emerald-700 bg-emerald-950/20 p-4 text-emerald-300">
              {myPlayer.state_name} seçildi. Diğer oyuncular bekleniyor.
            </p>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-5">
              {availablePlayableCountries.map((country) => (
                <button
                  key={country.state_name}
                  onClick={() => selectCountry(country.state_name)}
                  className="rounded-xl border border-stone-700 bg-stone-800 p-4 text-left hover:border-amber-500"
                >
                  <p className="font-semibold text-amber-400">
                    {country.state_name}
                  </p>
                  <p className="mt-2 text-xs text-stone-400">
                    {country.role}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    Toprak {country.territory} · Ordu {country.army} · Ekonomi{" "}
                    {country.economy}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-stone-700 bg-stone-900 p-6">
          <h2 className="text-2xl font-semibold">Oyuncular</h2>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {players.length === 0 ? (
              <p className="text-stone-400">Henüz ülke seçilmedi.</p>
            ) : (
              players.map((player) => (
                <div
                  key={player.id}
                  className="rounded-xl border border-stone-700 bg-stone-800 p-4"
                >
                  <p className="font-semibold text-amber-400">
                    {player.state_name}
                  </p>
                  <p className="mt-1 text-sm text-stone-400">
                    {player.user_id ? "Oyuncu" : "Yapay Zekâ"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-stone-700 bg-stone-900 p-6">
          <h2 className="text-2xl font-semibold">Oyunu Başlat</h2>

          {!canStartVoting && (
            <p className="mt-3 text-stone-400">
              {game.is_demo
                ? "Demo oyunu başlatmak için önce bir ülke seçmelisin."
                : "Başlatma oylaması için en az 3 gerçek oyuncu gerekir."}
            </p>
          )}

          {canStartVoting && !everyoneVoted && (
            <p className="mt-3 text-stone-400">
              Tüm oyuncular “Başlasın” oyu verdiğinde oyun başlayacak.
            </p>
          )}

          <button
            onClick={voteStart}
            disabled={!canStartVoting || !myPlayer}
            className="mt-5 rounded-xl bg-amber-500 px-6 py-3 font-semibold text-stone-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
          >
            Başlasın Oyu Ver
          </button>
        </div>
      </div>
    </main>
  );
}