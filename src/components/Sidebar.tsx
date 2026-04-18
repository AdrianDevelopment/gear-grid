"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../styles/Sidebar.module.css";

const NAV_ITEMS = [
  { name: "4 Tage Hüttentour", href: "/huettentour" },
  { name: "Zugspitze", href: "/zugspitze" },
  { name: "3 Tage Hüttentour", href: "/huettentour-kurz" },
  { name: "Theoretisch Zelten", href: "/zelten" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.title}>Packlisten</div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          // Temporäre Logik: "4 Tage Hüttentour" ist immer aktiv, 
          // solange die echten Routen noch nicht existieren.
          const isActive = item.name === "4 Tage Hüttentour";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${isActive ? styles.isActive : ""}`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}