"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import styles from "../styles/AuthModal.module.css";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Verifizierungs-E-Mail wurde gesendet! Bitte prüfe dein Postfach.");
      }
    } catch (err: any) {
      setError(err.message || "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isLogin ? "Willkommen zurück" : "Konto erstellen"}</h2>
          <p className={styles.subtitle}>
            {isLogin 
              ? "Melde dich an, um deine Packlisten zu verwalten." 
              : "Erstelle ein Konto, um deine Listen dauerhaft zu speichern."}
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>E-Mail</label>
            <input
              type="email"
              className={styles.input}
              placeholder="deine@email.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Passwort</label>
            <input
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "Wird geladen..." : (isLogin ? "Anmelden" : "Registrieren")}
          </button>
        </form>

        <div className={styles.switchMode}>
          {isLogin ? "Noch kein Konto?" : "Bereits ein Konto?"}
          <button 
            className={styles.switchButton} 
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Registrieren" : "Anmelden"}
          </button>
        </div>
      </div>
    </div>
  );
}
