export default function Home() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-amber-400">
          1530–1570 Diplomasi ve Strateji Oyunu
        </p>

        <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-7xl">
          Hâkimiyet: 1530
        </h1>

        <p className="mb-10 max-w-3xl text-lg leading-8 text-stone-300">
          Osmanlı’nın güçlü olduğu bir dönemde; diplomasi, casusluk, ittifak,
          ekonomi ve savaş kararlarıyla tarihin akışını yeniden şekillendir.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <a
            href="/login"
            className="rounded-xl bg-amber-500 px-8 py-3 font-semibold text-stone-950 hover:bg-amber-400"
          >
            Oyuna Başla
          </a>

          <button className="rounded-xl border border-stone-600 px-8 py-3 font-semibold text-stone-100 hover:bg-stone-800">
            Oyun Hakkında
          </button>
        </div>
      </section>
    </main>
  );
}