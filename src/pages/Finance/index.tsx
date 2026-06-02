// ========================================
// 财务管理 - Finance Management
// ========================================

import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Tabs, Tag, message, Button, Modal, Form, InputNumber, Select, DatePicker, Row, Col, Space, Input } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { financeLedgerDB, customerDB, supplierDB, salesOrderDB, purchaseOrderDB } from '../../database/db';
import type { FinanceLedger, Customer, Supplier, SalesOrder, PurchaseOrder } from '../../database/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function Finance() {
  const [activeTab, setActiveTab] = useState('receivable');
  
  const [ledgers, setLedgers] = useState<FinanceLedger[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const refreshData = async () => {
    setLoading(true);
    try {
      const [l, c, s, so, po] = await Promise.all([
        financeLedgerDB.getAll(),
        customerDB.getAll(),
        supplierDB.getAll(),
        salesOrderDB.getAll(),
        purchaseOrderDB.getAll()
      ]);
      setLedgers(l);
      setCustomers(c);
      setSuppliers(s);
      setSalesOrders(so);
      setPurchaseOrders(po);
    } catch (e: any) {
      message.error('加载财务数据失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleDeleteLedger = async (id: string) => {
    try {
      await financeLedgerDB.delete(id);
      message.success('删除流水成功，订单已收款金额已自动回退');
      refreshData();
    } catch (e: any) {
      message.error('删除流水失败: ' + e.message);
    }
  };

  // -------------------------
  // 应收账款 (AR)
  // -------------------------
  const getARData = () => {
    return customers.map(c => {
      const cOrders = salesOrders.filter(o => o.customerId === c.id && o.status !== 'cancelled' && o.status !== 'draft');
      const totalOrdered = cOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const totalPaid = cOrders.reduce((sum, o) => sum + Number(o.paidAmount || 0), 0);
      const balance = totalOrdered - totalPaid;
      return {
        ...c,
        totalOrdered,
        totalPaid,
        balance,
        ordersCount: cOrders.length
      };
    }).filter(c => 
      c.name.toLowerCase().includes(searchText.toLowerCase()) || 
      c.balance > 0
    );
  };

  // -------------------------
  // 应付账款 (AP)
  // -------------------------
  const getAPData = () => {
    return suppliers.map(s => {
      const sOrders = purchaseOrders.filter(o => o.supplierId === s.id && o.status !== 'cancelled' && o.status !== 'draft');
      const totalOrdered = sOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const totalPaid = sOrders.reduce((sum, o) => sum + Number(o.paidAmount || 0), 0);
      const balance = totalOrdered - totalPaid;
      return {
        ...s,
        totalOrdered,
        totalPaid,
        balance,
        ordersCount: sOrders.length
      };
    }).filter(s => 
      s.name.toLowerCase().includes(searchText.toLowerCase()) || 
      s.balance > 0
    );
  };

  const getLedgerData = () => {
    return ledgers.filter(l => {
      const party = l.type === 'income' 
        ? customers.find(c => c.id === l.partyId) 
        : suppliers.find(s => s.id === l.partyId);
      return (party?.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
             (l.remark || '').toLowerCase().includes(searchText.toLowerCase());
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>财务管理</Title>
        <Input.Search 
          placeholder="搜索客户/供应商/备注" 
          allowClear 
          onSearch={setSearchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 300 }} 
        />
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="应收账款 (客户)" key="receivable">
            <Table
              dataSource={getARData()}
              rowKey="id"
              loading={loading}
              columns={[
                { title: '客户名称', dataIndex: 'name', key: 'name', render: (t) => <Text strong>{t}</Text> },
                { title: '联系人', dataIndex: 'contact', key: 'contact' },
                { title: '有效单据数', dataIndex: 'ordersCount', key: 'ordersCount' },
                { title: '历史总订货额', dataIndex: 'totalOrdered', key: 'totalOrdered', render: (v) => `¥${Number(v).toFixed(2)}` },
                { title: '历史总已收款', dataIndex: 'totalPaid', key: 'totalPaid', render: (v) => <Text type="success">¥{Number(v).toFixed(2)}</Text> },
                { title: '当前欠款', dataIndex: 'balance', key: 'balance', render: (v, record) => (
                  <Text strong type={v > 0 ? 'danger' : 'secondary'} style={{ color: v > (record.creditLimit || 9999999) ? '#dc2626' : undefined }}>
                    ¥{Number(v).toFixed(2)}
                  </Text>
                ) },
                { title: '信用额度', dataIndex: 'creditLimit', key: 'creditLimit', render: (v) => v ? `¥${v}` : '无限制' },
              ]}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="应付账款 (供应商)" key="payable">
            <Table
              dataSource={getAPData()}
              rowKey="id"
              loading={loading}
              columns={[
                { title: '供应商名称', dataIndex: 'name', key: 'name', render: (t) => <Text strong>{t}</Text> },
                { title: '联系人', dataIndex: 'contact', key: 'contact' },
                { title: '有效采购单数', dataIndex: 'ordersCount', key: 'ordersCount' },
                { title: '历史总采购额', dataIndex: 'totalOrdered', key: 'totalOrdered', render: (v) => `¥${Number(v).toFixed(2)}` },
                { title: '历史总已付款', dataIndex: 'totalPaid', key: 'totalPaid', render: (v) => <Text type="warning">¥{Number(v).toFixed(2)}</Text> },
                { title: '当前欠款', dataIndex: 'balance', key: 'balance', render: (v) => <Text strong type={v > 0 ? 'danger' : 'secondary'}>¥{Number(v).toFixed(2)}</Text> },
              ]}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="资金流水" key="ledger">
            <Table
              dataSource={getLedgerData()}
              rowKey="id"
              loading={loading}
              columns={[
                { title: '日期', dataIndex: 'paymentDate', key: 'paymentDate', render: (v) => dayjs(v).format('YYYY-MM-DD') },
                { title: '类型', dataIndex: 'type', key: 'type', render: (v) => (
                  <Tag color={v === 'income' ? 'green' : 'orange'}>{v === 'income' ? '收款 (应收)' : '付款 (应付)'}</Tag>
                ) },
                { title: '关联客商', dataIndex: 'partyId', key: 'partyId', render: (v, r) => {
                  if (r.type === 'income') return customers.find(c => c.id === v)?.name || '未知客户';
                  return suppliers.find(s => s.id === v)?.name || '未知供应商';
                } },
                { title: '关联订单', dataIndex: 'orderId', key: 'orderId', render: (v, r) => {
                  if (!v) return '—';
                  if (r.type === 'income') return salesOrders.find(o => o.id === v)?.orderNo || v;
                  return purchaseOrders.find(o => o.id === v)?.orderNo || v;
                } },
                { title: '金额', dataIndex: 'amount', key: 'amount', render: (v, r) => (
                  <Text strong style={{ color: r.type === 'income' ? '#22c55e' : '#f59e0b' }}>
                    {r.type === 'income' ? '+' : '-'}¥{Number(v).toFixed(2)}
                  </Text>
                ) },
                { title: '支付方式', dataIndex: 'paymentMethod', key: 'paymentMethod', render: (v) => {
                  const map: any = { wechat: '微信', alipay: '支付宝', bank: '银行转账', cash: '现金' };
                  return map[v] || v;
                } },
                { title: '备注', dataIndex: 'remark', key: 'remark' },
                { title: '经办人', dataIndex: 'createdBy', key: 'createdBy' },
                { title: '操作', key: 'action', render: (_, r) => (
                  <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteLedger(r.id)}>
                    撤销
                  </Button>
                ) },
              ]}
            />
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
