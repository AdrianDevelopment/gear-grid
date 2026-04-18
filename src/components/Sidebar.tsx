"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../styles/Sidebar.module.css";

interface Packliste {
  id: string;
  name: string;
}

// const INITIAL_LISTS: Packliste[] = [
//   { id: "1", name: "4 Tage Hüttentour" },
//   { id: "2", name: "Zugspitze" },
//   { id: "3", name: "3 Tage Hüttentour" },
//   { id: "4", name: "Theoretisch Zelten" },
// ];

export default function Sidebar() {
  const [lists, setLists] = useState<Packliste[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if ((isAdding || editingId) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isAdding, editingId]);

  const handleAddClick = () => {
    setIsAdding(true);
    setTempName("");
  };

  const saveNewList = () => {
    const finalName = tempName.trim() || `Liste ${lists.length + 1}`;
    const newList = {
      id: Math.random().toString(36).substr(2, 9),
      name: finalName,
    };
    setLists([...lists, newList]);
    setIsAdding(false);
    setTempName("");
  };

  const startEditing = (list: Packliste) => {
    setEditingId(list.id);
    setTempName(list.name);
  };

  const saveRename = () => {
    if (editingId) {
      setLists(
        lists.map((l) =>
          l.id === editingId ? { ...l, name: tempName.trim() || l.name } : l
        )
      );
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
              const isActive = pathname === `/list/${list.id}` || list.name === "4 Tage Hüttentour";
              
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
