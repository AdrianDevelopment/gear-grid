"use client";

import { useEffect, useRef } from "react";
import styles from "../styles/page.module.css";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function Home() {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Aktuelle Position des Hintergrunds
    let currentX = 0;
    let currentY = 0;
    // Zielposition basierend auf der Maus
    let targetX = 0;
    let targetY = 0;
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      // 1. Normalisieren: Mausposition von -1 (links/oben) bis 1 (rechts/unten). Mitte ist 0.
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = (e.clientY / window.innerHeight) * 2 - 1;

      // 2. Die "Edge-Acceleration" (Beschleunigung am Rand):
      // Durch das Potenzieren (Math.pow) wird die Kurve nicht-linear. 
      // Ein Wert von 0.2 in der Mitte bleibt klein, ein Wert von 0.9 am Rand explodiert förmlich.
      targetX = Math.sign(normX) * Math.pow(Math.abs(normX), 1.8);
      targetY = Math.sign(normY) * Math.pow(Math.abs(normY), 1.8);
    };

    const animate = () => {
      // 3. LERP (Linear Interpolation) für die samtweiche Trägheit
      // 0.06 ist der "Friction"-Wert. Je kleiner, desto mehr "schwebt" das Bild nach.
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      if (bgRef.current) {
        // 40px ist die maximale Auslenkung in jede Richtung
        bgRef.current.style.transform = `translate(${currentX * -40}px, ${currentY * -40}px)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    animate(); // Startet den 60fps Animations-Loop

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={styles.page}>
      {/* Das Hintergrund-Div bekommt jetzt das Ref */}
      <div 
        ref={bgRef}
        className={styles.parallaxBackground} 
      />
      
      <Navbar />
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.contentBox}>
          <h2>Main Content</h2>
          <p>This is the main content area.</p>
        </div>
      </main>
    </div>
  );
}