/* -------------------------------------------------
   data.js – إدارة البيانات عبر SheetDB + مخزون ديناميكي
---------------------------------------------------*/

const DataStore = {
  products: [],
  customers: [],
  invoices: []
};

const FALLBACK_PRODUCTS = [
  { barcode:"11001000111", name:"جاكيت", priceRetail:0, priceWholesale:0 },
  { barcode:"20001000111", name:"بنطلون", priceRetail:0, priceWholesale:0 },
  { barcode:"11001000411", name:"فروة رجالي", priceRetail:0, priceWholesale:0 },
  { barcode:"20001000121", name:"بنطلون 511 مبطن", priceRetail:0, priceWholesale:0 },
  { barcode:"20001000131", name:"بنطلون 511 بدون تبطين", priceRetail:0, priceWholesale:0 },
  { barcode:"30003000111", name:"بجامة ولادي", priceRetail:0, priceWholesale:0 },
  { barcode:"30001000111", name:"بجامة رجالي", priceRetail:0, priceWholesale:0 },
  { barcode:"11001000211", name:"بلوزة جولف", priceRetail:0, priceWholesale:0 },
  { barcode:"11001000221", name:"بلوزة هودي", priceRetail:0, priceWholesale:0 },
  { barcode:"50001000111", name:"قشاط", priceRetail:0, priceWholesale:0 },
  { barcode:"11001000311", name:"جاكيت فايبر SuperTex", priceRetail:0, priceWholesale:0 }
];

/* تحميل الأصناف – بدون الاعتماد على Products.stock */
async function loadProducts() {
  try {
    const rows = await sheetGet(SHEETDB.products);
    if (Array.isArray(rows) && rows.length) {
      DataStore.products = rows.map(p => ({
        barcode: p.barcode,
        name: p.name,
        priceRetail: Number(p.priceRetail || 0),
        priceWholesale: Number(p.priceWholesale || 0)
      }));
    } else {
      DataStore.products = FALLBACK_PRODUCTS.slice();
    }
  } catch (err) {
    console.error("Error loading products:", err);
    DataStore.products = FALLBACK_PRODUCTS.slice();
  }
}

/* تحميل العملاء */
async function loadCustomers() {
  try {
    const rows = await sheetGet(SHEETDB.customers);
    if (Array.isArray(rows) && rows.length) {
      DataStore.customers = rows;
    } else {
      DataStore.customers = [{ name:"زبون نقدي" }, { name:"تاجر" }];
    }
  } catch (err) {
    console.error("Error loading customers:", err);
    DataStore.customers = [{ name:"زبون نقدي" }, { name:"تاجر" }];
  }
  updateCustomersDatalist();
}

/* تحميل الفواتير + الأصناف */
async function loadInvoices() {
  try {
    const inv = await sheetGet(SHEETDB.invoices);
    const items = await sheetGet(SHEETDB.invoiceItems);

    const map = {};

    (inv || []).forEach(r => {
      map[r.id] = {
        id: r.id,
        type: r.type,
        name: r.name,
        customerType: r.customerType,
        dateISO: r.dateISO,
        discount: Number(r.discount || 0),
        paid: Number(r.paid || 0),
        total: Number(r.total || 0),
        items: []
      };
    });

    (items || []).forEach(line => {
      if (!map[line.invoiceId]) return;
      map[line.invoiceId].items.push({
        barcode: line.barcode,
        name: line.name,
        qty: Number(line.qty || 0),
        price: Number(line.priceRetail || line.priceWholesale || 0)
      });
    });

    DataStore.invoices = Object.values(map);

  } catch (err) {
    console.error("Error loading invoices:", err);
    DataStore.invoices = [];
  }
}

/* حساب مخزون جميع الأصناف من StockUpdates + InvoiceItems */
async function calculateAllStocks(){
  const adds = await sheetGet(SHEETDB.stockUpdates);
  const sales = await sheetGet(SHEETDB.invoiceItems);
  const stockMap = {};

  (adds || []).forEach(r => {
    const bc = r.barcode;
    const qty = Number(r.changeQty || 0);
    stockMap[bc] = (stockMap[bc] || 0) + qty;
  });

  (sales || []).forEach(r => {
    const bc = r.barcode;
    const qty = Number(r.qty || 0);
    stockMap[bc] = (stockMap[bc] || 0) - qty;
  });

  return stockMap;
}

/* حفظ فاتورة إلى SheetDB + تسجيل حركة بيع في StockUpdates */
async function saveInvoiceToDB(invoice) {
  try {
    await sheetPost(SHEETDB.invoices, {
      id: String(invoice.id),
      type: invoice.type,
      name: invoice.name,
      customerType: invoice.customerType,
      dateISO: invoice.dateISO,
      discount: invoice.discount,
      paid: invoice.paid,
      total: invoice.total
    });

    for (const line of (invoice.items || [])) {
      await sheetPost(SHEETDB.invoiceItems, {
        invoiceId: String(invoice.id),
        barcode: line.barcode,
        name: line.name,
        qty: line.qty,
        priceRetail: line.price,
        priceWholesale: line.price
      });

      await sheetPost(SHEETDB.stockUpdates, {
        barcode: line.barcode,
        changeQty: -line.qty,
        source: "sale",
        notes: "Invoice " + invoice.id,
        dateISO: invoice.dateISO
      });
    }

    return { status: "success" };

  } catch (err) {
    console.error("Error saving invoice:", err);
    return { status: "error", message: err.message };
  }
}

/* تسجيل حركة مخزون من إدارة الأصناف */
async function saveProductToDB(data) {
  try {
    await sheetPost(SHEETDB.stockUpdates, {
      barcode: data.barcode,
      changeQty: data.qty,
      source: data.source,
      notes: data.notes,
      dateISO: data.dateISO
    });
    return { status: "success" };
  } catch (err) {
    console.error("Error saving stock update:", err);
    return { status: "error", message: err.message };
  }
}

/* Datalist */
function updateCustomersDatalist() {
  const dl = $("#customers-list");
  if (!dl) return;
  dl.innerHTML = "";
  const names = [...new Set(DataStore.customers.map(c => c.name))];
  names.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    dl.appendChild(opt);
  });
}

/* تحميل أولي */
async function loadAllData() {
  await loadProducts();
  await loadCustomers();
  await loadInvoices();
}
