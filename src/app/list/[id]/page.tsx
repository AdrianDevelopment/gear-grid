"use client";

import { useEffect, useState, use, useRef, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import ModalPortal from "../../../components/ModalPortal";
import listStyles from "../../../styles/ListDetail.module.css";

interface Category {
  id: string;
  name: string;
  color: string;
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
  "#5856D6", "#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5AC8FA", "#FF2D55"
];

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const nameInputRefs = useRef<{ [catId: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id]);

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

    const weight = items.reduce((sum, i) => sum + (i.weight * i.count), 0);
    const price = items.reduce((sum, i) => sum + (Number(i.price) * i.count), 0);
    const total = items.reduce((sum, i) => sum + i.count, 0);
    const packed = items.filter(i => i.is_packed).reduce((sum, i) => sum + i.count, 0);
    const prog = total > 0 ? (packed / total) * 100 : 0;

    return { 
      totalWeight: weight, 
      totalPrice: price, 
      totalItems: total, 
      packedItems: packed, 
      progress: prog 
    };
  }, [items]); // <--- Die Abhängigkeit: Nur wenn items sich ändern

  const chartData = useMemo(() => {
    return categories.map(cat => {
      const weight = items
        .filter(i => i.category_id === cat.id)
        .reduce((sum, i) => sum + (i.weight * i.count), 0);
      return { name: cat.name, value: weight, color: cat.color };
    }).filter(d => d.value > 0);
  }, [categories, items]); // Berechnen, wenn Kategorien oder Items sich ändern

  if (loading) return null;

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
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
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

      <div className={listStyles.scrollContainer}>
        {categories.map(cat => (
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

            <div className={listStyles.itemsList}>
              {items.filter(i => i.category_id === cat.id).map(item => (
                <div key={item.id} className={listStyles.itemRow}>
                  <div 
                    className={`${listStyles.checkbox} ${item.is_packed ? listStyles.checked : ""}`}
                    onClick={() => togglePacked(item)}
                  >
                    {item.is_packed ? "✓" : ""}
                  </div>
                  <div className={listStyles.itemName}>{item.name}</div>
                  <div className={listStyles.itemStat}>{item.weight}<span className={listStyles.unit}>g</span></div>
                  <div className={listStyles.itemStat}>{item.count}<span className={listStyles.unit}>x</span></div>
                  <div className={listStyles.itemStat}>{Number(item.price).toFixed(2)}<span className={listStyles.unit}>€</span></div>
                  <button className={listStyles.deleteButtonSmall} onClick={() => setItemToDelete(item)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
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
                  placeholder="Gegenstand..." 
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
          </div>
        ))}

        <div className={listStyles.horizontalLine} />
        <div className={listStyles.addCategoryContainer}>
          <input 
            className={listStyles.addCategoryInput} 
            placeholder="+ Neue Kategorie erstellen..." 
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
        </div>
      </div>

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
