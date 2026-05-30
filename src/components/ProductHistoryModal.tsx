import React, { useState, useEffect } from 'react';
import { Modal, Table, Typography, Tag } from 'antd';
import { inventoryLogDB } from '../database/db';
import type { InventoryLog } from '../database/types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Props {
  open: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
}

const ProductHistoryModal: React.FC<Props> = ({ open, productId, productName, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<InventoryLog[]>([]);

  useEffect(() => {
    if (open && productId) {
      fetchLogs();
    }
  }, [open, productId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await inventoryLogDB.getByProductId(productId);
      setLogs(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (t: string) => {
        if (t === 'in') return <Tag color="green">入库</Tag>;
        if (t === 'out') return <Tag color="orange">出库</Tag>;
        return <Tag color="default">调整</Tag>;
      }
    },
    {
      title: '交易对象(供应商/客户)',
      width: 180,
      render: (_: unknown, record: InventoryLog) => {
        if (record.supplierName) return <span><Text type="secondary">进货供应商: </Text>{record.supplierName}</span>;
        if (record.customerName) return <span><Text type="secondary">出货客户: </Text>{record.customerName}</span>;
        return '—';
      }
    },
    {
      title: '我方单号',
      width: 140,
      render: (_: unknown, record: InventoryLog) => {
        return <Text strong>{record.poNo || record.soNo || '—'}</Text>;
      }
    },
    {
      title: '对方单号',
      width: 140,
      render: (_: unknown, record: InventoryLog) => {
        return <Text>{record.poExtNo || record.soExtNo || '—'}</Text>;
      }
    },
    {
      title: '价格',
      width: 100,
      render: (_: unknown, record: InventoryLog) => {
        if (record.purchasePrice !== null && record.purchasePrice !== undefined) return <Text style={{ color: '#f59e0b' }}>¥{Number(record.purchasePrice).toFixed(2)}</Text>;
        if (record.salePrice !== null && record.salePrice !== undefined) return <Text style={{ color: '#22c55e' }}>¥{Number(record.salePrice).toFixed(2)}</Text>;
        return '—';
      }
    },
    {
      title: '数量变化',
      dataIndex: 'quantity',
      width: 90,
      render: (q: number) => {
        const color = q > 0 ? '#22c55e' : q < 0 ? '#ef4444' : 'inherit';
        return <Text strong style={{ color }}>{q > 0 ? `+${q}` : q}</Text>;
      }
    },
    {
      title: '结余',
      dataIndex: 'balance',
      width: 80,
      render: (b: number) => <Text strong>{b}</Text>
    }
  ];

  return (
    <Modal
      title={`交易与库存流水明细 - ${productName}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={1000}
    >
      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{ defaultPageSize: 15 }}
      />
    </Modal>
  );
};

export default ProductHistoryModal;
