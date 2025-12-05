import Sidebar from './Sidebar.jsx';

const Layout = ({ children }) => (
  <div className="flex min-h-screen bg-base-100 text-slate-900">
    <Sidebar />
    <main className="flex-1 overflow-y-auto px-6 py-10 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-6xl space-y-8">{children}</div>
    </main>
  </div>
);

export default Layout;
