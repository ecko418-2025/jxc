// ========================================
// App Router - Main Application Entry
// ========================================

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import ProductsPage from './pages/Products';
import PurchasePage from './pages/Purchase';
import SalesPage from './pages/Sales';
import InventoryPage from './pages/Inventory';
import SuppliersPage from './pages/Suppliers';
import CustomersPage from './pages/Customers';
import ReportsPage from './pages/Reports';
import SettingsPage from './pages/Settings';
import { initCloudBase, auth } from './database/db';
import { seedDemoData } from './database/seed';
import LoginPage from './pages/Login';

const App: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    // 监听登录状态
    const unsubscribe = auth.onLoginStateChanged(async (loginState: any) => {
      if (loginState) {
        setIsLoggedIn(true);
        try {
          await initCloudBase();
        } catch (e) {
          console.error(e);
        }
      } else {
        setIsLoggedIn(false);
      }
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#fff' }}>
        <h2>加载云端数据中...</h2>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          colorBgContainer: '#1e293b',
          colorBgElevated: '#1e293b',
          colorBorder: 'rgba(148, 163, 184, 0.15)',
          colorText: '#f1f5f9',
          colorTextSecondary: '#94a3b8',
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Table: {
            headerBg: '#334155',
            rowHoverBg: 'rgba(51, 65, 85, 0.6)',
          },
          Card: {
            headerBg: 'transparent',
          },
        },
      }}
    >
      <Router>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/purchase" element={<PurchasePage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
};

export default App;
