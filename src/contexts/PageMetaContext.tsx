import { createContext, useContext, useState, type ReactNode } from "react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageMeta {
  title?: string;
  breadcrumbs?: Breadcrumb[];
}

interface PageMetaContextValue {
  meta: PageMeta;
  setMeta: (meta: PageMeta) => void;
}

const PageMetaContext = createContext<PageMetaContextValue>({
  meta: {},
  setMeta: () => {},
});

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<PageMeta>({});
  return (
    <PageMetaContext.Provider value={{ meta, setMeta }}>
      {children}
    </PageMetaContext.Provider>
  );
}

export function usePageMeta() {
  return useContext(PageMetaContext);
}
