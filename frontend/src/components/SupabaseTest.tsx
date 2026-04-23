import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function SupabaseTest() {
  const [todos, setTodos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function getTodos() {
      setLoading(true)
      const { data: todos, error } = await supabase.from('todos').select()

      if (error) {
        setError(error.message)
      } else if (todos) {
        setTodos(todos)
      }
      setLoading(false)
    }

    getTodos()
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="max-w-md mx-auto">
        <Link to="/" className="flex items-center text-blue-400 mb-8 hover:text-blue-300 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to App
        </Link>
        
        <h1 className="text-3xl font-bold mb-6 tracking-tight">Supabase Connection Test</h1>
        
        <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-xl">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Table: todos</h2>
          
          {loading && <p className="text-slate-400">Loading data from Supabase...</p>}
          
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-rose-400 text-sm">
              <p className="font-bold mb-1">Error fetching data:</p>
              <p>{error}</p>
              <p className="mt-4 text-xs text-rose-300/70">
                Note: This error usually occurs if the 'todos' table has not been created in your Supabase project yet.
              </p>
            </div>
          )}

          {!loading && !error && (
            <ul className="space-y-3">
              {todos.length === 0 ? (
                <p className="text-slate-500 italic">No todos found. If you just created the table, try adding a row.</p>
              ) : (
                todos.map((todo) => (
                  <li key={todo.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center group hover:border-blue-500/50 transition-colors">
                    <span className="font-medium">{todo.name}</span>
                    <span className="text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-500 group-hover:text-blue-400 transition-colors uppercase font-bold">ID: {todo.id}</span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
