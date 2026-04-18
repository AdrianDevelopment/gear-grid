"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import AuthModal from "./AuthModal";
import styles from "../styles/Navbar.module.css";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [listName, setListName] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Dynamischer Titel basierend auf der aktuellen Liste + Realtime Update
  useEffect(() => {
    const id = pathname.startsWith("/list/") ? pathname.split("/").pop() : null;

    if (!id) {
      setListName("");
      return;
    }

    // 1. Initialen Namen laden
    const fetchTitle = async () => {
      const { data } = await supabase
        .from("packing_lists")
        .select("name")
        .eq("id", id)
        .single();
      if (data) setListName(data.name);
    };

    fetchTitle();

    // 2. Realtime Abo: Wenn sich die Liste in der DB ändert (z.B. durch Sidebar Rename)
    const channel = supabase
      .channel(`list-rename-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "packing_lists",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          // Wenn ein Update reinkommt, setzen wir den neuen Namen direkt im UI
          if (payload.new && payload.new.name) {
            setListName(payload.new.name);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsDropdownOpen(false);
    router.push("/");
  };

  return (
    <>
      <header className={styles.navbar}>
        <div className={styles.left}>
          <span className={styles.title}>{listName}</span>
        </div>

        <div className={styles.right}>
          <button className={styles.iconButton} type="button">
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button className={styles.iconButton} type="button">
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>

          <div className={styles.accountWrapper} ref={settingsRef}>
            <button 
              className={styles.iconButton} 
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
              {/* Dein bestehendes Settings-SVG */}
              <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {isSettingsOpen && (
              <div className={styles.dropdown}>
                <div className={styles.userInfo}>
                  <div className={styles.userEmail}>Einstellungen</div>
                </div>
                
                <button className={styles.dropdownItem} type="button">
                  <span>Einheit: Metrisch (kg/g)</span>
                </button>
                
                <button className={styles.dropdownItem} type="button">
                  <span>Währung: Euro (€)</span>
                </button>
                
                <div className={styles.horizontalLine} />
                
                <button className={styles.dropdownItem} type="button">
                  <span>Erscheinungsbild: System</span>
                </button>

                <button className={styles.dropdownItem} type="button">
                  <span>Sprache: Deutsch</span>
                </button>
              </div>
            )}
          </div>

          <div className={styles.accountWrapper} ref={dropdownRef}>
            <button 
              className={styles.iconButton} 
              type="button" 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className={styles.dropdown}>
                {user ? (
                  <>
                    <div className={styles.userInfo}>
                      <div className={styles.userEmail}>{user.email}</div>
                    </div>
                    <div className={styles.verticalLine}></div>
                    <button className={styles.dropdownItem} type="button">
                      Profil bearbeiten
                    </button>
                    <div className={styles.horizontalLine} />
                    <button 
                      className={`${styles.dropdownItem} ${styles.logout}`} 
                      type="button"
                      onClick={handleLogout}
                    >
                      Abmelden
                    </button>
                  </>
                ) : (
                  <button 
                    className={styles.dropdownItem} 
                    type="button" 
                    onClick={() => {
                      setIsAuthModalOpen(true);
                      setIsDropdownOpen(false);
                    }}
                  >
                    Anmelden / Registrieren
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  );
}
