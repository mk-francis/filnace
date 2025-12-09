const Store = (() => {
  const LS_KEY = 'okc_finance';
  let state = null;

  function _load() {
    const raw = localStorage.getItem(LS_KEY);
    state = raw ? JSON.parse(raw) : null;
    if (!state) state = { companies: [], transactions: {}, budgets: {}, settings: { currency: 'PHP', locale: 'en-PH' }, dashboard: {} };
  }

  function _save() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function initSeed() {
    _load();
    if (!state.companies || !state.companies.length) {
      state.companies = [
        { id: 'company1', name: 'ABC Auto Repair Shop', businessType: 'repair' },
        { id: 'company2', name: 'Custom Motors PH', businessType: 'customization' },
        { id: 'company3', name: 'CoolTech Aircon Services', businessType: 'aircon' }
      ];
    }
    if (!state.groups || !state.groups.length) {
      state.groups = [
        { id: 'group1', name: 'OK集团', companies: state.companies.map(c => c.id) }
      ];
    }
    if (!state.transactions) { state.transactions = {}; }
    if (!state.budgets || !Object.keys(state.budgets).length) {
      state.budgets = {
      company1: [
        { id: 1, name: '修车服务预算', department: 'repair', allocated: 500000, spent: 420000, period: 'yearly', startDate: '2024-01-01', endDate: '2024-12-31', description: 'ABC修车行全年维修服务预算', status: 'good' },
        { id: 2, name: '零件采购预算', department: 'parts', allocated: 300000, spent: 280000, period: 'yearly', startDate: '2024-01-01', endDate: '2024-12-31', description: '零件和材料采购预算', status: 'warning' }
      ],
      company2: [
        { id: 1, name: '改装服务预算', department: 'customization', allocated: 800000, spent: 720000, period: 'yearly', startDate: '2024-01-01', endDate: '2024-12-31', description: '汽车改装服务收入预算', status: 'good' }
      ],
      company3: [
        { id: 1, name: '空调服务预算', department: 'aircon', allocated: 600000, spent: 550000, period: 'yearly', startDate: '2024-01-01', endDate: '2024-12-31', description: '空调安装维修服务预算', status: 'good' }
      ]
    };
    }
    if (!state.dashboard) { state.dashboard = {}; }
    (state.companies || []).forEach(c => {
      if (!state.dashboard[c.id]) {
        state.dashboard[c.id] = {
          timeseries: { income: [0,0,0,0,0,0], expense: [0,0,0,0,0,0] },
          totals: {
            month: { income: 0, expense: 0, profit: 0 },
            quarter: { income: 0, expense: 0, profit: 0 },
            year: { income: 0, expense: 0, profit: 0 }
          }
        };
      }
    });
    if (!state.categoriesByCompany) {
      state.categoriesByCompany = {
        company1: ['修车', '零件', '维保', '空调', '工资', '水电费', '租金', '网络费', '车费', '其他'],
        company2: ['改装', '零件', '维保', '工资', '水电费', '租金', '网络费', '车费', '其他'],
        company3: ['空调', '设备', '维保', '工资', '水电费', '租金', '网络费', '车费', '其他']
      };
    }
    if (!state.users || !state.users.length) {
      state.users = [
        { id: 'user_admin', name: '管理员', role: 'admin', allowedCompanies: [] },
        { id: 'user_company1', name: '公司1用户', role: 'company_user', allowedCompanies: ['company1'] },
        { id: 'user_company2', name: '公司2用户', role: 'company_user', allowedCompanies: ['company2'] },
        { id: 'user_company3', name: '公司3用户', role: 'company_user', allowedCompanies: ['company3'] }
      ];
    }
    if (!state.currentUserId) state.currentUserId = 'user_admin';
    _save();
  }

  function getCompanies() { _load(); return state.companies; }
  function getCompanyName(id) { _load(); const c = state.companies.find(x => x.id === id); return c ? c.name : id; }
  function getGroups() { _load(); return state.groups || []; }
  function getCompaniesByGroup(groupId) { _load(); const g = (state.groups || []).find(x => x.id === groupId); const list = g ? g.companies.map(id => state.companies.find(c => c.id === id)).filter(Boolean) : []; const allowed = getAllowedCompanyIds(); return list.filter(c => !allowed.length || allowed.includes(c.id)); }

  function getTransactions(companyId) { _load(); if (!hasAccessToCompany(companyId)) return []; return (state.transactions[companyId] || []).slice(); }

  function addTransaction(companyId, tx) {
    _load();
    if (!companyId) return null;
    if (!hasAccessToCompany(companyId)) return null;
    const cats = state.categoriesByCompany && state.categoriesByCompany[companyId] ? state.categoriesByCompany[companyId] : [];
    if (cats.length && tx.category && !cats.includes(tx.category)) return null;
    const list = state.transactions[companyId] || (state.transactions[companyId] = []);
    const id = (list.length ? Math.max(...list.map(t => t.id)) : 0) + 1;
    const item = { ...tx, id };
    list.unshift(item);
    _adjustDashboard(companyId, item);
    _save();
    const client = _supabase();
    if (client) {
      const row = { company_id: companyId, date: item.date, description: item.description || '', category: item.category || '', amount: item.amount || 0, type: item.type };
      client.from('transactions').insert(row).then(()=>{}).catch(()=>{});
    }
    return item;
  }

  function updateTransaction(companyId, id, patch) {
    _load();
    const list = state.transactions[companyId] || [];
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...patch };
    _recomputeDashboard(companyId);
    _save();
    return true;
  }

  function removeTransaction(companyId, id) {
    _load();
    state.transactions[companyId] = (state.transactions[companyId] || []).filter(t => t.id !== id);
    _recomputeDashboard(companyId);
    _save();
  }

  function getBudgets(companyId) { _load(); return (state.budgets[companyId] || []).slice(); }

  function addBudget(companyId, budget) {
    _load();
    const list = state.budgets[companyId] || (state.budgets[companyId] = []);
    const id = (list.length ? Math.max(...list.map(b => b.id)) : 0) + 1;
    const item = { ...budget, id };
    list.unshift(item);
    _save();
    const client = _supabase();
    if (client) {
      const row = { company_id: companyId, name: item.name, department: item.department || '', allocated: item.allocated || 0, spent: item.spent || 0, period: item.period || 'yearly', start_date: item.startDate || null, end_date: item.endDate || null, status: item.status || null };
      client.from('budgets').insert(row).then(()=>{}).catch(()=>{});
    }
    return item;
  }

  function updateBudget(companyId, id, patch) {
    _load();
    const list = state.budgets[companyId] || [];
    const idx = list.findIndex(b => b.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...patch };
    _save();
    return true;
  }

  function removeBudget(companyId, id) {
    _load();
    state.budgets[companyId] = (state.budgets[companyId] || []).filter(b => b.id !== id);
    _save();
  }

  function aggregateDashboard(companyId, period) {
    _load();
    const d = state.dashboard[companyId];
    if (!hasAccessToCompany(companyId) || !d) return { totals: { income: 0, expense: 0, profit: 0 }, series: { income: [0,0,0,0,0,0], expense: [0,0,0,0,0,0] } };
    const totals = d.totals[period] || d.totals.month;
    const incomeSeries = d.timeseries.income;
    const expenseSeries = d.timeseries.expense;
    return { totals, series: { income: incomeSeries, expense: expenseSeries } };
  }
  function aggregateDashboardGroup(groupId, period) {
    _load();
    const companies = getCompaniesByGroup(groupId).map(c => c.id);
    const totals = { income: 0, expense: 0, profit: 0 };
    let incomeSeries = [];
    let expenseSeries = [];
    companies.forEach(cid => {
      const d = state.dashboard[cid] || { timeseries: { income: [0,0,0,0,0,0], expense: [0,0,0,0,0,0] }, totals: { month: { income: 0, expense: 0, profit: 0 }, quarter: { income: 0, expense: 0, profit: 0 }, year: { income: 0, expense: 0, profit: 0 } } };
      const t = (d.totals && d.totals[period]) ? d.totals[period] : d.totals.month;
      totals.income += t.income; totals.expense += t.expense; totals.profit += t.profit;
      const inc = d.timeseries.income; const exp = d.timeseries.expense;
      incomeSeries = incomeSeries.length ? incomeSeries.map((v,i)=>v+(inc[i]||0)) : inc.slice();
      expenseSeries = expenseSeries.length ? expenseSeries.map((v,i)=>v+(exp[i]||0)) : exp.slice();
    });
    return { totals, series: { income: incomeSeries, expense: expenseSeries } };
  }

  function aggregateReports(companyId, period, type) {
    const { totals } = aggregateDashboard(companyId, period);
    if (type === 'profit') {
      const revenue = totals.income;
      const cost = totals.expense;
      const gross = revenue - cost;
      const opExpense = Math.round(revenue * 0.12);
      const admin = Math.round(revenue * 0.065);
      const finance = Math.round(revenue * 0.016);
      const opProfit = gross - opExpense - admin - finance;
      return {
        title: '利润表',
        period,
        data: [
          { item: '营业收入', current: revenue, previous: Math.round(revenue * 0.89), change: 12.5 },
          { item: '营业成本', current: cost, previous: Math.round(cost * 0.92), change: 8.4 },
          { item: '毛利', current: gross, previous: Math.round(gross * 0.80), change: 24.3 },
          { item: '营业费用', current: opExpense, previous: Math.round(opExpense * 0.9), change: 10.2 },
          { item: '管理费用', current: admin, previous: Math.round(admin * 0.9), change: 10.3 },
          { item: '财务费用', current: finance, previous: Math.round(finance * 0.93), change: 7.5 },
          { item: '营业利润', current: opProfit, previous: Math.round(opProfit * 0.46), change: 119.0 },
          { item: '利润总额', current: opProfit, previous: Math.round(opProfit * 0.46), change: 119.0 },
          { item: '净利润', current: Math.round(opProfit * 0.75), previous: Math.round(opProfit * 0.34), change: 119.0 }
        ],
        keyMetrics: [
          { name: '毛利率', value: `${((gross / revenue) * 100).toFixed(1)}%`, change: '+2.8%' },
          { name: '净利率', value: `${((opProfit * 0.75 / revenue) * 100).toFixed(1)}%`, change: '+2.5%' },
          { name: '营业收入增长率', value: '12.5%', change: '+3.2%' }
        ]
      };
    }
    if (type === 'cashflow') {
      const inflow = totals.income;
      const outflow = Math.round(totals.expense * 1.1);
      const net = inflow - outflow;
      return {
        title: '现金流量表',
        period,
        data: [
          { item: '经营活动现金流入', current: inflow, previous: Math.round(inflow * 0.89), change: 12.5 },
          { item: '经营活动现金流出', current: outflow, previous: Math.round(outflow * 0.94), change: 6.5 },
          { item: '经营活动净现金流', current: net, previous: Math.round(net * 0.82), change: 32.1 }
        ],
        keyMetrics: [
          { name: '经营现金流比率', value: `${((net / inflow) * 100).toFixed(1)}%`, change: '+4.2%' },
          { name: '现金流量充足率', value: '1.35', change: '+0.15' },
          { name: '现金循环周期', value: '45天', change: '-3天' }
        ]
      };
    }
    if (type === 'balance') {
      const currentAssets = Math.round(totals.income * 2.27);
      const nonCurrentAssets = Math.round(totals.income * 3.35);
      const totalAssets = currentAssets + nonCurrentAssets;
      const currentLiabilities = Math.round(totals.expense * 2.07);
      const nonCurrentLiabilities = Math.round(totals.expense * 1.34);
      const totalLiabilities = currentLiabilities + nonCurrentLiabilities;
      const equity = totalAssets - totalLiabilities;
      return {
        title: '资产负债表',
        period,
        data: [
          { item: '流动资产', current: currentAssets, previous: Math.round(currentAssets * 0.94), change: 6.3 },
          { item: '非流动资产', current: nonCurrentAssets, previous: Math.round(nonCurrentAssets * 0.99), change: 1.2 },
          { item: '资产总计', current: totalAssets, previous: Math.round(totalAssets * 0.97), change: 3.2 },
          { item: '流动负债', current: currentLiabilities, previous: Math.round(currentLiabilities * 0.95), change: 5.7 },
          { item: '非流动负债', current: nonCurrentLiabilities, previous: Math.round(nonCurrentLiabilities * 1.04), change: -4.0 },
          { item: '负债合计', current: totalLiabilities, previous: Math.round(totalLiabilities * 0.98), change: 1.7 },
          { item: '所有者权益', current: equity, previous: Math.round(equity * 0.96), change: 4.4 },
          { item: '负债和所有者权益总计', current: totalAssets, previous: Math.round(totalAssets * 0.97), change: 3.2 }
        ],
        keyMetrics: [
          { name: '资产负债率', value: `${((totalLiabilities / totalAssets) * 100).toFixed(1)}%`, change: '-0.6%' }
        ]
      };
    }
    return { title: '', period, data: [], keyMetrics: [] };
  }
  function aggregateReportsGroup(groupId, period, type) {
    const { totals } = aggregateDashboardGroup(groupId, period);
    if (type === 'profit') {
      const revenue = totals.income;
      const cost = totals.expense;
      const gross = revenue - cost;
      const opExpense = Math.round(revenue * 0.12);
      const admin = Math.round(revenue * 0.065);
      const finance = Math.round(revenue * 0.016);
      const opProfit = gross - opExpense - admin - finance;
      return {
        title: '利润表',
        period,
        data: [
          { item: '营业收入', current: revenue, previous: Math.round(revenue * 0.89), change: 12.5 },
          { item: '营业成本', current: cost, previous: Math.round(cost * 0.92), change: 8.4 },
          { item: '毛利', current: gross, previous: Math.round(gross * 0.80), change: 24.3 },
          { item: '营业费用', current: opExpense, previous: Math.round(opExpense * 0.9), change: 10.2 },
          { item: '管理费用', current: admin, previous: Math.round(admin * 0.9), change: 10.3 },
          { item: '财务费用', current: finance, previous: Math.round(finance * 0.93), change: 7.5 },
          { item: '营业利润', current: opProfit, previous: Math.round(opProfit * 0.46), change: 119.0 },
          { item: '利润总额', current: opProfit, previous: Math.round(opProfit * 0.46), change: 119.0 },
          { item: '净利润', current: Math.round(opProfit * 0.75), previous: Math.round(opProfit * 0.34), change: 119.0 }
        ],
        keyMetrics: [
          { name: '毛利率', value: `${((gross / revenue) * 100).toFixed(1)}%`, change: '+2.8%' },
          { name: '净利率', value: `${((opProfit * 0.75 / revenue) * 100).toFixed(1)}%`, change: '+2.5%' },
          { name: '营业收入增长率', value: '12.5%', change: '+3.2%' }
        ]
      };
    }
    if (type === 'cashflow') {
      const inflow = totals.income;
      const outflow = Math.round(totals.expense * 1.1);
      const net = inflow - outflow;
      return {
        title: '现金流量表',
        period,
        data: [
          { item: '经营活动现金流入', current: inflow, previous: Math.round(inflow * 0.89), change: 12.5 },
          { item: '经营活动现金流出', current: outflow, previous: Math.round(outflow * 0.94), change: 6.5 },
          { item: '经营活动净现金流', current: net, previous: Math.round(net * 0.82), change: 32.1 }
        ],
        keyMetrics: [
          { name: '经营现金流比率', value: `${((net / inflow) * 100).toFixed(1)}%` }
        ]
      };
    }
    if (type === 'balance') {
      const currentAssets = Math.round(totals.income * 2.27);
      const nonCurrentAssets = Math.round(totals.income * 3.35);
      const totalAssets = currentAssets + nonCurrentAssets;
      const currentLiabilities = Math.round(totals.expense * 2.07);
      const nonCurrentLiabilities = Math.round(totals.expense * 1.34);
      const totalLiabilities = currentLiabilities + nonCurrentLiabilities;
      const equity = totalAssets - totalLiabilities;
      return {
        title: '资产负债表',
        period,
        data: [
          { item: '流动资产', current: currentAssets, previous: Math.round(currentAssets * 0.94), change: 6.3 },
          { item: '非流动资产', current: nonCurrentAssets, previous: Math.round(nonCurrentAssets * 0.99), change: 1.2 },
          { item: '资产总计', current: totalAssets, previous: Math.round(totalAssets * 0.97), change: 3.2 },
          { item: '流动负债', current: currentLiabilities, previous: Math.round(currentLiabilities * 0.95), change: 5.7 },
          { item: '非流动负债', current: nonCurrentLiabilities, previous: Math.round(nonCurrentLiabilities * 1.04), change: -4.0 },
          { item: '负债合计', current: totalLiabilities, previous: Math.round(totalLiabilities * 0.98), change: 1.7 },
          { item: '所有者权益', current: equity, previous: Math.round(equity * 0.96), change: 4.4 },
          { item: '负债和所有者权益总计', current: totalAssets, previous: Math.round(totalAssets * 0.97), change: 3.2 }
        ],
        keyMetrics: [
          { name: '资产负债率', value: `${((totalLiabilities / totalAssets) * 100).toFixed(1)}%` }
        ]
      };
    }
    return { title: '', period, data: [], keyMetrics: [] };
  }

  function _adjustDashboard(companyId, tx) {
    const d = state.dashboard[companyId];
    if (!d) return;
    const monthTotals = d.totals.month;
    if (tx.type === 'income') monthTotals.income += tx.amount; else monthTotals.expense += tx.amount;
    monthTotals.profit = monthTotals.income - monthTotals.expense;
  }

  function _recomputeDashboard(companyId) {
    const d = state.dashboard[companyId];
    if (!d) return;
    const monthTotals = { income: 0, expense: 0, profit: 0 };
    (state.transactions[companyId] || []).forEach(tx => {
      if (tx.type === 'income') monthTotals.income += tx.amount; else monthTotals.expense += tx.amount;
    });
    monthTotals.profit = monthTotals.income - monthTotals.expense;
    d.totals.month = monthTotals;
  }

  function getTransactionsForGroup(groupId) {
    _load();
    const companies = getCompaniesByGroup(groupId).map(c => c.id);
    let list = [];
    companies.forEach(cid => {
      (state.transactions[cid] || []).forEach(t => list.push({ ...t, companyId: cid, companyName: getCompanyName(cid) }));
    });
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    return list;
  }

  function getBudgetsForGroup(groupId) {
    _load();
    const companies = getCompaniesByGroup(groupId).map(c => c.id);
    let list = [];
    companies.forEach(cid => {
      (state.budgets[cid] || []).forEach(b => list.push({ ...b, companyId: cid, companyName: getCompanyName(cid) }));
    });
    return list;
  }

  function getCompanyCategories(companyId) {
    _load();
    if (!state.categoriesByCompany) state.categoriesByCompany = {};
    const list = state.categoriesByCompany[companyId] || (state.categoriesByCompany[companyId] = []);
    const fixed = ['水电费','工资','租金','网络费','车费'];
    fixed.forEach(k => { if (!list.includes(k)) list.push(k); });
    _save();
    return list.slice();
  }

  function getFixedExpenses(companyId) {
    _load();
    const fixed = ['水电费','工资','租金','网络费','车费'];
    const list = (state.transactions[companyId] || []).filter(t => t.type === 'expense');
    const map = {};
    fixed.forEach(k => map[k] = 0);
    list.forEach(t => { if (fixed.includes(t.category)) map[t.category] += t.amount; });
    return fixed.map(k => ({ name: k, amount: map[k] }));
  }

  function getFixedExpensesGroup(groupId) {
    _load();
    const fixed = ['水电费','工资','租金','网络费','车费'];
    const companies = getCompaniesByGroup(groupId).map(c => c.id);
    const map = {};
    fixed.forEach(k => map[k] = 0);
    companies.forEach(cid => {
      (state.transactions[cid] || []).filter(t => t.type === 'expense').forEach(t => { if (fixed.includes(t.category)) map[t.category] += t.amount; });
    });
    return fixed.map(k => ({ name: k, amount: map[k] }));
  }

  function addCompany(company) {
    _load();
    const nums = (state.companies || []).map(c => parseInt((c.id || '').replace('company',''))).filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    const id = `company${next}`;
    const item = { id, name: company.name || `新公司${next}`, businessType: company.businessType || 'repair' };
    state.companies.push(item);
    state.transactions[id] = [];
    state.budgets[id] = [];
    state.dashboard[id] = { timeseries: { income: [0,0,0,0,0,0], expense: [0,0,0,0,0,0] }, totals: { month: { income: 0, expense: 0, profit: 0 }, quarter: { income: 0, expense: 0, profit: 0 }, year: { income: 0, expense: 0, profit: 0 } } };
    if (!state.groups) state.groups = [];
    let g = state.groups.find(x => x.id === 'group1');
    if (!g) { g = { id: 'group1', name: 'OK集团', companies: [] }; state.groups.push(g); }
    if (!g.companies.includes(id)) g.companies.push(id);
    if (!state.categoriesByCompany) state.categoriesByCompany = {};
    const preset = {
      repair: ['修车','零件','维保','空调','工资','其他'],
      customization: ['改装','零件','维保','工资','其他'],
      aircon: ['空调','设备','维保','工资','其他']
    };
    state.categoriesByCompany[id] = preset[item.businessType] ? preset[item.businessType].slice() : ['其他'];
    _save();
    return item;
  }

  function updateCompany(id, patch) {
    _load();
    const idx = (state.companies || []).findIndex(c => c.id === id);
    if (idx === -1) return false;
    state.companies[idx] = { ...state.companies[idx], ...patch };
    _save();
    return true;
  }

  function removeCompany(id) {
    _load();
    state.companies = (state.companies || []).filter(c => c.id !== id);
    if (state.groups) state.groups.forEach(g => { g.companies = (g.companies || []).filter(cid => cid !== id); });
    delete state.transactions[id];
    delete state.budgets[id];
    delete state.dashboard[id];
    if (state.categoriesByCompany) delete state.categoriesByCompany[id];
    _save();
  }

  function addCompanyCategory(companyId, name) {
    _load();
    if (!state.categoriesByCompany) state.categoriesByCompany = {};
    const list = state.categoriesByCompany[companyId] || (state.categoriesByCompany[companyId] = []);
    if (!list.includes(name)) list.push(name);
    _save();
    return list.slice();
  }

  function removeCompanyCategory(companyId, name) {
    _load();
    if (!state.categoriesByCompany) return [];
    state.categoriesByCompany[companyId] = (state.categoriesByCompany[companyId] || []).filter(x => x !== name);
    _save();
    return (state.categoriesByCompany[companyId] || []).slice();
  }

  function clearAll() {
    state = {
      companies: [],
      groups: [{ id: 'group1', name: 'OK集团', companies: [] }],
      transactions: {},
      budgets: {},
      dashboard: {},
      categoriesByCompany: {}
    };
    _save();
  }

  function _supabase() {
    const url = localStorage.getItem('supabase_url');
    const key = localStorage.getItem('supabase_anon_key');
    if (typeof supabase === 'undefined') return null;
    if (!url || !key) return null;
    try { return supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }); } catch (e) { return null; }
  }
  async function syncFromSupabase() {
    const client = _supabase();
    if (!client) return false;
    try {
      const { data: companies, error: cErr } = await client.from('companies').select('*');
      if (cErr) return false;
      _load();
      const hasCompanies = Array.isArray(companies) && companies.length > 0;
      if (!hasCompanies) return false;
      state.companies = companies;
      const { data: txs } = await client.from('transactions').select('*').order('date', { ascending: false });
      state.transactions = {};
      (txs || []).forEach(t => {
        const cid = t.company_id; if (!state.transactions[cid]) state.transactions[cid] = [];
        state.transactions[cid].push({ id: t.id, date: t.date, description: t.description, category: t.category, amount: Number(t.amount || 0), type: t.type });
      });
      const { data: budgets } = await client.from('budgets').select('*');
      state.budgets = {};
      (budgets || []).forEach(b => {
        const cid = b.company_id; if (!state.budgets[cid]) state.budgets[cid] = [];
        state.budgets[cid].push({ id: b.id, name: b.name, department: b.department, allocated: Number(b.allocated || 0), spent: Number(b.spent || 0), period: b.period, startDate: b.start_date, endDate: b.end_date, status: b.status });
      });
      state.dashboard = state.dashboard || {};
      (state.companies || []).forEach(c => {
        if (!state.dashboard[c.id]) state.dashboard[c.id] = { timeseries: { income: [0,0,0,0,0,0], expense: [0,0,0,0,0,0] }, totals: { month: { income: 0, expense: 0, profit: 0 }, quarter: { income: 0, expense: 0, profit: 0 }, year: { income: 0, expense: 0, profit: 0 } } };
        _recomputeDashboard(c.id);
      });
      if (!state.groups || !state.groups.length) state.groups = [{ id: 'group1', name: 'OK集团', companies: (state.companies || []).map(c => c.id) }];
      _save();
      return true;
    } catch (e) {
      return false;
    }
  }

  function getUsers() { _load(); return (state.users || []).slice(); }
  function getCurrentUser() { _load(); const id = state.currentUserId; const u = (state.users || []).find(x => x.id === id); return u || null; }
  function login(userId) { _load(); const ok = (state.users || []).some(x => x.id === userId); if (!ok) return false; state.currentUserId = userId; _save(); return true; }
  function logout() { _load(); state.currentUserId = null; _save(); }
  function getAllowedCompanyIds() { _load(); const u = (state.users || []).find(x => x.id === state.currentUserId); if (!u) return []; return u.role === 'admin' ? (state.companies || []).map(c => c.id) : (u.allowedCompanies || []); }
  function hasAccessToCompany(companyId) { _load(); const ids = getAllowedCompanyIds(); return !ids.length ? true : ids.includes(companyId); }

  return {
    initSeed,
    syncFromSupabase,
    getUsers,
    getCurrentUser,
    login,
    logout,
    getCompanies,
    getCompanyName,
    getGroups,
    getCompaniesByGroup,
    getTransactions,
    getTransactionsForGroup,
    addTransaction,
    updateTransaction,
    removeTransaction,
    getBudgets,
    getBudgetsForGroup,
    addBudget,
    updateBudget,
    removeBudget,
    aggregateDashboard,
    aggregateDashboardGroup,
    aggregateReports,
    aggregateReportsGroup,
    getCompanyCategories,
    addCompany,
    updateCompany,
    removeCompany,
    addCompanyCategory,
    removeCompanyCategory,
    getFixedExpenses,
    getFixedExpensesGroup,
    clearAll
  };
})();
