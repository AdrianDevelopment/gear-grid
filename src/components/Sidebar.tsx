"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import ModalPortal from "./ModalPortal";
import styles from "../styles/Sidebar.module.css";
import { CSS } from "@dnd-kit/utilities";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  closestCenter
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import {Draggable, DragDropManager} from '@dnd-kit/dom';

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
    data: {
      type: "GearItem",
      gear,
    },
  });

  const style = {
    // CSS.Translate sorgt dafür, dass nur die Position verändert wird, 
    // ohne das Item zu verzerren (Scale).
    transform: CSS.Translate.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.18, 0.67, 0.6, 1.22)',
    // transition: transition || 'transform 250ms cubic-bezier(0.2, 0, 0, 1)',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : "auto",
    position: "relative"/* as const */,
    // Verhindert Textmarkierung während des Draggens
    touchAction: "none",
    userSelect: isDragging ? "none" : "auto",
    cursor: isDragging ? "grabbing" : "default",
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} className={styles.gearItem} {...attributes} {...listeners}>
      <span className={styles.gearName}>{gear.name}</span>
      <span className={styles.gearWeight}>{gear.weight}g</span>
    </div>
  );
}

export default function Sidebar() {
  const [lists, setLists] = useState<Packliste[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [user, setUser] = useState<any>(null);
  const [gearLibrary, setGearLibrary] = useState<GearItem[]>([]);
  const [activeGearId, setActiveGearId] = useState<string | null>(null);
  
  // Custom Modal State
  // const [listToDelete, setListToDelete] = useState<Packliste | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    type: "delete" | "auth";
    list?: Packliste;
  } | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

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
      setGearLibrary([]);
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
      const fetchedLists = data || [];
      setLists(fetchedLists);
      // Nach dem Laden der Listen die Ausrüstung laden
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
      // Falls es die erste Liste ist, Gear Library initialisieren (wird leer sein)
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
    setModalConfig({ type: "delete", list });
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
      // Gear Library aktualisieren (falls Items nur in dieser Liste waren)
      fetchGearLibrary(newLists.map(l => l.id));
      
      if (pathname === `/list/${list.id}`) {
        router.push("/");
      }
    }
    setModalConfig(null); // Modal schließen
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      action();
    } else if (e.key === "Escape") {
      // Wenn ein Modal offen ist, schließe nur das Modal
      if (modalConfig) {
        setModalConfig(null);
      } else {
        // Ansonsten brich das Hinzufügen/Editieren ab
        setIsAdding(false);
        setEditingId(null);
        setTempName("");
      }
    }
  };

  const fetchGearLibrary = async (listIds?: string[]) => {
    // Falls keine IDs übergeben wurden, nutzen wir die aus dem State
    const ids = listIds || lists.map(l => l.id);

    if (ids.length === 0) {
      setGearLibrary([]);
      return;
    }

    const { data, error } = await supabase
      .from("packing_items")
      .select("id, name, weight")
      .in("list_id", ids)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching gear library:", error);
      return;
    }

    if (data) {
      // Deduplizierung: Wir nutzen eine Map, um nur den ersten Treffer pro Name zu behalten
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
          fetchGearLibrary(); // Neu laden bei Änderungen
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lists]); // Re-subscribe wenn sich lists ändert (für die IDs)

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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className={styles.scrollArea}>
              <SortableContext
                items={gearLibrary.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <nav className={styles.nav}>
                  {gearLibrary.map((gear) => (
                    <SortableGearItem key={gear.id} gear={gear} />
                  ))}
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
      </aside>

      {/* Custom Confirmation Modal */}
      {modalConfig && (
        <ModalPortal>
          <div className={styles.modalOverlay} onClick={() => setModalConfig(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              
              {modalConfig.type === "delete" ? (
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
              ) : (
                <>
                  <h3 className={styles.modalTitle}>Anmeldung erforderlich</h3>
                  <p className={styles.modalText}>
                    Du musst angemeldet sein, um neue Packlisten zu erstellen.
                  </p>
                  <div className={styles.modalButtons}>
                    <button 
                      className={`${styles.modalButton} ${styles.confirmDeleteButton}`} 
                      style={{ background: "#007AFF", boxShadow: "none" }} // Blau statt Rot für Login
                      onClick={() => {
                        setModalConfig(null);
                        router.push("/"); // Optional: Direkt zum Login leiten
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
