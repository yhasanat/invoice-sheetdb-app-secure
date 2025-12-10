/* -----------------------------------------
   invoice.js – منطق الفواتير
------------------------------------------*/

const AppState = {
  currentInvoice: null
};

const FIXED_PRODUCTS = [
  { barcode:"11001000111", name:"جاكيت" },
  { barcode:"20001000111", name:"بنطلون" },
  { barcode:"11001000211", name:"بلوزة جولف" }
];

function findProductByBarcode(barcode){
  return DataStore.products.find(p => p.barcode === barcode);
}

function getCustomerBalance(name){
  if(!name) return 0;
  let balance = 0;
  for(const inv of DataStore.invoices){
    if(inv.name !== name) continue;
    const total = Number(inv.total || 0);
    const paid  = Number(inv.paid  || 0);
    balance += (total - paid);
  }
  return balance;
}

async function createNewInvoice(type){
  AppState.currentInvoice = {
    id: generateInvoiceNumber(),
    type,
    name:"",
    dateISO: todayISO(),
    items:[],
    discount:0,
    paid:0,
    total:0
  };

  if(type === "retail"){
    $("#retail-invoice-number").textContent = AppState.currentInvoice.id;
    $("#retail-invoice-date").textContent = AppState.currentInvoice.dateISO;
    $("#retail-discount").value = 0;
    $("#retail-paid").value = 0;
    $("#retail-items-table tbody").innerHTML = "";
    updateInvoiceTotals("retail");
    renderQuickButtons();
  }else{
    $("#wh-invoice-number").textContent = AppState.currentInvoice.id;
    $("#wh-invoice-date").textContent = AppState.currentInvoice.dateISO;
    $("#wh-discount").value = 0;
    $("#wh-paid").value = 0;
    $("#wh-items-table tbody").innerHTML = "";
    updateInvoiceTotals("wholesale");
  }
}

function addItemToCurrentInvoice(barcode, qty, type){
  const product = findProductByBarcode(barcode);
  if(!product){
    alert("الصنف غير موجود في قاعدة الأصناف.");
    return;
  }
  if(!AppState.currentInvoice || AppState.currentInvoice.type !== type){
    createNewInvoice(type);
  }

  qty = Number(qty || 1);
  if(qty <= 0) qty = 1;

  const price = (type === "retail") ? Number(product.priceRetail || 0) : Number(product.priceWholesale || 0);
  const items = AppState.currentInvoice.items;
  let line = items.find(i => i.barcode === barcode);
  if(line){
    line.qty += qty;
  }else{
    line = { barcode:product.barcode, name:product.name, qty, price };
    items.push(line);
  }

  renderInvoiceItemsTable(type);
  updateInvoiceTotals(type);
}

function renderInvoiceItemsTable(type){
  const tbody = (type === "retail")
    ? $("#retail-items-table tbody")
    : $("#wh-items-table tbody");

  tbody.innerHTML = "";
  const items = AppState.currentInvoice.items;

  items.forEach((line, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${line.barcode}</td>
      <td class="text-right">${line.name}</td>
      <td>
        <input type="number" min="1" value="${line.qty}" data-barcode="${line.barcode}" class="input" style="max-width:65px;font-size:11px;padding:3px 4px;">
      </td>
      <td>${fnum(line.price)}</td>
      <td>${fnum(line.qty * line.price)}</td>
      <td><button class="btn secondary" data-remove="${line.barcode}" style="padding:2px 8px;font-size:10px;">حذف</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input[type='number']").forEach(inp => {
    inp.addEventListener("change", e => {
      const bc = e.target.dataset.barcode;
      let qty = Number(e.target.value || 1);
      if(qty <= 0) qty = 1;
      const line = AppState.currentInvoice.items.find(i => i.barcode === bc);
      if(line){
        line.qty = qty;
        updateInvoiceTotals(type);
        renderInvoiceItemsTable(type);
      }
    });
  });

  tbody.querySelectorAll("button[data-remove]").forEach(btn => {
    btn.addEventListener("click", e => {
      const bc = e.target.dataset.remove;
      AppState.currentInvoice.items = AppState.currentInvoice.items.filter(i => i.barcode !== bc);
      updateInvoiceTotals(type);
      renderInvoiceItemsTable(type);
    });
  });
}

function updateInvoiceTotals(type){
  if(!AppState.currentInvoice) return;
  const items = AppState.currentInvoice.items || [];
  let totalBefore = 0;
  items.forEach(i => totalBefore += i.qty * i.price);

  if(type === "retail"){
    const discount = Number($("#retail-discount").value || 0);
    const paid = Number($("#retail-paid").value || 0);
    const totalAfter = totalBefore - discount;
    const balance = totalAfter - paid;

    AppState.currentInvoice.discount = discount;
    AppState.currentInvoice.paid = paid;
    AppState.currentInvoice.total = totalAfter;

    $("#retail-total-before").textContent = fnum(totalBefore);
    $("#retail-total-after").textContent = fnum(totalAfter);
    $("#retail-balance").textContent = fnum(balance);
    $("#retail-current-invoice").textContent = fnum(totalAfter);

    const name = $("#retail-customer").value.trim();
    const prevBalance = getCustomerBalance(name);
    $("#retail-prev-balance").textContent = fnum(prevBalance);
    $("#retail-new-balance").textContent = fnum(prevBalance + balance);
  }else{
    const discount = Number($("#wh-discount").value || 0);
    const paid = Number($("#wh-paid").value || 0);
    const totalAfter = totalBefore - discount;
    const balance = totalAfter - paid;

    AppState.currentInvoice.discount = discount;
    AppState.currentInvoice.paid = paid;
    AppState.currentInvoice.total = totalAfter;

    $("#wh-total-before").textContent = fnum(totalBefore);
    $("#wh-total-after").textContent = fnum(totalAfter);
    $("#wh-balance").textContent = fnum(balance);
    $("#wh-current-invoice").textContent = fnum(totalAfter);

    const name = $("#wh-customer").value.trim();
    const prevBalance = getCustomerBalance(name);
    $("#wh-prev-balance").textContent = fnum(prevBalance);
    $("#wh-new-balance").textContent = fnum(prevBalance + balance);
  }
}

async function saveCurrentInvoice(type, paymentOnly = false){
  const isRetail = type === "retail";
  const nameInputId = isRetail ? "#retail-customer" : "#wh-customer";
  const discountInput = isRetail ? "#retail-discount" : "#wh-discount";
  const paidInput = isRetail ? "#retail-paid" : "#wh-paid";
  const accountTypeSelect = isRetail ? "#retail-account-type" : "#wh-account-type";

  const name = $(nameInputId).value.trim() || (isRetail ? "زبون نقدي" : "تاجر نقدي");
  const paid = Number($(paidInput).value || 0);
  const discount = Number(discountInput ? $(discountInput).value || 0 : 0);
  const customerType = accountTypeSelect ? $(accountTypeSelect).value : "cash";

  if(!AppState.currentInvoice || AppState.currentInvoice.type !== type){
    await createNewInvoice(type);
  }

  let totalAfter = 0;
  if(paymentOnly){
    AppState.currentInvoice.items = [];
    totalAfter = 0;
  }else{
    AppState.currentInvoice.items.forEach(i => totalAfter += i.qty * i.price);
    totalAfter -= discount;
  }

  AppState.currentInvoice.name = name;
  AppState.currentInvoice.total = totalAfter;
  AppState.currentInvoice.paid = paid;
  AppState.currentInvoice.discount = discount;
  AppState.currentInvoice.customerType = customerType;

  DataStore.invoices.push({...AppState.currentInvoice});

  const res = await saveInvoiceToDB(AppState.currentInvoice);

  if(res.status === "success"){
    alert(paymentOnly ? "تم تسجيل الدفعة في SheetDB." : "تم حفظ الفاتورة في SheetDB.");
  } else {
    queueInvoiceForSync(AppState.currentInvoice);
    alert("تم حفظ الفاتورة محلياً (أوفلاين). سيتم إرسالها عند توفر الإنترنت.");
  }

  await createNewInvoice(type);
  if(isRetail){
    $("#retail-customer").value = name;
    renderQuickButtons();
  }else{
    $("#wh-customer").value = name;
  }

  refreshDashboard();
}

/* كشف حساب */
function runStatement(){
  const name = $("#st-name").value.trim();
  const type = $("#st-type").value;
  const from = $("#st-from").value;
  const to = $("#st-to").value;
  const tbody = $("#st-table tbody");
  tbody.innerHTML = "";

  let balance = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = [];

  const filtered = DataStore.invoices
    .filter(inv => !name || inv.name === name)
    .filter(inv => type === "all" || inv.type === type)
    .filter(inv => {
      if(!from && !to) return true;
      if(from && inv.dateISO < from) return false;
      if(to && inv.dateISO > to) return false;
      return true;
    })
    .sort((a,b) => a.dateISO.localeCompare(b.dateISO) || String(a.id).localeCompare(String(b.id)));

  filtered.forEach(inv => {
    const debit = Number(inv.total || 0);
    const credit = Number(inv.paid || 0);
    balance += (debit - credit);
    totalDebit += debit;
    totalCredit += credit;

    const row = {
      dateISO: inv.dateISO,
      id: inv.id,
      type: inv.type === "retail" ? "فاتورة زبون" : "فاتورة تاجر",
      desc: inv.items && inv.items.length ? "فاتورة بيع" : "سند قبض",
      debit,
      credit,
      balance
    };

    rows.push(row);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.dateISO}</td>
      <td>${row.id}</td>
      <td>${row.type}</td>
      <td class="text-right">${row.desc}</td>
      <td>${fnum(row.debit)}</td>
      <td>${fnum(row.credit)}</td>
      <td>${fnum(row.balance)}</td>
    `;
    tbody.appendChild(tr);
  });

  window.__STATEMENT_ROWS__ = rows;
  window.__STATEMENT_TOTALS__ = {
    totalDebit,
    totalCredit,
    finalBalance: balance,
    name
  };

  $("#st-total-debit").textContent = fnum(totalDebit);
  $("#st-total-credit").textContent = fnum(totalCredit);
  $("#st-final-balance").textContent = fnum(balance);
}

/* أزرار الأصناف السريعة */
function getTopSellingProducts(limit = 9){
  const counter = {};
  DataStore.invoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      counter[item.barcode] = (counter[item.barcode] || 0) + item.qty;
    });
  });
  return Object.entries(counter)
    .sort((a,b)=>b[1] - a[1])
    .slice(0, limit)
    .map(([barcode]) => DataStore.products.find(p => p.barcode === barcode))
    .filter(Boolean);
}

function renderQuickButtons(){
  const box = $("#retail-quick-box");
  if(!box) return;
  box.innerHTML = "";

  const fixedBarcodes = FIXED_PRODUCTS.map(f => f.barcode);

  FIXED_PRODUCTS.forEach(fp => {
    const btn = create("div","quick-btn");
    btn.textContent = fp.name;
    btn.addEventListener("click", ()=> addItemToCurrentInvoice(fp.barcode, 1, "retail"));
    box.appendChild(btn);
  });

  const top = getTopSellingProducts(9)
    .filter(p => !fixedBarcodes.includes(p.barcode));

  top.forEach(p => {
    const btn = create("div","quick-btn");
    btn.textContent = p.name;
    btn.addEventListener("click", ()=> addItemToCurrentInvoice(p.barcode, 1, "retail"));
    box.appendChild(btn);
  });
}
