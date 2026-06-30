import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface Props {
  pageTitle: string;
  children: ReactNode;
}

export function AppShell({ pageTitle, children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-tint-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header pageTitle={pageTitle} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
