import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import AppointmentsPage from './pages/AppointmentsPage.jsx';
import AppointmentsHistoryPage from './pages/AppointmentsHistoryPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PatientsPage from './pages/PatientsPage.jsx';
import OwnersPage from './pages/OwnersPage.jsx';
import VeterinariansPage from './pages/VeterinariansPage.jsx';
import MedicinesPage from './pages/MedicinesPage.jsx';

const App = () => (
  <Layout>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/patients" element={<PatientsPage />} />
      <Route path="/owners" element={<OwnersPage />} />
      <Route path="/veterinarians" element={<VeterinariansPage />} />
      <Route path="/medicines" element={<MedicinesPage />} />
      <Route path="/appointments" element={<AppointmentsPage />} />
      <Route path="/appointments/history" element={<AppointmentsHistoryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Layout>
);

export default App;
