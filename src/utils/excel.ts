// ========================================
// Excel 导入导出工具
// ========================================

import * as XLSX from 'xlsx';

import { categoryDB, productDB, customerDB, supplierDB } from '../database/db';

export interface ImportResult {
  success: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

// ---- Download template ----
export function downloadCategoryTemplate() {
  const headers = ['品类编码', '品类名称', '上级品类编码', '说明'];
  const example = [
    ['BJ-001', '客房清洁', '', '一级品类'],
    ['BJ-001-01', '清洁剂', 'BJ-001', '二级品类'],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '品类导入模板');
  XLSX.writeFile(wb, '品类导入模板.xlsx');
}

export function downloadProductTemplate() {
  const headers = ['产品编码', '产品名称', '品类编码', '规格', '单位', '品牌', '采购价', '销售价', '最低库存'];
  const example = [
    ['P-0001', '多功能清洁剂', 'BJ-001-01', '5L/桶', '桶', '洁霸', 35, 58, 50],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  ws['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
    { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '产品导入模板');
  XLSX.writeFile(wb, '产品导入模板.xlsx');
}

// ---- Parse Excel file ----
export function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet);
        resolve(rows as Record<string, unknown>[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ---- Import categories from Excel ----
export async function importCategories(file: File): Promise<ImportResult> {
  const rows = await parseExcelFile(file);
  const result: ImportResult = { success: 0, skipped: 0, errors: [] };
  
  const allCats = await categoryDB.getAll();
  const existingCodes = new Set(allCats.map(c => c.code));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const code = String(row['品类编码'] || '').trim();
    const name = String(row['品类名称'] || '').trim();
    const parentCode = String(row['上级品类编码'] || '').trim();
    const description = String(row['说明'] || '').trim();

    if (!code || !name) {
      result.errors.push({ row: i + 2, message: '品类编码和名称为必填项' });
      continue;
    }

    if (existingCodes.has(code)) {
      result.skipped++;
      continue;
    }

    let parentId: string | undefined;
    if (parentCode) {
      // NOTE: Here we only look at the initial loaded cats.
      // If parent is created in the same batch, this simple logic might miss it.
      // A two-pass approach is better for production, but kept simple here.
      const parent = allCats.find(c => c.code === parentCode);
      if (!parent) {
        result.errors.push({ row: i + 2, message: `未找到上级品类: ${parentCode}` });
        continue;
      }
      parentId = parent.id;
    }

    try {
      await categoryDB.create({ code, name, parentId, description });
      existingCodes.add(code);
      result.success++;
    } catch (e: any) {
      result.errors.push({ row: i + 2, message: `插入失败: ${e.message}` });
    }
  }

  return result;
}

// ---- Import products from Excel ----
export async function importProducts(file: File): Promise<ImportResult> {
  const rows = await parseExcelFile(file);
  const result: ImportResult = { success: 0, skipped: 0, errors: [] };
  
  const allProds = await productDB.getAll();
  const categories = await categoryDB.getAll();
  const existingSkus = new Set(allProds.map(p => p.sku));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sku = String(row['产品编码'] || '').trim();
    const name = String(row['产品名称'] || '').trim();
    const catCode = String(row['品类编码'] || '').trim();
    const spec = String(row['规格'] || '').trim();
    const unit = String(row['单位'] || '').trim();
    const brand = String(row['品牌'] || '').trim();
    const purchasePrice = Number(row['采购价']) || 0;
    const salePrice = Number(row['销售价']) || 0;
    const minStock = Number(row['最低库存']) || 0;

    if (!sku || !name) {
      result.errors.push({ row: i + 2, message: '产品编码和名称为必填项' });
      continue;
    }

    if (existingSkus.has(sku)) {
      result.skipped++;
      continue;
    }

    const category = categories.find(c => c.code === catCode);
    if (!category) {
      result.errors.push({ row: i + 2, message: `未找到品类: ${catCode}` });
      continue;
    }

    try {
      await productDB.create({
        sku, name, categoryId: category.id,
        unit, spec, brand,
        purchasePrice, salePrice, minStock,
        active: true,
      });
      existingSkus.add(sku);
      result.success++;
    } catch (e: any) {
      result.errors.push({ row: i + 2, message: `插入失败: ${e.message}` });
    }
  }

  return result;
}

// ---- Export data to Excel ----
export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Export current products list
export async function exportProducts() {
  const products = await productDB.getAll();
  const categories = await categoryDB.getAll();
  
  const data = products.map(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    return {
      '产品编码': p.sku,
      '产品名称': p.name,
      '品类': cat?.name || '',
      '规格': p.spec,
      '单位': p.unit,
      '品牌': p.brand,
      '采购价': p.purchasePrice,
      '销售价': p.salePrice,
      '最低库存': p.minStock,
      '状态': p.active ? '启用' : '停用',
    };
  });

  exportToExcel(data, '产品列表', '产品');
}

// Export current categories list
export async function exportCategories() {
  const categories = await categoryDB.getAll();
  
  const data = categories.map(c => {
    const parent = c.parentId ? categories.find(p => p.id === c.parentId) : null;
    return {
      '品类编码': c.code,
      '品类名称': c.name,
      '上级品类': parent?.name || '',
      '说明': c.description || '',
    };
  });

  exportToExcel(data, '品类列表', '品类');
}

// ---- Parse Multi-Sheet Excel file ----
export function parseMultiSheetExcelFile(file: File): Promise<Record<string, Record<string, unknown>[]>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const result: Record<string, Record<string, unknown>[]> = {};
        for (const sheetName of workbook.SheetNames) {
          result[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ---- Export all data to Excel ----
export async function exportAllToExcel() {
  const [categories, products, customers, suppliers] = await Promise.all([
    categoryDB.getAll(),
    productDB.getAll(),
    customerDB.getAll(),
    supplierDB.getAll(),
  ]);

  const wb = XLSX.utils.book_new();

  // Categories
  const catData = categories.map(c => {
    const parent = c.parentId ? categories.find(p => p.id === c.parentId) : null;
    return {
      '品类编码': c.code,
      '品类名称': c.name,
      '上级品类编码': parent?.code || '',
      '说明': c.description || '',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catData), '品类');

  // Products
  const prodData = products.map(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    return {
      '产品编码': p.sku,
      '产品名称': p.name,
      '品类编码': cat?.code || '',
      '规格': p.spec || '',
      '单位': p.unit || '',
      '品牌': p.brand || '',
      '采购价': p.purchasePrice || 0,
      '销售价': p.salePrice || 0,
      '最低库存': p.minStock || 0,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), '产品');

  // Customers
  const custData = customers.map(c => ({
    '名称': c.name,
    '等级': c.level || '普通',
    '联系人': c.contact || '',
    '电话': c.phone || '',
    '地址': c.address || '',
    '信用额度': c.creditLimit || 0,
    '备注': c.remark || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custData), '客户');

  // Suppliers
  const suppData = suppliers.map(s => ({
    '名称': s.name,
    '联系人': s.contact || '',
    '电话': s.phone || '',
    '地址': s.address || '',
    '开户行及账号': s.bankAccount || '',
    '备注': s.remark || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppData), '供应商');

  XLSX.writeFile(wb, '全量数据备份.xlsx');
}

// ---- Restore from Excel ----
export async function restoreFromExcel(file: File): Promise<string[]> {
  const sheets = await parseMultiSheetExcelFile(file);
  const logs: string[] = [];

  // Restore Categories
  if (sheets['品类']) {
    const rows = sheets['品类'];
    const existing = await categoryDB.getAll();
    let count = 0;
    for (const row of rows) {
      const code = String(row['品类编码'] || '').trim();
      const name = String(row['品类名称'] || '').trim();
      if (!code || !name) continue;
      
      const parentCode = String(row['上级品类编码'] || '').trim();
      let parentId = undefined;
      if (parentCode) {
         const parent = existing.find(c => c.code === parentCode);
         if (parent) parentId = parent.id;
      }
      
      const match = existing.find(c => c.code === code);
      if (match) {
        await categoryDB.update(match.id, { name, parentId, description: String(row['说明'] || '') });
      } else {
        await categoryDB.create({ code, name, parentId, description: String(row['说明'] || '') });
      }
      count++;
    }
    logs.push(`成功处理 ${count} 条品类`);
  }

  // Restore Products
  if (sheets['产品']) {
    const rows = sheets['产品'];
    const existing = await productDB.getAll();
    const categories = await categoryDB.getAll();
    let count = 0;
    for (const row of rows) {
      const sku = String(row['产品编码'] || '').trim();
      const name = String(row['产品名称'] || '').trim();
      if (!sku || !name) continue;
      
      const catCode = String(row['品类编码'] || '').trim();
      const category = categories.find(c => c.code === catCode);
      const categoryId = category ? category.id : existing.find(p => p.sku === sku)?.categoryId || '';
      
      const payload = {
        name,
        categoryId,
        spec: String(row['规格'] || ''),
        unit: String(row['单位'] || ''),
        brand: String(row['品牌'] || ''),
        purchasePrice: Number(row['采购价']) || 0,
        salePrice: Number(row['销售价']) || 0,
        minStock: Number(row['最低库存']) || 0,
      };

      const match = existing.find(p => p.sku === sku);
      if (match) {
        await productDB.update(match.id, payload);
      } else {
        await productDB.create({ sku, ...payload, active: true });
      }
      count++;
    }
    logs.push(`成功处理 ${count} 条产品`);
  }

  // Restore Customers
  if (sheets['客户']) {
    const rows = sheets['客户'];
    const existing = await customerDB.getAll();
    let count = 0;
    for (const row of rows) {
      const name = String(row['名称'] || '').trim();
      if (!name) continue;
      
      const payload = {
        name,
        level: String(row['等级'] || '普通'),
        contact: String(row['联系人'] || ''),
        phone: String(row['电话'] || ''),
        address: String(row['地址'] || ''),
        creditLimit: Number(row['信用额度']) || 0,
        remark: String(row['备注'] || ''),
      };

      const match = existing.find(c => c.name === name);
      if (match) {
        await customerDB.update(match.id, payload);
      } else {
        await customerDB.create(payload);
      }
      count++;
    }
    logs.push(`成功处理 ${count} 个客户`);
  }

  // Restore Suppliers
  if (sheets['供应商']) {
    const rows = sheets['供应商'];
    const existing = await supplierDB.getAll();
    let count = 0;
    for (const row of rows) {
      const name = String(row['名称'] || '').trim();
      if (!name) continue;
      
      const payload = {
        name,
        contact: String(row['联系人'] || ''),
        phone: String(row['电话'] || ''),
        address: String(row['地址'] || ''),
        bankAccount: String(row['开户行及账号'] || ''),
        remark: String(row['备注'] || ''),
      };

      const match = existing.find(s => s.name === name);
      if (match) {
        await supplierDB.update(match.id, payload);
      } else {
        await supplierDB.create(payload);
      }
      count++;
    }
    logs.push(`成功处理 ${count} 个供应商`);
  }

  return logs;
}
