// ========================================
// 示例数据种子 - 酒店保洁产品
// ========================================

import { categoryDB, productDB, supplierDB, customerDB, purchaseOrderDB, salesOrderDB } from './db';

const generateId = () => Math.random().toString(36).substr(2, 9);

export async function seedDemoData() {
  // 不再检查是否已存在，允许重复添加以生成更多随机数据
  // const existingCats = await categoryDB.getAll();
  // if (existingCats.length > 0) return;

  // ---- Categories ----
  const cat1Id = generateId();
  const cat2Id = generateId();
  const cat3Id = generateId();
  const cat4Id = generateId();
  const cat5Id = generateId();

  await Promise.all([
    categoryDB.create({ id: cat1Id, code: 'BJ-001-' + generateId(), name: '客房清洁', description: '客房日常清洁用品' } as any),
    categoryDB.create({ id: cat2Id, code: 'BJ-002-' + generateId(), name: '公区保洁', description: '公共区域清洁用品' } as any),
    categoryDB.create({ id: cat3Id, code: 'BJ-003-' + generateId(), name: '洗涤用品', description: '洗衣房及清洗用品' } as any),
    categoryDB.create({ id: cat4Id, code: 'BJ-004-' + generateId(), name: '一次性用品', description: '客房一次性消耗品' } as any),
    categoryDB.create({ id: cat5Id, code: 'BJ-005-' + generateId(), name: '清洁工具', description: '各类清洁器具' } as any),
  ]);

  // ---- Products ----
  const products = [
    { id: generateId(), sku: 'P-' + generateId(), name: '多功能清洁剂', categoryId: cat1Id, unit: '桶', spec: '5L/桶', brand: '洁霸', purchasePrice: 35, salePrice: 58, minStock: 50, active: true },
    { id: generateId(), sku: 'P-' + generateId(), name: '84消毒液', categoryId: cat1Id, unit: '瓶', spec: '1L/瓶', brand: '蓝月亮', purchasePrice: 8, salePrice: 15, minStock: 100, active: true },
    { id: generateId(), sku: 'P-' + generateId(), name: '空气清新剂', categoryId: cat2Id, unit: '罐', spec: '320ml/罐', brand: '花仙子', purchasePrice: 12, salePrice: 22, minStock: 80, active: true },
    { id: generateId(), sku: 'P-' + generateId(), name: '洗衣液(商用)', categoryId: cat3Id, unit: '桶', spec: '25kg/桶', brand: '奥妙', purchasePrice: 120, salePrice: 198, minStock: 15, active: true },
    { id: generateId(), sku: 'P-' + generateId(), name: '一次性牙刷套装', categoryId: cat4Id, unit: '套', spec: '200套/箱', brand: '洁丽雅', purchasePrice: 65, salePrice: 110, minStock: 30, active: true },
    { id: generateId(), sku: 'P-' + generateId(), name: '超细纤维抹布', categoryId: cat5Id, unit: '条', spec: '30x30cm', brand: '3M', purchasePrice: 3, salePrice: 6.5, minStock: 200, active: true },
  ];

  await productDB.bulkCreate(products);

  // ---- Suppliers ----
  const sup1Id = generateId();
  const sup2Id = generateId();
  await Promise.all([
    supplierDB.create({ id: sup1Id, name: '广州洁霸日化有限公司', contact: '张经理', phone: '13800138001', address: '广州市白云区太和镇工业园A栋' } as any),
    supplierDB.create({ id: sup2Id, name: '上海蓝月亮日用品公司', contact: '李总', phone: '13900139001', address: '上海市松江区九亭镇科技路88号' } as any),
  ]);

  // ---- Customers (Hotels) ----
  const cust1Id = generateId();
  const cust2Id = generateId();
  await Promise.all([
    customerDB.create({ id: cust1Id, name: '锦江之星（市中心店）', contact: '刘店长', phone: '0571-88001234', address: '杭州市上城区中山中路108号', level: '金牌' } as any),
    customerDB.create({ id: cust2Id, name: '如家快捷酒店（西湖店）', contact: '陈经理', phone: '0571-87005678', address: '杭州市西湖区北山路56号', level: '银牌' } as any),
  ]);

  // ---- Random Purchase Orders ----
  for (let i = 0; i < 3; i++) {
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const qty = Math.floor(Math.random() * 50) + 10;
    await purchaseOrderDB.create({
      id: generateId(),
      supplierId: i % 2 === 0 ? sup1Id : sup2Id,
      orderDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
      totalAmount: randomProduct.purchasePrice * qty,
      status: 'completed',
      remark: '系统自动生成的随机采购单',
      items: [
        { productId: randomProduct.id, quantity: qty, unitPrice: randomProduct.purchasePrice }
      ]
    } as any);
  }

  // ---- Random Sales Orders ----
  for (let i = 0; i < 5; i++) {
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const qty = Math.floor(Math.random() * 20) + 5;
    await salesOrderDB.create({
      id: generateId(),
      customerId: i % 2 === 0 ? cust1Id : cust2Id,
      orderDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
      totalAmount: randomProduct.salePrice * qty,
      discount: 0,
      status: 'shipped',
      paymentStatus: 'paid',
      remark: '系统自动生成的随机销售单',
      items: [
        { productId: randomProduct.id, quantity: qty, unitPrice: randomProduct.salePrice }
      ]
    } as any);
  }
}
