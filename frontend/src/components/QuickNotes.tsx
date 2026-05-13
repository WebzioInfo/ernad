import { useState, useEffect } from 'react';
import { StickyNote, X, Plus, Trash2, Save, FileText, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Note {
  id: string;
  content: string;
  timestamp: string;
  title: string;
}

export default function QuickNotes() {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  // Load notes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mes-manager-notes');
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load notes', e);
      }
    }
  }, []);

  // Save notes to localStorage
  const saveNotes = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    localStorage.setItem('mes-manager-notes', JSON.stringify(updatedNotes));
  };

  const createNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'New Note',
      content: '',
      timestamp: new Date().toLocaleString()
    };
    saveNotes([newNote, ...notes]);
    setActiveNote(newNote);
  };

  const updateNote = (id: string, content: string, title: string) => {
    const updated = notes.map(n =>
      n.id === id ? { ...n, content, title, timestamp: new Date().toLocaleString() } : n
    );
    saveNotes(updated);
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    saveNotes(updated);
    if (activeNote?.id === id) setActiveNote(null);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-10 right-10 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group border border-white/10"
      >
        <StickyNote className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        {notes.length > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-slate-900">
            {notes.length}
          </span>
        )}
      </button>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.1)] z-[70] flex flex-col"
            >
              {/* Header */}
              <div className="h-24 flex items-center justify-between px-8 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                    <StickyNote className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none">Quick Notes</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Personal Scratchpad</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-900 transition-all active:scale-90 shadow-sm border border-transparent hover:border-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {activeNote ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col p-8 space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setActiveNote(null)}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2 hover:translate-x-[-4px] transition-transform"
                      >
                        <ChevronRight className="w-3 h-3 rotate-180" /> Back to list
                      </button>
                      <button
                        onClick={() => deleteNote(activeNote.id)}
                        className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={activeNote.title}
                      onChange={(e) => {
                        updateNote(activeNote.id, activeNote.content, e.target.value);
                        setActiveNote({ ...activeNote, title: e.target.value });
                      }}
                      placeholder="Note Title"
                      className="text-2xl font-black text-slate-900 placeholder:text-slate-200 border-none focus:ring-0 p-0"
                    />

                    <textarea
                      value={activeNote.content}
                      onChange={(e) => {
                        updateNote(activeNote.id, e.target.value, activeNote.title);
                        setActiveNote({ ...activeNote, content: e.target.value });
                      }}
                      placeholder="Start typing your observations..."
                      className="flex-1 resize-none text-slate-600 leading-relaxed border-none focus:ring-0 p-0 text-sm"
                    />

                    <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Last edited: {activeNote.timestamp}
                      </span>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase">
                        <Save className="w-3 h-3" /> Auto-saved
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar p-6 space-y-3">
                    <button
                      onClick={createNote}
                      className="w-full p-6 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                    >
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Create New Entry</span>
                    </button>

                    {notes.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center opacity-30 py-20">
                        <FileText className="w-12 h-12 mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest">No entries yet</p>
                      </div>
                    ) : (
                      notes.map((note) => (
                        <div
                          key={note.id}
                          onClick={() => setActiveNote(note)}
                          className="p-6 bg-white border border-slate-100 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/40 hover:border-indigo-100 transition-all cursor-pointer group"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate flex-1 pr-4">
                              {note.title || 'Untitled'}
                            </h3>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter whitespace-nowrap">
                              {note.timestamp.split(',')[0]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {note.content || 'No content...'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
