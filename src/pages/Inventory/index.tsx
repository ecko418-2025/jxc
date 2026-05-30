// ========================================
// 库存管理 - Inventory Management
// ========================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Card, Tag, Typography, Space, Badge, InputNumber, Button,
  Modal, Tabs, message, Progress, Input,
} from 'antd';
import {
  WarningOutlined, CheckCircleOutlined, EditOutlined,
  HistoryOutlined, AlertOutlined,
} from '@ant-design/icons';
import { inventoryDB, productDB, categoryDB } from '../../database/db';
import type { Product, Category, InventoryRecord } from '../../database/types';
import ProductHistoryModal from '../../components/ProductHistoryModal';

const { Text } = Typography;
const { Search } = Input;

const InventoryPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventories, setInventories] = useState<InventoryRecord[]>([]);
  
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [pData, cData, iData] = await Promise.all([
        productDB.getAll(),
        categoryDB.getAll(),
        inventoryDB.getAll(),
      ]);
      setProducts(pData);
      setCategories(cData);
      setInventories(iData);
    } catch (error: any) {
      message.error(error.message || '加载库存数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const filteredProducts = products.filter(p => {
    if (!searchText) return true;
    return p.name.includes(searchText) || p.sku.includes(searchText);
  });

  const inventoryData = filteredProducts.map(p => {
    const inv = inventories.find(i => i.productId === p.id) as any;
    const cat = categories.find(c => c.id === p.categoryId);
    const qty = inv?.quantity ?? inv?.currentQty ?? 0;
    return {
      ...p,
      categoryName: cat?.name || '—',
      currentQty: qty,
      lastUpdated: inv?.lastUpdated || '—',
      isLow: qty <= p.minStock,
    };
  });

  const displayData = activeTab === 'low' ? inventoryData.filter(i => i.isLow && i.active) : inventoryData;

  const lowStockCount = inventoryData.filter(i => i.isLow && i.active).length;

  const handleAdjust = (product: Product) => {
    const inv = inventories.find(i => i.productId === product.id) as any;
    setSelectedProduct(product);
    setAdjustQty(inv?.quantity ?? inv?.currentQty ?? 0);
    setAdjustModalOpen(true);
  };

  const confirmAdjust = async () => {
    if (selectedProduct) {
      try {
        await inventoryDB.adjustStock(selectedProduct.id, adjustQty, '系统管理员');
        message.success('库存已调整');
        setAdjustModalOpen(false);
        refreshData();
      } catch (error: any) {
        message.error('调整失败: ' + (error.message || ''));
      }
    }
  };

  const showLogs = (product: Product) => {
    setSelectedProduct(product);
    setLogModalOpen(true);
  };

  const columns = [
    {
      title: '编码',
      dataIndex: 'sku',
      width: 100,
      render: (sku: string, record: any) => (
        <a onClick={() => showLogs(record)} style={{ fontFamily: 'monospace', color: 'var(--primary-color)' }}>
          {sku}
        </a>
      ),
    },
    {
      title: '产品名称',
      dataIndex: 'name',
      width: 180,
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
      render: (name: string, record: any) => (
        <Space>
          <Text strong>{name}</Text>
          {record.isLow && record.active && <Badge status="error" />}
        </Space>
      ),
    },
    { 
      title: '品类', 
      dataIndex: 'categoryName', 
      width: 100, 
      sorter: (a: any, b: any) => a.categoryName.localeCompare(b.categoryName),
      render: (v: string) => <Tag>{v}</Tag> 
    },
    { title: '规格', dataIndex: 'spec', width: 90 },
    { title: '单位', dataIndex: 'unit', width: 60 },
    {
      title: '当前库存',
      dataIndex: 'currentQty',
      width: 100,
      sorter: (a: any, b: any) => a.currentQty - b.currentQty,
      render: (qty: number, record: any) => (
        <Text strong style={{ color: record.isLow && record.active ? '#ef4444' : 'var(--text-primary)', fontSize: 15 }}>
          {qty}
        </Text>
      ),
    },
    {
      title: '安全库存',
      dataIndex: 'minStock',
      width: 90,
      render: (v: number) => <Text style={{ color: 'var(--text-muted)' }}>{v}</Text>,
    },
    {
      title: '库存状态',
      width: 120,
      render: (_: unknown, record: any) => {
        if (!record.active) return <Tag>已停用</Tag>;
        const ratio = record.minStock > 0 ? (record.currentQty / record.minStock) * 100 : 100;
        if (ratio <= 0) return <Tag color="error" icon={<WarningOutlined />}>缺货</Tag>;
        if (ratio <= 100) return <Tag color="warning" icon={<AlertOutlined />}>不足</Tag>;
        return <Tag color="success" icon={<CheckCircleOutlined />}>充足</Tag>;
      },
    },
    {
      title: '库存进度',
      width: 100,
      render: (_: unknown, record: any) => {
        if (!record.active || record.minStock === 0) return '—';
        const ratio = Math.min((record.currentQty / record.minStock) * 100, 200);
        return <Progress percent={Math.round(ratio)} size="small" status={ratio <= 100 ? 'exception' : 'normal'} showInfo={false} />;
      },
    },
    {
      title: '操作',
      width: 140,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleAdjust(record)}>
            调整
          </Button>
          <Button size="small" icon={<HistoryOutlined />} onClick={() => showLogs(record)}>
            流水
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'all',
            label: `全部库存 (${inventoryData.length})`,
          },
          {
            key: 'low',
            label: (
              <Space>
                <WarningOutlined style={{ color: '#ef4444' }} />
                库存预警 ({lowStockCount})
              </Space>
            ),
          },
        ]}
      />

      <Card size="small">
        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索产品名称/编码"
            allowClear
            style={{ width: 250 }}
            onSearch={setSearchText}
            onChange={e => !e.target.value && setSearchText('')}
          />
          <Text style={{ color: 'var(--text-muted)' }}>
            共 {displayData.length} 种产品，{lowStockCount} 项库存预警
          </Text>
        </Space>

        <Table
          loading={loading}
          dataSource={displayData}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ defaultPageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1200 }}
          rowClassName={(record) => record.isLow && record.active ? 'low-stock-row' : ''}
        />
      </Card>

      {/* Adjust Modal */}
      <Modal
        title={`库存调整 - ${selectedProduct?.name}`}
        open={adjustModalOpen}
        onOk={confirmAdjust}
        onCancel={() => setAdjustModalOpen(false)}
        okText="确认调整"
        cancelText="取消"
      >
        <div style={{ padding: '16px 0' }}>
          <Text style={{ display: 'block', marginBottom: 8 }}>
            当前库存: <Text strong>
              {(() => {
                const inv = inventories.find(i => i.productId === selectedProduct?.id) as any;
                return inv?.quantity ?? inv?.currentQty ?? 0;
              })()}
            </Text> {selectedProduct?.unit}
          </Text>
          <Text style={{ display: 'block', marginBottom: 16 }}>
            安全库存: <Text>{selectedProduct?.minStock}</Text> {selectedProduct?.unit}
          </Text>
          <div>
            <Text>调整后库存:</Text>
            <InputNumber
              value={adjustQty}
              onChange={(v) => setAdjustQty(v || 0)}
              min={0}
              style={{ width: '100%', marginTop: 8 }}
              size="large"
            />
          </div>
        </div>
      </Modal>

      <ProductHistoryModal
        open={logModalOpen}
        productId={selectedProduct?.id || ''}
        productName={selectedProduct?.name || ''}
        onClose={() => setLogModalOpen(false)}
      />
    </div>
  );
};

export default InventoryPage;
