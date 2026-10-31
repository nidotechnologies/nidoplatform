import React, { createContext, ReactNode } from 'react';

export function NotificationProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
