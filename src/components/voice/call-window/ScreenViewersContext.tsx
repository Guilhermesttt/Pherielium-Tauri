import React, { createContext, useContext } from "react";

/** Quantas pessoas assistem à minha transmissão (mostrado no cartão de quem transmite). */
const ScreenViewersContext = createContext<number>(0);

export const ScreenViewersProvider: React.FC<{ count: number; children: React.ReactNode }> = ({ count, children }) => (
  <ScreenViewersContext.Provider value={count}>{children}</ScreenViewersContext.Provider>
);

export const useScreenViewers = (): number => useContext(ScreenViewersContext);
