// ========================================
// 产品管理页面 - Products Management
// ========================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag,
  Tabs, Card, Tree, message, Upload, Popconfirm, Switch, Typography, Row, Col,
  Badge, Tooltip, Alert, Spin,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  DownloadOutlined, FileExcelOutlined,
  AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons';

import { productDB, categoryDB, inventoryDB } from '../../database/db';
import type { Product, Category, InventoryRecord } from '../../database/types';
import {
  downloadCategoryTemplate, downloadProductTemplate,
  importCategories, importProducts,
  exportProducts, exportCategories,
} from '../../utils/excel';

const { Search } = Input;
const { Text } = Typography;

const ProductsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventories, setInventories] = useState<InventoryRecord[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [importType, setImportType] = useState<'category' | 'product'>('product');
  const [productForm] = Form.useForm();
  const [categoryForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('products');

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [p, c, invs] = await Promise.all([
        productDB.getAll(),
        categoryDB.getAll(),
        inventoryDB.getAll()
      ]);
      setProducts(p);
      setCategories(c);
      setInventories(invs);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Build tree data for categories
  const buildCategoryTree = (cats: Category[], parentId?: string): any[] => {
    return cats
      .filter(c => (c.parentId || undefined) === parentId)
      .map(c => ({
        key: c.id,
        title: `${c.name} (${c.code})`,
        children: buildCategoryTree(cats, c.id),
      }));
  };
  const categoryTree = buildCategoryTree(categories);

  // Filtered products
  const filteredProducts = products.filter(p => {
    const matchCategory = !selectedCategory || p.categoryId === selectedCategory;
    const matchSearch = !searchText ||
      p.name.toLowerCase().includes(searchText.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchText.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchText.toLowerCase());
    return matchCategory && matchSearch;
  });

  // ---- Product CRUD ----
  const handleSaveProduct = async () => {
    try {
      const values = await productForm.validateFields();
      if (editingProduct) {
        await productDB.update(editingProduct.id, values);
        message.success('产品已更新');
      } else {
        await productDB.create(values);
        message.success('产品已添加');
      }
      setProductModalOpen(false);
      productForm.resetFields();
      setEditingProduct(null);
      refreshData();
    } catch (err: any) {
      if (err.errorFields) return; // Validation failed
      message.error('操作失败: ' + (err.message || '未知错误'));
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    productForm.setFieldsValue(product);
    setProductModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await productDB.delete(id);
      message.success('产品已删除');
      refreshData();
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || ''));
    }
  };

  // ---- Category CRUD ----
  const handleSaveCategory = async () => {
    try {
      const values = await categoryForm.validateFields();
      if (editingCategory) {
        await categoryDB.update(editingCategory.id, values);
        message.success('品类已更新');
      } else {
        await categoryDB.create(values);
        message.success('品类已添加');
      }
      setCategoryModalOpen(false);
      categoryForm.resetFields();
      setEditingCategory(null);
      refreshData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('操作失败: ' + (err.message || ''));
    }
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    categoryForm.setFieldsValue(cat);
    setCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (id: string) => {
    // Check if any products use this category
    const hasProducts = products.some(p => p.categoryId === id);
    if (hasProducts) {
      message.error('该品类下有产品，无法删除');
      return;
    }
    try {
      await categoryDB.delete(id);
      message.success('品类已删除');
      if (selectedCategory === id) setSelectedCategory(null);
      refreshData();
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || ''));
    }
  };

  // ---- Excel Import ----
  const handleImport = async (file: File) => {
    try {
      const result = importType === 'category'
        ? await importCategories(file)
        : await importProducts(file);

      if (result.success > 0) {
        message.success(`成功导入 ${result.success} 条记录`);
      }
      if (result.skipped > 0) {
        message.warning(`跳过 ${result.skipped} 条重复记录`);
      }
      if (result.errors.length > 0) {
        Modal.warning({
          title: '部分数据导入失败',
          content: (
            <div>
              {result.errors.map((e, i) => (
                <div key={i}>第 {e.row} 行: {e.message}</div>
              ))}
            </div>
          ),
        });
      }
      refreshData();
      setImportModalOpen(false);
    } catch (err) {
      message.error('文件解析失败，请检查文件格式');
    }
    return false; // Prevent auto upload
  };

  // Table columns for products
  const productColumns = [
    {
      title: '编码',
      dataIndex: 'sku',
      width: 100,
      sorter: (a: Product, b: Product) => a.sku.localeCompare(b.sku),
      render: (sku: string) => <Text style={{ color: 'var(--text-accent)', fontFamily: 'monospace' }}>{sku}</Text>,
    },
    {
      title: '产品名称',
      dataIndex: 'name',
      width: 180,
      sorter: (a: Product, b: Product) => a.name.localeCompare(b.name),
      render: (name: string) => <Text strong style={{ color: 'var(--text-primary)' }}>{name}</Text>,
    },
    {
      title: '品类',
      dataIndex: 'categoryId',
      width: 120,
      sorter: (a: Product, b: Product) => {
        const catA = categories.find(c => c.id === a.categoryId)?.name || '';
        const catB = categories.find(c => c.id === b.categoryId)?.name || '';
        return catA.localeCompare(catB);
      },
      render: (catId: string) => {
        const cat = categories.find(c => c.id === catId);
        return <Tag color="blue">{cat?.name || '未分类'}</Tag>;
      },
    },
    { title: '规格', dataIndex: 'spec', width: 100 },
    { title: '单位', dataIndex: 'unit', width: 60 },
    { 
      title: '品牌', 
      dataIndex: 'brand', 
      width: 80,
      sorter: (a: Product, b: Product) => (a.brand || '').localeCompare(b.brand || '') 
    },
    {
      title: '采购价',
      dataIndex: 'purchasePrice',
      width: 90,
      sorter: (a: Product, b: Product) => Number(a.purchasePrice) - Number(b.purchasePrice),
      render: (v: number) => <Text style={{ color: 'var(--text-secondary)' }}>¥{Number(v).toFixed(2)}</Text>,
    },
    {
      title: '销售价',
      dataIndex: 'salePrice',
      width: 90,
      sorter: (a: Product, b: Product) => Number(a.salePrice) - Number(b.salePrice),
      render: (v: number) => <Text style={{ color: '#22c55e' }}>¥{Number(v).toFixed(2)}</Text>,
    },
    {
      title: '库存',
      width: 80,
      sorter: (a: Product, b: Product) => {
        const qtyA = (inventories.find(i => i.productId === a.id) as any)?.quantity || 0;
        const qtyB = (inventories.find(i => i.productId === b.id) as any)?.quantity || 0;
        return qtyA - qtyB;
      },
      render: (_: unknown, record: Product) => {
        const inv = inventories.find(i => i.productId === record.id) as any;
        const qty = inv?.quantity ?? inv?.currentQty ?? 0;
        const isLow = qty <= record.minStock;
        return (
          <Space>
            <Text style={{ color: isLow ? '#ef4444' : 'var(--text-primary)' }}>{qty}</Text>
            {isLow && <Badge status="error" />}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'active',
      width: 70,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, record: Product) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditProduct(record)} />
          </Tooltip>
          <Popconfirm title="确定删除?" onConfirm={() => handleDeleteProduct(record.id)}>
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Category table columns
  const categoryColumns = [
    { title: '编码', dataIndex: 'code', width: 120 },
    { title: '品类名称', dataIndex: 'name', width: 160 },
    {
      title: '上级品类',
      dataIndex: 'parentId',
      width: 120,
      render: (parentId: string) => {
        if (!parentId) return <Text style={{ color: 'var(--text-muted)' }}>—</Text>;
        const parent = categories.find(c => c.id === parentId);
        return parent?.name || '—';
      },
    },
    { title: '说明', dataIndex: 'description', width: 200 },
    {
      title: '产品数',
      width: 80,
      render: (_: unknown, record: Category) => products.filter(p => p.categoryId === record.id).length,
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, record: Category) => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditCategory(record)} />
          <Popconfirm title="确定删除?" onConfirm={() => handleDeleteCategory(record.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在加载数据..." />
      </div>
    );
  }

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'products',
            label: <Space><UnorderedListOutlined />产品列表</Space>,
            children: (
              <Row gutter={16}>
                {/* Category tree sidebar */}
                <Col xs={24} lg={6}>
                  <Card
                    title="产品品类"
                    size="small"
                    extra={
                      <Button
                        type="text"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setEditingCategory(null);
                          categoryForm.resetFields();
                          setCategoryModalOpen(true);
                        }}
                      />
                    }
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Button
                        type={!selectedCategory ? 'primary' : 'text'}
                        size="small"
                        block
                        onClick={() => setSelectedCategory(null)}
                        style={{ textAlign: 'left' }}
                      >
                        全部产品 ({products.length})
                      </Button>
                    </div>
                    {categoryTree.length > 0 ? (
                      <Tree
                        treeData={categoryTree}
                        selectedKeys={selectedCategory ? [selectedCategory] : []}
                        onSelect={(keys) => setSelectedCategory(keys[0] as string || null)}
                        showLine
                        blockNode
                        style={{ color: 'var(--text-primary)' }}
                      />
                    ) : (
                      <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>暂无品类</Text>
                    )}
                  </Card>
                </Col>

                {/* Products table */}
                <Col xs={24} lg={18}>
                  <Card size="small">
                    <Space style={{ marginBottom: 16, flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Search
                          placeholder="搜索产品名称/编码/品牌"
                          allowClear
                          style={{ width: 250 }}
                          onSearch={setSearchText}
                          onChange={e => !e.target.value && setSearchText('')}
                        />
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setEditingProduct(null);
                            productForm.resetFields();
                            productForm.setFieldsValue({ active: true, minStock: 10 });
                            setProductModalOpen(true);
                          }}
                        >
                          新增产品
                        </Button>
                      </Space>
                      <Space>
                        <Button
                          icon={<UploadOutlined />}
                          onClick={() => { setImportType('product'); setImportModalOpen(true); }}
                        >
                          Excel导入
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={() => exportProducts()}>
                          导出
                        </Button>
                      </Space>
                    </Space>
                    <Table
                      dataSource={filteredProducts}
                      columns={productColumns}
                      rowKey="id"
                      size="small"
                      pagination={{ defaultPageSize: 15, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                      scroll={{ x: 1100 }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'categories',
            label: <Space><AppstoreOutlined />品类管理</Space>,
            children: (
              <Card size="small">
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingCategory(null);
                      categoryForm.resetFields();
                      setCategoryModalOpen(true);
                    }}
                  >
                    新增品类
                  </Button>
                  <Button
                    icon={<UploadOutlined />}
                    onClick={() => { setImportType('category'); setImportModalOpen(true); }}
                  >
                    Excel导入
                  </Button>
                  <Button icon={<DownloadOutlined />} onClick={() => exportCategories()}>
                    导出品类
                  </Button>
                </Space>
                <Table
                  dataSource={categories}
                  columns={categoryColumns}
                  rowKey="id"
                  size="small"
                  pagination={{ defaultPageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 1000 }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Product Modal */}
      <Modal
        title={editingProduct ? '编辑产品' : '新增产品'}
        open={productModalOpen}
        onOk={handleSaveProduct}
        onCancel={() => { setProductModalOpen(false); setEditingProduct(null); }}
        width={680}
        okText="保存"
        cancelText="取消"
      >
        <Form form={productForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sku" label="产品编码" rules={[{ required: true, message: '请输入产品编码' }]}>
                <Input placeholder="例如: P-0001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
                <Input placeholder="产品名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="categoryId" label="品类" rules={[{ required: true, message: '请选择品类' }]}>
                <Select placeholder="选择品类">
                  {categories.map(c => (
                    <Select.Option key={c.id} value={c.id}>{c.name} ({c.code})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="brand" label="品牌" rules={[{ required: true, message: '请输入品牌' }]}>
                <Input placeholder="品牌" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="spec" label="规格型号" rules={[{ required: true }]}>
                <Input placeholder="例如: 5L/桶" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit" label="计量单位" rules={[{ required: true }]}>
                <Select placeholder="选择单位">
                  {['桶', '瓶', '箱', '袋', '罐', '条', '把', '双', '套', '卷', '个', '件'].map(u => (
                    <Select.Option key={u} value={u}>{u}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="minStock" label="最低库存">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="预警数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="purchasePrice" label="采购价(¥)" rules={[{ required: true }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="salePrice" label="销售价(¥)" rules={[{ required: true }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="active" label="状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Category Modal */}
      <Modal
        title={editingCategory ? '编辑品类' : '新增品类'}
        open={categoryModalOpen}
        onOk={handleSaveCategory}
        onCancel={() => { setCategoryModalOpen(false); setEditingCategory(null); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={categoryForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="code" label="品类编码" rules={[{ required: true }]}>
            <Input placeholder="例如: BJ-001" />
          </Form.Item>
          <Form.Item name="name" label="品类名称" rules={[{ required: true }]}>
            <Input placeholder="品类名称" />
          </Form.Item>
          <Form.Item name="parentId" label="上级品类">
            <Select placeholder="选择上级品类（可选）" allowClear>
              {categories
                .filter(c => c.id !== editingCategory?.id)
                .map(c => (
                  <Select.Option key={c.id} value={c.id}>{c.name} ({c.code})</Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} placeholder="品类说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title={`Excel导入${importType === 'category' ? '品类' : '产品'}`}
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={null}
        width={520}
      >
        <div style={{ marginTop: 16 }}>
          <Alert
            message="导入说明"
            description={
              <ul style={{ paddingLeft: 16, margin: '8px 0 0' }}>
                <li>请先下载模板，按模板格式填写数据</li>
                <li>编码重复的记录会自动跳过</li>
                <li>支持 .xlsx 和 .xls 格式</li>
              </ul>
            }
            type="info"
            style={{ marginBottom: 16 }}
          />
          <Space style={{ marginBottom: 16 }}>
            <Button
              icon={<FileExcelOutlined />}
              onClick={importType === 'category' ? downloadCategoryTemplate : downloadProductTemplate}
            >
              下载导入模板
            </Button>
          </Space>
          <Upload.Dragger
            accept=".xlsx,.xls"
            maxCount={1}
            beforeUpload={(file) => {
              handleImport(file);
              return false;
            }}
            showUploadList={false}
          >
            <p style={{ fontSize: 40, color: 'var(--primary-500)', marginBottom: 8 }}>
              <UploadOutlined />
            </p>
            <p style={{ color: 'var(--text-primary)', fontSize: 14 }}>
              点击或拖拽 Excel 文件到此处
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              支持 .xlsx, .xls 格式
            </p>
          </Upload.Dragger>
        </div>
      </Modal>
    </div>
  );
};

export default ProductsPage;
