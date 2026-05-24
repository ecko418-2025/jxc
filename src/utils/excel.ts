// ========================================
// Excel 导入导出工具
// ========================================

import * as XLSX from 'xlsx';

import { categoryDB, productDB } from '../database/db';

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
