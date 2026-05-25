// ========================================
// 采购管理 - Purchase Management
// ========================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag,
  Card, message, DatePicker, Popconfirm, Typography, Row, Col, Divider, Drawer, Timeline
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, CheckOutlined, InboxOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { purchaseOrderDB, supplierDB, productDB, inventoryDB } from '../../database/db';
import type { PurchaseOrder, PurchaseItem, Supplier, Product } from '../../database/types';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

const { Text } = Typography;
const { RangePicker } = DatePicker;

const PurchasePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventories, setInventories] = useState<any[]>([]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null);
  const [form] = Form.useForm();
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [searchParams] = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get('search') || '');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const [timelineVisible, setTimelineVisible] = useState(false);
  const [timelineLogs, setTimelineLogs] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [currentTimelineOrder, setCurrentTimelineOrder] = useState<string>('');

  const handleShowTimeline = async (order: PurchaseOrder) => {
    setCurrentTimelineOrder(order.orderNo);
    setTimelineVisible(true);
    setTimelineLoading(true);
    try {
      const logs = await purchaseOrderDB.getLogs(order.id);
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
      const [oData, sData, pData, iData] = await Promise.all([
        purchaseOrderDB.getAll(),
        supplierDB.getAll(),
        productDB.getAll(),
        inventoryDB.getAll(),
      ]);
      setOrders(oData);
      setSuppliers(sData);
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
    received: { color: 'success', text: '已入库' },
    cancelled: { color: 'error', text: '已取消' },
  };

  // Add item row
  const addItem = () => {
    setItems([...items, { id: Math.random().toString(36).substr(2, 9), productId: '', quantity: 1, unitPrice: 0, subtotal: 0 }]);
  };

  const updateItem = (idx: number, field: string, value: unknown) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;
    
    // Auto-fill price when product selected
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[idx].unitPrice = product.purchasePrice;
      }
    }
    
    // Recalculate subtotal
    newItems[idx].subtotal = newItems[idx].quantity * newItems[idx].unitPrice;
    setItems(newItems);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Save order
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        message.error('请添加至少一个产品');
        return;
      }
      if (items.some(i => !i.productId)) {
        message.error('请选择产品');
        return;
      }

      await purchaseOrderDB.create({
        supplierId: values.supplierId,
        orderDate: values.orderDate.format('YYYY-MM-DD HH:mm:ss'),
        totalAmount,
        status: 'draft',
        remark: values.remark || '',
        items,
      });

      message.success('采购单已创建');
      setModalOpen(false);
      form.resetFields();
      setItems([]);
      refreshData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('保存失败: ' + (err.message || '未知错误'));
    }
  };

  // Confirm order
  const handleConfirm = async (id: string) => {
    try {
      await purchaseOrderDB.update(id, { status: 'confirmed' });
      message.success('采购单已确认');
      refreshData();
    } catch (error: any) {
      message.error('确认失败: ' + (error.message || ''));
    }
  };

  // Receive / enter stock
  const handleReceive = async (id: string) => {
    try {
      await purchaseOrderDB.confirmReceipt(id, '系统');
      message.success('已入库，库存已更新');
      refreshData();
    } catch (error: any) {
      message.error('入库失败: ' + (error.message || ''));
    }
  };

  const handleCancel = async (record: PurchaseOrder) => {
    try {
      if (record.status === 'draft') {
        await purchaseOrderDB.delete(record.id);
        message.info('草稿已删除');
      } else {
        await purchaseOrderDB.update(record.id, { status: 'cancelled' });
        message.info('采购单已取消');
      }
      refreshData();
    } catch (error: any) {
      message.error('取消失败: ' + (error.message || ''));
    }
  };

  const columns = [
    {
      title: '采购单号',
      dataIndex: 'orderNo',
      width: 160,
      sorter: (a: any, b: any) => a.orderNo.localeCompare(b.orderNo),
      render: (no: string, record: PurchaseOrder) => <a onClick={() => handleShowTimeline(record)} style={{ fontFamily: 'monospace', color: 'var(--primary-color)' }}>{no}</a>,
    },
    {
      title: '供应商',
      dataIndex: 'supplierId',
      width: 180,
      sorter: (a: any, b: any) => {
        const sA = suppliers.find(s => s.id === a.supplierId)?.name || '';
        const sB = suppliers.find(s => s.id === b.supplierId)?.name || '';
        return sA.localeCompare(sB);
      },
      render: (id: string) => suppliers.find(s => s.id === id)?.name || '—',
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
      render: (v: number) => <Text strong style={{ color: '#f59e0b' }}>¥{Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 200,
      render: (text: string) => <Text type="secondary" ellipsis={{ tooltip: text }}>{text || '—'}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: string) => {
        const st = statusMap[s] || { color: 'default', text: s };
        return <Tag color={st.color}>{st.text}</Tag>;
      },
    },
    {
      title: '操作',
      width: 180,
      render: (_: unknown, record: PurchaseOrder) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailOrder(record)}>
            查看
          </Button>
          {record.status === 'draft' && (
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleConfirm(record.id)}>
              确认
            </Button>
          )}
          {record.status === 'confirmed' && (
            <Button size="small" style={{ background: '#22c55e', borderColor: '#22c55e', color: '#fff' }}
              icon={<InboxOutlined />} onClick={() => handleReceive(record.id)}>
              入库
            </Button>
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
            form.setFieldsValue({ orderDate: dayjs() });
            setItems([]);
            setModalOpen(true);
          }}>
            新建采购单
          </Button>
        </Space>
        <Space>
          <RangePicker 
            onChange={(dates) => setDateRange(dates as any)} 
            allowClear 
          />
          <Input.Search
            placeholder="搜索单号/供应商名称"
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
              const supplier = suppliers.find(s => s.id === o.supplierId)?.name || '';
              if (!o.id.includes(searchText) && !supplier.includes(searchText)) return false;
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
      />

      {/* Create Modal */}
      <Modal
        title="新建采购单"
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
              <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}>
                <Select placeholder="选择供应商">
                  {suppliers.map(s => (
                    <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="orderDate" label="采购日期" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="remark" label="备注">
                <Input placeholder="备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider>采购明细</Divider>
        
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
              <Text strong style={{ fontSize: 16, color: '#f59e0b' }}>合计: ¥{totalAmount.toFixed(2)}</Text>
            </div>
          )}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`采购单详情 - ${detailOrder?.orderNo}`}
        open={!!detailOrder}
        onCancel={() => setDetailOrder(null)}
        footer={null}
        width={700}
      >
        {detailOrder && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Text type="secondary">供应商：</Text>{suppliers.find(s => s.id === detailOrder.supplierId)?.name}</Col>
              <Col span={8}><Text type="secondary">日期：</Text>{detailOrder.orderDate}</Col>
              <Col span={8}><Text type="secondary">状态：</Text><Tag color={statusMap[detailOrder.status]?.color}>{statusMap[detailOrder.status]?.text}</Tag></Col>
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
              <Text strong style={{ fontSize: 16 }}>合计: ¥{Number(detailOrder.totalAmount).toFixed(2)}</Text>
            </div>
            {detailOrder.remark && <div style={{ marginTop: 8 }}><Text type="secondary">备注: {detailOrder.remark}</Text></div>}
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

export default PurchasePage;
