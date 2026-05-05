"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      alert("E-posta ve şifre gir");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Hata: " + error.message);
    } else {
      window.location.href = "/lobby";
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-6 text-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-8">
        <h1 className="mb-2 text-center text-3xl font-bold">Giriş Yap</h1>

        <p className="mb-8 text-center text-sm text-stone-400">
          Devletini yönetmeye devam et.
        </p>

        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg bg-stone-800 px-4 py-3 outline-none"
          />

          <input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg bg-stone-800 px-4 py-3 outline-none"
          />

          <button
            onClick={handleLogin}
            className="mt-4 rounded-lg bg-amber-500 py-3 font-semibold text-stone-950 hover:bg-amber-400"
          >
            Giriş Yap
          </button>
        </div>

        <a
          href="/register"
          className="mt-6 block text-center text-sm text-amber-400 hover:text-amber-300"
        >
          Hesabın yok mu? Kayıt ol
        </a>
      </div>
    </main>
  );
}