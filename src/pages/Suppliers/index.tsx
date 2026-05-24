// ========================================
// 供应商管理 - Supplier Management
// ========================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Card, Space, message,
  Popconfirm, Typography, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PhoneOutlined } from '@ant-design/icons';
import { supplierDB } from '../../database/db';
import type { Supplier } from '../../database/types';

const { Text } = Typography;

const SuppliersPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form] = Form.useForm();

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await supplierDB.getAll();
      setSuppliers(data);
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
      if (editing) {
        await supplierDB.update(editing.id, values);
        message.success('供应商已更新');
      } else {
        await supplierDB.create(values);
        message.success('供应商已添加');
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

  const handleEdit = (item: Supplier) => {
    setEditing(item);
    form.setFieldsValue(item);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await supplierDB.delete(id);
      message.success('供应商已删除');
      refreshData();
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || ''));
    }
  };

  return (
    <Card size="small">
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditing(null);
          form.resetFields();
          setModalOpen(true);
        }}>
          新增供应商
        </Button>
      </Space>

      <Table
        loading={loading}
        dataSource={suppliers}
        rowKey="id"
        size="small"
        pagination={{ defaultPageSize: 15, showSizeChanger: true }}
        columns={[
          { title: '供应商名称', dataIndex: 'name', width: 200, render: (v: string) => <Text strong>{v}</Text> },
          { title: '联系人', dataIndex: 'contact', width: 100 },
          {
            title: '电话',
            dataIndex: 'phone',
            width: 140,
            render: (v: string) => <Space><PhoneOutlined style={{ color: 'var(--text-muted)' }} />{v}</Space>,
          },
          { title: '地址', dataIndex: 'address', width: 250, ellipsis: true },
          { title: '开户行/账号', dataIndex: 'bankAccount', width: 200, ellipsis: true },
          {
            title: '操作',
            width: 100,
            render: (_: unknown, record: Supplier) => (
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
        title={editing ? '编辑供应商' : '新增供应商'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="供应商名称" rules={[{ required: true }]}>
            <Input placeholder="供应商名称" />
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
          <Form.Item name="bankAccount" label="开户行及账号">
            <Input placeholder="开户行及账号" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default SuppliersPage;
