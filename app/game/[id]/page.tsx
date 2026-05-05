"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const STATES = [
  {
    name: "Osmanlı",
    treasury: 85,
    army: 90,
    navy: 75,
    stability: 80,
    reputation: 70,
    spy_network: 65,
    trade_power: 75,
    manpower: 90,
    technology: 70,
  },
  {
    name: "Avusturya",
    treasury: 70,
    army: 75,
    navy: 35,
    stability: 70,
    reputation: 80,
    spy_network: 55,
    trade_power: 60,
    manpower: 75,
    technology: 75,
  },
  {
    name: "Fransa",
    treasury: 75,
    army: 80,
    navy: 55,
    stability: 65,
    reputation: 75,
    spy_network: 60,
    trade_power: 70,
    manpower: 80,
    technology: 75,
  },
  {
    name: "İspanya",
    treasury: 90,
    army: 75,
    navy: 85,
    stability: 70,
    reputation: 78,
    spy_network: 60,
    trade_power: 85,
    manpower: 70,
    technology: 78,
  },
  {
    name: "Macaristan",
    treasury: 55,
    army: 65,
    navy: 10,
    stability: 50,
    reputation: 55,
    spy_network: 45,
    trade_power: 45,
    manpower: 60,
    technology: 60,
  },
];

type Game = {
  id: string;
  is_demo: boolean;
};

type GamePlayer = {
  id: string;
  game_id: string;
  user_id: string | null;
  state_name: string;
};

export default function GamePage() {
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [userId, setUserId] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [takenStates, setTakenStates] = useState<string[]>([]);
  const [existingState, setExistingState] = useState("");

  const fetchUserAndGameData = async () => {
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError) {
      alert("Oyun bilgisi alınamadı: " + gameError.message);
      return;
    }

    setGame(gameData);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      alert("Oturum bulunamadı. Lütfen tekrar giriş yap.");
      window.location.href = "/login";
      return;
    }

    const currentUserId = userData.user.id;
    setUserId(currentUserId);

    const { data: playersData, error: playersError } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameId);

    if (playersError) {
      alert("Oyuncu bilgileri alınamadı: " + playersError.message);
      return;
    }

    const players = playersData as GamePlayer[];
    const userPlayer = players.find((player) => player.user_id === currentUserId);

    if (userPlayer) {
      setExistingState(userPlayer.state_name);
    }

    setTakenStates(players.map((player) => player.state_name));
  };

  const goToDashboard = () => {
    window.location.href = `/game/${gameId}/dashboard`;
  };

  const createStateRow = async (stateData: (typeof STATES)[number]) => {
    const { error } = await supabase.from("game_states").insert([
      {
        game_id: gameId,
        state_name: stateData.name,
        treasury: stateData.treasury,
        army: stateData.army,
        navy: stateData.navy,
        stability: stateData.stability,
        reputation: stateData.reputation,
        spy_network: stateData.spy_network,
        trade_power: stateData.trade_power,
        manpower: stateData.manpower,
        technology: stateData.technology,
      },
    ]);

    return error;
  };

  const fillDemoStates = async (selectedPlayerState: string) => {
    const remainingStates = STATES.filter(
      (state) => state.name !== selectedPlayerState
    );

    for (const state of remainingStates) {
      const { error: playerError } = await supabase.from("game_players").insert([
        {
          game_id: gameId,
          user_id: null,
          state_name: state.name,
        },
      ]);

      if (playerError && playerError.code !== "23505") {
        alert("Demo devlet oluşturulamadı: " + playerError.message);
        return false;
      }

      const stateError = await createStateRow(state);

      if (stateError && stateError.code !== "23505") {
        alert("Demo devlet değerleri oluşturulamadı: " + stateError.message);
        return false;
      }
    }

    return true;
  };

  const joinGame = async () => {
    if (!userId || !game) {
      alert("Kullanıcı veya oyun bilgisi bulunamadı.");
      return;
    }

    if (existingState) {
      alert("Bu odada zaten bir devlet seçtin.");
      goToDashboard();
      return;
    }

    if (!selectedState) {
      alert("Devlet seçmelisin.");
      return;
    }

    if (takenStates.includes(selectedState)) {
      alert("Bu devlet bu odada zaten seçilmiş.");
      return;
    }

    const selectedStateData = STATES.find((state) => state.name === selectedState);

    if (!selectedStateData) {
      alert("Devlet bilgisi bulunamadı.");
      return;
    }

    const { error: playerError } = await supabase.from("game_players").insert([
      {
        game_id: gameId,
        user_id: userId,
        state_name: selectedState,
      },
    ]);

    if (playerError) {
      if (playerError.code === "23505") {
        alert("Bu odada zaten bir devlet seçtin veya bu devlet seçilmiş.");
      } else {
        alert("Oyuna katılım hatası: " + playerError.message);
      }
      return;
    }

    const stateError = await createStateRow(selectedStateData);

    if (stateError && stateError.code !== "23505") {
      alert("Devlet değerleri oluşturulamadı: " + stateError.message);
      return;
    }

    if (game.is_demo) {
      const demoCompleted = await fillDemoStates(selectedState);

      if (!demoCompleted) {
        return;
      }
    }

    window.location.href = `/game/${gameId}/dashboard`;
  };

  useEffect(() => {
    fetchUserAndGameData();
  }, []);

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-sm uppercase tracking-[0.35em] text-amber-400">
          Hâkimiyet: 1530
        </p>

        <h1 className="mb-3 text-3xl font-bold">Devlet Seç</h1>

        {game?.is_demo && (
          <p className="mb-6 rounded-xl border border-amber-700 bg-amber-950/20 p-4 text-sm text-amber-200">
            Demo mod aktif. Sen bir devlet seçtikten sonra diğer devletler test
            oyuncusu olarak otomatik doldurulacak.
          </p>
        )}

        {existingState ? (
          <div className="rounded-2xl border border-amber-500 bg-stone-900 p-6">
            <p className="text-stone-300">
              Bu odada daha önce <strong>{existingState}</strong> devletini seçtin.
            </p>

            <button
              onClick={goToDashboard}
              className="mt-6 rounded-xl bg-amber-500 px-6 py-3 font-semibold text-stone-950 hover:bg-amber-400"
            >
              Oyuna Devam Et
            </button>
          </div>
        ) : (
          <>
            <p className="mb-8 text-stone-400">
              Her kullanıcı bu odada yalnızca bir devlet seçebilir.
            </p>

            <div className="grid gap-4">
              {STATES.map((state) => {
                const isTaken = takenStates.includes(state.name);
                const isSelected = selectedState === state.name;

                return (
                  <button
                    key={state.name}
                    disabled={isTaken}
                    onClick={() => setSelectedState(state.name)}
                    className={`rounded-xl border px-6 py-4 text-left transition ${
                      isTaken
                        ? "cursor-not-allowed border-stone-800 bg-stone-900 text-stone-600"
                        : isSelected
                        ? "border-amber-400 bg-stone-800 text-stone-100"
                        : "border-stone-700 bg-stone-900 text-stone-100 hover:bg-stone-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{state.name}</span>

                      {isTaken ? (
                        <span className="text-sm text-stone-500">Seçildi</span>
                      ) : (
                        <span className="text-sm text-amber-400">Müsait</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={joinGame}
              className="mt-8 rounded-xl bg-amber-500 px-6 py-3 font-semibold text-stone-950 hover:bg-amber-400"
            >
              Oyuna Katıl
            </button>
          </>
        )}

        <a
          href="/lobby"
          className="mt-6 block text-sm text-stone-400 hover:text-stone-200"
        >
          ← Lobiye dön
        </a>
      </div>
    </main>
  );
}