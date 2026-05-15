"use client";
import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const reg = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // silencioso — não bloqueia o app
      }
    };
    if (document.readyState === "complete") {
      reg();
    } else {
      window.addEventListener("load", reg, { once: true });
    }
  }, []);

  return null;
}
