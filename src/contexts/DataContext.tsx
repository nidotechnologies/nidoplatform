import React, { createContext, ReactNode, useContext } from 'react';

const DataContext = createContext<any>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const value = {
    data: {},
    loading: false,
    error: null,
  };
  
  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    return {
      data: {},
      loading: false,
      error: null,
    };
  }
  return context;
}
