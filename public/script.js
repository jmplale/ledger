(function(){
  const EXPENSE_CATEGORIES = ["Needs","Wants"];
  const INCOME_CATEGORIES = ["Salary","Freelance","Allowance","Gift","Other"];
  const CATEGORY_COLORS = {
    "Needs":"#3E7256","Wants":"#9E4238",
    "Salary":"#3E7256","Freelance":"#6FA8B5","Allowance":"#B9893C","Gift":"#C77B9A","Other":"#8A8272"
  };

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  let monthsIndex = [];       // sorted array of "YYYY-MM" strings, ascending
  let monthsCache = {};       // key -> month record
  let currentRealMonthKey = "";
  let viewingMonthKey = "";
  let categoryChart = null;
  let trendChart = null;
  let selectedCategory = EXPENSE_CATEGORIES[0];
  let selectedType = "expense";

  const fmtMoney = (n) => {
    const sign = n < 0 ? "-" : "";
    return sign + "₱" + Math.abs(n).toLocaleString("en-PH", {minimumFractionDigits:2, maximumFractionDigits:2});
  };

  const monthLabel = (key) => {
    const [y,m] = key.split("-").map(Number);
    return `${MONTH_NAMES[m-1]} ${y}`;
  };
  const shortMonthLabel = (key) => {
    const [y,m] = key.split("-").map(Number);
    return `${MONTH_NAMES[m-1].slice(0,3)} '${String(y).slice(2)}`;
  };

  // ---------- API helpers ----------
  async function apiGetJson(url){
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 401) { window.location.href = "index.html"; throw new Error("not logged in"); }
    return res.json();
  }
  async function apiPost(action, body){
    const res = await fetch("/api/data.php", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body })
    });
    if (res.status === 401) { window.location.href = "index.html"; throw new Error("not logged in"); }
    return res.json();
  }

  function endingBalance(rec){
    let bal = rec.startBalance;
    for (const t of rec.transactions){
      bal += t.type === "income" ? t.amount : -t.amount;
    }
    return bal;
  }

  async function loadData(){
    const data = await apiGetJson("/api/data.php?action=get_data");
    if (!data.ok) throw new Error(data.error || "Failed to load data");
    currentRealMonthKey = data.currentMonthKey;
    monthsCache = data.months;
    monthsIndex = Object.keys(data.months).sort();
    if (!viewingMonthKey || !monthsCache[viewingMonthKey]) {
      viewingMonthKey = currentRealMonthKey;
    }
  }

  async function checkAuthAndInit(){
    const me = await apiGetJson("/api/auth.php?action=me");
    if (!me.loggedIn) { window.location.href = "index.html"; return; }
    document.getElementById("userName").textContent = me.username;

    await loadData();
    viewingMonthKey = currentRealMonthKey;
    populateCategoryPicker("expense");
    renderMonthTabs();
    renderAll();
    wireEvents();
    wireBalanceEditing();
    wireLogout();
  }

  function wireLogout(){
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await fetch("/api/auth.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" })
      });
      window.location.href = "index.html";
    });
  }

  function wireEvents(){
    const typeToggle = document.getElementById("typeToggle");
    typeToggle.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-type]");
      if (!btn) return;
      typeToggle.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedType = btn.dataset.type;
      populateCategoryPicker(selectedType);
    });

    document.getElementById("categoryPicker").addEventListener("click", (e) => {
      const btn = e.target.closest(".cat-pill");
      if (!btn) return;
      document.querySelectorAll(".cat-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedCategory = btn.dataset.cat;
    });

    document.getElementById("txForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (viewingMonthKey !== currentRealMonthKey) return;
      const type = selectedType;
      const amount = parseFloat(document.getElementById("amountInput").value);
      const category = selectedCategory;
      const note = document.getElementById("noteInput").value.trim();
      if (!amount || amount <= 0) return;

      const addBtn = document.getElementById("addBtn");
      addBtn.disabled = true;
      try {
        const result = await apiPost("add_tx", { type, amount, category, note });
        if (!result.ok) { alert(result.error || "Could not add entry"); return; }

        document.getElementById("amountInput").value = "";
        document.getElementById("noteInput").value = "";
        document.getElementById("amountInput").focus();

        await loadData();
        renderMonthTabs();
        renderAll();
      } finally {
        addBtn.disabled = false;
      }
    });

    document.getElementById("txList").addEventListener("click", async (e) => {
      const btn = e.target.closest(".tx-del");
      if (!btn) return;
      if (viewingMonthKey !== currentRealMonthKey) return;
      const id = btn.dataset.id;
      await apiPost("delete_tx", { id });
      await loadData();
      renderAll();
    });
  }

  function populateCategoryPicker(type){
    const list = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    selectedCategory = list[0];
    const wrap = document.getElementById("categoryPicker");
    wrap.innerHTML = list.map((c,i) => `
      <button type="button" class="cat-pill ${i===0 ? "active" : ""}" data-cat="${c}" style="--pill-color:${CATEGORY_COLORS[c] || "#8A8272"}">${c}</button>
    `).join("");
  }

  function renderMonthTabs(){
    const wrap = document.getElementById("monthTabs");
    const ordered = [...monthsIndex].reverse(); // most recent first
    wrap.innerHTML = ordered.map(key => {
      const label = key === currentRealMonthKey ? "This month" : shortMonthLabel(key);
      return `<button class="month-tab ${key === viewingMonthKey ? "active" : ""}" data-key="${key}">${label}</button>`;
    }).join("");
    wrap.querySelectorAll(".month-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        viewingMonthKey = btn.dataset.key;
        renderAll();
        renderMonthTabs();
      });
    });
  }

  function renderAll(){
    const rec = monthsCache[viewingMonthKey];
    const isCurrent = viewingMonthKey === currentRealMonthKey;

    document.getElementById("monthEyebrow").textContent = isCurrent ? "This month" : "Viewing history";
    document.getElementById("monthTitle").textContent = monthLabel(viewingMonthKey);
    document.getElementById("historyNote").classList.toggle("visible", !isCurrent);
    document.getElementById("addBtn").disabled = !isCurrent;
    document.querySelectorAll(".entry-form input, .entry-form select, .entry-form button").forEach(el => {
      if (!isCurrent) el.setAttribute("disabled","disabled"); else el.removeAttribute("disabled");
    });

    const liveBal = endingBalance(monthsCache[currentRealMonthKey]);
    const balEl = document.getElementById("balanceAmount");
    balEl.textContent = fmtMoney(liveBal);
    balEl.classList.toggle("negative", liveBal < 0);
    balEl.classList.toggle("positive", liveBal >= 0);

    renderTxList(rec);
    renderSummary(rec);
    renderCategoryChart(rec);
    renderTrendChart();
  }

  function renderTxList(rec){
    const container = document.getElementById("txList");
    if (!rec.transactions.length){
      container.innerHTML = `<div class="empty-state">No entries yet this month. Add your first one above.</div>`;
      return;
    }
    const isCurrent = viewingMonthKey === currentRealMonthKey;
    const byDate = {};
    for (const t of rec.transactions) (byDate[t.date] = byDate[t.date] || []).push(t);
    const dates = Object.keys(byDate).sort().reverse();

    container.innerHTML = dates.map(date => {
      const dayNum = date.split("-")[2];
      const rows = byDate[date].slice().reverse().map(t => `
        <div class="tx-row">
          <div>
            <span class="tx-cat">${t.category}</span>
            ${t.note ? `<span class="tx-note">${escapeHtml(t.note)}</span>` : ""}
          </div>
          <span class="tx-time">${t.timeLabel || ""}</span>
          <span class="tx-amount ${t.type}">${t.type === "expense" ? "−" : "+"}${fmtMoney(t.amount).replace("₱","₱")}</span>
          ${isCurrent ? `<button class="tx-del" data-id="${t.id}" title="Delete entry">✕</button>` : ""}
        </div>
      `).join("");
      return `<div class="day-group"><div class="day-label">Day ${dayNum}</div>${rows}</div>`;
    }).join("");
  }

  function escapeHtml(s){
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function renderSummary(rec){
    const income = rec.transactions.filter(t=>t.type==="income").reduce((a,t)=>a+t.amount,0);
    const expense = rec.transactions.filter(t=>t.type==="expense").reduce((a,t)=>a+t.amount,0);
    document.getElementById("sumStart").textContent = fmtMoney(rec.startBalance);
    document.getElementById("sumIncome").textContent = "+" + fmtMoney(income);
    document.getElementById("sumExpense").textContent = "−" + fmtMoney(expense);
    document.getElementById("sumEnd").textContent = fmtMoney(rec.startBalance + income - expense);
  }

  function renderCategoryChart(rec){
    const wrap = document.getElementById("categoryChartWrap");
    const legend = document.getElementById("categoryLegend");
    const totals = {};
    for (const t of rec.transactions){
      if (t.type !== "expense") continue;
      if (!EXPENSE_CATEGORIES.includes(t.category)) continue;
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }
    const labels = Object.keys(totals);

    if (!labels.length){
      if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
      wrap.innerHTML = `<canvas id="categoryChart"></canvas>`;
      legend.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "chart-empty";
      empty.textContent = "No expenses logged for this month yet.";
      wrap.appendChild(empty);
      return;
    }
    const stale = wrap.querySelector(".chart-empty");
    if (stale) stale.remove();
    if (!document.getElementById("categoryChart")){
      wrap.innerHTML = `<canvas id="categoryChart"></canvas>`;
    }

    const values = labels.map(l => totals[l]);
    const colors = labels.map(l => CATEGORY_COLORS[l] || "#8A8272");

    if (typeof Chart === "undefined") return;

    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(document.getElementById("categoryChart"), {
      type: "doughnut",
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#F6F1E3", borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "62%",
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: (ctx) => `${ctx.label}: ${fmtMoney(ctx.parsed)}` }
        } }
      }
    });

    legend.innerHTML = labels.map((l,i) => `
      <li><span class="legend-swatch" style="background:${colors[i]}"></span>${l}
        <span class="amt">${fmtMoney(values[i])}</span>
      </li>
    `).join("");
  }

  function renderTrendChart(){
    const wrap = document.getElementById("trendChartWrap");
    const keys = [...monthsIndex];
    if (!document.getElementById("trendChart")){
      wrap.innerHTML = `<canvas id="trendChart"></canvas>`;
    }
    if (typeof Chart === "undefined") return;

    const labels = keys.map(shortMonthLabel);
    const balances = keys.map(k => endingBalance(monthsCache[k]));

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById("trendChart"), {
      type: "bar",
      data: { labels, datasets: [{
        data: balances,
        backgroundColor: balances.map(b => b >= 0 ? "rgba(62,114,86,0.75)" : "rgba(158,66,56,0.75)"),
        borderRadius: 3, maxBarThickness: 28
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: (ctx) => fmtMoney(ctx.parsed.y) }
        }},
        scales: {
          y: { ticks: { font: { family: "IBM Plex Mono", size: 10 }, callback: (v) => "₱" + v.toLocaleString() }, grid: { color: "#E2D8BE" } },
          x: { ticks: { font: { family: "IBM Plex Mono", size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  function wireBalanceEditing(){
    const balEl = document.getElementById("balanceAmount");
    balEl.addEventListener("click", () => {
      if (balEl.tagName === "INPUT") return;
      const liveBal = endingBalance(monthsCache[currentRealMonthKey]);
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.01";
      input.id = "balanceAmount";
      input.className = "balance-edit-input";
      input.value = liveBal.toFixed(2);
      balEl.replaceWith(input);
      input.focus();
      input.select();

      let settled = false;
      const finish = async (commit) => {
        if (settled) return;
        settled = true;
        if (commit){
          const newVal = parseFloat(input.value);
          if (!isNaN(newVal)){
            await apiPost("correct_balance", { newBalance: newVal });
            await loadData();
          }
        }
        const restored = document.createElement("p");
        restored.className = "amount";
        restored.id = "balanceAmount";
        restored.title = "Click to correct your balance";
        input.replaceWith(restored);
        renderAll();
        wireBalanceEditing();
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); finish(true); }
        if (e.key === "Escape") { e.preventDefault(); finish(false); }
      });
      input.addEventListener("blur", () => finish(true));
    }, { once: true });
  }

  checkAuthAndInit();
})();
