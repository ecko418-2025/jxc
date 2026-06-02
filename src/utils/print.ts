import type { PurchaseOrder, SalesOrder } from '../database/types';
import dayjs from 'dayjs';

interface PrintContext {
  products: { id: string; name: string; sku?: string }[];
  parties: { id: string; name: string }[]; // Customers or Suppliers
}

export const printOrder = (
  order: PurchaseOrder | SalesOrder,
  type: 'purchase' | 'sales',
  context: PrintContext
) => {
  const isSales = type === 'sales';
  const title = isSales ? '销 售 单' : '采 购 单';
  const partyLabel = isSales ? '客户' : '供应商';
  const partyId = isSales ? (order as SalesOrder).customerId : (order as PurchaseOrder).supplierId;
  const partyName = context.parties.find(p => p.id === partyId)?.name || '—';
  
  const discountHtml = isSales && (order as SalesOrder).discount > 0 
    ? `<tr><td colspan="4" style="text-align: right; padding: 8px;"><strong>折扣:</strong></td><td style="padding: 8px; text-align: right;">-¥${Number((order as SalesOrder).discount).toFixed(2)}</td></tr>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>${title} - ${order.orderNo}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, 'Microsoft Yahei', sans-serif; padding: 40px; color: #333; line-height: 1.5; }
        h1 { text-align: center; font-size: 24px; margin-bottom: 24px; letter-spacing: 4px; }
        .header-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
        .header-info div { margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
        th, td { border: 1px solid #333; padding: 10px 8px; text-align: left; }
        th { background-color: #f5f5f5; text-align: center; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .footer-info { display: flex; justify-content: space-between; margin-top: 40px; font-size: 14px; }
        .sign-area { border-top: 1px solid #333; width: 150px; text-align: center; padding-top: 8px; margin-top: 40px; }
        .total-row td { font-weight: bold; font-size: 16px; }
        @media print {
          @page { margin: 1cm; }
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: right;">
        <button onclick="window.print()" style="padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">打印此单据</button>
      </div>
      
      <h1>${title}</h1>
      
      <div class="header-info">
        <div>
          <div><strong>单号：</strong>${order.orderNo}</div>
          <div><strong>${partyLabel}：</strong>${partyName}</div>
          <div><strong>日期：</strong>${dayjs(order.orderDate).format('YYYY-MM-DD HH:mm')}</div>
        </div>
        <div>
          <div><strong>对方单号：</strong>${order.extOrderNo || '—'}</div>
          <div><strong>发票编号：</strong>${order.invoiceNo || '—'}</div>
          <div><strong>备注：</strong>${order.remark || '—'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th width="5%">序号</th>
            <th width="15%">产品编码</th>
            <th width="40%">产品名称</th>
            <th width="10%">数量</th>
            <th width="15%">单价</th>
            <th width="15%">小计</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map((item, idx) => {
            const prod = context.products.find(p => p.id === item.productId);
            return `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td>${prod?.sku || '—'}</td>
                <td>${prod?.name || '—'}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">¥${Number(item.unitPrice).toFixed(2)}</td>
                <td class="text-right">¥${Number(item.subtotal).toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
          ${discountHtml}
          <tr class="total-row">
            <td colspan="5" class="text-right">合计：</td>
            <td class="text-right">¥${Number(order.totalAmount).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-info">
        <div>制单人：系统管理员</div>
        <div style="display: flex; gap: 60px;">
          <div class="sign-area">制单签字</div>
          <div class="sign-area">${isSales ? '客户' : '审批'}签字</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Some browsers need a slight delay to render before printing
    setTimeout(() => {
      printWindow.focus();
      // Auto trigger print dialog
      // printWindow.print(); 
      // User can click the print button we added in the HTML
    }, 200);
  } else {
    alert('请允许浏览器弹出窗口以进行打印。');
  }
};
