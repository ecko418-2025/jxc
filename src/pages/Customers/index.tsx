// ========================================
// 客户管理 - Customer (Hotel) Management
// ========================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Card, Space, Tag, message,
  Popconfirm, Typography, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PhoneOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { customerDB } from '../../database/db';
import type { Customer } from '../../database/types';

const { Text } = Typography;

const levelColors: Record<string, string> = {
  '普通': 'default',
  '银牌': '#a0aec0',
  '金牌': 'gold',
  'VIP': '#a855f7',
};

const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form] = Form.useForm();

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await customerDB.getAll();
      setCustomers(data);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // Fix null constraints
      values.address = values.address || '';
      values.creditLimit = values.creditLimit ? Number(values.creditLimit) : 0;
      values.remark = values.remark || '';

      if (editing) {
        await customerDB.update(editing.id, values);
        message.success('客户信息已更新');
      } else {
        await customerDB.create(values);
        message.success('客户已添加');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      refreshData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('操作失败: ' + (err.message || ''));
    }
  };

  const handleEdit = (item: Customer) => {
    setEditing(item);
    form.setFieldsValue(item);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await customerDB.delete(id);
      message.success('客户已删除');
      refreshData();
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || ''));
    }
  };

  return (
    <Card size="small">
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ level: '普通' });
            setModalOpen(true);
          }}>
            新增客户
          </Button>
        </Space>
        <Space>
          <Input.Search
            placeholder="搜索酒店名称/联系人/电话"
            allowClear
            style={{ width: 250 }}
            onSearch={setSearchText}
            onChange={e => !e.target.value && setSearchText('')}
          />
          <Text style={{ color: 'var(--text-muted)' }}>共 {customers.length} 个客户</Text>
        </Space>
      </Space>

      <Table
        loading={loading}
        dataSource={customers.filter(c => {
          if (!searchText) return true;
          return c.name.includes(searchText) || c.contact.includes(searchText) || c.phone.includes(searchText);
        })}
        rowKey="id"
        size="small"
        pagination={{ defaultPageSize: 15, showSizeChanger: true }}
        columns={[
          {
            title: '酒店名称',
            dataIndex: 'name',
            width: 200,
            render: (v: string, record: Customer) => (
              <a onClick={() => navigate(`/sales?search=${encodeURIComponent(v)}`)}>
                <Text strong style={{ color: '#6366f1' }}>{v}</Text>
              </a>
            ),
          },
          {
            title: '等级',
            dataIndex: 'level',
            width: 90,
            render: (level: string) => (
              <Tag color={levelColors[level] || 'default'} icon={level === 'VIP' ? <CrownOutlined /> : undefined}>
                {level}
              </Tag>
            ),
          },
          { title: '联系人', dataIndex: 'contact', width: 100 },
          {
            title: '电话',
            dataIndex: 'phone',
            width: 140,
            render: (v: string) => <Space><PhoneOutlined style={{ color: 'var(--text-muted)' }} />{v}</Space>,
          },
          { title: '地址', dataIndex: 'address', width: 250, ellipsis: true },
          {
            title: '操作',
            width: 100,
            render: (_: unknown, record: Customer) => (
              <Space>
                <Tooltip title="编辑">
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                </Tooltip>
                <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? '编辑客户' : '新增客户'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="酒店名称" rules={[{ required: true }]}>
            <Input placeholder="酒店名称" />
          </Form.Item>
          <Form.Item name="level" label="客户等级" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="普通">普通</Select.Option>
              <Select.Option value="银牌">银牌</Select.Option>
              <Select.Option value="金牌">金牌</Select.Option>
              <Select.Option value="VIP">VIP</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="contact" label="联系人" rules={[{ required: true }]}>
            <Input placeholder="联系人" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true }]}>
            <Input placeholder="电话号码" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input.TextArea rows={2} placeholder="地址" />
          </Form.Item>
          <Form.Item name="creditLimit" label="信用额度">
            <Input type="number" placeholder="信用额度（元）" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default CustomersPage;
