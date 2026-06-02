
// ========================================
// 投标标书 - Proposals
// ========================================

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Popconfirm, message, Upload, Select, Input } from 'antd';
import { DownloadOutlined, UploadOutlined, DeleteOutlined, FileDoneOutlined, ArrowUpOutlined, ArrowDownOutlined, MenuOutlined, PrinterOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { productDB, categoryDB } from '../../database/db';
import type { Product, Category } from '../../database/types';
import { CloudImage } from '../../components/CloudImage';

// dnd-kit
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { Title, Text } = Typography;

const STORAGE_KEY = 'proposals_draft';
const TITLE_STORAGE_KEY = 'proposals_title_draft';

interface SelectedItem {
  id: string;
  remark: string;
}

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string;
}

const Row = ({ children, ...props }: RowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props['data-row-key'],
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999 } : {}),
  };

  return (
    <tr {...props} ref={setNodeRef} style={style} {...attributes}>
      {React.Children.map(children, (child) => {
        if ((child as React.ReactElement).key === 'sort') {
          return React.cloneElement(child as any, {
            children: (
              <MenuOutlined
                ref={setActivatorNodeRef}
                style={{ touchAction: 'none', cursor: 'move', color: '#999', fontSize: 16 }}
                {...listeners}
              />
            ),
          });
        }
        return child;
      })}
    </tr>
  );
};

const ProposalsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchValue, setSearchValue] = useState<string | null>(null);
  const [proposalTitle, setProposalTitle] = useState('投标标书制单');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    loadProducts();
    // Load draft
    try {
      const draft = localStorage.getItem(STORAGE_KEY);
      const titleDraft = localStorage.getItem(TITLE_STORAGE_KEY);
      if (titleDraft) setProposalTitle(titleDraft);

      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          setSelectedItems(parsed.map((id: string) => ({ id, remark: '' })));
        } else {
          setSelectedItems(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse draft', e);
    }
  }, []);

  // Sync to draft
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedItems));
  }, [selectedItems]);

  useEffect(() => {
    localStorage.setItem(TITLE_STORAGE_KEY, proposalTitle);
  }, [proposalTitle]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const [products, cats] = await Promise.all([
        productDB.getAll(),
        categoryDB.getAll()
      ]);
      setAllProducts(products.filter(p => p.active));
      setCategories(cats);
    } catch (e) {
      message.error('加载产品失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = (id: string) => {
    if (selectedItems.some(item => item.id === id)) {
      message.warning('该产品已在列表中');
      return;
    }
    setSelectedItems([...selectedItems, { id, remark: '' }]);
    setSearchValue(null);
    message.success('已添加到标书列表');
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === selectedItems.length - 1) return;
    const newItems = [...selectedItems];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
    setSelectedItems(newItems);
  };

  const handleRemarkChange = (id: string, value: string) => {
    setSelectedItems(selectedItems.map(item => item.id === id ? { ...item, remark: value } : item));
  };

  const handleRemove = (id: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  const handleBatchDelete = () => {
    setSelectedItems(selectedItems.filter(item => !selectedRowKeys.includes(item.id)));
    setSelectedRowKeys([]);
    message.success('已批量删除选中的产品');
  };

  const handleClear = () => {
    setSelectedItems([]);
    message.success('标书列表已清空');
  };

  const selectedProducts = selectedItems
    .map(item => {
      const p = allProducts.find(p => p.id === item.id);
      if (p) return { ...p, _remark: item.remark };
      return null;
    })
    .filter(Boolean) as (Product & { _remark: string })[];

  // 导出 Excel
  const handleExport = () => {
    if (selectedProducts.length === 0) {
      message.warning('列表为空，无法导出');
      return;
    }

    const data = selectedProducts.map(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      return {
        系统编号: p.id, // 用于二次导入时的精确匹配
        产品分类: cat ? cat.name : '未分类',
        产品名称: p.name,
        品牌: p.brand || '',
        规格型号: p.spec || '',
        库存单位: p.unit || '',
        销售单价: Number(p.salePrice).toFixed(2),
        客户备注: p._remark || '', // 空白列供客户填写
        图片预览: p.imageUrl ? '点击查看图片' : '无图片',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);

    // 将图片预览列加上超链接
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      // 假设"图片预览"是第 9 列 (从 0 开始计，I列，也就是 c: 8)
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cell = ws[XLSX.utils.encode_cell({ c: 8, r: R })];
        if (cell && cell.v === '点击查看图片') {
          const product = selectedProducts[R - 1]; // 排除表头
          if (product && product.imageUrl) {
            cell.l = { Target: product.imageUrl, Tooltip: '打开图片' };
          }
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '投标标书清单');
    XLSX.writeFile(wb, `${proposalTitle}_${new Date().getTime()}.xlsx`);
    message.success('导出成功！已保存为 Excel');
  };

  // 导入 Excel
  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        let addedCount = 0;
        const newItems = [...selectedItems];

        rows.forEach(row => {
          const id = row['系统编号'];
          const remark = row['客户备注'] || '';
          if (id && allProducts.some(p => p.id === id) && !newItems.some(item => item.id === id)) {
            newItems.push({ id, remark: String(remark) });
            addedCount++;
          }
        });

        setSelectedItems(newItems);
        if (addedCount > 0) {
          message.success(`成功导入并追加了 ${addedCount} 款产品`);
        } else {
          message.info('没有找到新的匹配产品');
        }
      } catch (err) {
        message.error('文件解析失败，请确保格式正确');
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Prevent auto upload
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1, // 1px
      },
    })
  );

  const onDragEnd = ({ active, over }: any) => {
    if (active.id !== over?.id) {
      setSelectedItems((previous) => {
        const activeIndex = previous.findIndex((i) => i.id === active.id);
        const overIndex = previous.findIndex((i) => i.id === over?.id);
        return arrayMove(previous, activeIndex, overIndex);
      });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space align="center">
          <FileDoneOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title
            level={4}
            style={{ margin: 0 }}
            editable={{ onChange: setProposalTitle, tooltip: '点击编辑标书标题' }}
          >
            {proposalTitle}
          </Title>
        </Space>
        <Space className="hide-on-print">
          <Text type="secondary">
            {selectedItems.length > 0 ? `草稿已自动缓存，共 ${selectedItems.length} 款产品` : '暂无数据'}
          </Text>
          {selectedRowKeys.length > 0 && (
            <Popconfirm title={`确定要删除选中的 ${selectedRowKeys.length} 款产品吗？`} onConfirm={handleBatchDelete}>
              <Button danger>批量删除</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确定要清空当前所有选中的产品吗？" onConfirm={handleClear}>
            <Button danger icon={<DeleteOutlined />}>一键清空</Button>
          </Popconfirm>
          <Upload beforeUpload={handleImport} showUploadList={false} accept=".xlsx,.xls">
            <Button icon={<UploadOutlined />}>导入历史标书</Button>
          </Upload>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} disabled={selectedItems.length === 0}>
            下载报表 (Excel)
          </Button>
          <Button type="default" icon={<PrinterOutlined />} onClick={() => window.print()} disabled={selectedItems.length === 0}>
            打印 / 导出 PDF
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, display: 'flex', gap: 16 }} className="hide-on-print">
          <Select
            showSearch
            placeholder="请输入系统产品编号 或 产品名称快速添加"
            value={searchValue}
            onChange={(val) => handleAddProduct(val)}
            style={{ width: 400 }}
            optionFilterProp="searchText"
            filterOption={(input, option) =>
              (option?.searchText ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={allProducts.map(p => ({ 
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.imageUrl ? (
                    <CloudImage src={p.imageUrl} style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} preview={false} />
                  ) : (
                    <div style={{ width: 24, height: 24, background: '#f1f5f9', borderRadius: 4 }} />
                  )}
                  <span>{p.name} ({p.spec || '无规格'}) <Text type="secondary" style={{ fontSize: 12 }}>[{p.id.slice(-6)}]</Text></span>
                </div>
              ), 
              value: p.id,
              searchText: `${p.name} ${p.spec || ''} ${p.id.slice(-6)}`
            }))}
          />
          <Text type="secondary" style={{ alignSelf: 'center' }}>支持下拉搜索名称，或直接输入后回车。</Text>
        </div>

        <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext
            items={selectedProducts.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <Table
              components={{
                body: {
                  row: Row,
                },
              }}
              rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
              dataSource={selectedProducts}
              rowKey="id"
              loading={loading}
              pagination={false}
              columns={[
                {
                  key: 'sort',
                  width: 50,
                  className: 'hide-on-print',
                },
                { 
                  title: '产品编码', 
                  dataIndex: 'sku', 
                  width: 100,
                  render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>
                },
                { 
                  title: '产品名称', 
                  dataIndex: 'name', 
                  width: 160,
                  render: (v) => <Text strong style={{ color: 'var(--text-primary)' }}>{v}</Text>
                },
                { title: '分类', dataIndex: 'categoryId', width: 100, render: (id) => categories.find(c => c.id === id)?.name || '未分类' },
                { title: '品牌', dataIndex: 'brand', width: 100 },
                { title: '规格型号', dataIndex: 'spec', width: 120 },
                { title: '单位', dataIndex: 'unit', width: 80 },
                { 
                  title: '销售价', 
                  dataIndex: 'salePrice', 
                  width: 120,
                  render: (v) => <Text strong style={{ color: '#22c55e' }}>¥{Number(v).toFixed(2)}</Text>
                },
                {
                  title: '图片',
                  dataIndex: 'imageUrl',
                  width: 80,
                  render: (url) => <CloudImage src={url} style={{ width: 40, height: 40, objectFit: 'cover' }} preview />,
                },
                { 
                  title: '客户备注',
                  dataIndex: '_remark',
                  width: 75,
                  render: (text, record) => <Input value={text} onChange={(e) => handleRemarkChange(record.id, e.target.value)} />
                },
                {
                  title: '操作',
                  width: 80,
                  className: 'hide-on-print',
                  render: (_, record, index) => (
                    <Space>
                      <Button type="text" icon={<ArrowUpOutlined />} size="small" disabled={index === 0} onClick={() => handleMove(index, 'up')} />
                      <Button type="text" icon={<ArrowDownOutlined />} size="small" disabled={index === selectedItems.length - 1} onClick={() => handleMove(index, 'down')} />
                      <Button type="text" danger size="small" onClick={() => handleRemove(record.id)}>移除</Button>
                    </Space>
                  )
                }
              ]}
            />
          </SortableContext>
        </DndContext>
      </Card>
    </div>
  );
};

export default ProposalsPage;
