import React, { useState } from 'react';
import { 
  Plus, Search, Filter, Pin, 
  MessageSquare, AlertCircle, Clock, MoreVertical,
  ChevronRight, StickyNote, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotes, useCreateNote } from './hooks/useNotes';
import { format } from 'date-fns';

export default function NotesPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const { data: notes, isLoading } = useNotes({
    search,
    type: typeFilter === 'all' ? undefined : typeFilter
  });

  const createNoteMutation = useCreateNote();

  const handleCreateNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const noteData = {
      title: formData.get('title'),
      content: formData.get('content'),
      type: formData.get('type'),
      priority: formData.get('priority'),
    };
    await createNoteMutation.mutateAsync(noteData);
    setIsCreateModalOpen(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-rose-500 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-amber-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'INCIDENT': return <AlertCircle className="w-4 h-4" />;
      case 'MAINTENANCE': return <HardDrive className="w-4 h-4" />;
      case 'PRODUCTION': return <Clock className="w-4 h-4" />;
      default: return <StickyNote className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Header Area */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Operational Notes</h1>
          <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-[10px]">Production intelligence / Communication</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm w-64 focus:ring-4 focus:ring-indigo-50 transition-all font-semibold"
            />
          </div>
          
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 transition-all font-bold shadow-xl shadow-slate-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>New Remark</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        {/* Filters Sidebar */}
        <aside className="col-span-12 lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-900 mb-6 flex items-center gap-3">
              <Filter className="w-4 h-4 text-indigo-600" />
              Categorize
            </h3>
            
            <div className="space-y-2">
              {['all', 'GENERAL', 'PRODUCTION', 'MAINTENANCE', 'QUALITY', 'SHIFT_HANDOVER', 'INCIDENT', 'STOCK'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-between group
                    ${typeFilter === type 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                      : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <span className="uppercase tracking-widest">{type}</span>
                  <ChevronRight className={`w-3 h-3 transition-transform ${typeFilter === type ? 'translate-x-1' : 'group-hover:translate-x-1'}`} />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Notes List */}
        <div className="col-span-12 lg:col-span-9">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 animate-pulse h-64" />
                ))
              ) : notes?.map((note) => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`group relative bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 flex flex-col justify-between
                    ${note.isPinned ? 'ring-2 ring-indigo-600' : ''}`}
                >
                  {note.isPinned && (
                    <div className="absolute -top-3 -right-3 bg-indigo-600 text-white p-2 rounded-xl shadow-lg">
                      <Pin className="w-4 h-4 fill-current" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${getPriorityColor(note.priority)}`}>
                          {note.priority}
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          {getTypeIcon(note.type)}
                          <span className="text-[9px] font-bold uppercase tracking-widest">{note.type}</span>
                        </div>
                      </div>
                      <button className="text-slate-300 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-xl">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    <h2 className="text-xl font-black text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors leading-tight">
                      {note.title}
                    </h2>
                    <p className="text-slate-500 font-medium text-sm line-clamp-3 leading-relaxed mb-6">
                      {note.content}
                    </p>
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[10px]">
                        {note.createdByName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-900 leading-none">{note.createdByName}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{note.createdByRole}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-[9px] font-bold">{format(new Date(note.createdAt), 'MMM dd, HH:mm')}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {!isLoading && notes?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-300 mb-6">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900">No notes found</h3>
              <p className="text-slate-400 font-bold mt-2">Try adjusting your filters or search query</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Note Modal (Simple version) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-12">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Create Remark</h2>
                  <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-[10px]">Internal Operation Journal</p>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-4 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleCreateNote} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                  <input 
                    name="title"
                    required
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-50 font-bold text-slate-900" 
                    placeholder="Enter short title..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                    <select 
                      name="type"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-50 font-bold text-slate-900 appearance-none"
                    >
                      <option value="GENERAL">General</option>
                      <option value="PRODUCTION">Production</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="QUALITY">Quality</option>
                      <option value="INCIDENT">Incident</option>
                      <option value="SHIFT_HANDOVER">Shift Handover</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                    <select 
                      name="priority"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-50 font-bold text-slate-900 appearance-none"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Content</label>
                  <textarea 
                    name="content"
                    required
                    rows={4}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-50 font-bold text-slate-900 resize-none" 
                    placeholder="Describe the situation or update..."
                  />
                </div>

                <div className="pt-6">
                  <button 
                    disabled={createNoteMutation.isPending}
                    type="submit"
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                  >
                    {createNoteMutation.isPending ? 'Committing...' : 'Commit Note'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
