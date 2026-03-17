import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmployeesPage from './EmployeesPage.jsx';
import SalaryManagementPage from './SalaryManagementPage.jsx';
import BonusesPage from './BonusesPage.jsx';

const TAB_CONFIG = [
  { key: 'employees', label: 'Employees', description: 'Create and maintain employee records.' },
  { key: 'salaries', label: 'Salaries', description: 'Track salary payments, deductions, and payout history.' },
  { key: 'bonuses', label: 'Bonuses', description: 'Manage special bonus payouts for employees.' }
];

const EmployeeManagementPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = String(searchParams.get('tab') || 'employees').toLowerCase();

  const activeTab = useMemo(() => {
    if (TAB_CONFIG.some((tab) => tab.key === requestedTab)) {
      return requestedTab;
    }
    return 'employees';
  }, [requestedTab]);

  const activeTabConfig = TAB_CONFIG.find((tab) => tab.key === activeTab) || TAB_CONFIG[0];

  const handleTabChange = (tabKey) => {
    if (tabKey === 'employees') {
      setSearchParams({}, { replace: true });
      return;
    }

    setSearchParams({ tab: tabKey }, { replace: true });
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800">Employee Management</h1>
            <p className="mt-1 text-sm text-slate-500">Manage employee profiles, salary payments, and bonus records from one module.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Current section:</span> {activeTabConfig.label}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {TAB_CONFIG.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={[
                  'btn btn-sm rounded-full border transition',
                  isActive
                    ? 'border-sky-500 bg-sky-500 text-white hover:border-sky-600 hover:bg-sky-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-sm text-slate-500">{activeTabConfig.description}</p>
      </div>

      {activeTab === 'employees' && <EmployeesPage />}
      {activeTab === 'salaries' && <SalaryManagementPage />}
      {activeTab === 'bonuses' && <BonusesPage />}
    </section>
  );
};

export default EmployeeManagementPage;