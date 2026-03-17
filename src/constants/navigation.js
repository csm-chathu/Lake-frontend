export const doctorNavItems = [
  { to: '/', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/appointments', label: 'Treatment', end: true, icon: '🗓️' },
  { to: '/appointments/history', label: 'Treatment History', icon: '📜' },
  { to: '/sales', label: 'Direct Sale', end: true, icon: '🧾' },
  { to: '/sales/history', label: 'Sales History', end: true, icon: '🧮' },
  { to: '/patients', label: 'Manage Patients', icon: '🐾' },
  { to: '/owners', label: 'Manage Owners', icon: '👥' },
  { to: '/medicines', label: 'Medicines & Stock', icon: '💊' },
  { to: '/suppliers', label: 'Suppliers', icon: '🏭' },
  { to: '/employees', label: 'Employee Management', icon: '🧑‍💼' },
  { to: '/sms-logs', label: 'SMS Logs', icon: '✉️' },
  { to: '/billing/day-end', label: 'Sales Day-End Close', icon: '🏦' },
  { to: '/procurement/purchase-orders', label: 'Purchase Orders', icon: '📦' },
  { to: '/procurement/goods-receipts', label: 'Goods Receipts (GRN)', icon: '📥' },
  { to: '/procurement/supplier-invoices', label: 'Supplier Invoices', icon: '🧮' },
  { to: '/procurement/supplier-credit-notes', label: 'Credit Notes', icon: '↩️' },
  { to: '/reports', label: 'Reports & Summary', end: true, icon: '📋' },
  { to: '/settings', label: 'Settings', icon: '⚙️' }
];

export const cashierNavItems = [
  { to: '/', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/sales', label: 'Direct Sale', end: true, icon: '🧾' },
  { to: '/sales/history', label: 'Sales History', end: true, icon: '🧮' },
  { to: '/sales/heatmap', label: 'Sales Heatmap', end: true, icon: '🔥' },
  { to: '/sales/customer-returns', label: 'Customer Returns', icon: '↩️' },
  { to: '/stock/low-stock', label: 'Low Stock Alerts', icon: '⏳' },
  { to: '/suppliers', label: 'Suppliers', icon: '🏭' },
  { to: '/medicines', label: 'Medicines & Stock', icon: '💊' },
  { to: '/billing/day-end', label: 'Sales Day-End Close', icon: '🏦' },
  { to: '/procurement/supplier-invoices', label: 'Supplier Invoices', icon: '🧮' },
  { to: '/reports', label: 'Reports & Summary', end: true, icon: '📋' }
];

export const posAdminNavItems = [
  ...cashierNavItems,
  { to: '/employees', label: 'Employee Management', icon: '🧑‍💼' },
  { to: '/procurement/goods-receipts', label: 'Goods Receipts (GRN)', icon: '📥' },
  { to: '/procurement/supplier-credit-notes', label: 'Supplier Returns (Damage)', icon: '↩️' },
  { to: '/procurement/purchase-orders', label: 'Purchase Notes', icon: '📦' }
];

export const posUserTypes = ['cashier', 'pos_admin'];

export const isPosUserType = (userType) => posUserTypes.includes(String(userType || '').toLowerCase());

export const getPosNavItems = (userType) => {
  const normalizedType = String(userType || '').toLowerCase();
  if (normalizedType === 'pos_admin') {
    return posAdminNavItems;
  }

  return cashierNavItems;
};