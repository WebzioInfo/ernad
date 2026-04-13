import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AdminDashboard from "./components/AdminDashboard";
import OperatorPanel from "./components/OperatorPanel";
import Login from "./components/Login";
import RequireAuth from "./components/RequireAuth";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50">
        <Toaster position="top-right" />
        <Routes>
          {/* Default redirect to admin */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Public Login */}
          <Route path="/login" element={<Login />} />
          
          {/* Admin Route */}
          <Route path="/admin" element={
            <RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
              <AdminDashboard />
            </RequireAuth>
          } />

          {/* Operator Route (tablet panel) */}
          <Route path="/line/:id/operator" element={
            <RequireAuth>
              <OperatorPanel />
            </RequireAuth>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

