"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import styles from "../styles/AuthModal.module.css";

// Einfache SVG-Icons für das Auge
const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);
const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
);

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = "login" | "register" | "reset";

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Neuer State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("user already exists")) {
            throw new Error("Diese E-Mail ist bereits registriert.");
          }
          throw error;
        }
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error("Diese E-Mail ist bereits registriert.");
        }
        setMessage("Verifizierungs-E-Mail wurde gesendet!");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        if (error) throw error;
        setMessage("Link zum Zurücksetzen wurde gesendet!");
      }
    } catch (err: any) {
      if (err.message === "Diese E-Mail ist bereits registriert.") {
        setError(err.message);
        setTimeout(() => setMode("login"), 2500);
      } else {
        setError(err.message || "Ein Fehler ist aufgetreten.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{mode === "login" ? "Willkommen zurück" : mode === "register" ? "Konto erstellen" : "Passwort zurücksetzen"}</h2>
          <p className={styles.subtitle}>
            {mode === "login" ? "Melde dich an, um deine Packlisten zu verwalten." : mode === "register" ? "Erstelle ein Konto für deine Listen." : "Gib deine E-Mail ein für den Reset-Link."}
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>E-Mail</label>
            <input type="email" className={styles.input} placeholder="deine@email.de" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          
          {mode !== "reset" && (
            <div className={styles.inputGroup}>
              <div className={styles.passwordHeader}>
                <label className={styles.label}>Passwort</label>
                {mode === "login" && (
                  <button type="button" className={styles.forgotPasswordLink} onClick={() => setMode("reset")}>Vergessen?</button>
                )}
              </div>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${styles.input} ${styles.passwordInput}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className={styles.eyeButton} 
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
          )}

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "Wird geladen..." : mode === "login" ? "Anmelden" : mode === "register" ? "Registrieren" : "Link senden"}
          </button>
        </form>

        <div className={styles.switchMode}>
          {mode === "login" ? "Noch kein Konto?" : "Bereits ein Konto?"}
          <button className={styles.switchButton} onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Registrieren" : "Anmelden"}
          </button>
        </div>
      </div>
    </div>
  );
}