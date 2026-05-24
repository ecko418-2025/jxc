// ========================================
// 数据看板 - Dashboard
// ========================================

import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Space, Empty, Progress, Spin } from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  ShopOutlined,
  RiseOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { productDB, customerDB, salesOrderDB, purchaseOrderDB, inventoryDB, supplierDB, categoryDB } from '../../database/db';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Text } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    monthSales: 0,
    pendingOrders: 0,
    pendingPurchase: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    totalCategories: 0,
    lowStockCount: 0,
    lowStockItems: [] as any[],
    topProducts: [] as any[],
    recentSales: [] as any[],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [
          salesOrders,
          purchaseOrders,
          products,
          customers,
          suppliers,
          categories,
          lowStock
        ] = await Promise.all([
          salesOrderDB.getAll(),
          purchaseOrderDB.getAll(),
          productDB.getAll(),
          customerDB.getAll(),
          supplierDB.getAll(),
          categoryDB.getAll(),
          inventoryDB.getLowStockProducts()
        ]);

        const today = dayjs().format('YYYY-MM-DD');
        const thisMonth = dayjs().format('YYYY-MM');

        const todaySales = salesOrders
          .filter(o => o.orderDate.startsWith(today) && (o.status === 'shipped' || o.status === 'completed'))
          .reduce((sum, o) => sum + Number(o.totalAmount), 0);

        const monthSales = salesOrders
          .filter(o => o.orderDate.startsWith(thisMonth) && (o.status === 'shipped' || o.status === 'completed'))
          .reduce((sum, o) => sum + Number(o.totalAmount), 0);

        const pendingOrders = salesOrders.filter(o => o.status === 'draft' || o.status === 'confirmed').length;
        const pendingPurchase = purchaseOrders.filter(o => o.status === 'draft' || o.status === 'confirmed').length;

        // Top selling products (from shipped/completed sales)
        const productSales: Record<string, number> = {};
        salesOrders
          .filter(o => o.status === 'shipped' || o.status === 'completed')
          .forEach(o => {
            if (o.items) {
              o.items.forEach(item => {
                productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
              });
            }
          });
        
        const topProducts = Object.entries(productSales)
          .map(([productId, qty]) => {
            const product = products.find(p => p.id === productId);
            return { product, qty };
          })
          .filter(item => item.product)
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5);

        // Recent orders
        const recentSales = [...salesOrders].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 5);

        setStats({
          todaySales,
          monthSales,
          pendingOrders,
          pendingPurchase,
          totalProducts: products.filter(p => p.active).length,
          totalCustomers: customers.length,
          totalSuppliers: suppliers.length,
          totalCategories: categories.length,
          lowStockCount: lowStock.length,
          lowStockItems: lowStock.slice(0, 5),
          topProducts,
          recentSales,
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    confirmed: { color: 'processing', text: '已确认' },
    shipped: { color: 'warning', text: '已发货' },
    received: { color: 'success', text: '已入库' },
    completed: { color: 'success', text: '已完成' },
    cancelled: { color: 'error', text: '已取消' },
  };

  const paymentMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'error', text: '未收款' },
    partial: { color: 'warning', text: '部分收款' },
    paid: { color: 'success', text: '已收款' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在加载看板数据..." />
      </div>
    );
  }

  return (
    <div>
      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card-blue" hoverable onClick={() => navigate('/sales')}>
            <Statistic
              title="今日销售额"
              value={stats.todaySales}
              prefix={<DollarOutlined style={{ color: '#3b82f6' }} />}
              precision={2}
              suffix="元"
              valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card-green" hoverable onClick={() => navigate('/sales')}>
            <Statistic
              title="本月销售额"
              value={stats.monthSales}
              prefix={<RiseOutlined style={{ color: '#22c55e' }} />}
              precision={2}
              suffix="元"
              valueStyle={{ color: '#22c55e', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card-amber" hoverable onClick={() => navigate('/sales')}>
            <Statistic
              title="待处理订单"
              value={stats.pendingOrders}
              prefix={<ShoppingCartOutlined style={{ color: '#f59e0b' }} />}
              suffix="单"
              valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card-red" hoverable onClick={() => navigate('/inventory')}>
            <Statistic
              title="库存预警"
              value={stats.lowStockCount}
              prefix={<WarningOutlined style={{ color: '#ef4444' }} />}
              suffix="项"
              valueStyle={{ color: '#ef4444', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick overview cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small" className="stat-card-purple" hoverable onClick={() => navigate('/products')}>
            <Statistic title="产品总数" value={stats.totalProducts} prefix={<ShopOutlined style={{ color: '#a855f7' }} />} valueStyle={{ color: '#a855f7', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="stat-card-blue" hoverable onClick={() => navigate('/customers')}>
            <Statistic title="客户数" value={stats.totalCustomers} valueStyle={{ color: '#3b82f6', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="stat-card-green" hoverable onClick={() => navigate('/suppliers')}>
            <Statistic title="供应商" value={stats.totalSuppliers} valueStyle={{ color: '#22c55e', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="stat-card-amber" hoverable onClick={() => navigate('/purchase')}>
            <Statistic title="待采购" value={stats.pendingPurchase} suffix="单" valueStyle={{ color: '#f59e0b', fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      {/* Bottom section: Recent Orders + Low Stock + Top Products */}
      <Row gutter={[16, 16]}>
        {/* Recent sales */}
        <Col xs={24} lg={14}>
          <Card title={<Space><ShoppingCartOutlined /> 近期销售订单</Space>} size="small">
            {stats.recentSales.length === 0 ? (
              <Empty description="暂无销售订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                dataSource={stats.recentSales}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '单号', dataIndex: 'orderNo', width: 160 },
                  { title: '日期', dataIndex: 'orderDate', width: 100, render: (d: string) => dayjs(d).format('MM-DD') },
                  {
                    title: '金额',
                    dataIndex: 'totalAmount',
                    width: 100,
                    render: (v: number) => <Text style={{ color: '#22c55e' }}>¥{Number(v).toFixed(2)}</Text>,
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
                    title: '收款',
                    dataIndex: 'paymentStatus',
                    width: 90,
                    render: (s: string) => {
                      const st = paymentMap[s] || { color: 'default', text: s };
                      return <Tag color={st.color}>{st.text}</Tag>;
                    },
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        {/* Low stock alert */}
        <Col xs={24} lg={10}>
          <Card
            title={<Space><WarningOutlined style={{ color: '#ef4444' }} /> 库存预警</Space>}
            size="small"
            style={{ marginBottom: 16 }}
          >
            {stats.lowStockItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Text style={{ color: 'var(--success)' }}>✅ 所有产品库存充足</Text>
              </div>
            ) : (
              <div>
                {stats.lowStockItems.map(({ product, inventory }) => {
                  const qty = inventory.quantity ?? inventory.currentQty ?? 0;
                  const ratio = product.minStock > 0 ? (qty / product.minStock) * 100 : 0;
                  return (
                    <div key={product.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border-color)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <Text style={{ color: 'var(--text-primary)', fontSize: 13 }}>{product.name}</Text>
                        <br />
                        <Text style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          当前: {qty}{product.unit} / 最低: {product.minStock}{product.unit}
                        </Text>
                      </div>
                      <Progress
                        percent={Math.round(ratio)}
                        size="small"
                        status={ratio < 30 ? 'exception' : 'normal'}
                        style={{ width: 80 }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Top products */}
          <Card title={<Space><ArrowUpOutlined style={{ color: '#a855f7' }} /> 热销产品 TOP5</Space>} size="small">
            {stats.topProducts.length === 0 ? (
              <Empty description="暂无销售数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div>
                {stats.topProducts.map(({ product, qty }, idx) => (
                  <div key={product!.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-color)',
                  }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      background: idx < 3
                        ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                        : 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#fff',
                    }}>
                      {idx + 1}
                    </div>
                    <Text style={{ flex: 1, color: 'var(--text-primary)', fontSize: 13 }}>
                      {product!.name}
                    </Text>
                    <Text style={{ color: 'var(--text-accent)', fontWeight: 600 }}>
                      {qty}{product!.unit}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
