"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import ModalPortal from "./ModalPortal";
import styles from "../styles/Sidebar.module.css";

interface Packliste {
  id: string;
  name: string;
}

export default function Sidebar() {
  const [lists, setLists] = useState<Packliste[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [user, setUser] = useState<any>(null);
  
  // Custom Modal State
  const [listToDelete, setListToDelete] = useState<Packliste | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Scroll Position speichern
  const handleScroll = () => {
    if (scrollRef.current) {
      sessionStorage.setItem("sidebar-scroll", scrollRef.current.scrollTop.toString());
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchLists();
    } else {
      setLists([]);
    }
  }, [user]);

  // Scroll Position wiederherstellen, sobald Listen geladen sind
  useEffect(() => {
    if (lists.length > 0 && scrollRef.current) {
      const savedScroll = sessionStorage.getItem("sidebar-scroll");
      if (savedScroll) {
        scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      }
    }
  }, [lists]);

  useEffect(() => {
    if ((isAdding || editingId) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isAdding, editingId]);


  const fetchLists = async () => {
    const { data, error } = await supabase
      .from("packing_lists")
      .select("*")
      .order("created_at", { ascending: true });
    
    if (error) {
      console.error("Error fetching lists:", error);
    } else {
      setLists(data || []);
    }
  };

  const handleAddClick = () => {
    if (!user) {
      alert("Bitte melde dich zuerst an!");
      return;
    }
    setIsAdding(true);
    setTempName("");
  };

  const saveNewList = async () => {
    const finalName = tempName.trim() || `Liste ${lists.length + 1}`;
    
    const { data, error } = await supabase
      .from("packing_lists")
      .insert([{ name: finalName, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error("Error creating list:", error);
    } else if (data) {
      setLists([...lists, data]);
    }
    
    setIsAdding(false);
    setTempName("");
  };

  const startEditing = (list: Packliste) => {
    setEditingId(list.id);
    setTempName(list.name);
  };

  const saveRename = async () => {
    if (!editingId) return;

    // Profi-Tipp: Wenn der Name leer ist, nimm den alten Namen zurück 
    // oder verhindere das Speichern, anstatt einen leeren String zu senden.
    const trimmedName = tempName.trim();
    const oldName = lists.find(l => l.id === editingId)?.name;

    if (!trimmedName || trimmedName === oldName) {
      setEditingId(null);
      return;
    }

    const { error } = await supabase
      .from("packing_lists")
      .update({ name: trimmedName })
      .eq("id", editingId);

    if (!error) {
      setLists(lists.map((l) =>
        l.id === editingId ? { ...l, name: trimmedName } : l
      ));
    }
    setEditingId(null);
  };

  const openDeleteModal = (e: React.MouseEvent, list: Packliste) => {
    e.preventDefault();
    e.stopPropagation();
    setListToDelete(list);
  };

  const confirmDelete = async () => {
    if (!listToDelete) return;

    const { error } = await supabase
      .from("packing_lists")
      .delete()
      .eq("id", listToDelete.id);

    if (error) {
      console.error("Error deleting list:", error);
      alert("Fehler beim Löschen der Liste.");
    } else {
      setLists(lists.filter((l) => l.id !== listToDelete.id));
      if (pathname === `/list/${listToDelete.id}`) {
        router.push("/");
      }
    }
    setListToDelete(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") action();
    if (e.key === "Escape") {
      setIsAdding(false);
      setEditingId(null);
      setTempName("");
      setListToDelete(null);
    }
  };

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.listSection}>
          <div className={styles.title}>Packlisten</div>

          <div 
            className={styles.scrollArea} 
            ref={scrollRef} 
            onScroll={handleScroll}
          >
            <nav className={styles.nav}>

              {lists.map((list) => {
                const isActive = pathname === `/list/${list.id}`;
                
                if (editingId === list.id) {
                  return (
                    <div key={list.id} className={styles.editItem}>
                      <input
                        ref={inputRef}
                        className={styles.editInput}
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={saveRename}
                        onKeyDown={(e) => handleKeyDown(e, saveRename)}
                      />
                    </div>
                  );
                }

                return (
                  <Link
                    key={list.id}
                    href={`/list/${list.id}`}
                    className={`${styles.link} ${isActive ? styles.isActive : ""}`}
                    onDoubleClick={() => startEditing(list)}
                  >
                    <span className={styles.listName}>{list.name}</span>
                    <button 
                      className={styles.deleteButton}
                      onClick={(e) => openDeleteModal(e, list)}
                      title="Liste löschen"
                    >
                      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </Link>
                );
              })}

              {isAdding && (
                <div className={styles.editItem}>
                  <input
                    ref={inputRef}
                    className={styles.editInput}
                    placeholder={`Liste ${lists.length + 1}`}
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={saveNewList}
                    onKeyDown={(e) => handleKeyDown(e, saveNewList)}
                  />
                </div>
              )}
            </nav>
          </div>
          <div className={styles.plusButtonContainer}>
            <button 
              className={styles.plusButton} 
              onClick={handleAddClick}
              title="Neue Liste erstellen"
            >
              <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.items}>
          <div className={styles.title}>Ausrüstung</div>
          <nav className={styles.nav}>
            <div className={styles.link}>Kategorien</div>
            <div className={styles.link}>Statistiken</div>
          </nav>
        </div>
      </aside>

      {/* Custom Confirmation Modal */}
      {listToDelete && (
        <ModalPortal>
          <div className={styles.modalOverlay} onClick={() => setListToDelete(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Liste löschen?</h3>
              <p className={styles.modalText}>
                Bist du sicher, dass du die Liste <strong>"{listToDelete.name}"</strong> unwiderruflich löschen möchtest?
              </p>
              <div className={styles.modalButtons}>
                <button 
                  className={`${styles.modalButton} ${styles.cancelButton}`}
                  onClick={() => setListToDelete(null)}
                >
                  Abbrechen
                </button>
                <button 
                  className={`${styles.modalButton} ${styles.confirmDeleteButton}`}
                  onClick={confirmDelete}
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
