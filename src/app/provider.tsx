'use client'
import React, { useEffect, useState } from 'react';

function Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setmounted] = useState(false);

  useEffect(() => {
    setmounted(true);
  }, []);
  if (!mounted) return null;
  return children;
}

export { Provider };
