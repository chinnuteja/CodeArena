import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import Navbar from './components/Navbar';
import StaffRoute from './components/StaffRoute';
import Home from './pages/Home';
import ProblemList from './pages/ProblemList';
import Workspace from './pages/Workspace';
import ContestList from './pages/ContestList';
import ContestDetail from './pages/ContestDetail';
import ContestLeaderboard from './pages/ContestLeaderboard';
import UserProfile from './pages/UserProfile';
import AcceptInvite from './pages/AcceptInvite';
import AdminProblems from './pages/admin/AdminProblems';
import AdminProblemEdit from './pages/admin/AdminProblemEdit';
import AdminContests from './pages/admin/AdminContests';
import './App.css';

function AppShell() {
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/workspace');

  return (
    <div className={isWorkspace ? 'app-container app-container--workspace' : 'app-container'}>
      {!isWorkspace && <Navbar />}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/problems" element={<ProblemList />} />
          <Route path="/workspace/:problemSlug" element={<Workspace />} />
          <Route path="/contests" element={<ContestList />} />
          <Route path="/contests/invite" element={<AcceptInvite />} />
          <Route path="/contests/:slug" element={<ContestDetail />} />
          <Route path="/contests/:slug/leaderboard" element={<ContestLeaderboard />} />
          <Route path="/users/:username" element={<UserProfile />} />
          <Route path="/admin/problems" element={<StaffRoute><AdminProblems /></StaffRoute>} />
          <Route path="/admin/problems/:slug" element={<StaffRoute><AdminProblemEdit /></StaffRoute>} />
          <Route path="/admin/contests" element={<StaffRoute><AdminContests /></StaffRoute>} />
        </Routes>
      </main>
      <AuthModal />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </Router>
  );
}

export default App;
