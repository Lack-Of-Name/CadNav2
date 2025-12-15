import React, { createContext, FC, PropsWithChildren, useContext, useMemo } from 'react';

export type PagerApi = {
  goToPage: (index: number, options?: { animated?: boolean }) => void;
};

const PagerContext = createContext<PagerApi | null>(null);

export const PagerProvider: FC<PropsWithChildren<{ goToPage: PagerApi['goToPage'] }>> = ({
  goToPage,
  children,
}) => {
  const value = useMemo(() => ({ goToPage }), [goToPage]);
  return <PagerContext.Provider value={value}>{children}</PagerContext.Provider>;
};

export function usePager() {
  const ctx = useContext(PagerContext);
  if (!ctx) throw new Error('usePager must be used within PagerProvider');
  return ctx;
}
