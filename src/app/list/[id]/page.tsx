"use client";

import { useEffect, useState, use, useRef, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";
import ModalPortal from "../../../components/ModalPortal";
import listStyles from "../../../styles/ListDetail.module.css";
import { useRouter } from "next/navigation";
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
  useDroppable
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import { createPortal } from "react-dom";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface GearItem {
  id: string;
  name: string;
  weight: number;
}

interface Item {
  id: string;
  name: string;
  description: string;
  weight: number;
  count: number;
  price: number;
  category_id: string;
  is_packed: boolean;
}

const CATEGORY_COLORS = [
  "#5856D6", // Indigo
  "#007AFF", // Blue
  "#34C759", // Green
  "#FF2D55", // Pink
  "#FF9500", // Orange
  "#AF52DE", // Purple
  "#5AC8FA", // Sky
  "#FF3B30", // Red
  "#64D2FF", // Teal
  "#FFCC00"  // Gold
];

function SortableItem({ item, children }: { item: Item, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: "Item",
      item,
    },
  });

  const style = {
    // CSS.Translate sorgt dafür, dass nur die Position verändert wird, 
    // ohne das Item zu verzerren (Scale).
    transform: CSS.Translate.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.18, 0.67, 0.6, 1.22)',
    // transition: transition || 'transform 250ms cubic-bezier(0.2, 0, 0, 1)',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : "auto",
    position: "relative"/* as const */,
    // Verhindert Textmarkierung während des Draggens
    touchAction: "none",
    userSelect: isDragging ? "none" : "auto",
    cursor: isDragging ? "grabbing" : "default",
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} className={listStyles.itemRow}>
      <div className={listStyles.dragArea}>
        {/* Cursor-Style direkt am Handle */}
        <div 
          className={listStyles.dragHandle} 
          {...attributes} 
          {...listeners}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
      {children} 
    </div>
  );
}

function DroppableCategory({ cat, children }: { cat: Category; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: cat.id,
    data: { categoryId: cat.id },
  });

  return (
    <div ref={setNodeRef} style={{ outline: isOver ? "2px solid #007AFF" : "none" }}>
      {children}
    </div>
  );
}

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom Modal States
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemNames, setNewItemNames] = useState<{ [catId: string]: string }>({});
  const [newItemWeights, setNewItemWeights] = useState<{ [catId: string]: string }>({});
  const [newItemCounts, setNewItemCounts] = useState<{ [catId: string]: string }>({});
  const [newItemPrices, setNewItemPrices] = useState<{ [catId: string]: string }>({});

  const [isAuthorized, setIsAuthorized] = useState(false);

  const nameInputRefs = useRef<{ [catId: string]: HTMLInputElement | null }>({});

  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [tempValue, setTempValue] = useState<string>("");

  const [activeGear, setActiveGear] = useState<GearItem | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
      } else {
        setIsAuthorized(true); // Nur wenn Session da ist, erlauben wir das Anzeigen
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setIsAuthorized(false);
        router.push("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id]);

  // Sensoren definieren (Maus & Touch)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Etwas höherer Schwellenwert für flüssigeren Start
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;

    if (data?.type === "GearItem") {
      setActiveGear(data.gear);
    } else {
      setActiveGear(null);
    }
  };

  // [Drag Over] Feuert, wenn ein Item über eine ANDERE Kategorie schwebt
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeItem = items.find(i => i.id === activeId);
    const overItem = items.find(i => i.id === overId);

    if (!activeItem || !overItem) return;

    // Nur verschieben, wenn wir in eine andere Kategorie kommen oder die Position sich ändert
    if (activeItem.category_id !== overItem.category_id) {
      setItems((prev) => {
        const activeIndex = prev.findIndex((i) => i.id === activeId);
        const overIndex = prev.findIndex((i) => i.id === overId);

        // Wir updaten die category_id des Items im State sofort, 
        // damit der SortableContext reagiert
        const newItems = [...prev];
        newItems[activeIndex] = { ...newItems[activeIndex], category_id: overItem.category_id };

        return arrayMove(newItems, activeIndex, overIndex);
      });
    }
  };

  // [Drag End] Feuert, wenn die Maus losgelassen wird (Speichern in DB)
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;

    if (activeData?.type === "GearItem") {
      const gear = activeData.gear;
      const targetCategoryId = over.data.current?.categoryId;

      if (!targetCategoryId) {
        setActiveGear(null);
        return;
      }

      const { data, error } = await supabase
        .from("packing_items")
        .insert([{
          name: gear.name,
          weight: gear.weight,
          count: 1,
          price: 0,
          list_id: resolvedParams.id,
          category_id: targetCategoryId,
          is_packed: false,
        }])
        .select()
        .single();

      if (!error && data) {
        setItems(prev => [...prev, data]);
      }

      setActiveGear(null);
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    if (activeId !== overId) {
      // Finaler State nach dem Drop
      setItems((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId);
        const overIndex = prev.findIndex((t) => t.id === overId);
        
        const newItems = arrayMove(prev, activeIndex, overIndex);
        
        // --- SUPABASE BATCH UPDATE ---
        // Hier müsstest du idealerweise die neue Reihenfolge an Supabase senden.
        // Ein einfacher Weg ist, das gezogene Item mit der neuen category_id und position zu updaten.
        const movedItem = newItems.find(i => i.id === activeId);
        if (movedItem) {
           supabase.from("packing_items")
             .update({ category_id: movedItem.category_id })
             .eq("id", movedItem.id)
             .then(({ error }) => { if (error) console.error(error) });
        }
        
        return newItems;
      });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catsRes, itemsRes] = await Promise.all([
        supabase.from("packing_categories").select("*").eq("list_id", resolvedParams.id).order("created_at", { ascending: true }),
        supabase.from("packing_items").select("*").eq("list_id", resolvedParams.id).order("created_at", { ascending: true })
      ]);

      if (catsRes.data) setCategories(catsRes.data);
      if (itemsRes.data) setItems(itemsRes.data);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
    const { data } = await supabase
      .from("packing_categories")
      .insert([{ name: newCategoryName.trim(), list_id: resolvedParams.id, color }])
      .select()
      .single();

    if (data) {
      setCategories([...categories, data]);
      setNewCategoryName("");
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const { error } = await supabase.from("packing_categories").delete().eq("id", categoryToDelete.id);
    if (!error) {
      setCategories(categories.filter(c => c.id !== categoryToDelete.id));
      setItems(items.filter(i => i.category_id !== categoryToDelete.id));
    }
    setCategoryToDelete(null);
  };

  const addItem = async (catId: string) => {
    const name = newItemNames[catId];
    if (!name?.trim()) return;

    const weight = parseInt(newItemWeights[catId]) || 0;
    const count = parseInt(newItemCounts[catId]) || 1;
    const price = parseFloat(newItemPrices[catId]) || 0;

    const { data, error } = await supabase
      .from("packing_items")
      .insert([{
        name: name.trim(),
        list_id: resolvedParams.id,
        category_id: catId,
        weight,
        count,
        price,
        is_packed: false // Explizit setzen
      }])
      .select()
      .single();

    if (error) {
      console.error("Fehler beim Hinzufügen:", error);
      return;
    }

    if (data) {
      // Funktionaler State-Update garantiert, dass wir auf dem aktuellsten Stand basieren
      setItems(prevItems => [...prevItems, data]);
      
      // Inputs zurücksetzen
      setNewItemNames(prev => ({ ...prev, [catId]: "" }));
      setNewItemWeights(prev => ({ ...prev, [catId]: "" }));
      setNewItemCounts(prev => ({ ...prev, [catId]: "" }));
      setNewItemPrices(prev => ({ ...prev, [catId]: "" }));
      
      nameInputRefs.current[catId]?.focus();
    }
  };

  const togglePacked = async (item: Item) => {
    const { error } = await supabase
      .from("packing_items")
      .update({ is_packed: !item.is_packed })
      .eq("id", item.id);
    
    if (!error) {
      setItems(items.map(i => i.id === item.id ? { ...i, is_packed: !i.is_packed } : i));
    }
  };

  const updateItemField = async (item: Item, field: string, value: string | number) => {
    setEditingCell(null);

    // Wichtig: Vergleich nach Typ-Konvertierung
    const formattedValue = (field === "name") ? value : Number(value);
    if (item[field as keyof Item] === formattedValue) return;

    // Lokaler State-Update (Optimistic UI)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, [field]: formattedValue } : i));

    // Supabase Update im Hintergrund
    const { error } = await supabase
      .from("packing_items")
      .update({ [field]: formattedValue })
      .eq("id", item.id);

    if (error) {
      console.error("Update Fehler:", error);
      fetchData(); // Bei Fehler Daten neu laden, um inkonsistenten State zu fixen
    }
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    
    const { error } = await supabase
      .from("packing_items")
      .delete()
      .eq("id", itemToDelete.id);

    if (!error) {
      setItems(prevItems => prevItems.filter(i => i.id !== itemToDelete.id));
    } else {
      console.error("Fehler beim Löschen:", error);
    }
    setItemToDelete(null);
  };

  // Diese Werte werden nur neu berechnet, wenn [items] sich ändert
  const { totalWeight, totalPrice, totalItems, packedItems, progress } = useMemo(() => {
    console.log("Berechne Zusammenfassung neu..."); // Zum Testen im Browser-Log

    const weight = items.reduce((sum, i) => sum + (Number(i.weight) * Number(i.count)), 0);
    const price = items.reduce((sum, i) => sum + (Number(i.price) * Number(i.count)), 0);
    const total = items.reduce((sum, i) => sum + Number(i.count), 0);
    const packed = items
      .filter(i => i.is_packed)
      .reduce((sum, i) => sum + Number(i.count), 0);
    const prog = total > 0 ? (packed / total) * 100 : 0;

    return { totalWeight: weight, totalPrice: price, totalItems: total, packedItems: packed, progress: prog };
  }, [items]); // <--- Die Abhängigkeit: Nur wenn items sich ändern

  const chartData = useMemo(() => {
    return categories.map(cat => {
      const weight = items
        .filter(i => i.category_id === cat.id)
        .reduce((sum, i) => sum + (i.weight * i.count), 0);
      return { name: cat.name, value: weight, color: cat.color };
    }).filter(d => d.value > 0);
  }, [categories, items]); // Berechnen, wenn Kategorien oder Items sich ändern

  if (loading || !isAuthorized) return null;

  return (
    <div className={listStyles.listPage}>
      <div className={listStyles.topSection}>
        <div className={listStyles.chartContainer}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.color}
                      fillOpacity={0.8} // Macht das Chart selbst leicht glasig
                      stroke="rgba(255,255,255,0.2)" // Subtile Kante
                      strokeWidth={1}
                    />
                  ))}
                <Label 
                  value={`Gewicht`} 
                  position="center" 
                  fill="#1d1d1f"
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: '800',
                    fontFamily: 'inherit'
                  }}
                />
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [`${(Number(value) / 1000).toFixed(2)} kg`, name]}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255,255,255,0.4)', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    background: 'rgba(255,255,255,0.98)', /* Fast solide für Schärfe */
                    fontWeight: '700',
                    fontSize: '16px',
                    padding: '6px 12px'
                  }}
                  itemStyle={{ padding: '2px 0' }}
                  cursor={{ fill: 'transparent' }}
                />

              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ opacity: 0.2, fontWeight: 700 }}>Keine Daten</div>
          )}
        </div>

        <div className={listStyles.summaryContainer}>
          <div className={listStyles.summaryItem}>
            <span className={listStyles.summaryLabel}>Gesamtgewicht</span>
            <span className={listStyles.summaryValue}>{(totalWeight / 1000).toFixed(2)}<span className={listStyles.unit}>kg</span></span>
          </div>
          <div className={listStyles.summaryItem}>
            <span className={listStyles.summaryLabel}>Gesamtwert</span>
            <span className={listStyles.summaryValue}>{totalPrice.toFixed(2)}<span className={listStyles.unit}>€</span></span>
          </div>
          <div className={listStyles.summaryItem}>
            <span className={listStyles.summaryLabel}>Fortschritt</span>
            <span className={listStyles.summaryValue}>{packedItems}<span className={listStyles.unit}>/ {totalItems}</span></span>
          </div>
          <div className={listStyles.progressBar}><div className={listStyles.progressFill} style={{ width: `${progress}%` }} /></div>
        </div>
      </div>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver} 
        onDragEnd={handleDragEnd}
      >
        <div className={listStyles.scrollContainer}>
          {categories.map(cat => {
            const categoryItems = items.filter(i => i.category_id === cat.id);
            
            return (
              <DroppableCategory key={cat.id} cat={cat}>
                <div key={cat.id} className={listStyles.categoryGroup}>
                  <div className={listStyles.categoryHeader}>
                    <h2 className={listStyles.categoryTitle} style={{ color: cat.color }}>{cat.name}</h2>
                    <div className={listStyles.categoryLine} />
                    <button className={listStyles.deleteButtonSmall} onClick={() => setCategoryToDelete(cat)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>

                  <div className={listStyles.tableHeader}>
                    <div />
                    <div className={listStyles.headerLabel}>Name</div>
                    <div className={listStyles.headerLabel}>Gewicht</div>
                    <div className={listStyles.headerLabel}>Anzahl</div>
                    <div className={listStyles.headerLabel}>Preis</div>
                    <div />
                  </div>

                  <SortableContext 
                    items={categoryItems.map(i => i.id)} 
                    strategy={verticalListSortingStrategy}
                  >
                    <div className={listStyles.itemsList}>
                      {categoryItems.map(item => (
                        <SortableItem key={item.id} item={item}>
                          <div 
                            className={`${listStyles.checkbox} ${item.is_packed ? listStyles.checked : ""}`}
                            onClick={() => togglePacked(item)}
                          >
                            {item.is_packed ? "✓" : ""}
                          </div>
                          {/* NAME EDITIEREN */}
                          <div 
                            className={listStyles.itemName}
                            onDoubleClick={() => {
                              setEditingCell({ id: item.id, field: "name" });
                              setTempValue(item.name);
                            }}
                          >
                            {editingCell?.id === item.id && editingCell?.field === "name" ? (
                              <input 
                                autoFocus
                                className={listStyles.inlineInput}
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                onBlur={() => updateItemField(item, "name", tempValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    updateItemField(item, "name", tempValue);
                                  } else if (e.key === "Escape") {
                                    setEditingCell(null);
                                  }
                                }}
                              />
                            ) : (
                              item.name
                            )}
                          </div>

                          {/* GEWICHT EDITIEREN */}
                          <div 
                            className={listStyles.itemStat}
                            onDoubleClick={() => {
                              setEditingCell({ id: item.id, field: "weight" });
                              setTempValue(item.weight.toString());
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', maxWidth: '100%' }}>
                              {editingCell?.id === item.id && editingCell?.field === "weight" ? (
                                <input 
                                  autoFocus
                                  type="number"
                                  className={listStyles.inlineInputSmall}
                                  value={tempValue}
                                  style={{ width: `${Math.max(tempValue.length, 1) + 1}ch` }}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 6) setTempValue(e.target.value);
                                  }}
                                  onBlur={() => updateItemField(item, "weight", parseInt(tempValue) || 0)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") updateItemField(item, "weight", parseInt(tempValue) || 0);
                                    else if (e.key === "Escape") setEditingCell(null);
                                  }}
                                />
                              ) : (
                                <span>{item.weight}</span>
                              )}
                              <span className={listStyles.unit}>g</span>
                            </div>
                          </div>

                          {/* ANZAHL EDITIEREN */}
                          <div 
                            className={listStyles.itemStat}
                            onDoubleClick={() => {
                              setEditingCell({ id: item.id, field: "count" });
                              setTempValue(item.count.toString());
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', maxWidth: '100%' }}>
                              {editingCell?.id === item.id && editingCell?.field === "count" ? (
                                <input 
                                  autoFocus
                                  type="number"
                                  className={listStyles.inlineInputSmall}
                                  value={tempValue}
                                  style={{ width: `${Math.max(tempValue.length, 1) + 1}ch` }}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 4) setTempValue(e.target.value);
                                  }}
                                  onBlur={() => updateItemField(item, "count", parseInt(tempValue) || 1)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") updateItemField(item, "count", parseInt(tempValue) || 1);
                                    else if (e.key === "Escape") setEditingCell(null);
                                  }}
                                />
                              ) : (
                                <span>{item.count}</span>
                              )}
                              <span className={listStyles.unit}>x</span>
                            </div>
                          </div>

                          {/* PREIS EDITIEREN */}
                          <div 
                            className={listStyles.itemStat}
                            onDoubleClick={() => {
                              setEditingCell({ id: item.id, field: "price" });
                              setTempValue(item.price.toString());
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', maxWidth: '100%' }}>
                              {editingCell?.id === item.id && editingCell?.field === "price" ? (
                                <input 
                                  autoFocus
                                  type="number"
                                  step="0.01"
                                  className={listStyles.inlineInputSmall}
                                  value={tempValue}
                                  style={{ width: `${Math.max(tempValue.length, 1) + 1}ch` }}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 5) setTempValue(e.target.value);
                                  }}
                                  onBlur={() => updateItemField(item, "price", parseFloat(tempValue) || 0)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") updateItemField(item, "price", parseFloat(tempValue) || 0);
                                    else if (e.key === "Escape") setEditingCell(null);
                                  }}
                                />
                              ) : (
                                <span>{Number(item.price).toFixed(2)}</span>
                              )}
                              <span className={listStyles.unit}>€</span>
                            </div>
                          </div>
                          <button className={listStyles.deleteButtonSmall} onClick={() => setItemToDelete(item)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </SortableItem>
                      ))}

                      <div className={listStyles.addItemRow}>
                        <div className={listStyles.checkbox} style={{ opacity: 0.2, cursor: 'default' }}>+</div>
                        <input 
                          ref={(el) => {
                            if (nameInputRefs.current) {
                              nameInputRefs.current[cat.id] = el;
                            }
                          }}
                          className={listStyles.addInput} 
                          placeholder="Gegenstand hinzufügen" 
                          value={newItemNames[cat.id] || ""}
                          onChange={(e) => setNewItemNames({ ...newItemNames, [cat.id]: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItem(cat.id)}
                        />
                        <input 
                          className={listStyles.addInput} 
                          placeholder="0g" 
                          value={newItemWeights[cat.id] || ""}
                          onChange={(e) => setNewItemWeights({ ...newItemWeights, [cat.id]: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItem(cat.id)}
                        />
                        <input 
                          className={listStyles.addInput} 
                          placeholder="1x" 
                          value={newItemCounts[cat.id] || ""}
                          onChange={(e) => setNewItemCounts({ ...newItemCounts, [cat.id]: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItem(cat.id)}
                        />
                        <input 
                          className={listStyles.addInput} 
                          placeholder="0.00€" 
                          value={newItemPrices[cat.id] || ""}
                          onChange={(e) => setNewItemPrices({ ...newItemPrices, [cat.id]: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addItem(cat.id)}
                        />
                        <button 
                          type="button"
                          className={listStyles.confirmAddButton} 
                          onClick={() => addItem(cat.id)}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                      </div>
                    </div>
                  </SortableContext>
                </div>
              </DroppableCategory>
            );
          })}

          <div className={listStyles.horizontalLine} />
          <div className={listStyles.addCategoryContainer}>
            <input 
              className={listStyles.addCategoryInput} 
              placeholder="Neue Kategorie erstellen" 
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            <button 
              type="button"
              className={listStyles.confirmAddCategoryButton} 
              onClick={addCategory}
              title="Kategorie hinzufügen"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
        {typeof window !== "undefined" &&
          createPortal(
            <DragOverlay zIndex={9999}>
              {activeGear ? (
                <div className={listStyles.itemRow}>
                  <div className={listStyles.dragArea}>
                    <div className={listStyles.dragHandle} style={{ cursor: "grabbing" }}>
                      <span></span><span></span><span></span><span></span><span></span><span></span>
                    </div>
                  </div>
                  <div className={listStyles.itemName}>{activeGear.name}</div>
                  <div className={listStyles.itemStat}>
                    {activeGear.weight}<span className={listStyles.unit}>g</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>

      {/* Delete Category Modal */}
      {categoryToDelete && (
        <ModalPortal>
          <div className={listStyles.modalOverlay} onClick={() => setCategoryToDelete(null)}>
            <div className={listStyles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={listStyles.modalTitle}>Kategorie löschen?</h3>
              <p className={listStyles.modalText}>
                Bist du sicher, dass du die Kategorie <strong>"{categoryToDelete.name}"</strong> und alle darin enthaltenen Gegenstände löschen möchtest?
              </p>
              <div className={listStyles.modalButtons}>
                <button className={`${listStyles.modalButton} ${listStyles.cancelButton}`} onClick={() => setCategoryToDelete(null)}>Abbrechen</button>
                <button className={`${listStyles.modalButton} ${listStyles.confirmDeleteButton}`} onClick={confirmDeleteCategory}>Löschen</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete Item Modal */}
      {itemToDelete && (
        <ModalPortal>
          <div className={listStyles.modalOverlay} onClick={() => setItemToDelete(null)}>
            <div className={listStyles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={listStyles.modalTitle}>Gegenstand löschen?</h3>
              <p className={listStyles.modalText}>
                Möchtest du <strong>"{itemToDelete.name}"</strong> wirklich aus der Liste entfernen?
              </p>
              <div className={listStyles.modalButtons}>
                <button className={`${listStyles.modalButton} ${listStyles.cancelButton}`} onClick={() => setItemToDelete(null)}>Abbrechen</button>
                <button className={`${listStyles.modalButton} ${listStyles.confirmDeleteButton}`} onClick={confirmDeleteItem}>Löschen</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}