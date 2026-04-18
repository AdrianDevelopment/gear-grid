"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "../../../lib/supabase";
import listStyles from "../../../styles/ListDetail.module.css";

interface Item {
  id: string;
  name: string;
  description: string;
  weight: number;
  count: number;
  price: number;
  category: string;
  is_packed: boolean;
}

interface ListData {
  id: string;
  name: string;
}

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [list, setList] = useState<ListData | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListDetails();
    fetchItems();
  }, [resolvedParams.id]);

  const fetchListDetails = async () => {
    const { data, error } = await supabase
      .from("packing_lists")
      .select("*")
      .eq("id", resolvedParams.id)
      .single();
    if (!error) setList(data);
  };

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("packing_items")
      .select("*")
      .eq("list_id", resolvedParams.id)
      .order("created_at", { ascending: true });
    if (!error) setItems(data || []);
    setLoading(false);
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

  const categories = Array.from(new Set(items.map(i => i.category)));
  const totalWeight = items.reduce((sum, i) => sum + (i.weight * i.count), 0);
  const totalPrice = items.reduce((sum, i) => sum + (Number(i.price) * i.count), 0);

  if (loading) return null; // Verhindert das kurze Aufblitzen von Text während des Ladens
  if (!list) return <p>Liste nicht gefunden.</p>;

  return (
    <div className={listStyles.listPage}>
      <header className={listStyles.header}>
        <div className={listStyles.titleSection}>
          <div className={listStyles.stats}>
            <span>{items.length} Gegenstände</span>
            <span>{totalWeight / 1000} kg Gesamtgewicht</span>
            <span>{totalPrice.toFixed(2)} € Gesamtwert</span>
          </div>
        </div>
        <button className={listStyles.addButton}>
          + Gegenstand
        </button>
      </header>

      {categories.length > 0 ? (
        categories.map(cat => (
          <section key={cat} className={listStyles.categorySection}>
            <h2 className={listStyles.categoryTitle}>{cat}</h2>
            <div className={listStyles.itemsGrid}>
              {items.filter(i => i.category === cat).map(item => (
                <div key={item.id} className={listStyles.itemRow}>
                  <div 
                    className={`${listStyles.checkbox} ${item.is_packed ? listStyles.checked : ""}`}
                    onClick={() => togglePacked(item)}
                  >
                    {item.is_packed && "✓"}
                  </div>
                  <div className={listStyles.itemName}>{item.name}</div>
                  <div className={listStyles.itemWeight}>{item.weight}g</div>
                  <div className={listStyles.itemCount}>{item.count}x</div>
                  <div className={listStyles.itemPrice}>{Number(item.price).toFixed(2)}€</div>
                  <button className={listStyles.deleteButtonSmall}>×</button>
                </div>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className={listStyles.emptyState}>
          <p>Diese Liste ist noch leer. Füge deinen ersten Gegenstand hinzu!</p>
        </div>
      )}
    </div>
  );
}
