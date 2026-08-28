import { useEffect, useState } from "react";

const PAUSE_EVENT = "tttp-app-pause";
const RESUME_EVENT = "tttp-app-resume";

export function useAppActivity() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const syncVisibility = () => setActive(document.visibilityState !== "hidden");
    const pause = () => setActive(false);
    const resume = () => setActive(document.visibilityState !== "hidden");

    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", resume);
    window.addEventListener(PAUSE_EVENT, pause);
    window.addEventListener(RESUME_EVENT, resume);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener(PAUSE_EVENT, pause);
      window.removeEventListener(RESUME_EVENT, resume);
    };
  }, []);

  return active;
}
