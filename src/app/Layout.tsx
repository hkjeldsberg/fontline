import type { ReactNode } from 'react';

interface LayoutProps {
  title: ReactNode;
  actions?: ReactNode;
  workspace: ReactNode;
  filmstrip?: ReactNode;
}

export function Layout({ title, actions, workspace, filmstrip }: LayoutProps) {
  return (
    <div className="layout">
      <header className="topbar">
        <h1>{title}</h1>
        <div className="spacer" />
        {actions}
      </header>
      <main className="workspace">{workspace}</main>
      {filmstrip ? <footer className="filmstrip-dock">{filmstrip}</footer> : null}
    </div>
  );
}
