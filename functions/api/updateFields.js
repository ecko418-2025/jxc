const CATEGORY_UPDATE_FIELDS = {
  code: 'code',
  name: 'name',
  parentId: 'parent_id',
  description: 'description'
};

const PRODUCT_UPDATE_FIELDS = {
  sku: 'sku',
  name: 'name',
  categoryId: 'category_id',
  unit: 'unit',
  spec: 'spec',
  brand: 'brand',
  purchasePrice: 'purchase_price',
  salePrice: 'sale_price',
  minStock: 'min_stock',
  active: 'active',
  imageUrl: 'image_url'
};

const SUPPLIER_UPDATE_FIELDS = {
  name: 'name',
  contact: 'contact',
  phone: 'phone',
  address: 'address',
  bankAccount: 'bank_account',
  remark: 'remark'
};

const CUSTOMER_UPDATE_FIELDS = {
  name: 'name',
  contact: 'contact',
  phone: 'phone',
  address: 'address',
  level: 'level',
  creditLimit: 'credit_limit',
  remark: 'remark'
};

function buildUpdateClause(payload, fieldMap) {
  const assignments = [];
  const values = [];

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'id') continue;
    const column = fieldMap[key];
    if (!column) {
      throw new Error(`Invalid update field: ${key}`);
    }
    assignments.push(`${column} = ?`);
    values.push(value);
  }

  return {
    setClause: assignments.join(', '),
    values
  };
}

module.exports = {
  buildUpdateClause,
  CATEGORY_UPDATE_FIELDS,
  PRODUCT_UPDATE_FIELDS,
  SUPPLIER_UPDATE_FIELDS,
  CUSTOMER_UPDATE_FIELDS
};
