import React from 'react';

export default function PageErrorBoundary({ children, title, resetKey }: { children: React.ReactNode; title?: string; resetKey?: string }) {
  return <>{children}</>;
}
