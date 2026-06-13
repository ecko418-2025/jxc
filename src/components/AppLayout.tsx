// ========================================
// Main Layout - Sidebar + Header + Content
// ========================================

import React, { useState } from 'react';
import { Layout, Menu, Typography, Space, Badge, Avatar, Tooltip, Dropdown, Button } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ImportOutlined,
  ExportOutlined,
  DatabaseOutlined,
  TeamOutlined,
  BankOutlined,
  BarChartOutlined,
  FileDoneOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  BulbOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { inventoryDB, auth } from '../database/db';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

interface AppLayoutProps {
  themeMode: 'dark' | 'light';
  onThemeChange: () => void;
}

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据看板' },
  { key: '/products', icon: <ShoppingOutlined />, label: '产品管理' },
  { key: '/purchase', icon: <ImportOutlined />, label: '采购管理' },
  { key: '/sales', icon: <ExportOutlined />, label: '销售管理' },
  { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
  { key: '/suppliers', icon: <TeamOutlined />, label: '供应商' },
  { key: '/customers', icon: <BankOutlined />, label: '客户管理' },
  { key: '/reports', icon: <BarChartOutlined />, label: '数据报表' },
  { key: '/finance', icon: <BankOutlined />, label: '财务管理' },
  { key: '/proposals', icon: <FileDoneOutlined />, label: '投标标书' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

const AppLayout: React.FC<AppLayoutProps> = ({ themeMode, onThemeChange }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [lowStockCount, setLowStockCount] = useState(0);

  const role = localStorage.getItem('user_role') || 'pending';
  const displayName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '系统成员';

  const roleLabelMap: Record<string, string> = {
    admin: '系统管理员',
    sales: '销售员',
    warehouse: '库管员',
    finance: '财务员',
    pending: '待授权'
  };
  const roleLabel = roleLabelMap[role] || '成员';

  const filteredMenuItems = menuItems.filter(item => {
    if (role === 'admin') return true;
    if (role === 'sales') {
      return !['/reports', '/finance', '/settings'].includes(item.key);
    }
    if (role === 'warehouse') {
      return ['/', '/products', '/purchase', '/sales', '/inventory'].includes(item.key);
    }
    if (role === 'finance') {
      return !['/proposals', '/settings'].includes(item.key);
    }
    return false;
  });

  const isPathAllowed = filteredMenuItems.some(m => m.key === location.pathname);

  React.useEffect(() => {
    inventoryDB.getLowStockProducts().then(res => setLowStockCount(res.length)).catch(() => {});
  }, [location.pathname]);

  const currentTitle = menuItems.find(m => m.key === location.pathname)?.label || '数据看板';

  const dropdownItems = [
    ...(role === 'admin' ? [{ key: 'settings', label: '系统设置', onClick: () => navigate('/settings') }] : []),
    ...(role === 'admin' ? [{ type: 'divider' as const }] : []),
    { key: 'logout', label: '退出登录', danger: true, onClick: async () => { await auth.signOut(); window.location.reload(); } }
  ];

  return (
    <Layout style={{ height: '100vh' }}>
      {/* Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={260}
        collapsedWidth={72}
        style={{
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          overflow: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 20px',
          borderBottom: '1px solid var(--border-color)',
          gap: 12,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}>
            洁
          </div>
          {!collapsed && (
            <div style={{ animation: 'fadeIn 200ms ease-out' }}>
              <Text strong style={{ color: 'var(--text-primary)', fontSize: 15, display: 'block', lineHeight: 1.3 }}>
                酒店保洁
              </Text>
              <Text style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                进销存管理系统
              </Text>
            </div>
          )}
        </div>

        {/* Menu */}
        <Menu
          theme={themeMode}
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={filteredMenuItems.map(item => ({
            ...item,
            label: item.key === '/inventory' ? (
              <Space>
                {item.label}
                {lowStockCount > 0 && <Badge count={lowStockCount} size="small" />}
              </Space>
            ) : item.label,
          }))}
          style={{ padding: '12px 0', border: 'none' }}
        />
      </Sider>

      {/* Main content area */}
      <Layout>
        {/* Header */}
        <Header style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
        }}>
          <Space size={16}>
            <div
              onClick={() => setCollapsed(!collapsed)}
              style={{ cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', transition: 'color 150ms' }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
            <Text strong style={{ color: 'var(--text-primary)', fontSize: 16 }}>
              {currentTitle}
            </Text>
          </Space>

          <Space size={20}>
            <Tooltip title={themeMode === 'dark' ? '切换到明亮模式' : '切换到深色模式'}>
              <Button
                type="text"
                shape="circle"
                aria-label={themeMode === 'dark' ? '切换到明亮模式' : '切换到深色模式'}
                icon={themeMode === 'dark' ? <BulbOutlined /> : <MoonOutlined />}
                onClick={onThemeChange}
                style={{ color: 'var(--text-secondary)', fontSize: 18 }}
              />
            </Tooltip>
            <div style={{ display: collapsed ? 'none' : 'flex', alignItems: 'center', gap: '8px' }}>
              <Text strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{displayName}</Text>
              <span style={{ fontSize: 11, color: 'var(--text-accent)', background: 'rgba(99, 102, 241, 0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{roleLabel}</span>
            </div>

            {role !== 'warehouse' && (
              <Tooltip title={lowStockCount > 0 ? `${lowStockCount} 个产品库存不足，点击查看` : '库存正常，点击前往库存管理'}>
                <Badge count={lowStockCount} size="small" offset={[-2, 2]}>
                  <BellOutlined 
                    style={{ fontSize: 18, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.3s' }} 
                    onClick={() => navigate('/inventory')}
                  />
                </Badge>
              </Tooltip>
            )}
            <Dropdown
              menu={{ items: dropdownItems }}
              placement="bottomRight"
            >
              <Avatar
                size={32}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {displayName.charAt(0)}
              </Avatar>
            </Dropdown>
          </Space>
        </Header>
 
        {/* Page Content */}
        <Content style={{
          padding: 24,
          overflow: 'auto',
          background: 'var(--bg-primary)',
        }}>
          <div className="animate-fade-in-up">
            {isPathAllowed ? (
              <Outlet />
            ) : (
              <div style={{ textAlign: 'center', padding: '100px 24px' }}>
                <h1 style={{ color: '#ef4444', fontSize: 40, marginBottom: 16 }}>403</h1>
                <h2 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>抱歉，您无权访问此页面</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>您的当前岗位角色没有该模块的查看权限，如有疑问请联系系统管理员。</p>
                <button 
                  onClick={() => navigate('/')}
                  style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
                >
                  返回看板
                </button>
              </div>
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
