"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Globe } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { LANGUAGES, useLanguageStore } from "@/store/language";

// Registration labels translated per language
const REG_T: Record<string, {
  title: string; subtitle: string;
  namePh: string; emailPh: string; passPh: string;
  submit: string; switchToLogin: string;
}> = {
  en: { title: "Create Account",         subtitle: "Choose your language",
        namePh: "Name", emailPh: "Email", passPh: "Password (min 8 characters)",
        submit: "Register", switchToLogin: "Already have an account? Login" },
  ml: { title: "Account ഉണ്ടാക്കൂ",       subtitle: "നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കൂ",
        namePh: "പേര്", emailPh: "ഇ-മെയിൽ", passPh: "Password (8+ അക്ഷരം)",
        submit: "Register ചെയ്യൂ", switchToLogin: "Account ഉണ്ടോ? Login ചെയ്യൂ" },
  hi: { title: "खाता बनाएं",              subtitle: "अपनी भाषा चुनें",
        namePh: "नाम", emailPh: "ईमेल", passPh: "पासवर्ड (8+ अक्षर)",
        submit: "रजिस्टर करें", switchToLogin: "खाता है? लॉगिन करें" },
  ta: { title: "கணக்கு உருவாக்கு",        subtitle: "மொழியை தேர்ந்தெடுக்கவும்",
        namePh: "பெயர்", emailPh: "மின்னஞ்சல்", passPh: "கடவுச்சொல் (8+)",
        submit: "பதிவு செய்", switchToLogin: "கணக்கு உள்ளதா? உள்நுழை" },
  te: { title: "ఖాతా సృష్టించండి",         subtitle: "మీ భాషను ఎంచుకోండి",
        namePh: "పేరు", emailPh: "ఇమెయిల్", passPh: "పాస్వర్డ్ (8+)",
        submit: "నమోదు చేయండి", switchToLogin: "ఖాతా ఉందా? లాగిన్" },
  kn: { title: "ಖಾತೆ ಮಾಡಿ",               subtitle: "ನಿಮ್ಮ ಭಾಷೆ ಆರಿಸಿ",
        namePh: "ಹೆಸರು", emailPh: "ಇಮೇಲ್", passPh: "ಪಾಸ್ವರ್ಡ್ (8+)",
        submit: "ನೋಂದಣಿ", switchToLogin: "ಖಾತೆ ಇದೆಯೇ? ಲಾಗಿನ್" },
  ru: { title: "Создать аккаунт",          subtitle: "Выберите язык",
        namePh: "Имя", emailPh: "Email", passPh: "Пароль (8+ символов)",
        submit: "Зарегистрироваться", switchToLogin: "Уже есть аккаунт? Войти" },
  es: { title: "Crear cuenta",             subtitle: "Elige tu idioma",
        namePh: "Nombre", emailPh: "Correo", passPh: "Contraseña (8+ caracteres)",
        submit: "Registrarse", switchToLogin: "¿Ya tienes cuenta? Inicia sesión" },
  fr: { title: "Créer un compte",          subtitle: "Choisissez votre langue",
        namePh: "Nom", emailPh: "Email", passPh: "Mot de passe (8+ caractères)",
        submit: "S'inscrire", switchToLogin: "Déjà un compte ? Se connecter" },
  zh: { title: "创建账户",                    subtitle: "选择您的语言",
        namePh: "姓名", emailPh: "邮箱", passPh: "密码（8位以上）",
        submit: "注册", switchToLogin: "已有账户？登录" },
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuthStore();
  const { code: storedCode, setCode } = useLanguageStore();
  const [mode, setMode] = useState<"login" | "register">(
    searchParams.get("mode") === "register" ? "register" : "login"
  );
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  // Language for registration labels — only active during registration
  const [regLang, setRegLang] = useState("en");
  const t = REG_T[regLang] ?? REG_T.en;

  const handleLangChange = (code: string) => {
    setRegLang(code);
    setCode(code); // also update the global store so the app previews in this language
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
    // When switching away from register, if a non-English language was chosen,
    // keep it — the user has made their preference known.
    if (mode === "register") {
      setRegLang(storedCode);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
        // Language was already set via handleLangChange — keep it
      }
      router.push("/play");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-px flex justify-center py-20">
      <div className="card w-full max-w-md">

        {/* Registration: language picker at top */}
        {mode === "register" && (
          <div className="mb-5 rounded-xl border border-surface-border bg-surface-DEFAULT/50 p-3">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-gray-400">
              <Globe className="h-3.5 w-3.5" />
              {t.subtitle}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleLangChange(l.code)}
                  className={`rounded-lg px-2.5 py-1 text-sm font-medium transition ${
                    regLang === l.code
                      ? "bg-brand text-white"
                      : "border border-surface-border text-gray-400 hover:border-gray-500 hover:text-gray-200"
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold">
          {mode === "login" ? "Login" : t.title}
        </h1>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <input
              className="w-full rounded-xl border border-surface-border bg-surface-DEFAULT px-4 py-2.5 outline-none focus:border-brand"
              placeholder={t.namePh}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            type="email"
            required
            className="w-full rounded-xl border border-surface-border bg-surface-DEFAULT px-4 py-2.5 outline-none focus:border-brand"
            placeholder={mode === "register" ? t.emailPh : "Email"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-xl border border-surface-border bg-surface-DEFAULT px-4 py-2.5 outline-none focus:border-brand"
            placeholder={mode === "register" ? t.passPh : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={busy} className="btn-primary w-full">
            {busy ? "Please wait…" : mode === "login" ? "Login" : t.submit}
          </button>
        </form>

        <button
          onClick={switchMode}
          className="mt-4 w-full text-center text-sm text-gray-400 hover:text-white"
        >
          {mode === "login"
            ? "Don't have an account? Register here"
            : t.switchToLogin}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
