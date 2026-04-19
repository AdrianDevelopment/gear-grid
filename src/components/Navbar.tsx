"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import AuthModal from "./AuthModal";
import styles from "../styles/Navbar.module.css";
import jsPDF from "jspdf";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [listName, setListName] = useState<string>("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const importRef = useRef<HTMLDivElement>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
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
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (importRef.current && !importRef.current.contains(event.target as Node)) {
        setIsImportOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAccountOpen(false);
    router.push("/");
  };

  const handleExportPDF = async () => {
    const id = pathname.startsWith("/list/") ? pathname.split("/").pop() : null;
    
    if (!id) {
      alert("Keine Liste ausgewählt!");
      return;
    }

    try {
      console.log("Starting PDF export for list ID:", id);

      // Lade Liste und Items aus der Datenbank
      const { data: list, error: listError } = await supabase
        .from("packing_lists")
        .select("name")
        .eq("id", id)
        .single();

      console.log("List data:", list, "Error:", listError);
      if (listError) {
        console.error("List error:", listError);
        throw new Error(`Fehler beim Laden der Liste: ${listError.message}`);
      }

      const { data: categories, error: catError } = await supabase
        .from("packing_categories")
        .select("*")
        .eq("list_id", id)
        .order("created_at", { ascending: true });

      console.log("Categories data:", categories, "Error:", catError);
      if (catError) {
        console.error("Categories error:", catError);
        throw new Error(`Fehler beim Laden der Kategorien: ${catError.message}`);
      }

      const { data: items, error: itemsError } = await supabase
        .from("packing_items")
        .select("*")
        .eq("list_id", id)
        .order("created_at", { ascending: true });

      console.log("Items data:", items, "Error:", itemsError);
      if (itemsError) {
        console.error("Items error:", itemsError);
        throw new Error(`Fehler beim Laden der Items: ${itemsError.message}`);
      }

      console.log("All data loaded successfully, creating PDF...");

      // PDF erstellen
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Titel
      pdf.setFontSize(20);
      pdf.text(list?.name || "Packliste", margin, yPosition);
      yPosition += 15;

      // // Datum
      // pdf.setFontSize(10);
      // const today = new Date().toLocaleDateString("de-DE", {
      //   year: "numeric",
      //   month: "long",
      //   day: "numeric"
      // });
      // pdf.text(today, margin, yPosition);
      // yPosition += 15;

      // Gruppiere Items nach Kategorien
      if (categories && categories.length > 0) {
        categories.forEach((category) => {
          const categoryItems = items?.filter((item) => item.category_id === category.id) || [];
          
          if (categoryItems.length === 0) return;

          // Prüfe ob neue Seite nötig ist
          if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
          }

          // Kategorie-Name
          pdf.setFontSize(14);
          pdf.text(category.name, margin, yPosition);
          yPosition += 8;

          // Items in dieser Kategorie
          pdf.setFontSize(11);

          categoryItems.forEach((item) => {
            // Prüfe ob neue Seite nötig ist
            if (yPosition > pageHeight - 20) {
              pdf.addPage();
              yPosition = margin;
            }

            // Checkbox (leeres Quadrat)
            const checkboxSize = 4;
            pdf.rect(margin, yPosition - 3, checkboxSize, checkboxSize);

            // Item Name
            const nameX = margin + checkboxSize + 5;
            const itemName = item.name || "";
            pdf.text(itemName, nameX, yPosition);

            // Anzahl (rechtsbündig)
            const countText = `${item.count || 1}x`;
            const countWidth = pdf.getTextWidth(countText);
            pdf.text(countText, pageWidth - margin - countWidth, yPosition);

            yPosition += 7;
          });

          yPosition += 5; // Abstand zur nächsten Kategorie
        });
      }

      // Statistik am Ende
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = margin;
      } else {
        yPosition += 10;
      }

      yPosition -= 8;
      // Trennlinie
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // Gesamtstatistik
      const totalItems = items?.reduce((sum, item) => sum + (item.count || 0), 0) || 0;
      const totalWeight = items?.reduce((sum, item) => sum + ((item.weight || 0) * (item.count || 0)), 0) || 0;
      
      pdf.setFontSize(10);
      if (totalItems > 1) {
        pdf.text(`Gesamt: ${totalItems} Gegenstände`, margin, yPosition);
      }
      else {
        pdf.text(`Gesamt: ${totalItems} Gegenstand`, margin, yPosition);
      }
      yPosition += 6;
      pdf.text(`Gesamtgewicht: ${(totalWeight / 1000).toFixed(2)}kg`, margin, yPosition);

      console.log("PDF created, saving...");

      // PDF speichern
      const fileName = `${list?.name || "Packliste"}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      console.log("PDF saved successfully!");

      // Dropdown schließen
      setIsExportOpen(false);

    } catch (error) {
      console.error("Detaillierter Fehler beim PDF-Export:", error);
      alert(`Fehler beim Erstellen des PDFs: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  };

  return (
    <>
      <header className={styles.navbar}>
        <div className={styles.left}>
          <span className={styles.title}>{listName}</span>
        </div>

        <div className={styles.right}>
          <div className={styles.accountWrapper} ref={importRef}>
            <button className={styles.iconButton} type="button" onClick={() => setIsImportOpen(!isImportOpen)}>
              <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {isImportOpen && (
              <div className={styles.dropdown}>
                <div className={styles.userInfo}>
                  <div className={styles.userEmail}>Import</div>
                </div>
                <button className={styles.dropdownItem} type="button">
                  <span>Bald verfügbar</span>
                </button>
              </div>
            )}
          </div>
          
          <div className={styles.accountWrapper} ref={exportRef}>
            <button className={styles.iconButton} type="button" onClick={() => setIsExportOpen(!isExportOpen)}>
              <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
            {isExportOpen && (
              <div className={styles.dropdown}>
                <div className={styles.userInfo}>
                  <div className={styles.userEmail}>Export</div>
                </div>
                <button 
                  className={styles.dropdownItem} 
                  type="button"
                  onClick={handleExportPDF}
                >
                  <svg 
                    style={{ width: "16px", height: "16px", marginRight: "8px" }} 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <span>Als PDF exportieren</span>
                </button>
              </div>
            )}
          </div>

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
                
                {/* <button className={styles.dropdownItem} type="button">
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
                </button> */}
                <button className={styles.dropdownItem} type="button">
                  <span>Bald verfügbar</span>
                </button>
              </div>
            )}
          </div>

          <div className={styles.accountWrapper} ref={accountRef}>
            <button 
              className={styles.iconButton} 
              type="button" 
              onClick={() => setIsAccountOpen(!isAccountOpen)}
            >
              <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            {isAccountOpen && (
              <div className={styles.dropdown}>
                {user ? (
                  <>
                    <div className={styles.userInfo}>
                      <div className={styles.userEmail}>{user.email}</div>
                    </div>
                    <div className={styles.verticalLine}></div>
                    {/* <button className={styles.dropdownItem} type="button">
                      Profil bearbeiten
                    </button> */}
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
                      setIsAccountOpen(false);
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