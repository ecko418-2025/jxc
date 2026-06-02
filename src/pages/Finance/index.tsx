// ========================================
// 财务管理 - Finance Management
// ========================================

import { useState, useEffect } from 'react';
import { Table, Card, Typography, Tabs, Tag, Button, Input, DatePicker, Space, Modal } from 'antd';
import { DeleteOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { message } from '../../utils/antd';
import { financeLedgerDB, customerDB, supplierDB, salesOrderDB, purchaseOrderDB, userDB } from '../../database/db';
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
  const [userMap, setUserMap] = useState<Record<string, { displayName: string; role: string }>>({});

  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Customer | Supplier | null>(null);
  const [partyType, setPartyType] = useState<'receivable' | 'payable'>('receivable');
  const [statementDateRange, setStatementDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [l, c, s, so, po, uMap] = await Promise.all([
        financeLedgerDB.getAll(),
        customerDB.getAll(),
        supplierDB.getAll(),
        salesOrderDB.getAll(),
        purchaseOrderDB.getAll(),
        userDB.getUserMap(),
      ]);
      setLedgers(l);
      setCustomers(c);
      setSuppliers(s);
      setSalesOrders(so);
      setPurchaseOrders(po);
      setUserMap(uMap);
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
  // 计算对账单明细
  // ------------------------------------------
  const getStatementData = () => {
    if (!selectedParty || !statementDateRange || !statementDateRange[0] || !statementDateRange[1]) {
      return { openingBalance: 0, items: [], closingBalance: 0 };
    }

    const startDate = statementDateRange[0].startOf('day');
    const endDate = statementDateRange[1].endOf('day');
    const partyId = selectedParty.id;

    let orders: any[] = [];
    let flowLedgers: FinanceLedger[] = [];

    if (partyType === 'receivable') {
      orders = salesOrders.filter(o => o.customerId === partyId && o.status !== 'cancelled' && o.status !== 'draft');
      flowLedgers = ledgers.filter(l => l.partyId === partyId && l.type === 'income');
    } else {
      orders = purchaseOrders.filter(o => o.supplierId === partyId && o.status !== 'cancelled' && o.status !== 'draft');
      flowLedgers = ledgers.filter(l => l.partyId === partyId && l.type === 'expense');
    }

    // 期初余额 = 该区间之前的所有订单总额 - 所有的资金流水已结额
    const priorOrders = orders.filter(o => dayjs(o.orderDate).isBefore(startDate));
    const priorFlows = flowLedgers.filter(l => dayjs(l.paymentDate).isBefore(startDate));

    const priorOrderSum = priorOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const priorFlowSum = priorFlows.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const openingBalance = priorOrderSum - priorFlowSum;

    // 区间内明细
    const currentOrders = orders.filter(o => {
      const d = dayjs(o.orderDate);
      return d.isAfter(startDate.subtract(1, 'second')) && d.isBefore(endDate.add(1, 'second'));
    });

    const currentFlows = flowLedgers.filter(l => {
      const d = dayjs(l.paymentDate);
      return d.isAfter(startDate.subtract(1, 'second')) && d.isBefore(endDate.add(1, 'second'));
    });

    const timelineItems: any[] = [];

    currentOrders.forEach(o => {
      timelineItems.push({
        date: o.orderDate,
        type: partyType === 'receivable' ? '销售出库' : '采购入库',
        docNo: o.orderNo,
        amount: Number(o.totalAmount || 0),
        remark: o.remark || ''
      });
    });

    currentFlows.forEach(l => {
      let orderNo = '独立流水';
      if (l.orderId) {
        if (partyType === 'receivable') {
          orderNo = salesOrders.find(o => o.id === l.orderId)?.orderNo || l.orderId;
        } else {
          orderNo = purchaseOrders.find(o => o.id === l.orderId)?.orderNo || l.orderId;
        }
      }
      timelineItems.push({
        date: l.paymentDate,
        type: partyType === 'receivable' ? '销售收款' : '采购付款',
        docNo: orderNo,
        amount: -Number(l.amount || 0),
        remark: l.remark || ''
      });
    });

    timelineItems.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());

    let currentBalance = openingBalance;
    const items = timelineItems.map((item, idx) => {
      currentBalance += item.amount;
      return {
        ...item,
        key: `${item.docNo}-${idx}-${item.date}`,
        balance: currentBalance
      };
    });

    return {
      openingBalance,
      items,
      closingBalance: currentBalance
    };
  };

  // ------------------------------------------
  // 打印 PDF 对账单
  // ------------------------------------------
  const handlePrintStatement = () => {
    if (!selectedParty || !statementDateRange) return;
    const data = getStatementData();
    const dateStr = dayjs().format('YYYY-MM-DD HH:mm');
    const rangeStr = `${statementDateRange[0].format('YYYY-MM-DD')} 至 ${statementDateRange[1].format('YYYY-MM-DD')}`;
    const partyName = selectedParty.name;
    const contact = selectedParty.contact ? `${selectedParty.contact} (${selectedParty.phone || ''})` : (selectedParty.phone || '—');
    const title = `${partyType === 'receivable' ? '客户应收账目对账单' : '供应商应付账目对账单'}`;
    const labelStart = partyType === 'receivable' ? '期初应收余额' : '期初应付余额';
    const labelChange = partyType === 'receivable' ? '期间应收变动' : '期间应付变动';
    const labelEnd = partyType === 'receivable' ? '期末应收结余' : '期末应付结余';

    const html = `<!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; padding: 30px; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; color: #1e3a8a; }
        .header .meta { text-align: right; font-size: 13px; color: #666; line-height: 1.6; }
        .summary-box { display: flex; gap: 20px; margin-bottom: 20px; }
        .summary-card { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; background: #fafafa; }
        .summary-card .title { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
        .summary-card .value { font-size: 18px; font-weight: bold; color: #1f2937; }
        .summary-card.highlight .value { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
        th { background: #f3f4f6; font-weight: 600; text-align: left; }
        th, td { border: 1px solid #e5e7eb; padding: 8px 12px; }
        tr:nth-child(even) { background: #f9fafb; }
        .amount-pos { color: #dc2626; font-weight: bold; }
        .amount-neg { color: #16a34a; font-weight: bold; }
        .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 14px; color: #374151; }
        .footer-sign { width: 250px; border-bottom: 1px solid #9ca3af; height: 40px; margin-top: 10px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <div>
          <h1>${title}</h1>
          <div style="margin-top: 6px; font-size: 14px;"><strong>客商名称：</strong>${partyName} &nbsp;|&nbsp; <strong>联络人：</strong>${contact}</div>
        </div>
        <div class="meta">
          <div><strong>对账区间：</strong>${rangeStr}</div>
          <div><strong>打印时间：</strong>${dateStr}</div>
        </div>
      </div>

      <div class="summary-box">
        <div class="summary-card">
          <div class="title">${labelStart}</div>
          <div class="value">¥${data.openingBalance.toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <div class="title">${labelChange}</div>
          <div class="value">${(data.closingBalance - data.openingBalance) >= 0 ? '+' : ''}¥${(data.closingBalance - data.openingBalance).toFixed(2)}</div>
        </div>
        <div class="summary-card highlight">
          <div class="title">${labelEnd}</div>
          <div class="value">¥${data.closingBalance.toFixed(2)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 15%">日期</th>
            <th style="width: 15%">业务类型</th>
            <th style="width: 20%">单据号 / 流水号</th>
            <th style="width: 15%">发生金额</th>
            <th style="width: 15%">累计结余金额</th>
            <th style="width: 20%">备注</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${statementDateRange[0].format('YYYY-MM-DD')}</td>
            <td><strong>期初余额</strong></td>
            <td>—</td>
            <td>—</td>
            <td><strong>¥${data.openingBalance.toFixed(2)}</strong></td>
            <td>对账期前未结款项累计</td>
          </tr>
          ${data.items.map(item => {
            const isPos = item.amount >= 0;
            return `<tr>
              <td>${dayjs(item.date).format('YYYY-MM-DD')}</td>
              <td>${item.type}</td>
              <td style="font-family: monospace;">${item.docNo}</td>
              <td class="${isPos ? 'amount-pos' : 'amount-neg'}">${isPos ? '+' : ''}¥${item.amount.toFixed(2)}</td>
              <td style="font-weight: bold;">¥${item.balance.toFixed(2)}</td>
              <td>${item.remark || ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      <div class="footer">
        <div>
          <div>我方制单人（盖章签名）：</div>
          <div class="footer-sign"></div>
        </div>
        <div>
          <div>客商确认人（签字盖章）：</div>
          <div class="footer-sign"></div>
          <div style="font-size: 11px; color: #9ca3af; margin-top: 6px;">收到账单核对无误后请签字盖章回传</div>
        </div>
      </div>
      </body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  };

  // ------------------------------------------
  // 导出 Excel 对账单
  // ------------------------------------------
  const handleExportStatementExcel = () => {
    if (!selectedParty || !statementDateRange) return;
    const data = getStatementData();
    
    const rows = [
      {
        '日期': statementDateRange[0].format('YYYY-MM-DD'),
        '业务类型': '期初余额',
        '单据号/流水号': '—',
        '发生金额': '—',
        '累计结余': Number(data.openingBalance).toFixed(2),
        '备注': '期初累计余额'
      },
      ...data.items.map(item => ({
        '日期': dayjs(item.date).format('YYYY-MM-DD'),
        '业务类型': item.type,
        '单据号/流水号': item.docNo,
        '发生金额': `${item.amount >= 0 ? '+' : ''}${Number(item.amount).toFixed(2)}`,
        '累计结余': Number(item.balance).toFixed(2),
        '备注': item.remark || ''
      }))
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '往来账目对账单');
    
    const fileName = `往来对账单_${selectedParty.name}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    message.success('对账单 Excel 导出成功');
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
        '经办人': (() => {
          const info = userMap[l.createdBy || ''];
          if (info) {
            const roleText = info.role === 'admin' ? '管理员' : info.role === 'finance' ? '财务' : info.role === 'sales' ? '销售' : info.role === 'warehouse' ? '库管' : info.role;
            return `${info.displayName} (${roleText})`;
          }
          if (l.createdBy === 'system' || l.createdBy === '系统') return '系统自动';
          return l.createdBy || '';
        })(),
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
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              label: '应收账款 (客户)',
              key: 'receivable',
              children: (
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
                    { title: '操作', key: 'action', render: (_, r) => (
                      <Button size="small" type="link" style={{ padding: 0 }} onClick={() => { setSelectedParty(r); setPartyType('receivable'); setStatementModalOpen(true); }}>
                        对账单
                      </Button>
                    ) }
                  ]}
                />
              )
            },
            {
              label: '应付账款 (供应商)',
              key: 'payable',
              children: (
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
                    { title: '操作', key: 'action', render: (_, r) => (
                      <Button size="small" type="link" style={{ padding: 0 }} onClick={() => { setSelectedParty(r); setPartyType('payable'); setStatementModalOpen(true); }}>
                        对账单
                      </Button>
                    ) }
                  ]}
                />
              )
            },
            {
              label: '资金流水',
              key: 'ledger',
              children: (
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
                    { title: '经办人', dataIndex: 'createdBy', key: 'createdBy', render: (v) => {
                      const info = userMap[v];
                      if (info) {
                        const roleText = info.role === 'admin' ? '管理员' : info.role === 'finance' ? '财务' : info.role === 'sales' ? '销售' : info.role === 'warehouse' ? '库管' : info.role;
                        return `${info.displayName} (${roleText})`;
                      }
                      if (v === 'system' || v === '系统') return '系统自动';
                      return v;
                    } },
                    { title: '操作', key: 'action', render: (_, r) => (
                      <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteLedger(r.id)}>
                        撤销
                      </Button>
                    ) },
                  ]}
                />
              )
            }
          ]}
        />
      </Card>

      {/* 对账单 Modal */}
      <Modal
        title={`${partyType === 'receivable' ? '客户' : '供应商'}往来账目对账单 - ${selectedParty?.name || ''}`}
        open={statementModalOpen}
        onCancel={() => setStatementModalOpen(false)}
        width={900}
        footer={[
          <Button key="excel" icon={<DownloadOutlined />} onClick={handleExportStatementExcel}>
            导出 Excel
          </Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrintStatement}>
            打印/生成 PDF
          </Button>,
          <Button key="close" onClick={() => setStatementModalOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <div style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 16 }}>
            <Text strong>选择对账区间:</Text>
            <DatePicker.RangePicker
              value={statementDateRange}
              onChange={(dates: any) => setStatementDateRange(dates)}
              allowClear={false}
              placeholder={['开始日期', '结束日期']}
            />
          </Space>

          {selectedParty && (
            <>
              {/* Summary Statistics */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <Card size="small" style={{ flex: 1, background: '#fafafa' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {partyType === 'receivable' ? '期初应收余额' : '期初应付余额'}
                  </Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>
                    ¥{getStatementData().openingBalance.toFixed(2)}
                  </div>
                </Card>
                <Card size="small" style={{ flex: 1, background: '#fafafa' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {partyType === 'receivable' ? '期间应收变动' : '期间应付变动'}
                  </Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 4, color: (getStatementData().closingBalance - getStatementData().openingBalance) >= 0 ? '#ef4444' : '#22c55e' }}>
                    {(getStatementData().closingBalance - getStatementData().openingBalance) >= 0 ? '+' : ''}¥{(getStatementData().closingBalance - getStatementData().openingBalance).toFixed(2)}
                  </div>
                </Card>
                <Card size="small" style={{ flex: 1, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {partyType === 'receivable' ? '期末应收结余' : '期末应付结余'}
                  </Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 4, color: '#1d4ed8' }}>
                    ¥{getStatementData().closingBalance.toFixed(2)}
                  </div>
                </Card>
              </div>

              {/* Statement Preview Table */}
              <Table
                dataSource={[
                  {
                    key: 'opening',
                    date: statementDateRange ? statementDateRange[0].format('YYYY-MM-DD') : '',
                    type: '期初余额',
                    docNo: '—',
                    amount: 0,
                    balance: getStatementData().openingBalance,
                    remark: '对账周期前的累计未结账目'
                  },
                  ...getStatementData().items
                ]}
                columns={[
                  { title: '日期', dataIndex: 'date', key: 'date', render: (v, r) => r.type === '期初余额' ? v : dayjs(v).format('YYYY-MM-DD') },
                  { title: '业务类型', dataIndex: 'type', key: 'type', render: (v) => <Tag color={v.includes('出库') || v.includes('入库') ? 'blue' : v === '期初余额' ? 'default' : 'green'}>{v}</Tag> },
                  { title: '单据号/流水号', dataIndex: 'docNo', key: 'docNo', render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
                  { title: '变动金额', dataIndex: 'amount', key: 'amount', render: (v, r) => {
                    if (r.type === '期初余额') return '—';
                    const isPos = v >= 0;
                    return <span style={{ color: isPos ? '#ef4444' : '#22c55e', fontWeight: 'bold' }}>{isPos ? '+' : ''}¥{v.toFixed(2)}</span>;
                  } },
                  { title: '应收/应付余额', dataIndex: 'balance', key: 'balance', render: (v) => <strong>¥{v.toFixed(2)}</strong> },
                  { title: '备注', dataIndex: 'remark', key: 'remark' },
                ]}
                rowKey="key"
                pagination={{ defaultPageSize: 10, showSizeChanger: true }}
                size="small"
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
