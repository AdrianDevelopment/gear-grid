"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
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
  
  const inputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (user) {
      fetchLists();
    } else {
      setLists([]);
    }
  }, [user]);

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
      // Wir könnten hier einen Event-Emitter oder ein globales State nutzen,
      // um das Modal in der Navbar zu öffnen. Für jetzt zeigen wir eine Warnung.
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
    if (editingId) {
      const { error } = await supabase
        .from("packing_lists")
        .update({ name: tempName.trim() })
        .eq("id", editingId);

      if (error) {
        console.error("Error updating list:", error);
      } else {
        setLists(
          lists.map((l) =>
            l.id === editingId ? { ...l, name: tempName.trim() || l.name } : l
          )
        );
      }
      setEditingId(null);
      setTempName("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") action();
    if (e.key === "Escape") {
      setIsAdding(false);
      setEditingId(null);
      setTempName("");
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.listSection}>
        <div className={styles.title}>Packlisten</div>

        <div className={styles.scrollArea}>
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
                  {list.name}
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

      <div className={styles.items}>
        <div className={styles.title}>Ausrüstung</div>
        <nav className={styles.nav}>
          <div className={styles.link}>Kategorien</div>
          <div className={styles.link}>Statistiken</div>
        </nav>
      </div>
    </aside>
  );
}
