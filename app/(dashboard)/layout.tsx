'use client';

import { useState, useEffect } from 'react';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import { Stethoscope } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (sidebarOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar - always visible on md+ */}
      <Sidebar />

      {/* Mobile sidebar - drawer */}
      <Sidebar
        isMobile
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header - only on small screens */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
          <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Stethoscope className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="text-sm font-semibold text-slate-800 truncate">
              Pragati ENT Hospital
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
