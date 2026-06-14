// ========================================
// 登录页面 - Login
// ========================================

import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography } from 'antd';
import { UserOutlined, LockOutlined, ShopOutlined } from '@ant-design/icons';
import { auth } from '../../database/db';
import { message } from '../../utils/antd';

const { Title } = Typography;

const quickLoginUsers = [
  { label: '管理员', username: 'ecko418', password: 'Ecko0418' },
  { label: '销售', username: 'test1234s', password: 'Test1234' },
  { label: '仓储', username: 'test1234v', password: 'Test1234' },
  { label: '财务', username: 'test1234c', password: 'Test1234' },
];

interface LoginProps {
  onSuccess: () => void;
}

interface LoginValues {
  username: string;
  password: string;
}

const getLoginError = (error: unknown) => {
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
    return { code, message: error.message };
  }

  return { code: '', message: '' };
};

const LoginPage: React.FC<LoginProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: LoginValues) => {
    setLoading(true);
    try {
      await auth.signInWithUsernameAndPassword(values.username, values.password);
      message.success('登录成功！');
      onSuccess();
    } catch (error: unknown) {
      console.error('Login error:', error);
      const loginError = getLoginError(error);
      if (loginError.code === 'AUTH_CUSTOM_ERROR' || loginError.message.includes('password')) {
         message.error('账号或密码错误');
      } else if (loginError.code === 'INVALID_PARAM') {
         message.error('用户名格式不正确');
      } else {
         message.error('登录失败: ' + (loginError.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (username: string, password: string) => {
    handleLogin({ username, password });
  };

  return (
    <div className="login-page">
      <Card
        className="login-card"
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <ShopOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <Title level={3} className="login-title">酒店进销存管理系统</Title>
        </div>

        <Form
          name="login"
          size="large"
          onFinish={handleLogin}
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
            ]}
          >
            <Input 
              prefix={<UserOutlined />}
              className="login-input"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              className="login-input"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24 }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={loading}
              style={{ height: 48, fontSize: 16, background: 'linear-gradient(90deg, #6366f1, #a855f7)', border: 0 }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
          {quickLoginUsers.map(user => (
            <Button
              key={user.username}
              type="default"
              block
              loading={loading}
              onClick={() => handleQuickLogin(user.username, user.password)}
              className="quick-login-button"
            >
              {user.label}快捷登录
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
