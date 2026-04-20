"use client";

import { useEffect, useRef, createContext, useContext, useState, ReactNode } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import styles from "../styles/page.module.css";

const BackgroundContext = createContext({
  bgImage: "../assets/background4.jpg",
  setBgImage: (url: string) => {},
});

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [bgImage, setBgImageState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selectedBackground") || "/assets/background4.jpg";
    }
    return "/assets/background4.jpg";
  });

  useEffect(() => {
    // Lade das Hintergrundbild aus dem Local Storage beim Initialisieren
    const storedBg = localStorage.getItem("selectedBgImage");
    if (storedBg) {
      setBgImageState(storedBg);
    } else {
      // Setze ein Standardbild, wenn keins im Local Storage gefunden wird
      setBgImageState("/assets/background4.jpg");
    }
  }, []);

  // Aktualisiere das Local Storage, wenn sich das Hintergrundbild ändert
  const setBgImage = (url: string) => {
    setBgImageState(url);
    localStorage.setItem("selectedBgImage", url);
  };

  return (
    <BackgroundContext.Provider value={{ bgImage: bgImage || "/assets/background4.jpg", setBgImage }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export const useBackground = () => useContext(BackgroundContext);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BackgroundProvider>
      <DashboardContent>{children}</DashboardContent>
    </BackgroundProvider>
  );
}

// Interne Hilfskomponente, damit wir 'useBackground' innerhalb des Providers nutzen können
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { bgImage } = useBackground();
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let currentX = 0, currentY = 0, targetX = 0, targetY = 0;
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = (e.clientY / window.innerHeight) * 2 - 1; // FIX: Should be window.innerHeight
      targetX = Math.sign(normX) * Math.pow(Math.abs(normX), 1.8);
      targetY = Math.sign(normY) * Math.pow(Math.abs(normY), 1.8);
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      if (bgRef.current) {
        bgRef.current.style.transform = `translate(${currentX * -40}px, ${currentY * -40}px)`;
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={styles.page}>
      {/* Hier wird die URL aktiv gesetzt */}
      <div 
        ref={bgRef} 
        className={styles.parallaxBackground} 
        style={{ backgroundImage: `url(${bgImage})`, display: 'block'}} 
      />
      
      <Navbar />
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.contentBox}>
          {children}
        </div>
      </main>
    </div>
  );
}
