"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    if (!email || !password) {
      alert("E-posta ve şifre gir");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("Hata: " + error.message);
    } else {
      alert("Kayıt başarılı. Mailini kontrol et.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-6 text-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-8">
        <h1 className="mb-6 text-center text-3xl font-bold">Kayıt Ol</h1>

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
            onClick={handleRegister}
            className="mt-4 rounded-lg bg-amber-500 py-3 font-semibold text-stone-950 hover:bg-amber-400"
          >
            Hesap Oluştur
          </button>
        </div>
      </div>
    </main>
  );
}