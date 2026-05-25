// ========================================
// 销售管理 - Sales Management
// ========================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag,
  Card, message, DatePicker, Popconfirm, Typography, Row, Col, Divider, Drawer, Timeline
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, CheckOutlined, SendOutlined,
  EyeOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { salesOrderDB, customerDB, productDB, inventoryDB } from '../../database/db';
import type { SalesOrder, SalesItem, Customer, Product, InventoryRecord } from '../../database/types';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

const { Text } = Typography;
const { RangePicker } = DatePicker;

const SalesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventories, setInventories] = useState<InventoryRecord[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);
  const [form] = Form.useForm();
  const [items, setItems] = useState<SalesItem[]>([]);

  const [searchParams] = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get('search') || '');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const [timelineVisible, setTimelineVisible] = useState(false);
  const [timelineLogs, setTimelineLogs] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [currentTimelineOrder, setCurrentTimelineOrder] = useState<string>('');

  const handleShowTimeline = async (order: SalesOrder) => {
    setCurrentTimelineOrder(order.orderNo);
    setTimelineVisible(true);
    setTimelineLoading(true);
    try {
      const logs = await salesOrderDB.getLogs(order.id);
      setTimelineLogs(logs);
    } catch (e) {
      message.error('获取日志失败');
    } finally {
      setTimelineLoading(false);
    }
  };

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [oData, cData, pData, iData] = await Promise.all([
        salesOrderDB.getAll(),
        customerDB.getAll(),
        productDB.getAll(),
        inventoryDB.getAll(),
      ]);
      setOrders(oData);
      setCustomers(cData);
      setProducts(pData);
      setInventories(iData);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    confirmed: { color: 'processing', text: '已确认' },
    shipped: { color: 'warning', text: '已发货' },
    completed: { color: 'success', text: '已完成' },
    cancelled: { color: 'error', text: '已取消' },
  };

  const paymentMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'error', text: '未收款' },
    partial: { color: 'warning', text: '部分收款' },
    paid: { color: 'success', text: '已收款' },
  };

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(36).substr(2, 9), productId: '', quantity: 1, unitPrice: 0, subtotal: 0 }]);
  };

  const updateItem = (idx: number, field: string, value: unknown) => {
    const newItems = [...items];
    const updatedItem = { ...newItems[idx], [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) updatedItem.unitPrice = product.salePrice;
    }
    
    updatedItem.subtotal = updatedItem.quantity * updatedItem.unitPrice;
    newItems[idx] = updatedItem;
    setItems(newItems);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) { message.error('请添加至少一个产品'); return; }
      if (items.some(i => !i.productId)) { message.error('请选择产品'); return; }

      await salesOrderDB.create({
        customerId: values.customerId,
        orderDate: values.orderDate.format('YYYY-MM-DD HH:mm:ss'),
        totalAmount: totalAmount - (values.discount || 0),
        discount: values.discount || 0,
        status: 'draft',
        paymentStatus: 'pending',
        remark: values.remark || '',
        items,
      });
      message.success('销售单已创建');
      setModalOpen(false);
      form.resetFields();
      setItems([]);
      refreshData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('保存失败: ' + (err.message || '未知错误'));
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await salesOrderDB.update(id, { status: 'confirmed' });
      message.success('销售单已确认');
      refreshData();
    } catch (error: any) {
      message.error('确认失败: ' + (error.message || ''));
    }
  };

  const handleShip = async (id: string) => {
    try {
      await salesOrderDB.confirmShipment(id, '系统');
      message.success('已发货，库存已扣减');
      refreshData();
    } catch (error: any) {
      const errorMsg = error.message || '库存不足';
      if (errorMsg.includes('库存不足')) {
        Modal.error({
          title: '发货失败',
          content: <div style={{ whiteSpace: 'pre-line' }}>{errorMsg}</div>,
        });
      } else {
        message.error('发货失败: ' + errorMsg);
      }
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await salesOrderDB.update(id, { status: 'completed', paymentStatus: 'paid' });
      message.success('订单已完成');
      refreshData();
    } catch (error: any) {
      message.error('完成失败: ' + (error.message || ''));
    }
  };

  const handleCancel = async (record: SalesOrder) => {
    try {
      if (record.status === 'draft') {
        await salesOrderDB.delete(record.id);
        message.info('草稿已删除');
      } else {
        await salesOrderDB.update(record.id, { status: 'cancelled' });
        message.info('销售单已取消');
      }
      refreshData();
    } catch (error: any) {
      message.error('取消失败: ' + (error.message || ''));
    }
  };

  const handlePayment = async (id: string, status: string) => {
    try {
      await salesOrderDB.update(id, { paymentStatus: status as any });
      message.success('收款状态已更新');
      refreshData();
    } catch (error: any) {
      message.error('更新收款失败: ' + (error.message || ''));
    }
  };

  const columns = [
    {
      title: '销售单号',
      dataIndex: 'orderNo',
      width: 160,
      sorter: (a: any, b: any) => a.orderNo.localeCompare(b.orderNo),
      render: (no: string, record: SalesOrder) => <a onClick={() => handleShowTimeline(record)} style={{ fontFamily: 'monospace', color: 'var(--primary-color)' }}>{no}</a>,
    },
    {
      title: '客户',
      dataIndex: 'customerId',
      width: 180,
      sorter: (a: any, b: any) => {
        const cA = customers.find(c => c.id === a.customerId)?.name || '';
        const cB = customers.find(c => c.id === b.customerId)?.name || '';
        return cA.localeCompare(cB);
      },
      render: (id: string) => customers.find(c => c.id === id)?.name || '—',
    },
    { 
      title: '日期', 
      dataIndex: 'orderDate', 
      width: 170,
      sorter: (a: any, b: any) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '金额',
      dataIndex: 'totalAmount',
      width: 120,
      sorter: (a: any, b: any) => Number(a.totalAmount) - Number(b.totalAmount),
      render: (v: number) => <Text strong style={{ color: '#22c55e' }}>¥{Number(v).toFixed(2)}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>,
    },
    {
      title: '收款',
      dataIndex: 'paymentStatus',
      width: 90,
      render: (s: string) => <Tag color={paymentMap[s]?.color}>{paymentMap[s]?.text}</Tag>,
    },
    {
      title: '操作',
      width: 240,
      render: (_: unknown, record: SalesOrder) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailOrder(record)}>查看</Button>
          {record.status === 'draft' && (
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleConfirm(record.id)}>确认</Button>
          )}
          {record.status === 'confirmed' && (
            <Button size="small" style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}
              icon={<SendOutlined />} onClick={() => handleShip(record.id)}>发货</Button>
          )}
          {record.status === 'shipped' && (
            <Button size="small" style={{ background: '#22c55e', borderColor: '#22c55e', color: '#fff' }}
              icon={<DollarOutlined />} onClick={() => handleComplete(record.id)}>完成</Button>
          )}
          {record.status !== 'cancelled' && record.status !== 'completed' && record.paymentStatus !== 'paid' && (
            <Select
              size="small"
              value={record.paymentStatus}
              style={{ width: 100 }}
              onChange={(v) => handlePayment(record.id, v)}
              options={[
                { value: 'pending', label: '未收款' },
                { value: 'partial', label: '部分收款' },
                { value: 'paid', label: '已收款' },
              ]}
            />
          )}
          {(record.status === 'draft' || record.status === 'confirmed') && (
            <Popconfirm title="确定取消?" onConfirm={() => handleCancel(record)}>
              <Button size="small" danger>取消</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card size="small">
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            form.resetFields();
            form.setFieldsValue({ orderDate: dayjs(), discount: 0 });
            setItems([]);
            setModalOpen(true);
          }}>
            新建销售单
          </Button>
        </Space>
        <Space>
          <RangePicker 
            onChange={(dates) => setDateRange(dates as any)} 
            allowClear 
          />
          <Input.Search
            placeholder="搜索单号/客户名称"
            allowClear
            style={{ width: 250 }}
            value={searchText}
            onSearch={setSearchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </Space>
      </Space>

      <Table
        loading={loading}
        dataSource={[...orders]
          .filter(o => {
            if (searchText) {
              const customer = customers.find(c => c.id === o.customerId)?.name || '';
              if (!o.id.includes(searchText) && !customer.includes(searchText)) return false;
            }
            if (dateRange && dateRange[0] && dateRange[1]) {
              if (!dayjs(o.orderDate).isBetween(dateRange[0], dateRange[1], 'day', '[]')) return false;
            }
            return true;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ defaultPageSize: 15, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 1100 }}
      />

      {/* Create Modal */}
      <Modal
        title="新建销售单"
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="customerId" label="客户" rules={[{ required: true }]}>
                <Select placeholder="选择客户">
                  {customers.map(c => (
                    <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="orderDate" label="销售日期" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="discount" label="折扣金额">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="remark" label="备注">
                <Input placeholder="备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider>销售明细</Divider>

        <Table
          dataSource={items}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            {
              title: '产品',
              dataIndex: 'productId',
              width: 200,
              render: (v: string, _: unknown, idx: number) => {
                const sortedProducts = [...products].sort((a, b) => {
                  const invA = inventories.find(i => i.productId === a.id) as any;
                  const qtyA = invA?.quantity ?? invA?.currentQty ?? 0;
                  const isLowA = qtyA <= a.minStock;

                  const invB = inventories.find(i => i.productId === b.id) as any;
                  const qtyB = invB?.quantity ?? invB?.currentQty ?? 0;
                  const isLowB = qtyB <= b.minStock;

                  if (isLowA && !isLowB) return -1;
                  if (!isLowA && isLowB) return 1;
                  return a.name.localeCompare(b.name);
                });

                return (
                  <Select
                    value={v || undefined}
                    placeholder="选择产品"
                    style={{ width: '100%' }}
                    onChange={(val) => updateItem(idx, 'productId', val)}
                    showSearch
                    optionFilterProp="title"
                  >
                    {sortedProducts.map(p => {
                      const inv = inventories.find(i => i.productId === p.id) as any;
                      const qty = inv?.quantity ?? inv?.currentQty ?? 0;
                      const isLowStock = qty <= p.minStock;
                      const titleText = `${p.name} (${p.sku}) (库存:${qty})`;
                      
                      return (
                        <Select.Option key={p.id} value={p.id} title={titleText}>
                          <div style={{ color: isLowStock ? '#ef4444' : 'inherit', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{titleText}</span>
                            {isLowStock && <span style={{ fontSize: '0.85em', color: '#ef4444' }}>库存预警</span>}
                          </div>
                        </Select.Option>
                      );
                    })}
                  </Select>
                );
              },
            },
            {
              title: '数量',
              dataIndex: 'quantity',
              width: 100,
              render: (v: number, _: unknown, idx: number) => (
                <InputNumber min={1} value={v} onChange={(val) => updateItem(idx, 'quantity', val || 1)} style={{ width: '100%' }} />
              ),
            },
            {
              title: '单价',
              dataIndex: 'unitPrice',
              width: 100,
              render: (v: number, _: unknown, idx: number) => (
                <InputNumber min={0} precision={2} value={v} onChange={(val) => updateItem(idx, 'unitPrice', val || 0)} style={{ width: '100%' }} />
              ),
            },
            {
              title: '小计',
              dataIndex: 'subtotal',
              width: 100,
              render: (v: number) => <Text strong>¥{v.toFixed(2)}</Text>,
            },
            {
              title: '',
              width: 40,
              render: (_: unknown, __: unknown, idx: number) => (
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
              ),
            },
          ]}
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>添加产品</Button>
              <Text strong style={{ fontSize: 16, color: '#22c55e' }}>合计: ¥{totalAmount.toFixed(2)}</Text>
            </div>
          )}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`销售单详情 - ${detailOrder?.orderNo}`}
        open={!!detailOrder}
        onCancel={() => setDetailOrder(null)}
        footer={null}
        width={700}
      >
        {detailOrder && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Text type="secondary">客户：</Text>{customers.find(c => c.id === detailOrder.customerId)?.name}</Col>
              <Col span={8}><Text type="secondary">日期：</Text>{detailOrder.orderDate}</Col>
              <Col span={4}><Text type="secondary">状态：</Text><Tag color={statusMap[detailOrder.status]?.color}>{statusMap[detailOrder.status]?.text}</Tag></Col>
              <Col span={4}><Text type="secondary">收款：</Text><Tag color={paymentMap[detailOrder.paymentStatus]?.color}>{paymentMap[detailOrder.paymentStatus]?.text}</Tag></Col>
            </Row>
            <Table
              dataSource={detailOrder.items}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: '产品', dataIndex: 'productId', render: (id: string) => products.find(p => p.id === id)?.name || '—' },
                { title: '数量', dataIndex: 'quantity' },
                { title: '单价', dataIndex: 'unitPrice', render: (v: number) => `¥${Number(v).toFixed(2)}` },
                { title: '小计', dataIndex: 'subtotal', render: (v: number) => <Text strong>¥{Number(v).toFixed(2)}</Text> },
              ]}
            />
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              {detailOrder.discount > 0 && <div><Text type="secondary">折扣: -¥{Number(detailOrder.discount).toFixed(2)}</Text></div>}
              <Text strong style={{ fontSize: 16 }}>合计: ¥{Number(detailOrder.totalAmount).toFixed(2)}</Text>
            </div>
          </div>
        )}
      </Modal>

      <Drawer
        title={`订单动态: ${currentTimelineOrder}`}
        placement="right"
        onClose={() => setTimelineVisible(false)}
        open={timelineVisible}
        width={400}
      >
        <Timeline
          pending={timelineLoading ? '加载中...' : false}
          items={timelineLogs.map(log => ({
            color: log.action === 'create' ? 'green' : 'blue',
            children: (
              <>
                <div style={{ marginBottom: 4 }}>
                  <Text strong>{log.detail}</Text>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  <Space>
                    <span>{log.operator}</span>
                    <span>{dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
                  </Space>
                </div>
              </>
            )
          }))}
        />
        {!timelineLoading && timelineLogs.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-secondary)' }}>
            暂无历史动态
          </div>
        )}
      </Drawer>
    </Card>
  );
};

export default SalesPage;
