import { useEffect, useState } from "react";

const STORAGE_KEY = "pm-dark-mode";

export const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const toggle = () => {
    setIsDark((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return { isDark, toggle };
};
