// ========================================
// 财务管理 - Finance Management
// ========================================

import { useState, useEffect } from 'react';
import { Table, Card, Typography, Tabs, Tag, message, Button, Input, DatePicker, Space } from 'antd';
import { DeleteOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { financeLedgerDB, customerDB, supplierDB, salesOrderDB, purchaseOrderDB } from '../../database/db';
import type { FinanceLedger, Customer, Supplier, SalesOrder, PurchaseOrder } from '../../database/types';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

export default function Finance() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('receivable');
  
  const [ledgers, setLedgers] = useState<FinanceLedger[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

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
      const matchText = (party?.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
             (l.remark || '').toLowerCase().includes(searchText.toLowerCase());
      
      let matchDate = true;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const pd = dayjs(l.paymentDate);
        matchDate = pd.isAfter(dateRange[0].startOf('day')) && pd.isBefore(dateRange[1].endOf('day'));
      }
      return matchText && matchDate;
    });
  };

  // ------------------------------------------
  // 获取当前 Tab 可导出的表格行数据
  // ------------------------------------------
  const getExportRows = () => {
    const payMethodMap: any = { wechat: '微信', alipay: '支付宝', bank: '银行转账', cash: '现金' };
    if (activeTab === 'receivable') {
      return getARData().map(r => ({
        '客户名称': r.name,
        '联系人': r.contact || '',
        '有效单据数': r.ordersCount,
        '历史总订货额': Number(r.totalOrdered).toFixed(2),
        '历史总已收款': Number(r.totalPaid).toFixed(2),
        '当前欠款': Number(r.balance).toFixed(2),
      }));
    }
    if (activeTab === 'payable') {
      return getAPData().map(r => ({
        '供应商名称': r.name,
        '联系人': r.contact || '',
        '有效采购单数': r.ordersCount,
        '历史总采购额': Number(r.totalOrdered).toFixed(2),
        '历史总已付款': Number(r.totalPaid).toFixed(2),
        '当前欠款': Number(r.balance).toFixed(2),
      }));
    }
    // ledger
    return getLedgerData().map(l => {
      const party = l.type === 'income'
        ? customers.find(c => c.id === l.partyId)?.name || '未知客户'
        : suppliers.find(s => s.id === l.partyId)?.name || '未知供应商';
      const orderNo = l.orderId
        ? (l.type === 'income'
            ? salesOrders.find(o => o.id === l.orderId)?.orderNo || l.orderId
            : purchaseOrders.find(o => o.id === l.orderId)?.orderNo || l.orderId)
        : '—';
      return {
        '日期': dayjs(l.paymentDate).format('YYYY-MM-DD'),
        '类型': l.type === 'income' ? '收款 (应收)' : '付款 (应付)',
        '关联客商': party,
        '关联订单': orderNo,
        '金额': `${l.type === 'income' ? '+' : '-'}${Number(l.amount).toFixed(2)}`,
        '支付方式': payMethodMap[l.paymentMethod] || l.paymentMethod || '',
        '备注': l.remark || '',
        '经办人': l.createdBy || '',
      };
    });
  };

  const tabNameMap: Record<string, string> = {
    receivable: '应收账款',
    payable: '应付账款',
    ledger: '资金流水',
  };

  // ------------------------------------------
  // 下载 Excel
  // ------------------------------------------
  const handleDownloadExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) { message.warning('当前无数据可导出'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tabNameMap[activeTab]);
    const fileName = `财务管理_${tabNameMap[activeTab]}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    message.success('Excel 文件已下载');
  };

  // ------------------------------------------
  // 打印 PDF（通过浏览器打印对话框）
  // ------------------------------------------
  const handlePrintPDF = () => {
    const rows = getExportRows();
    if (rows.length === 0) { message.warning('当前无数据可打印'); return; }
    const headers = Object.keys(rows[0]);
    const title = `财务管理 - ${tabNameMap[activeTab]}`;
    const dateStr = dayjs().format('YYYY-MM-DD HH:mm');

    const html = `<!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; padding: 24px; color: #333; }
        h2 { margin: 0 0 4px; }
        .meta { color: #888; font-size: 13px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f0f0f0; font-weight: 600; }
        th, td { border: 1px solid #d9d9d9; padding: 6px 10px; text-align: left; }
        tr:nth-child(even) { background: #fafafa; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h2>${title}</h2>
      <div class="meta">导出时间: ${dateStr} &nbsp;|&nbsp; 共 ${rows.length} 条记录</div>
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${(r as any)[h]}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>财务管理</Title>
        <Space size="middle">
          {activeTab === 'ledger' && (
            <DatePicker.RangePicker 
              onChange={(dates: any) => setDateRange(dates)}
              allowClear
              placeholder={['开始日期', '结束日期']}
            />
          )}
          <Input.Search 
            placeholder="搜索客户/供应商/备注" 
            allowClear 
            onSearch={setSearchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }} 
          />
          <Button icon={<DownloadOutlined />} onClick={handleDownloadExcel}>下载 Excel</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrintPDF}>打印 PDF</Button>
        </Space>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="应收账款 (客户)" key="receivable">
            <Table
              dataSource={getARData()}
              rowKey="id"
              loading={loading}
              columns={[
                { title: '客户名称', dataIndex: 'name', key: 'name', render: (t) => (
                  <Button type="link" style={{ padding: 0, fontWeight: 'bold' }} onClick={() => navigate(`/sales?search=${encodeURIComponent(t)}`)}>
                    {t}
                  </Button>
                ) },
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
                { title: '供应商名称', dataIndex: 'name', key: 'name', render: (t) => (
                  <Button type="link" style={{ padding: 0, fontWeight: 'bold' }} onClick={() => navigate(`/purchase?search=${encodeURIComponent(t)}`)}>
                    {t}
                  </Button>
                ) },
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
              pagination={{
                defaultPageSize: 50,
                pageSizeOptions: ['10', '20', '50', '100'],
                showSizeChanger: true
              }}
              columns={[
                { title: '日期', dataIndex: 'paymentDate', key: 'paymentDate', render: (v) => dayjs(v).format('YYYY-MM-DD') },
                { title: '类型', dataIndex: 'type', key: 'type', render: (v) => (
                  <Tag color={v === 'income' ? 'green' : 'orange'}>{v === 'income' ? '收款 (应收)' : '付款 (应付)'}</Tag>
                ) },
                { title: '关联客商', dataIndex: 'partyId', key: 'partyId', render: (v, r) => {
                  if (r.type === 'income') {
                    const name = customers.find(c => c.id === v)?.name;
                    if (!name) return '未知客户';
                    return (
                      <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/sales?search=${encodeURIComponent(name)}`)}>
                        {name}
                      </Button>
                    );
                  } else {
                    const name = suppliers.find(s => s.id === v)?.name;
                    if (!name) return '未知供应商';
                    return (
                      <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/purchase?search=${encodeURIComponent(name)}`)}>
                        {name}
                      </Button>
                    );
                  }
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
