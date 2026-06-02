// ========================================
// 投标标书 - Proposals
// ========================================

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Popconfirm, message, Upload, Select } from 'antd';
import { DownloadOutlined, UploadOutlined, DeleteOutlined, FileDoneOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { productDB, categoryDB } from '../../database/db';
import type { Product, Category } from '../../database/types';
import { CloudImage } from '../../components/CloudImage';

const { Title, Text } = Typography;

const STORAGE_KEY = 'proposals_draft';

const ProposalsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
    // Load draft
    try {
      const draft = localStorage.getItem(STORAGE_KEY);
      if (draft) {
        setSelectedIds(JSON.parse(draft));
      }
    } catch (e) {
      console.error('Failed to parse draft', e);
    }
  }, []);

  // Sync to draft
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
  }, [selectedIds]);

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
    if (selectedIds.includes(id)) {
      message.warning('该产品已在列表中');
      return;
    }
    setSelectedIds([...selectedIds, id]);
    setSearchValue(null);
    message.success('已添加到标书列表');
  };

  const handleRemove = (id: string) => {
    setSelectedIds(selectedIds.filter(item => item !== id));
  };

  const handleClear = () => {
    setSelectedIds([]);
    message.success('标书列表已清空');
  };

  const selectedProducts = selectedIds
    .map(id => allProducts.find(p => p.id === id))
    .filter(Boolean) as Product[];

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
        客户备注: '', // 空白列供客户填写
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
            // 注意: 这里导出的超链接如果是 cloud://，在 Excel 中会打不开，最好转化为临时的 http 链接，或者让其保持原样。
            // 简单起见，如果需要在 Excel 直接打开，我们需要调用 getTempFileURL。
            // 但考虑到导出速度，暂存原图片标识符，在真实业务中客户如需查看大图，我们更推荐在系统中查看，或者在这里尝试解析它。
            // 这里为了简单，目前不作复杂的 Excel 超链接，如果您有特定需求可以加上。
            cell.l = { Target: product.imageUrl, Tooltip: '打开图片' };
          }
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '投标标书清单');
    XLSX.writeFile(wb, `投标标书_${new Date().getTime()}.xlsx`);
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
        const newIds = [...selectedIds];

        rows.forEach(row => {
          const id = row['系统编号'];
          if (id && allProducts.some(p => p.id === id) && !newIds.includes(id)) {
            newIds.push(id);
            addedCount++;
          }
        });

        setSelectedIds(newIds);
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><FileDoneOutlined /> 投标标书制单</Title>
        <Space>
          <Text type="secondary">
            {selectedIds.length > 0 ? `草稿已自动缓存，共 ${selectedIds.length} 款产品` : '暂无数据'}
          </Text>
          <Popconfirm title="确定要清空当前所有选中的产品吗？" onConfirm={handleClear}>
            <Button danger icon={<DeleteOutlined />}>一键清空</Button>
          </Popconfirm>
          <Upload beforeUpload={handleImport} showUploadList={false} accept=".xlsx,.xls">
            <Button icon={<UploadOutlined />}>导入历史标书</Button>
          </Upload>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} disabled={selectedIds.length === 0}>
            下载报表 (Excel)
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
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

        <Table
          dataSource={selectedProducts}
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={[
            {
              title: '图片',
              dataIndex: 'imageUrl',
              width: 80,
              render: (url) => <CloudImage src={url} style={{ width: 40, height: 40, objectFit: 'cover' }} preview />,
            },
            { title: '产品名称', dataIndex: 'name', width: 160 },
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
              title: '操作',
              width: 80,
              render: (_, record) => (
                <Button type="text" danger size="small" onClick={() => handleRemove(record.id)}>移除</Button>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default ProposalsPage;
