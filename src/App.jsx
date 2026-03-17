import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import AppointmentsPage from './pages/AppointmentsPage.jsx';
import AppointmentsHistoryPage from './pages/AppointmentsHistoryPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PatientsPage from './pages/PatientsPage.jsx';
import OwnersPage from './pages/OwnersPage.jsx';
import VeterinariansPage from './pages/VeterinariansPage.jsx';
import MedicinesPage from './pages/MedicinesPage.jsx';
import SuppliersPage from './pages/SuppliersPage.jsx';
import StockPage from './pages/StockPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SmsLogsPage from './pages/SmsLogsPage.jsx';
import DirectSalesPage from './pages/DirectSalesPage.jsx';
import DirectSalesHistoryPage from './pages/DirectSalesHistoryPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DayEndPage from './pages/DayEndPage.jsx';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage.jsx';
import GoodsReceiptsPage from './pages/GoodsReceiptsPage.jsx';
import SupplierInvoicesPage from './pages/SupplierInvoicesPage.jsx';
import SupplierCreditNotesPage from './pages/SupplierCreditNotesPage.jsx';
import EmployeeManagementPage from './pages/EmployeeManagementPage.jsx';
import CustomerReturnsPage from './pages/CustomerReturnsPage.jsx';
import SalesHeatmapPage from './pages/SalesHeatmapPage.jsx';
import LowStockPage from './pages/LowStockPage.jsx';

const App = () => (
  <Layout>
    <Routes>
    <Route path="/login" element={<LoginPage />} />
      {/* protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/owners" element={<OwnersPage />} />
        <Route path="/veterinarians" element={<VeterinariansPage />} />
        <Route path="/medicines" element={<MedicinesPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/employees" element={<EmployeeManagementPage />} />
        <Route path="/salaries" element={<Navigate to="/employees?tab=salaries" replace />} />
        <Route path="/bonuses" element={<Navigate to="/employees?tab=bonuses" replace />} />
        <Route path="/sales" element={<DirectSalesPage />} />
        <Route path="/sales/history" element={<DirectSalesHistoryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/sales/heatmap" element={<SalesHeatmapPage />} />
        <Route path="/stock/low-stock" element={<LowStockPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/appointments/history" element={<AppointmentsHistoryPage />} />
        <Route path="/sms-logs" element={<SmsLogsPage />} />
        {/* Billing */}
        <Route path="/billing" element={<Navigate to="/sales" replace />} />
        <Route path="/billing/day-end" element={<DayEndPage />} />
        {/* Procurement */}
        <Route path="/procurement/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/procurement/goods-receipts" element={<GoodsReceiptsPage />} />
        <Route path="/procurement/supplier-invoices" element={<SupplierInvoicesPage />} />
        <Route path="/procurement/supplier-credit-notes" element={<SupplierCreditNotesPage />} />
        <Route path="/sales/customer-returns" element={<CustomerReturnsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Layout>
);

export default App;
