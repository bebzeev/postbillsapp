import { useEffect, useState } from 'react';

export function useColW() {
  const [w, setW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const on = () => setW(window.innerWidth || 1024);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  // Figma shows populated columns at 166px and empty at 117px
  let populated = 166;
  if (w < 640) populated = Math.round(w * 0.42);
  else if (w < 1024) populated = 166;
  else populated = 180;
  const empty = Math.max(Math.round(populated * 0.7), 100);
  return { populated, empty, isNarrow: w < 640 };
}
