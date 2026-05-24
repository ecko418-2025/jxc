// ========================================
// 系统设置 - Settings
// ========================================

import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Modal, message, Row, Col, Statistic, Upload, Alert, Spin } from 'antd';
import {
  DownloadOutlined, UploadOutlined, DeleteOutlined,
  DatabaseOutlined, ExclamationCircleOutlined,
  CloudDownloadOutlined, CloudUploadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { dataUtils, productDB, categoryDB, supplierDB, customerDB, salesOrderDB, purchaseOrderDB } from '../../database/db';
import { seedDemoData } from '../../database/seed';

const { Text, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    products: 0,
    categories: 0,
    suppliers: 0,
    customers: 0,
    salesOrders: 0,
    purchaseOrders: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [prods, cats, supps, custs, sales, purch] = await Promise.all([
          productDB.getAll(),
          categoryDB.getAll(),
          supplierDB.getAll(),
          customerDB.getAll(),
          salesOrderDB.getAll(),
          purchaseOrderDB.getAll(),
        ]);
        setStats({
          products: prods.length,
          categories: cats.length,
          suppliers: supps.length,
          customers: custs.length,
          salesOrders: sales.length,
          purchaseOrders: purch.length,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Backup data
  const handleBackup = () => {
    message.info('纯异步云端架构暂不支持前端全量数据备份，请在云端控制台操作。');
  };

  // Restore data
  const handleRestore = (file: File) => {
    message.info('纯异步云端架构暂不支持前端全量数据恢复，请在云端控制台操作。');
    return false;
  };

  // Clear all data
  const handleClear = () => {
    Modal.confirm({
      title: '⚠️ 确认清空所有数据？',
      icon: <ExclamationCircleOutlined />,
      content: '前端直接清空所有云端数据已被禁用，防止误删，请从云端数据库后台操作。',
      okText: '好的',
      cancelText: '取消',
      onOk() {
        // Disabled for safety in prod
      },
    });
  };

  // Load demo data
  const handleLoadDemo = () => {
    Modal.confirm({
      title: '加载示例数据',
      content: '将向数据库插入示例数据。由于是网络请求可能需要几秒钟。',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        try {
          message.loading({ content: '正在加载示例数据...', key: 'seed' });
          await seedDemoData();
          message.success({ content: '示例数据已加载，请刷新页面', key: 'seed' });
          setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
          message.error({ content: '加载失败: ' + (error.message || ''), key: 'seed' });
        }
      },
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在加载系统状态..." />
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        {/* Data overview */}
        <Col xs={24}>
          <Card title={<Space><DatabaseOutlined /> 数据概览</Space>} size="small">
            <Row gutter={16}>
              <Col xs={8} sm={4}>
                <Statistic title="品类" value={stats.categories} valueStyle={{ fontSize: 20, color: 'var(--text-accent)' }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="产品" value={stats.products} valueStyle={{ fontSize: 20, color: 'var(--text-accent)' }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="供应商" value={stats.suppliers} valueStyle={{ fontSize: 20, color: 'var(--text-accent)' }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="客户" value={stats.customers} valueStyle={{ fontSize: 20, color: 'var(--text-accent)' }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="采购单" value={stats.purchaseOrders} valueStyle={{ fontSize: 20, color: 'var(--text-accent)' }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="销售单" value={stats.salesOrders} valueStyle={{ fontSize: 20, color: 'var(--text-accent)' }} />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Backup & Restore */}
        <Col xs={24} lg={12}>
          <Card title={<Space><CloudDownloadOutlined /> 数据备份</Space>} size="small">
            <Paragraph style={{ color: 'var(--text-secondary)' }}>
              将所有数据导出为 JSON 文件，可用于数据迁移或灾难恢复。（该功能已转至云端控制台）
            </Paragraph>
            <Button type="default" icon={<DownloadOutlined />} onClick={handleBackup} size="large" block>
              备份数据
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<Space><CloudUploadOutlined /> 数据恢复</Space>} size="small">
            <Paragraph style={{ color: 'var(--text-secondary)' }}>
              从备份文件恢复数据。恢复操作会覆盖当前数据。（该功能已转至云端控制台）
            </Paragraph>
            <Upload accept=".json" maxCount={1} beforeUpload={handleRestore} showUploadList={false}>
              <Button type="default" icon={<UploadOutlined />} size="large" block>
                选择备份文件恢复
              </Button>
            </Upload>
          </Card>
        </Col>

        {/* Demo data */}
        <Col xs={24} lg={12}>
          <Card title={<Space><InfoCircleOutlined /> 示例数据</Space>} size="small">
            <Paragraph style={{ color: 'var(--text-secondary)' }}>
              加载预设的酒店保洁产品示例数据，方便快速体验系统功能。
            </Paragraph>
            <Button type="primary" icon={<DatabaseOutlined />} onClick={handleLoadDemo} size="large" block>
              加载示例数据
            </Button>
          </Card>
        </Col>

        {/* Danger zone */}
        <Col xs={24} lg={12}>
          <Card
            title={<Space><DeleteOutlined style={{ color: '#ef4444' }} /> 危险操作</Space>}
            size="small"
            style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <Alert
              message="清空所有数据将不可恢复"
              description="云端 SQL 架构下禁止前端任意清库，若要重置系统，请从腾讯云后台重装数据库实例。"
              type="error"
              style={{ marginBottom: 16 }}
            />
            <Button danger icon={<DeleteOutlined />} onClick={handleClear} size="large" block disabled>
              清空所有数据
            </Button>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 16 }}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <Text style={{ color: 'var(--text-muted)' }}>
            酒店保洁产品进销存管理系统 v2.0.0 | 数据存储于腾讯云 CloudBase | Built with React + Ant Design
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
