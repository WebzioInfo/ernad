import React from 'react';
import { motion } from 'framer-motion';

interface StationWorkspaceProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  title: string;
  description: string;
  headerActions?: React.ReactNode;
}

export const StationWorkspace: React.FC<StationWorkspaceProps> = ({
  children,
  sidebar,
  title,
  description,
  headerActions
}) => {
  return (
    <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">
      {/* Main Action Area */}
      <main className="col-span-12 lg:col-span-8 p-4 md:p-6 overflow-y-auto bg-white custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="mb-6 flex items-start justify-between gap-4 md:gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">
                {title}
              </h2>
              <div className="h-1 w-20 bg-[#16857D] rounded-full mb-4" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
                {description}
              </p>
            </div>
            {headerActions && (
              <div className="flex shrink-0 items-center justify-end">
                {headerActions}
              </div>
            )}
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Sidebar Feed Area */}
      <aside className="hidden lg:flex lg:col-span-4 border-l border-[#16857D]/15 bg-white flex-col overflow-hidden">
        {sidebar}
      </aside>
    </div>
  );
};
