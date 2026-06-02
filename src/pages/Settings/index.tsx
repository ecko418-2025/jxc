// ========================================
// 系统设置 - Settings
// ========================================

import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Statistic, Button, message, Space, Upload, Alert, Modal, Spin, Table, Tag } from 'antd';
import {
  DownloadOutlined, UploadOutlined, DeleteOutlined,
  DatabaseOutlined, ExclamationCircleOutlined,
  CloudDownloadOutlined, CloudUploadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { productDB, categoryDB, supplierDB, customerDB, salesOrderDB, purchaseOrderDB, auditDB } from '../../database/db';
import { seedDemoData } from '../../database/seed';
import { exportAllToExcel, restoreFromExcel } from '../../utils/excel';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
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
        const [prods, cats, supps, custs, sales, purch, auditLogs] = await Promise.all([
          productDB.getAll(),
          categoryDB.getAll(),
          supplierDB.getAll(),
          customerDB.getAll(),
          salesOrderDB.getAll(),
          purchaseOrderDB.getAll(),
          auditDB.getList().catch(() => [])
        ]);
        setStats({
          products: prods.length,
          categories: cats.length,
          suppliers: supps.length,
          customers: custs.length,
          salesOrders: sales.length,
          purchaseOrders: purch.length,
        });
        setLogs(auditLogs);
        setProductsList(prods);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Backup data
  const handleBackup = async () => {
    try {
      message.loading({ content: '正在生成备份文件，请稍候...', key: 'backup' });
      await exportAllToExcel();
      message.success({ content: '数据备份成功！', key: 'backup' });
    } catch (err: any) {
      message.error({ content: '备份失败: ' + (err.message || ''), key: 'backup' });
    }
  };

  // Restore data
  const handleRestore = async (file: File) => {
    Modal.confirm({
      title: '确认恢复数据？',
      content: `确定要从 ${file.name} 恢复数据吗？这可能会覆盖当前数据库中编码或名称相同的记录。此操作不可逆！`,
      icon: <ExclamationCircleOutlined />,
      okText: '确认导入',
      cancelText: '取消',
      async onOk() {
        try {
          message.loading({ content: '正在恢复数据，这可能需要一些时间...', key: 'restore', duration: 0 });
          const logs = await restoreFromExcel(file);
          message.destroy('restore');
          Modal.success({
            title: '数据恢复成功',
            content: (
              <div>
                <p>恢复操作已完成，以下是处理结果：</p>
                <ul>
                  {logs.map((log, i) => <li key={i}>{log}</li>)}
                </ul>
              </div>
            ),
            onOk() {
              window.location.reload();
            }
          });
        } catch (err: any) {
          message.error({ content: '恢复失败: ' + (err.message || ''), key: 'restore' });
        }
      }
    });
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


  const columns = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 150,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '操作动作',
      dataIndex: 'action_type',
      key: 'action_type',
      width: 150,
      render: (text: string) => {
        const actionMap: Record<string, string> = {
          'createSalesOrder': '新建销售单',
          'updateSalesOrder': '修改销售单',
          'deleteSalesOrder': '删除销售单',
          'confirmSalesOrder': '确认出库',
          'createPurchaseOrder': '新建采购单',
          'updatePurchaseOrder': '修改采购单',
          'deletePurchaseOrder': '删除采购单',
          'confirmPurchaseOrder': '确认入库',
          'createProduct': '添加产品',
          'updateProduct': '修改产品',
          'deleteProduct': '删除产品',
          'adjustInventoryStock': '库存调整',
          'createCategory': '添加分类',
          'updateCategory': '修改分类',
          'deleteCategory': '删除分类',
          'createSupplier': '添加供应商',
          'createCustomer': '添加客户'
        };
        return <Tag color="cyan">{actionMap[text] || text}</Tag>;
      }
    },
    {
      title: '详细说明',
      dataIndex: 'message',
      key: 'message',
      render: (text: string, record: any) => {
        const id = record.payload?.id || record.payload?.productId;
        
        // Handle legacy un-translated text
        let displayMsg = text;
        if (text === '执行了操作: adjustInventoryStock') displayMsg = '执行了操作: 库存调整';
        
        let displayId = id;
        if (id) {
          const product = productsList.find(p => p.id === id);
          if (product) {
            displayId = `[${product.code}] ${product.name}`;
          }
        }
        
        return (
          <Space direction="vertical" size="small">
            <Text strong>{displayMsg}</Text>
            {id && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                关联单据/商品: {displayId}
              </Text>
            )}
          </Space>
        );
      }
    }
  ];

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
              用 Excel 的形式备份数据库里所有的品类、产品、客户、供应商四个核心大表。
            </Paragraph>
            <Button type="default" icon={<DownloadOutlined />} onClick={handleBackup} size="large" block>
              备份数据
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<Space><CloudUploadOutlined /> 数据恢复</Space>} size="small">
            <Paragraph style={{ color: 'var(--text-secondary)' }}>
              上传修改后的 Excel 备份文件进行数据恢复。匹配到的数据会被自动覆盖更新，新数据会被添加。
            </Paragraph>
        <Upload accept=".xlsx" showUploadList={false} beforeUpload={() => false} onChange={(info) => {
          if (info.fileList.length > 0) {
            handleRestore(info.fileList[0].originFileObj as File);
          }
        }}>
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


        {/* System Security Log */}
        <Col xs={24}>
          <Card 
            title={<Space><DatabaseOutlined style={{ color: '#10b981' }} /> 系统安全日志</Space>} 
            size="small"
            style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
          >
            <Alert
              message="日志自动记录所有的核心写入操作，用于后续安全审计和行为追溯。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              dataSource={logs}
              columns={columns}
              rowKey="id"
              pagination={{ defaultPageSize: 10, showSizeChanger: true }}
              scroll={{ x: 800 }}
              size="small"
            />
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
