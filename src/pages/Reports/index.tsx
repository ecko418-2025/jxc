// ========================================
// 数据报表 - Reports
// ========================================

import React, { useMemo, useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Space, Select, Tag, Spin, message } from 'antd';
import {
  DollarOutlined, ShoppingCartOutlined, RiseOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import { salesOrderDB, purchaseOrderDB, productDB, customerDB, inventoryDB, categoryDB } from '../../database/db';
import dayjs from 'dayjs';

const { Text } = Typography;

const ReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  const [dataCache, setDataCache] = useState<any>({
    salesOrders: [],
    purchaseOrders: [],
    products: [],
    customers: [],
    categories: [],
    inventories: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [sales, purchase, prods, custs, cats, invs] = await Promise.all([
          salesOrderDB.getAll(),
          purchaseOrderDB.getAll(),
          productDB.getAll(),
          customerDB.getAll(),
          categoryDB.getAll(),
          inventoryDB.getAll()
        ]);
        setDataCache({
          salesOrders: sales.filter(o => o.status === 'shipped' || o.status === 'completed'),
          purchaseOrders: purchase.filter(o => o.status === 'received'),
          products: prods,
          customers: custs,
          categories: cats,
          inventories: invs,
        });
      } catch (err: any) {
        message.error(err.message || '加载报表数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const report = useMemo(() => {
    const { salesOrders, purchaseOrders, products, customers, categories, inventories } = dataCache;

    // Period filter
    const now = dayjs();
    let startDate: dayjs.Dayjs;
    switch (period) {
      case 'week': startDate = now.subtract(7, 'day'); break;
      case 'month': startDate = now.subtract(1, 'month'); break;
      case 'quarter': startDate = now.subtract(3, 'month'); break;
      case 'year': startDate = now.subtract(1, 'year'); break;
    }

    const periodSales = salesOrders.filter((o: any) => dayjs(o.orderDate).isAfter(startDate));
    const periodPurchase = purchaseOrders.filter((o: any) => dayjs(o.orderDate).isAfter(startDate));

    const totalSales = periodSales.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
    const totalPurchase = periodPurchase.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
    const grossProfit = totalSales - totalPurchase;
    const orderCount = periodSales.length;

    // Sales by customer
    const customerSales: Record<string, number> = {};
    periodSales.forEach((o: any) => {
      customerSales[o.customerId] = (customerSales[o.customerId] || 0) + Number(o.totalAmount);
    });
    const topCustomers = Object.entries(customerSales)
      .map(([customerId, amount]) => ({
        customer: customers.find((c: any) => c.id === customerId),
        amount,
      }))
      .filter(i => i.customer)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Sales by product
    const productSales: Record<string, { qty: number; amount: number }> = {};
    periodSales.forEach((o: any) => {
      if (o.items) {
        o.items.forEach((item: any) => {
          if (!productSales[item.productId]) productSales[item.productId] = { qty: 0, amount: 0 };
          productSales[item.productId].qty += item.quantity;
          productSales[item.productId].amount += Number(item.subtotal);
        });
      }
    });
    const topProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        product: products.find((p: any) => p.id === productId),
        ...data,
      }))
      .filter(i => i.product)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Sales by category
    const categorySales: Record<string, number> = {};
    periodSales.forEach((o: any) => {
      if (o.items) {
        o.items.forEach((item: any) => {
          const product = products.find((p: any) => p.id === item.productId);
          if (product) {
            const cat = categories.find((c: any) => c.id === product.categoryId);
            const catName = cat?.name || '未分类';
            categorySales[catName] = (categorySales[catName] || 0) + Number(item.subtotal);
          }
        });
      }
    });
    const categoryData = Object.entries(categorySales)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Inventory value
    const inventoryValue = products.reduce((sum: number, p: any) => {
      const inv = inventories.find((i: any) => i.productId === p.id);
      const qty = inv?.quantity ?? inv?.currentQty ?? 0;
      return sum + qty * Number(p.purchasePrice);
    }, 0);

    return {
      totalSales,
      totalPurchase,
      grossProfit,
      orderCount,
      topCustomers,
      topProducts,
      categoryData,
      inventoryValue,
    };
  }, [period, dataCache]);

  const periodLabels: Record<string, string> = {
    week: '近7天',
    month: '近30天',
    quarter: '近3个月',
    year: '近1年',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在加载报表数据..." />
      </div>
    );
  }

  return (
    <div>
      {/* Period selector */}
      <Space style={{ marginBottom: 20 }}>
        <Text strong style={{ color: 'var(--text-primary)' }}>统计周期:</Text>
        <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
          <Select.Option value="week">近7天</Select.Option>
          <Select.Option value="month">近30天</Select.Option>
          <Select.Option value="quarter">近3个月</Select.Option>
          <Select.Option value="year">近1年</Select.Option>
        </Select>
      </Space>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card-green" size="small">
            <Statistic
              title={`${periodLabels[period]}销售额`}
              value={report.totalSales}
              prefix={<DollarOutlined style={{ color: '#22c55e' }} />}
              precision={2}
              suffix="元"
              valueStyle={{ color: '#22c55e', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card-amber" size="small">
            <Statistic
              title={`${periodLabels[period]}采购额`}
              value={report.totalPurchase}
              prefix={<ShoppingCartOutlined style={{ color: '#f59e0b' }} />}
              precision={2}
              suffix="元"
              valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={report.grossProfit >= 0 ? 'stat-card-blue' : 'stat-card-red'} size="small">
            <Statistic
              title="毛利润"
              value={report.grossProfit}
              prefix={report.grossProfit >= 0 ? <ArrowUpOutlined style={{ color: '#3b82f6' }} /> : <ArrowDownOutlined style={{ color: '#ef4444' }} />}
              precision={2}
              suffix="元"
              valueStyle={{ color: report.grossProfit >= 0 ? '#3b82f6' : '#ef4444', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card-purple" size="small">
            <Statistic
              title="库存总价值"
              value={report.inventoryValue}
              prefix={<RiseOutlined style={{ color: '#a855f7' }} />}
              precision={2}
              suffix="元"
              valueStyle={{ color: '#a855f7', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Top customers */}
        <Col xs={24} lg={12}>
          <Card title="🏨 客户销售排行" size="small">
            <Table
              dataSource={report.topCustomers}
              rowKey={(r) => r.customer!.id}
              size="small"
              pagination={false}
              columns={[
                {
                  title: '#',
                  width: 40,
                  render: (_: unknown, __: unknown, idx: number) => (
                    <div style={{
                      width: 22, height: 22, borderRadius: 11,
                      background: idx < 3 ? 'linear-gradient(135deg, #f59e0b, #f97316)' : 'var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#fff',
                    }}>{idx + 1}</div>
                  ),
                },
                { title: '客户', render: (_: unknown, r: any) => <Text>{r.customer?.name}</Text> },
                { title: '等级', render: (_: unknown, r: any) => <Tag>{r.customer?.level}</Tag>, width: 80 },
                {
                  title: '销售额',
                  dataIndex: 'amount',
                  width: 120,
                  render: (v: number) => <Text strong style={{ color: '#22c55e' }}>¥{v.toFixed(2)}</Text>,
                },
              ]}
            />
          </Card>
        </Col>

        {/* Top products */}
        <Col xs={24} lg={12}>
          <Card title="📦 产品销售排行" size="small">
            <Table
              dataSource={report.topProducts}
              rowKey={(r) => r.product!.id}
              size="small"
              pagination={false}
              columns={[
                {
                  title: '#',
                  width: 40,
                  render: (_: unknown, __: unknown, idx: number) => (
                    <div style={{
                      width: 22, height: 22, borderRadius: 11,
                      background: idx < 3 ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#fff',
                    }}>{idx + 1}</div>
                  ),
                },
                { title: '产品', render: (_: unknown, r: any) => <Text>{r.product?.name}</Text> },
                { title: '数量', dataIndex: 'qty', width: 80 },
                {
                  title: '销售额',
                  dataIndex: 'amount',
                  width: 120,
                  render: (v: number) => <Text strong style={{ color: '#22c55e' }}>¥{v.toFixed(2)}</Text>,
                },
              ]}
            />
          </Card>
        </Col>

        {/* Category sales */}
        <Col xs={24}>
          <Card title="📊 品类销售分布" size="small" style={{ marginTop: 16 }}>
            <Table
              dataSource={report.categoryData}
              rowKey="name"
              size="small"
              pagination={false}
              columns={[
                { title: '品类', dataIndex: 'name', render: (v: string) => <Tag color="blue">{v}</Tag> },
                {
                  title: '销售额',
                  dataIndex: 'amount',
                  render: (v: number) => <Text strong style={{ color: '#22c55e' }}>¥{v.toFixed(2)}</Text>,
                },
                {
                  title: '占比',
                  render: (_: unknown, record: any) => {
                    const total = report.categoryData.reduce((s, d) => s + d.amount, 0);
                    const pct = total > 0 ? ((record.amount / total) * 100).toFixed(1) : '0';
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: `${pct}%`,
                          maxWidth: 200,
                          height: 6,
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        }} />
                        <Text>{pct}%</Text>
                      </div>
                    );
                  },
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReportsPage;
