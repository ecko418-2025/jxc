// ========================================
// App Router - Main Application Entry
// ========================================

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
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
import ProposalsPage from './pages/Proposals';
import SettingsPage from './pages/Settings';
import FinancePage from './pages/Finance';
import { initCloudBase, auth, userDB } from './database/db';
import LoginPage from './pages/Login';
import { AntdStaticExtractor } from './utils/antd';

const App: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [themeMode, setThemeMode] = React.useState<'dark' | 'light'>(() => {
    return localStorage.getItem('ui_theme') === 'light' ? 'light' : 'dark';
  });

  React.useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem('ui_theme', themeMode);
  }, [themeMode]);

  React.useEffect(() => {
    // 监听登录状态
    const unsubscribe = auth.onLoginStateChanged(async (loginState: any) => {
      if (loginState) {
        setIsLoggedIn(true);
        let role = 'pending';
        try {
          await initCloudBase();
          const profile = await userDB.getProfile(
            loginState.user.uid,
            loginState.user.email,
            loginState.user.displayName
          );
          if (profile) {
            if (profile.role) {
              role = profile.role;
            }
            localStorage.setItem('user_display_name', profile.displayName || profile.username || loginState.user.uid);
          }
        } catch (e) {
          console.error('获取用户权限失败:', e);
        }
        localStorage.setItem('user_role', role);
        setUserRole(role);
      } else {
        setIsLoggedIn(false);
        setUserRole(null);
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_display_name');
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

  if (userRole === 'pending' || !userRole) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#fff', flexDirection: 'column', padding: 24, textAlign: 'center' }}>
        <h1 style={{ color: '#f59e0b', fontSize: 32, marginBottom: 16 }}>⚠️ 账号待授权</h1>
        <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 500, marginBottom: 24 }}>
          您的账号已成功注册并登录，但目前处于<strong>「待授权」</strong>状态。请联系管理员为您分配岗位角色（如销售员、库管员或财务员）。
        </p>
        <div style={{ background: '#1e293b', padding: '16px 24px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.15)', marginBottom: 24, width: '100%', maxWidth: 450 }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>您的账号 UID (提供给管理员授权):</p>
          <code style={{ fontSize: 14, color: '#f1f5f9', wordBreak: 'break-all', fontFamily: 'monospace' }}>{auth.currentUser?.uid}</code>
        </div>
        <button 
          onClick={() => auth.signOut().then(() => { setIsLoggedIn(false); setUserRole(null); })}
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}
        >
          退出登录
        </button>
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          colorBgContainer: themeMode === 'dark' ? '#1e293b' : '#fffdf7',
          colorBgElevated: themeMode === 'dark' ? '#1e293b' : '#fffdf7',
          colorBorder: themeMode === 'dark' ? 'rgba(148, 163, 184, 0.15)' : '#d8cfbf',
          colorText: themeMode === 'dark' ? '#f1f5f9' : '#172033',
          colorTextSecondary: themeMode === 'dark' ? '#94a3b8' : '#475569',
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Table: {
            headerBg: themeMode === 'dark' ? '#334155' : '#eee7d9',
            rowHoverBg: themeMode === 'dark' ? 'rgba(51, 65, 85, 0.6)' : '#f3ede2',
          },
          Card: {
            headerBg: 'transparent',
          },
        },
      }}
    >
      <AntdApp>
        <AntdStaticExtractor />
        <Router>
          <Routes>
            <Route
              element={(
                <AppLayout
                  themeMode={themeMode}
                  onThemeChange={() => setThemeMode(current => current === 'dark' ? 'light' : 'dark')}
                />
              )}
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/purchase" element={<PurchasePage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/proposals" element={<ProposalsPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </Router>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
