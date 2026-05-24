// ========================================
// Main Layout - Sidebar + Header + Content
// ========================================

import React, { useState } from 'react';
import { Layout, Menu, Typography, Space, Badge, Avatar, Tooltip, Dropdown } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ImportOutlined,
  ExportOutlined,
  DatabaseOutlined,
  TeamOutlined,
  BankOutlined,
  BarChartOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { inventoryDB, auth } from '../database/db';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据看板' },
  { key: '/products', icon: <ShoppingOutlined />, label: '产品管理' },
  { key: '/purchase', icon: <ImportOutlined />, label: '采购管理' },
  { key: '/sales', icon: <ExportOutlined />, label: '销售管理' },
  { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
  { key: '/suppliers', icon: <TeamOutlined />, label: '供应商' },
  { key: '/customers', icon: <BankOutlined />, label: '客户管理' },
  { key: '/reports', icon: <BarChartOutlined />, label: '数据报表' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [lowStockCount, setLowStockCount] = useState(0);

  React.useEffect(() => {
    inventoryDB.getLowStockProducts().then(res => setLowStockCount(res.length)).catch(() => {});
  }, [location.pathname]);
  const currentTitle = menuItems.find(m => m.key === location.pathname)?.label || '数据看板';

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
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={menuItems.map(item => ({
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
            <Tooltip title={lowStockCount > 0 ? `${lowStockCount} 个产品库存不足，点击查看` : '库存正常，点击前往库存管理'}>
              <Badge count={lowStockCount} size="small" offset={[-2, 2]}>
                <BellOutlined 
                  style={{ fontSize: 18, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.3s' }} 
                  onClick={() => navigate('/inventory')}
                />
              </Badge>
            </Tooltip>
            
            <Tooltip title="安全退出">
              <LogoutOutlined 
                style={{ fontSize: 18, color: 'var(--error-color)', cursor: 'pointer', transition: 'opacity 0.3s' }} 
                onClick={async () => {
                  await auth.signOut();
                  window.location.reload();
                }}
              />
            </Tooltip>

            <Dropdown
              menu={{
                items: [
                  { key: 'settings', label: '系统设置', onClick: () => navigate('/settings') },
                  { type: 'divider' },
                  { key: 'logout', label: '退出登录', danger: true, onClick: async () => { await auth.signOut(); window.location.reload(); } }
                ]
              }}
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
                管
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
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
