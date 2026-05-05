"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Game = {
  id: string;
  status: string;
  current_turn: number;
  max_players: number;
  created_at: string;
  is_demo: boolean;
};

export default function LobbyPage() {
  const [games, setGames] = useState<Game[]>([]);

  const fetchGames = async () => {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Odalar alınamadı: " + error.message);
      return;
    }

    setGames(data || []);
  };

  const createGame = async (isDemo: boolean) => {
    const { error } = await supabase.from("games").insert([
      {
        status: "waiting",
        current_turn: 1530,
        max_players: 5,
        is_demo: isDemo,
      },
    ]);

    if (error) {
      alert("Hata: " + error.message);
    } else {
      await fetchGames();
      alert(isDemo ? "Demo oda oluşturuldu" : "Oda oluşturuldu");
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
            Hâkimiyet: 1530
          </p>

          <h1 className="mt-3 text-4xl font-bold">Oyun Lobisi</h1>

          <p className="mt-3 max-w-2xl text-stone-400">
            Aktif oyun odalarını görüntüle veya yeni bir oda oluştur.
          </p>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-stone-700 bg-stone-900 p-6">
            <h2 className="mb-3 text-2xl font-semibold">Normal Oyun Oluştur</h2>

            <p className="mb-6 text-stone-400">
              5 gerçek oyunculu standart senaryo başlat.
            </p>

            <button
              onClick={() => createGame(false)}
              className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-stone-950 hover:bg-amber-400"
            >
              Normal Oda Oluştur
            </button>
          </div>

          <div className="rounded-2xl border border-amber-700 bg-stone-900 p-6">
            <h2 className="mb-3 text-2xl font-semibold">Demo Oyun Oluştur</h2>

            <p className="mb-6 text-stone-400">
              Tek kullanıcıyla test için demo oda oluştur. Diğer devletler sistem
              tarafından doldurulur.
            </p>

            <button
              onClick={() => createGame(true)}
              className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-stone-950 hover:bg-amber-400"
            >
              Demo Oda Oluştur
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-700 bg-stone-900 p-6">
          <h2 className="mb-6 text-2xl font-semibold">Aktif Odalar</h2>

          {games.length === 0 ? (
            <p className="text-stone-400">Henüz aktif oda yok.</p>
          ) : (
            <div className="grid gap-4">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-stone-700 bg-stone-800 p-5 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-semibold text-stone-100">
                      Oda ID: {game.id.slice(0, 8)}
                    </p>

                    <p className="mt-1 text-sm text-stone-400">
                      Durum: {game.status} | Tur: {game.current_turn} | Oyuncu
                      Limiti: {game.max_players} | Mod:{" "}
                      {game.is_demo ? "Demo" : "Normal"}
                    </p>
                  </div>

                  <a
                    href={`/game/${game.id}`}
                    className="rounded-lg bg-amber-500 px-5 py-2 text-center font-semibold text-stone-950 hover:bg-amber-400"
                  >
                    Odaya Gir
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}