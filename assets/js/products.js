/* -----------------------------------------
   products.js – إدارة الأصناف والمخزون الديناميكي
------------------------------------------*/

async function renderStockTable(filterText=""){
  const tbody = $("#stock-table tbody");
  if(!tbody) return;
  tbody.innerHTML = "";

  const text = (filterText || "").toLowerCase();
  const stockMap = await calculateAllStocks();

  DataStore.products
    .filter(p =>
      !text ||
      String(p.barcode || "").includes(text) ||
      (p.name && String(p.name).toLowerCase().includes(text))
    )
    .forEach(p => {
      const stock = stockMap[p.barcode] ?? 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.barcode}</td>
        <td class="text-right">${p.name}</td>
        <td>${fnum(p.priceRetail)}</td>
        <td>${fnum(p.priceWholesale)}</td>
        <td>${stock}</td>
      `;
      tr.addEventListener("click", () => {
        $("#stock-barcode").value = p.barcode;
        $("#stock-name").value = p.name;
        $("#stock-price-retail").value = p.priceRetail;
        $("#stock-price-wholesale").value = p.priceWholesale;
        $("#stock-qty").value = "";
      });
      tbody.appendChild(tr);
    });
}

async function saveStockItem(){
  const barcode = $("#stock-barcode").value.trim();
  const name = $("#stock-name").value.trim();
  const priceRetail = Number($("#stock-price-retail").value || 0);
  const priceWholesale = Number($("#stock-price-wholesale").value || 0);
  const qty = Number($("#stock-qty").value || 0);
  const source = $("#stock-source").value;
  const notes = $("#stock-notes").value.trim();

  if(!barcode || !name){
    alert("الرجاء إدخال الباركود واسم الصنف.");
    return;
  }

  let product = DataStore.products.find(p => p.barcode === barcode);
  if(product){
    product.name = name;
    product.priceRetail = priceRetail;
    product.priceWholesale = priceWholesale;
  }else{
    product = { barcode,name,priceRetail,priceWholesale };
    DataStore.products.push(product);
  }

  const payload = {
    barcode,
    name,
    priceRetail,
    priceWholesale,
    qty,
    source,
    notes,
    dateISO: todayISO()
  };

  const res = await saveProductToDB(payload);

  if(res.status === "success"){
    alert("تم تسجيل حركة المخزون في SheetDB.");
  } else {
    queueStockUpdateForSync(payload);
    alert("تم حفظ حركة المخزون محلياً (أوفلاين). سيتم إرسالها عند توفر الإنترنت.");
  }

  await renderStockTable($("#stock-search").value);
}
