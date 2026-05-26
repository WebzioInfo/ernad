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
      <main className="col-span-12 lg:col-span-8 p-6 md:p-10 overflow-y-auto bg-slate-50 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">
                {title}
              </h2>
              <div className="h-1 w-20 bg-indigo-600 rounded-full mb-4" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
                {description}
              </p>
            </div>
            {headerActions && (
              <div className="flex items-center">
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
      <aside className="hidden lg:flex lg:col-span-4 border-l border-slate-200 bg-white flex-col overflow-hidden">
        {sidebar}
      </aside>
    </div>
  );
};
