// ========================================
// 系统设置 - Settings
// ========================================

import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Statistic, Button, message, Space, Upload, Alert, Modal, Spin, Table, Tag, Input, Form, Select, Popconfirm } from 'antd';
import {
  DownloadOutlined, UploadOutlined, DeleteOutlined,
  DatabaseOutlined, ExclamationCircleOutlined,
  CloudDownloadOutlined, CloudUploadOutlined,
  InfoCircleOutlined,
  TeamOutlined, EditOutlined, PlusOutlined
} from '@ant-design/icons';
import { productDB, categoryDB, supplierDB, customerDB, salesOrderDB, purchaseOrderDB, auditDB, userDB } from '../../database/db';
import { seedDemoData } from '../../database/seed';
import { exportAllToExcel, restoreFromExcel } from '../../utils/excel';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
  const role = localStorage.getItem('user_role') || 'pending';
  const [loading, setLoading] = useState(true);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [salesList, setSalesList] = useState<any[]>([]);
  const [purchaseList, setPurchaseList] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [stats, setStats] = useState({
    products: 0,
    categories: 0,
    suppliers: 0,
    customers: 0,
    salesOrders: 0,
    purchaseOrders: 0,
  });

  const [usersList, setUsersList] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm] = Form.useForm();
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const fetchUsers = async () => {
    if (role !== 'admin') return;
    try {
      setUserLoading(true);
      const list = await userDB.getList();
      setUsersList(list);
    } catch (e) {
      console.error('获取成员列表失败:', e);
    } finally {
      setUserLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ role: 'pending' });
    setUserModalOpen(true);
  };

  const handleEditUser = (record: any) => {
    setEditingUser(record);
    userForm.setFieldsValue({
      uid: record.uid,
      username: record.username,
      displayName: record.displayName,
      role: record.role,
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      const values = await userForm.validateFields();
      setUserLoading(true);
      await userDB.saveProfile(values.uid, values.displayName, values.role, values.username || 'user');
      message.success(editingUser ? '成员权限已更新' : '已添加成员授权');
      setUserModalOpen(false);
      fetchUsers();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error('保存失败: ' + (e.message || '未知错误'));
    } finally {
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      setUserLoading(true);
      await userDB.deleteProfile(uid);
      message.success('已取消授权，该账号状态已重置');
      fetchUsers();
    } catch (e: any) {
      message.error('删除失败: ' + (e.message || ''));
    } finally {
      setUserLoading(false);
    }
  };

  const userRoleMap: Record<string, { color: string; label: string }> = {
    admin: { color: 'red', label: '系统管理员' },
    sales: { color: 'blue', label: '销售员' },
    warehouse: { color: 'orange', label: '库管员' },
    finance: { color: 'green', label: '财务员' },
    pending: { color: 'default', label: '待授权' },
  };

  const userColumns = [
    {
      title: '唯一 UID',
      dataIndex: 'uid',
      key: 'uid',
      width: 200,
      render: (text: string) => <Text style={{ fontFamily: 'monospace' }}>{text}</Text>,
    },
    {
      title: '登录账号',
      dataIndex: 'username',
      key: 'username',
      width: 180,
    },
    {
      title: '显示姓名',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 150,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '系统角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (roleVal: string) => {
        const item = userRoleMap[roleVal] || { color: 'default', label: roleVal };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditUser(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认取消该用户的系统授权？"
            description="取消后，该用户下次登录将重新进入待授权拦截页面。"
            onConfirm={() => handleDeleteUser(record.uid)}
            okText="确认"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              取消授权
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const prods = await productDB.getAll().catch(() => []);
        const cats = await categoryDB.getAll().catch(() => []);
        const supps = await supplierDB.getAll().catch(() => []);
        const custs = await customerDB.getAll().catch(() => []);
        const sales = await salesOrderDB.getAll().catch(() => []);
        const purch = await purchaseOrderDB.getAll().catch(() => []);
        const auditLogs = await auditDB.getList().catch(() => []);
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
        setSalesList(sales);
        setPurchaseList(purch);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    fetchUsers();
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



  const getDisplayId = (id: string) => {
    if (!id) return '';
    const product = productsList.find(p => p.id === id);
    if (product) return `[${product.code}] ${product.name}`;
    let displayId = id;
    const sale = salesList.find(s => s.id === id);
    if (sale) {
      displayId = `[${sale.orderNo}]`;
    } else {
      const purch = purchaseList.find(p => p.id === id);
      if (purch) {
        displayId = `[${purch.orderNo}]`;
      }
    }
    return displayId;
  };
  
  const getActionName = (type: string) => {
    const actionMap: Record<string, string> = {
      'createSalesOrder': '新建销售单',
      'updateSalesOrder': '修改销售单',
      'deleteSalesOrder': '删除销售单',
      'confirmSalesOrder': '确认出库',
      'confirmSalesShipment': '确认出库',
      'createPurchaseOrder': '新建采购单',
      'updatePurchaseOrder': '修改采购单',
      'deletePurchaseOrder': '删除采购单',
      'confirmPurchaseOrder': '确认入库',
      'confirmPurchaseReceipt': '确认入库',
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
    return actionMap[type] || type;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchText) return true;
    const lowerSearch = searchText.toLowerCase();
    
    // Check user (including resolved name)
    const uid = log.operator_uid || log.user_name;
    const matchedUser = usersList.find(u => u.uid === uid || u.username === uid);
    if (matchedUser) {
      if (matchedUser.displayName.toLowerCase().includes(lowerSearch)) return true;
      const roleText = userRoleMap[matchedUser.role]?.label || matchedUser.role;
      if (roleText.toLowerCase().includes(lowerSearch)) return true;
    }
    
    if (log.user_name && log.user_name.toLowerCase().includes(lowerSearch)) return true;
    if (log.operator_uid && log.operator_uid.toLowerCase().includes(lowerSearch)) return true;
    
    // Check action
    if (getActionName(log.action_type).toLowerCase().includes(lowerSearch)) return true;
    
    // Check message
    if (log.message && log.message.toLowerCase().includes(lowerSearch)) return true;
    
    // Check display ID
    const id = log.payload?.id || log.payload?.productId;
    if (id) {
      const displayId = getDisplayId(id).toLowerCase();
      if (displayId.includes(lowerSearch)) return true;
    }
    
    return false;
  });

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
      key: 'operator',
      width: 180,
      render: (_: any, record: any) => {
        const uid = record.operator_uid || record.user_name;
        // 优先在成员列表中匹配
        const matchedUser = usersList.find(u => u.uid === uid || u.username === uid);
        if (matchedUser) {
          const roleLabel = userRoleMap[matchedUser.role]?.label || matchedUser.role;
          const roleColor = userRoleMap[matchedUser.role]?.color || 'blue';
          return (
            <Space size={8}>
              <Text strong>{matchedUser.displayName}</Text>
              <Tag color={roleColor} style={{ fontSize: 10, margin: 0 }}>{roleLabel}</Tag>
            </Space>
          );
        }
        
        // 系统级自动任务
        if (uid === 'system') {
          return <Tag color="gold">系统自动</Tag>;
        }

        // 如果是有效名字而不是 ID
        if (record.user_name && record.user_name !== '未知账户' && !/^[a-zA-Z0-9_-]{15,40}$/.test(record.user_name)) {
          return <Text strong>{record.user_name}</Text>;
        }

        // 兜底显示 ID/账号
        return <Text code style={{ fontSize: 11 }}>{uid || '未知操作员'}</Text>;
      }
    },
    {
      title: '操作动作',
      dataIndex: 'action_type',
      key: 'action_type',
      width: 150,
      render: (text: string) => <Tag color="cyan">{getActionName(text)}</Tag>
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
        if (text === '执行了操作: confirmSalesShipment') displayMsg = '执行了操作: 确认销售出库';
        if (text === '执行了操作: confirmPurchaseReceipt') displayMsg = '执行了操作: 确认采购入库';
        
        // Also clean up UUID in the original message if it exists
        if (displayMsg.includes(id)) {
          displayMsg = displayMsg.replace(id, '');
        }

        const displayId = getDisplayId(id);
        return (
          <Space orientation="vertical" size="small">
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
        <Spin size="large" description="正在加载系统状态..." />
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
                <Statistic title="品类" value={stats.categories} styles={{ content: { fontSize: 20, color: 'var(--text-accent)' } }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="产品" value={stats.products} styles={{ content: { fontSize: 20, color: 'var(--text-accent)' } }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="供应商" value={stats.suppliers} styles={{ content: { fontSize: 20, color: 'var(--text-accent)' } }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="客户" value={stats.customers} styles={{ content: { fontSize: 20, color: 'var(--text-accent)' } }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="采购单" value={stats.purchaseOrders} styles={{ content: { fontSize: 20, color: 'var(--text-accent)' } }} />
              </Col>
              <Col xs={8} sm={4}>
                <Statistic title="销售单" value={stats.salesOrders} styles={{ content: { fontSize: 20, color: 'var(--text-accent)' } }} />
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
              title="清空所有数据将不可恢复"
              description="云端 SQL 架构下禁止前端任意清库，若要重置系统，请从腾讯云后台重装数据库实例。"
              type="error"
              style={{ marginBottom: 16 }}
            />
            <Button danger icon={<DeleteOutlined />} onClick={handleClear} size="large" block disabled>
              清空所有数据
            </Button>
          </Card>
        </Col>


        {/* Member Permissions Management */}
        {role === 'admin' && (
          <Col xs={24}>
            <Card
              title={<Space><TeamOutlined style={{ color: '#6366f1' }} /> 成员权限管理</Space>}
              size="small"
              extra={
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddUser}>
                  添加授权
                </Button>
              }
              style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
            >
              <Table
                dataSource={usersList}
                columns={userColumns}
                rowKey="uid"
                pagination={{ defaultPageSize: 10 }}
                scroll={{ x: 800 }}
                size="small"
                loading={userLoading}
              />
            </Card>
          </Col>
        )}

        {/* System Security Log */}
        <Col xs={24}>
          <Card 
            title={<Space><DatabaseOutlined style={{ color: '#10b981' }} /> 系统安全日志</Space>} 
            size="small"
            style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
          >
            <Alert
              title="日志自动记录所有的核心写入操作，用于后续安全审计和行为追溯。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Input.Search
                placeholder="搜索单号、产品名、操作动作、操作人..."
                allowClear
                onSearch={val => setSearchText(val)}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 350 }}
              />
            </div>
            <Table
              dataSource={filteredLogs}
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

      {/* User Edit Modal */}
      <Modal
        title={editingUser ? '编辑成员授权' : '添加成员授权'}
        open={userModalOpen}
        onOk={handleSaveUser}
        onCancel={() => setUserModalOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={userLoading}
      >
        <Form form={userForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="uid"
            label="用户唯一 UID"
            rules={[{ required: true, message: '请输入用户的唯一 UID' }]}
          >
            <Input placeholder="可让用户从待授权页面复制并提供" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="username"
            label="登录账号(邮箱/用户名)"
            rules={[{ required: true, message: '请输入登录账号' }]}
          >
            <Input placeholder="例如: lisi@ecko.com" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="员工真实姓名，将用于安全日志追溯" />
          </Form.Item>
          <Form.Item
            name="role"
            label="系统角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select>
              <Select.Option value="admin">系统管理员</Select.Option>
              <Select.Option value="sales">销售员</Select.Option>
              <Select.Option value="warehouse">库管员</Select.Option>
              <Select.Option value="finance">财务员</Select.Option>
              <Select.Option value="pending">待授权</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SettingsPage;
