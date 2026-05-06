"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Score = {
  id: string;
  state_name: string;
  score: number;
  rank: number;
  reason: string;
};

export default function ResultsPage() {
  const params = useParams();
  const gameId = params.id as string;

  const [scores, setScores] = useState<Score[]>([]);

  const fetchScores = async () => {
    const { data, error } = await supabase
      .from("game_scores")
      .select("*")
      .eq("game_id", gameId)
      .order("rank", { ascending: true });

    if (error) {
      alert("Skorlar alınamadı: " + error.message);
      return;
    }

    setScores((data || []) as Score[]);
  };

  useEffect(() => {
    fetchScores();
  }, []);

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
          Hâkimiyet: 1530
        </p>

        <h1 className="mt-3 text-4xl font-bold">Oyun Sonuçları</h1>

        <p className="mt-3 text-stone-400">
          1590 yılına ulaşıldı. Devletlerin toplam güç puanına göre sıralama
          aşağıdadır.
        </p>

        <div className="mt-8 grid gap-4">
          {scores.length === 0 ? (
            <p className="text-stone-400">Henüz skor bulunamadı.</p>
          ) : (
            scores.map((score) => (
              <div
                key={score.id}
                className="rounded-2xl border border-stone-700 bg-stone-900 p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-amber-400">#{score.rank}</p>

                    <h2 className="mt-1 text-2xl font-semibold">
                      {score.state_name}
                    </h2>

                    <p className="mt-2 text-sm text-stone-400">
                      {score.reason}
                    </p>
                  </div>

                  <p className="text-3xl font-bold text-amber-400">
                    {score.score}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <a
          href="/lobby"
          className="mt-8 inline-block rounded-xl bg-amber-500 px-6 py-3 font-semibold text-stone-950 hover:bg-amber-400"
        >
          Lobiye Dön
        </a>
      </div>
    </main>
  );
}