"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Game = {
  id: string;
  name: string;
  status: string;
  current_turn: number;
  max_players: number;
  created_at: string;
  is_demo: boolean;
  owner_user_id: string | null;
  delete_requested: boolean;
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

export default function LobbyPage() {
  const [userId, setUserId] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [votes, setVotes] = useState<StartVote[]>([]);
  const [newGameName, setNewGameName] = useState("Yeni Oyun");

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      window.location.href = "/login";
      return;
    }

    setUserId(data.user.id);
  };

  const fetchLobbyData = async () => {
    const { data: gamesData, error: gamesError } = await supabase
      .from("games")
      .select("*")
      .order("created_at", { ascending: false });

    if (gamesError) {
      alert("Odalar alınamadı: " + gamesError.message);
      return;
    }

    setGames((gamesData || []) as Game[]);

    const { data: playersData } = await supabase
      .from("game_players")
      .select("*");

    setPlayers((playersData || []) as GamePlayer[]);

    const { data: votesData } = await supabase
      .from("game_start_votes")
      .select("*");

    setVotes((votesData || []) as StartVote[]);
  };

  const createGame = async (isDemo: boolean) => {
    if (!userId) {
      alert("Kullanıcı bilgisi bulunamadı.");
      return;
    }

    const { error } = await supabase.from("games").insert([
      {
        name: newGameName || "Yeni Oyun",
        status: "waiting",
        current_turn: 1530,
        max_players: 5,
        is_demo: isDemo,
        owner_user_id: userId,
        delete_requested: false,
      },
    ]);

    if (error) {
      alert("Oda oluşturulamadı: " + error.message);
      return;
    }

    setNewGameName("Yeni Oyun");
    await fetchLobbyData();
    alert(isDemo ? "Demo oda oluşturuldu." : "Oda oluşturuldu.");
  };

  const renameGame = async (game: Game) => {
    if (game.owner_user_id !== userId) {
      alert("Sadece oda sahibi oda adını değiştirebilir.");
      return;
    }

    const nextName = prompt("Yeni oda adı:", game.name);

    if (!nextName) return;

    const { error } = await supabase
      .from("games")
      .update({ name: nextName })
      .eq("id", game.id);

    if (error) {
      alert("Oda adı güncellenemedi: " + error.message);
      return;
    }

    await fetchLobbyData();
  };

  const deleteGame = async (game: Game) => {
    if (game.owner_user_id !== userId) {
      alert("Sadece oda sahibi silme işlemini başlatabilir.");
      return;
    }

    if (game.status === "active") {
      const { error } = await supabase
        .from("games")
        .update({ delete_requested: true })
        .eq("id", game.id);

      if (error) {
        alert("Silme oylaması başlatılamadı: " + error.message);
        return;
      }

      alert("Oyun aktif olduğu için silme oylaması başlatıldı. Oyuncuların %60 onayı gerekir.");
      await fetchLobbyData();
      return;
    }

    const approved = confirm("Bu odayı silmek istiyor musun?");

    if (!approved) return;

    await supabase.from("player_actions").delete().eq("game_id", game.id);
    await supabase.from("game_events").delete().eq("game_id", game.id);
    await supabase.from("conflicts").delete().eq("game_id", game.id);
    await supabase.from("spy_networks").delete().eq("game_id", game.id);
    await supabase.from("diplomatic_relations").delete().eq("game_id", game.id);
    await supabase.from("game_state_snapshots").delete().eq("game_id", game.id);
    await supabase.from("game_scores").delete().eq("game_id", game.id);
    await supabase.from("game_start_votes").delete().eq("game_id", game.id);
    await supabase.from("game_delete_votes").delete().eq("game_id", game.id);
    await supabase.from("game_states").delete().eq("game_id", game.id);
    await supabase.from("game_players").delete().eq("game_id", game.id);

    const { error } = await supabase.from("games").delete().eq("id", game.id);

    if (error) {
      alert("Oda silinemedi: " + error.message);
      return;
    }

    await fetchLobbyData();
  };

  const voteToStart = async (game: Game) => {
    if (!userId) return;

    const gamePlayers = players.filter(
      (player) => player.game_id === game.id && player.user_id !== null
    );

    const isPlayerInGame = gamePlayers.some((player) => player.user_id === userId);

    if (!isPlayerInGame) {
      alert("Başlatma oylamasına katılmak için önce odada bir devlet seçmelisin.");
      return;
    }

    if (gamePlayers.length < 3) {
      alert("Oyunu başlatmak için en az 3 gerçek oyuncu gerekir.");
      return;
    }

    const { error } = await supabase.from("game_start_votes").upsert(
      [
        {
          game_id: game.id,
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

    await tryStartGame(game.id);
    await fetchLobbyData();
  };

  const tryStartGame = async (gameId: string) => {
    const gamePlayers = players.filter(
      (player) => player.game_id === gameId && player.user_id !== null
    );

    const gameVotes = votes.filter((vote) => vote.game_id === gameId && vote.vote);

    const latestVotesResult = await supabase
      .from("game_start_votes")
      .select("*")
      .eq("game_id", gameId)
      .eq("vote", true);

    const latestVotes = (latestVotesResult.data || []) as StartVote[];

    if (gamePlayers.length >= 3 && latestVotes.length >= gamePlayers.length) {
      const { error } = await supabase
        .from("games")
        .update({
          status: "active",
          started_at: new Date().toISOString(),
          turn_started_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (error) {
        alert("Oyun başlatılamadı: " + error.message);
        return;
      }

      alert("Tüm oyuncular onay verdi. Oyun başladı.");
    }
  };

  const voteDelete = async (game: Game) => {
    if (!userId) return;

    const { error } = await supabase.from("game_delete_votes").upsert(
      [
        {
          game_id: game.id,
          user_id: userId,
          vote: true,
        },
      ],
      {
        onConflict: "game_id,user_id",
      }
    );

    if (error) {
      alert("Silme oyun kaydedilemedi: " + error.message);
      return;
    }

    const gamePlayers = players.filter(
      (player) => player.game_id === game.id && player.user_id !== null
    );

    const { data: deleteVotesData } = await supabase
      .from("game_delete_votes")
      .select("*")
      .eq("game_id", game.id)
      .eq("vote", true);

    const voteCount = deleteVotesData?.length || 0;
    const requiredVotes = Math.ceil(gamePlayers.length * 0.6);

    if (voteCount >= requiredVotes) {
      await deleteGame({
        ...game,
        status: "waiting",
      });
      return;
    }

    alert(`Silme oyun kaydedildi. Gerekli oy: ${requiredVotes}, mevcut oy: ${voteCount}.`);
    await fetchLobbyData();
  };

  const getPlayerCount = (gameId: string) => {
    return players.filter(
      (player) => player.game_id === gameId && player.user_id !== null
    ).length;
  };

  const getVoteCount = (gameId: string) => {
    return votes.filter((vote) => vote.game_id === gameId && vote.vote).length;
  };

  useEffect(() => {
    fetchUser();
    fetchLobbyData();
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
            Oda oluştur, oyuncuların katılmasını bekle ve en az 3 oyuncu ile
            başlatma oylaması yap.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-stone-700 bg-stone-900 p-6">
          <h2 className="text-2xl font-semibold">Yeni Oda Oluştur</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <input
              value={newGameName}
              onChange={(e) => setNewGameName(e.target.value)}
              placeholder="Oda adı"
              className="rounded-xl bg-stone-800 px-4 py-3 outline-none"
            />

            <button
              onClick={() => createGame(false)}
              className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-stone-950 hover:bg-amber-400"
            >
              Normal Oda
            </button>

            <button
              onClick={() => createGame(true)}
              className="rounded-xl border border-amber-600 px-6 py-3 font-semibold text-amber-300 hover:bg-amber-950/30"
            >
              Demo Oda
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-700 bg-stone-900 p-6">
          <h2 className="mb-6 text-2xl font-semibold">Aktif Odalar</h2>

          {games.length === 0 ? (
            <p className="text-stone-400">Henüz aktif oda yok.</p>
          ) : (
            <div className="grid gap-4">
              {games.map((game) => {
                const playerCount = getPlayerCount(game.id);
                const voteCount = getVoteCount(game.id);
                const isOwner = game.owner_user_id === userId;

                return (
                  <div
                    key={game.id}
                    className="rounded-xl border border-stone-700 bg-stone-800 p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-semibold">{game.name}</h3>

                          {isOwner && (
                            <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-stone-950">
                              Oda Sahibi
                            </span>
                          )}

                          {game.is_demo && (
                            <span className="rounded-full border border-amber-600 px-3 py-1 text-xs text-amber-300">
                              Demo
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm text-stone-400">
                          Durum: {game.status} | Tur: {game.current_turn} |
                          Oyuncu: {playerCount}/{game.max_players} |
                          Başlatma Oyları: {voteCount}/{playerCount}
                        </p>

                        {game.delete_requested && (
                          <p className="mt-2 text-sm text-red-300">
                            Bu oyun için silme oylaması açık.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/game/${game.id}`}
                          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-400"
                        >
                          Odaya Gir
                        </a>

                        {game.status !== "active" && playerCount >= 3 && (
                          <button
                            onClick={() => voteToStart(game)}
                            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-950/30"
                          >
                            Başlasın Oyu Ver
                          </button>
                        )}

                        {isOwner && (
                          <button
                            onClick={() => renameGame(game)}
                            className="rounded-lg border border-stone-600 px-4 py-2 text-sm text-stone-200 hover:bg-stone-700"
                          >
                            Adı Değiştir
                          </button>
                        )}

                        {isOwner && (
                          <button
                            onClick={() => deleteGame(game)}
                            className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-300 hover:bg-red-950/30"
                          >
                            Odayı Sil
                          </button>
                        )}

                        {game.delete_requested && (
                          <button
                            onClick={() => voteDelete(game)}
                            className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-300 hover:bg-red-950/30"
                          >
                            Silinsin Oyu Ver
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}