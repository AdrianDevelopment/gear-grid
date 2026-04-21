"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import ModalPortal from "./ModalPortal";
import styles from "../styles/Sidebar.module.css";
import { CSS } from "@dnd-kit/utilities";
import { 
  DndContext, 
  DragOverlay, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
  closestCenter
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";

interface Packliste {
  id: string;
  name: string;
}

interface GearItem {
  id: string;
  name: string;
  weight: number;
}

function SortableGearItem({ gear }: { gear: GearItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: gear.id,
    data: { type: "GearItem", gear },
  });

  const style: React.CSSProperties = {
    // 1. Transform: dnd-kit nutzt Transform für die Bewegung
    transform: CSS.Transform.toString(transform),
    
    // 2. Transition: WICHTIG! Nur die Transition von dnd-kit nutzen.
    // Sie ist nur aktiv, wenn ein Item "ausweichen" muss.
    // transition: transition,
    
    // 3. Status-Werte
    zIndex: isDragging ? 999 : "auto",
    opacity: isDragging ? 0.3 : 1,
    
    // 4. Cursor: Hier im JS setzen, damit es "grabbing" bleibt, 
    // auch wenn die Maus das Item verlässt (während des Drags)
    cursor: isDragging ? "grabbing" : "grab",
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Wir geben eine extra Klasse 'isDragging', wenn es aktiv ist
      className={`${styles.gearItem} ${isDragging ? styles.isDragging : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className={styles.gearName}>{gear.name}</span>
      <span className={styles.gearWeight}>{gear.weight}g</span>
    </div>
  );
}

// Schneller Fuzzy-Search Algorithmus
const fuzzy_match = (pattern: string, target: string) => {
  if (!pattern) return true;
  const p = pattern.toLowerCase();
  const t = target.toLowerCase();
  let pIdx = 0;
  let tIdx = 0;
  
  while (pIdx < p.length && tIdx < t.length) {
    if (p[pIdx] === t[tIdx]) pIdx++;
    tIdx++;
  }
  return pIdx === p.length;
};

export default function Sidebar() {
  const [lists, setLists] = useState<Packliste[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [user, setUser] = useState<any>(null);
  const [gearLibrary, setGearLibrary] = useState<GearItem[]>([]);
  const [activeGearId, setActiveGearId] = useState<string | null>(null);
  
  // Neue States für die Suche
  const [search_query, setSearchQuery] = useState("");
  
  const [modalConfig, setModalConfig] = useState<{
    type: "delete" | "auth" | "impressum";
    list?: Packliste;
  } | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Erst nach 5 Pixeln Bewegung startet der Drag, vorher ist es ein Klick
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Gefilterte GearLibrary basierend auf dem SearchQuery (memorized für Performance)
  const filteredGear = useMemo(() => {
    return gearLibrary.filter(gear => fuzzy_match(search_query, gear.name));
  }, [gearLibrary, search_query]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchQuery(""); // Eingabe löschen
      searchInputRef.current?.blur(); // Fokus entfernen
    } else if (e.key === "Enter") {
      searchInputRef.current?.blur(); // Nur Fokus entfernen, Text bleibt
    }
  };

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
      setGearLibrary([]);
    }
  }, [user]);

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
      const fetchedLists = data || [];
      setLists(fetchedLists);
      if (fetchedLists.length > 0) {
        fetchGearLibrary(fetchedLists.map(l => l.id));
      }
    }
  };

  const handleAddClick = () => {
    if (!user) {
      setModalConfig({ type: "auth" });
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
      if (lists.length === 0) {
        fetchGearLibrary([data.id]);
      }
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
    setModalConfig({ type: "delete", list });
  };

  const openImpressum = () => {
    setModalConfig({ type: "impressum" });
  };

  const confirmDelete = async () => {
    const list = modalConfig?.list;
    if (!list) return;

    const { error } = await supabase
      .from("packing_lists")
      .delete()
      .eq("id", list.id);

    if (!error) {
      const newLists = lists.filter((l) => l.id !== list.id);
      setLists(newLists);
      fetchGearLibrary(newLists.map(l => l.id));
      
      if (pathname === `/list/${list.id}`) {
        router.push("/");
      }
    }
    setModalConfig(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      action();
    } else if (e.key === "Escape") {
      if (modalConfig) {
        setModalConfig(null);
      } else {
        setIsAdding(false);
        setEditingId(null);
        setTempName("");
      }
    }
  };

  const fetchGearLibrary = async (listIds?: string[]) => {
    const ids = listIds || lists.map(l => l.id);

    if (ids.length === 0) {
      setGearLibrary([]);
      return;
    }

    const { data, error } = await supabase
      .from("packing_items")
      .select("id, name, weight")
      .in("list_id", ids)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching gear library:", error);
      return;
    }

    if (data) {
      const uniqueItems = Array.from(
        data.reduce((map, item) => {
          if (!map.has(item.name.toLowerCase())) {
            map.set(item.name.toLowerCase(), item);
          }
          return map;
        }, new Map<string, any>()).values()
      );
      
      setGearLibrary(uniqueItems);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "packing_items" },
        () => {
          fetchGearLibrary();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lists]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveGearId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveGearId(null);
      return;
    }

    if (active.id !== over.id) {
      setGearLibrary((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveGearId(null);
  };

  const activeGear = gearLibrary.find((g) => g.id === activeGearId);

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.listSection}>
          <div className={styles.logo}>Gear Grid</div>
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
                      <svg className={styles.listIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <svg className={styles.listIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.items}>
          <div className={styles.title}>Ausrüstung</div>
          <div className={styles.search}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              ref={searchInputRef}
              className={styles.searchInput}
              placeholder="Suchen..."
              value={search_query}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchQuery("")} /* Leert das Feld beim Reinklicken */
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className={styles.scrollArea}>
              <SortableContext
                items={filteredGear.map((item) => item.id)} // Nutzt jetzt die gefilterte Liste
                strategy={verticalListSortingStrategy}
              >
                <nav className={styles.nav}>
                  {filteredGear.map((gear) => ( // Mappt über die gefilterte Liste
                    <SortableGearItem key={gear.id} gear={gear} />
                  ))}
                  
                  {filteredGear.length === 0 && search_query && (
                    <div className={styles.emptySearch}>keine Ausrüstung gefunden...</div>
                  )}
                </nav>
              </SortableContext>
            </div>

            <DragOverlay>
              {activeGear ? (
                <div className={styles.gearItem}>
                  <span className={styles.gearName}>{activeGear.name}</span>
                  <span className={styles.gearWeight}>{activeGear.weight}g</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
        <div className={styles.footerIcons}>
          <button onClick={openImpressum} className={styles.iconButton} title="Impressum">
            <svg className={styles.icon} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>

          <a href="mailto:dev.lindstedt@gmail.com" className={styles.iconButton} title="Kontakt">
            <svg className={styles.icon} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </a>

          <a href="https://github.com/AdrianDevelopment/gear-grid/issues/new/choose" target="_blank" rel="noopener noreferrer" className={styles.iconButton} title="Feedback auf GitHub">
            <svg className={styles.icon} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
          </a>
        </div>
      </aside>

      {/* ModalPortal unverändert gelassen (gekürzt für Übersichtlichkeit, aber dein Code bleibt gleich) */}
      {modalConfig && (
        <ModalPortal>
          <div className={styles.modalOverlay} onClick={() => setModalConfig(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              {modalConfig.type === "impressum" && (
                <>
                  <h3 className={styles.modalTitle}>Rechtliche Informationen</h3>
                  <div className={styles.modalScrollContent}>
                    <section className={styles.legalSection}>
                      <h4 className={styles.legalSubHeading}>Impressum</h4>
                      <p className={styles.modalTextSmall}>
                        <strong>Angaben gemäß § 5 TMG:</strong><br />
                        Dies ist eine rein private Website ohne kommerzielle Interessen.
                        Sie dient ausschließlich persönlichen Zwecken.
                      </p>
                      <p className={styles.modalTextSmall}>
                        <strong>Kontakt:</strong><br />
                        E-Mail: dev.lindstedt@gmail.com
                      </p>
                    </section>
                    <section className={styles.legalSection}>
                      <h4 className={styles.legalSubHeading}>Datenschutz</h4>
                      <p className={styles.modalTextSmall}>
                        Diese Anwendung nutzt <strong>Supabase</strong> zur Authentifizierung und Datenspeicherung. 
                        Dabei werden technisch notwendige Daten verarbeitet, um den Dienst bereitzustellen. 
                        Es findet kein Tracking zu Werbezwecken statt.
                      </p>
                    </section>
                    <section className={styles.legalSection}>
                      <h4 className={styles.legalSubHeading}>Haftung für Links</h4>
                      <p className={styles.modalTextSmall}>
                        Unser Angebot enthält Links zu externen Webseiten Dritter. 
                        Auf deren Inhalte haben wir keinen Einfluss und übernehmen daher keine Gewähr.
                      </p>
                    </section>
                  </div>
                  <div className={styles.modalButtonsFixed}>
                    <button 
                      className={`${styles.modalButton} ${styles.primaryButton}`} 
                      onClick={() => setModalConfig(null)}
                    >
                      Schließen
                    </button>
                  </div>
                </>
              )}
              {modalConfig.type === "delete" && (
                <>
                  <h3 className={styles.modalTitle}>Liste löschen?</h3>
                  <p className={styles.modalText}>
                    Bist du sicher, dass du die Liste <strong>"{modalConfig.list?.name}"</strong> unwiderruflich löschen möchtest?
                  </p>
                  <div className={styles.modalButtons}>
                    <button className={`${styles.modalButton} ${styles.cancelButton}`} onClick={() => setModalConfig(null)}>
                      Abbrechen
                    </button>
                    <button className={`${styles.modalButton} ${styles.confirmDeleteButton}`} onClick={confirmDelete}>
                      Löschen
                    </button>
                  </div>
                </>
              )}
              {modalConfig.type === "auth" && (
                <>
                  <h3 className={styles.modalTitle}>Anmeldung erforderlich</h3>
                  <p className={styles.modalText}>
                    Du musst angemeldet sein, um neue Packlisten zu erstellen.
                  </p>
                  <div className={styles.modalButtons}>
                    <button 
                      className={`${styles.modalButton} ${styles.confirmDeleteButton}`} 
                      style={{ background: "#007AFF", boxShadow: "none" }}
                      onClick={() => {
                        setModalConfig(null);
                        router.push("/");
                      }}
                    >
                      Verstanden
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}