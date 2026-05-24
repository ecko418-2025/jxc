// ========================================
// 登录页面 - Login
// ========================================

import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, ShopOutlined } from '@ant-design/icons';
import { auth } from '../../database/db';

const { Title, Text } = Typography;

interface LoginProps {
  onSuccess: () => void;
}

const LoginPage: React.FC<LoginProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      await auth.signInWithUsernameAndPassword(values.username, values.password);
      message.success('登录成功！');
      onSuccess();
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'AUTH_CUSTOM_ERROR' || error.message?.includes('password')) {
         message.error('账号或密码错误');
      } else if (error.code === 'INVALID_PARAM') {
         message.error('用户名格式不正确');
      } else {
         message.error('登录失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: 20
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(10px)'
        }}
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
          <Title level={3} style={{ color: '#fff', margin: 0 }}>酒店进销存管理系统</Title>
          <Text style={{ color: 'var(--text-secondary)' }}>云端协同版本 v2.0</Text>
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
              prefix={<UserOutlined style={{ color: 'var(--text-muted)' }} />} 
              placeholder="请输入用户名" 
              style={{ background: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
              placeholder="密码"
              style={{ background: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
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
        
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            请使用管理员在腾讯云后台创建的邮箱账号登录
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
