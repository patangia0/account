(function() {
    'use strict';

    // ═════════════════════════════════════════════════════
    // STORAGE KEYS
    // ═════════════════════════════════════════════════════
    var COMPANIES_KEY = 'acc_companies_v6';
    var CUSTOMERS_KEY = 'acc_customers_v6'; // SHARED across all companies
    var ACTIVE_KEY = 'acc_active_company_v6';

    // Per-company keys (dynamic)
    function billsKey(compId) { return 'acc_bills_' + compId; }
    function paymentsKey(compId) { return 'acc_pay_' + compId; }

    // ═════════════════════════════════════════════════════
    // STATE
    // ═════════════════════════════════════════════════════
    var companies = [];
    var customers = [];  // shared
    var bills = [];      // current company
    var payments = [];   // current company
    var activeCompanyId = null;
    var items = [];      // current bill items
    var editId = null;
    var delId = null;
    var delType = null;  // 'bill','customer','company'

    // ═════════════════════════════════════════════════════
    // DOM REFS
    // ═════════════════════════════════════════════════════
    var companyScreen = document.getElementById('company-screen');
    var mainScreen = document.getElementById('main-screen');
    var companyListEl = document.getElementById('company-list');
    var mainHeader = document.getElementById('main-header');
    var companyTitle = document.getElementById('company-title');
    var companySubtitle = document.getElementById('company-subtitle');

    var billDateEl = document.getElementById('bill-date');
    var billTypeEl = document.getElementById('bill-type');
    var billCustomerEl = document.getElementById('bill-customer');
    var billNumberEl = document.getElementById('bill-number');
    var billNotesEl = document.getElementById('bill-notes');
    var billPaidEl = document.getElementById('bill-paid');
    var billPayModeEl = document.getElementById('bill-pay-mode');
    var itemNameEl = document.getElementById('item-name');
    var itemQtyEl = document.getElementById('item-qty');
    var itemPriceEl = document.getElementById('item-price');
    var itemsListEl = document.getElementById('items-list');
    var totalsArea = document.getElementById('totals-area');
    var taxPercentEl = document.getElementById('tax-percent');
    var discountEl = document.getElementById('discount');
    var saveBtnEl = document.getElementById('save-btn');
    var remainingBox = document.getElementById('remaining-box');
    var toastEl = document.getElementById('toast');
    var modalEl = document.getElementById('modal');

    // ═════════════════════════════════════════════════════
    // HELPERS
    // ═════════════════════════════════════════════════════
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function fmt(n) {
        return '₹' + Math.abs(n).toLocaleString('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }

    function today() {
        return new Date().toISOString().split('T')[0];
    }

    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        setTimeout(function() { toastEl.classList.remove('show'); }, 2500);
    }

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function fmtDate(d) {
        if (!d) return '';
        var p = d.split('-');
        return p[2] + '/' + p[1] + '/' + p[0];
    }

    function csvSafe(s) {
        s = (s || '').toString();
        if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
            return '"' + s.replace(/"/g, '""') + '"';
        return s;
    }

    // ═════════════════════════════════════════════════════
    // STORAGE
    // ═════════════════════════════════════════════════════
    function saveCompanies() {
        try { localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies)); }
        catch(e) { toast('⚠️ Storage full!'); }
    }

    function loadCompanies() {
        try { companies = JSON.parse(localStorage.getItem(COMPANIES_KEY)) || []; }
        catch(e) { companies = []; }
    }

    function saveCustomers() {
        try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); }
        catch(e) { toast('⚠️ Storage full!'); }
    }

    function loadCustomers() {
        try { customers = JSON.parse(localStorage.getItem(CUSTOMERS_KEY)) || []; }
        catch(e) { customers = []; }
    }

    function saveActive() {
        try { localStorage.setItem(ACTIVE_KEY, activeCompanyId || ''); }
        catch(e) {}
    }

    function loadActive() {
        try { activeCompanyId = localStorage.getItem(ACTIVE_KEY) || null; }
        catch(e) { activeCompanyId = null; }
    }

    function saveBills() {
        if (!activeCompanyId) return;
        try { localStorage.setItem(billsKey(activeCompanyId), JSON.stringify(bills)); }
        catch(e) { toast('⚠️ Storage full!'); }
    }

    function loadBills() {
        if (!activeCompanyId) { bills = []; return; }
        try { bills = JSON.parse(localStorage.getItem(billsKey(activeCompanyId))) || []; }
        catch(e) { bills = []; }
    }

    function savePayments() {
        if (!activeCompanyId) return;
        try { localStorage.setItem(paymentsKey(activeCompanyId), JSON.stringify(payments)); }
        catch(e) { toast('⚠️ Storage full!'); }
    }

    function loadPayments() {
        if (!activeCompanyId) { payments = []; return; }
        try { payments = JSON.parse(localStorage.getItem(paymentsKey(activeCompanyId))) || []; }
        catch(e) { payments = []; }
    }

    // Load bills/payments for a specific company (for stats)
    function loadBillsFor(compId) {
        try { return JSON.parse(localStorage.getItem(billsKey(compId))) || []; }
        catch(e) { return []; }
    }

    function loadPaymentsFor(compId) {
        try { return JSON.parse(localStorage.getItem(paymentsKey(compId))) || []; }
        catch(e) { return []; }
    }

    // ═════════════════════════════════════════════════════
    // PAYMENT HELPERS
    // ═════════════════════════════════════════════════════
    function getBillPaid(billId) {
        var total = 0;
        payments.forEach(function(p) {
            if (p.billId === billId) total += p.amount;
        });
        return total;
    }

    function getBillRemaining(billId) {
        var bill = bills.find(function(b) { return b.id === billId; });
        if (!bill) return 0;
        return Math.max(0, bill.grandTotal - getBillPaid(billId));
    }

    function getBillStatus(billId) {
        var bill = bills.find(function(b) { return b.id === billId; });
        if (!bill) return 'unpaid';
        var paid = getBillPaid(billId);
        if (paid >= bill.grandTotal) return 'paid';
        if (paid > 0) return 'partial';
        return 'unpaid';
    }

    // For stats on company selector screen
    function getBillPaidFor(billId, payList) {
        var total = 0;
        payList.forEach(function(p) {
            if (p.billId === billId) total += p.amount;
        });
        return total;
    }

    // ═════════════════════════════════════════════════════
    // MIGRATION — Move old data to default company
    // ═════════════════════════════════════════════════════
    function migrateOldData() {
        // Check for old data keys
        var oldBills = null;
        var oldCust = null;
        var oldPay = null;

        try { oldBills = JSON.parse(localStorage.getItem('acc_bills_v5')); } catch(e) {}
        try { oldCust = JSON.parse(localStorage.getItem('acc_cust_v5')); } catch(e) {}
        try { oldPay = JSON.parse(localStorage.getItem('acc_pay_v5')); } catch(e) {}

        if (!oldBills && !oldCust && !oldPay) return; // no old data

        // Create default company
        var defId = uid();
        var defCompany = {
            id: defId,
            name: 'My Business',
            color: '#667eea',
            gst: '',
            address: '',
            createdAt: Date.now()
        };

        companies.push(defCompany);
        saveCompanies();

        // Move customers to shared
        if (oldCust && oldCust.length > 0) {
            oldCust.forEach(function(c) {
                var exists = customers.some(function(x) {
                    return x.name.toLowerCase() === c.name.toLowerCase();
                });
                if (!exists) customers.push(c);
            });
            saveCustomers();
        }

        // Move bills
        if (oldBills && oldBills.length > 0) {
            localStorage.setItem(billsKey(defId), JSON.stringify(oldBills));
        }

        // Move payments
        if (oldPay && oldPay.length > 0) {
            localStorage.setItem(paymentsKey(defId), JSON.stringify(oldPay));
        }

        // Clean old keys
        localStorage.removeItem('acc_bills_v5');
        localStorage.removeItem('acc_cust_v5');
        localStorage.removeItem('acc_pay_v5');

        toast('✅ Purana data "My Business" me migrate ho gaya!');
    }

    // ═════════════════════════════════════════════════════
    // SCREEN MANAGEMENT
    // ═════════════════════════════════════════════════════
    function showCompanyScreen() {
        companyScreen.style.display = 'block';
        mainScreen.style.display = 'none';
        renderCompanyList();
        renderGlobalCustomers();
    }

    function showMainScreen() {
        companyScreen.style.display = 'none';
        mainScreen.style.display = 'block';

        var comp = companies.find(function(c) { return c.id === activeCompanyId; });
        if (!comp) { showCompanyScreen(); return; }

        // Update header
        companyTitle.textContent = '📒 ' + comp.name;
        companySubtitle.textContent = (comp.gst ? 'GST: ' + comp.gst + ' • ' : '') + 'Accounting';
        mainHeader.style.background = 'linear-gradient(135deg, ' + comp.color + ', ' + adjustColor(comp.color, -30) + ')';

        // Update tab active color
        var styleTag = document.getElementById('dynamic-tab-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'dynamic-tab-style';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = '.tab.active { background: ' + comp.color + ' !important; }' +
            '.total-row.grand { color: ' + comp.color + ' !important; border-top-color: ' + comp.color + ' !important; }' +
            '.item-row .item-total { color: ' + comp.color + ' !important; }';

        // Load company data
        loadBills();
        loadPayments();

        // Reset to first tab
        var tabBtns = document.querySelectorAll('.tab');
        var sections = document.querySelectorAll('.section');
        for (var i = 0; i < tabBtns.length; i++) tabBtns[i].classList.remove('active');
        for (var i = 0; i < sections.length; i++) sections[i].classList.remove('active');
        tabBtns[0].classList.add('active');
        document.getElementById('sec-new').classList.add('active');

        updateCustomerDropdown();
        updateSummary();
        clearForm();
    }

    function adjustColor(hex, amount) {
        var num = parseInt(hex.slice(1), 16);
        var r = Math.min(255, Math.max(0, (num >> 16) + amount));
        var g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        var b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
    }

    // ═════════════════════════════════════════════════════
    // COMPANY MANAGEMENT
    // ═════════════════════════════════════════════════════
    document.getElementById('add-comp-btn').addEventListener('click', function() {
        var name = document.getElementById('new-comp-name').value.trim();
        if (!name) { toast('⚠️ Company name daalein!'); return; }

        var exists = companies.some(function(c) {
            return c.name.toLowerCase() === name.toLowerCase();
        });
        if (exists) { toast('⚠️ Company already exists!'); return; }

        var comp = {
            id: uid(),
            name: name,
            color: document.getElementById('new-comp-color').value,
            gst: document.getElementById('new-comp-gst').value.trim(),
            address: document.getElementById('new-comp-address').value.trim(),
            createdAt: Date.now()
        };

        companies.push(comp);
        saveCompanies();

        document.getElementById('new-comp-name').value = '';
        document.getElementById('new-comp-gst').value = '';
        document.getElementById('new-comp-address').value = '';

        renderCompanyList();
        toast('✅ ' + name + ' added!');
    });

    function renderCompanyList() {
        if (companies.length === 0) {
            companyListEl.innerHTML = '<div class="empty"><span class="emoji">🏢</span>Koi company nahi.<br>Upar se add karein!</div>';
            return;
        }

        var html = '';
        companies.forEach(function(comp) {
            var cBills = loadBillsFor(comp.id);
            var cPay = loadPaymentsFor(comp.id);

            var totalIn = 0, totalEx = 0, billCount = cBills.length, custCount = 0;
            var custSet = {};

            cBills.forEach(function(b) {
                var paid = getBillPaidFor(b.id, cPay);
                if (b.type === 'income') totalIn += paid;
                else totalEx += paid;
                if (b.customerId) custSet[b.customerId] = true;
            });

            custCount = Object.keys(custSet).length;
            var bal = totalIn - totalEx;

            html += '<div class="company-card" style="border-left-color:' + comp.color + ';" onclick="openCompany(\'' + comp.id + '\')">' +
                '<div class="comp-top">' +
                    '<div>' +
                        '<div class="comp-name" style="color:' + comp.color + ';">🏢 ' + esc(comp.name) + '</div>' +
                        '<div class="comp-detail">' +
                            (comp.gst ? 'GST: ' + esc(comp.gst) + ' • ' : '') +
                            (comp.address ? esc(comp.address) : '') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="comp-stats">' +
                    '<div class="comp-stat">📋 ' + billCount + ' bills</div>' +
                    '<div class="comp-stat">👥 ' + custCount + ' customers</div>' +
                    '<div class="comp-stat" style="color:#22c55e;">In: ' + fmt(totalIn) + '</div>' +
                    '<div class="comp-stat" style="color:#ef4444;">Out: ' + fmt(totalEx) + '</div>' +
                    '<div class="comp-stat" style="font-weight:700;color:' + (bal >= 0 ? '#22c55e' : '#ef4444') + ';">Net: ' + (bal >= 0 ? '+' : '−') + fmt(bal) + '</div>' +
                '</div>' +
                '<div class="comp-actions">' +
                    '<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();openCompany(\'' + comp.id + '\')">📂 Open</button>' +
                    '<button class="btn btn-sm btn-red" onclick="event.stopPropagation();confirmDel(\'' + comp.id + '\',\'company\')">🗑️</button>' +
                '</div>' +
            '</div>';
        });

        companyListEl.innerHTML = html;
    }

    window.openCompany = function(id) {
        activeCompanyId = id;
        saveActive();
        showMainScreen();
    };

    // Switch button
    document.getElementById('switch-btn').addEventListener('click', function() {
        activeCompanyId = null;
        clearForm();
        showCompanyScreen();
    });

    // ═════════════════════════════════════════════════════
    // GLOBAL CUSTOMERS (Shared - Company Selector Screen)
    // ═════════════════════════════════════════════════════
    document.getElementById('add-global-cust-btn').addEventListener('click', function() {
        var name = document.getElementById('global-cust-name').value.trim();
        if (!name) { toast('⚠️ Name daalein!'); return; }

        var exists = customers.some(function(c) {
            return c.name.toLowerCase() === name.toLowerCase();
        });
        if (exists) { toast('⚠️ Customer already exists!'); return; }

        customers.push({
            id: uid(),
            name: name,
            phone: document.getElementById('global-cust-phone').value.trim(),
            address: document.getElementById('global-cust-address').value.trim(),
            createdAt: Date.now()
        });

        saveCustomers();
        document.getElementById('global-cust-name').value = '';
        document.getElementById('global-cust-phone').value = '';
        document.getElementById('global-cust-address').value = '';
        renderGlobalCustomers();
        toast('✅ Customer added!');
    });

    function renderGlobalCustomers() {
        var box = document.getElementById('global-cust-list');
        if (customers.length === 0) {
            box.innerHTML = '<div style="text-align:center;color:#bbb;padding:10px;font-size:0.85rem;">Koi customer nahi</div>';
            return;
        }

        var html = '';
        customers.forEach(function(c) {
            html += '<div class="gcust-item">' +
                '<div>' +
                    '<div class="gcust-name">👤 ' + esc(c.name) + '</div>' +
                    '<div class="gcust-detail">' +
                        (c.phone ? '📞 ' + esc(c.phone) + ' ' : '') +
                        (c.address ? '📍 ' + esc(c.address) : '') +
                    '</div>' +
                '</div>' +
                '<button class="btn btn-sm btn-red" onclick="confirmDel(\'' + c.id + '\',\'customer\')" style="padding:4px 8px;font-size:0.75rem;">✕</button>' +
            '</div>';
        });
        box.innerHTML = html;
    }

    // ═════════════════════════════════════════════════════
    // TABS (Main Screen)
    // ═════════════════════════════════════════════════════
    var tabBtns = document.querySelectorAll('.tab');
    var sections = document.querySelectorAll('.section');

    for (var i = 0; i < tabBtns.length; i++) {
        tabBtns[i].addEventListener('click', function() {
            var t = this.getAttribute('data-tab');
            for (var j = 0; j < tabBtns.length; j++) tabBtns[j].classList.remove('active');
            for (var k = 0; k < sections.length; k++) sections[k].classList.remove('active');
            this.classList.add('active');
            document.getElementById('sec-' + t).classList.add('active');
            if (t === 'bills') renderBills();
            if (t === 'customers') renderCustomers();
            if (t === 'payments') { updatePayBillDropdown(); renderPaymentHistory(); }
        });
    }

    // ═════════════════════════════════════════════════════
    // CUSTOMER MANAGEMENT (Main Screen)
    // ═════════════════════════════════════════════════════
    function updateCustomerDropdown() {
        var sel = billCustomerEl.value;
        billCustomerEl.innerHTML = '<option value="">-- Select Customer --</option>';
        customers.forEach(function(c) {
            var o = document.createElement('option');
            o.value = c.id;
            o.textContent = c.name + (c.phone ? ' (' + c.phone + ')' : '');
            if (c.id === sel) o.selected = true;
            billCustomerEl.appendChild(o);
        });
    }

    function getCustomerName(id) {
        var c = customers.find(function(x) { return x.id === id; });
        return c ? c.name : 'Unknown';
    }

    // Add customer from bill form
    document.getElementById('show-add-cust').addEventListener('click', function() {
        document.getElementById('add-customer-box').style.display = 'block';
        document.getElementById('new-customer-name').focus();
    });

    document.getElementById('hide-add-cust').addEventListener('click', function() {
        document.getElementById('add-customer-box').style.display = 'none';
        document.getElementById('new-customer-name').value = '';
        document.getElementById('new-customer-phone').value = '';
        document.getElementById('new-customer-address').value = '';
    });

    document.getElementById('save-new-cust').addEventListener('click', function() {
        var name = document.getElementById('new-customer-name').value.trim();
        if (!name) { toast('⚠️ Name daalein!'); return; }

        var exists = customers.some(function(c) {
            return c.name.toLowerCase() === name.toLowerCase();
        });
        if (exists) { toast('⚠️ Customer exists!'); return; }

        var c = {
            id: uid(),
            name: name,
            phone: document.getElementById('new-customer-phone').value.trim(),
            address: document.getElementById('new-customer-address').value.trim(),
            createdAt: Date.now()
        };

        customers.push(c);
        saveCustomers();
        updateCustomerDropdown();
        billCustomerEl.value = c.id;

        document.getElementById('add-customer-box').style.display = 'none';
        document.getElementById('new-customer-name').value = '';
        document.getElementById('new-customer-phone').value = '';
        document.getElementById('new-customer-address').value = '';
        toast('✅ ' + name + ' added!');
    });

    // Add customer from customers tab
    document.getElementById('save-cust-btn').addEventListener('click', function() {
        var name = document.getElementById('cust-name').value.trim();
        if (!name) { toast('⚠️ Name daalein!'); return; }

        var exists = customers.some(function(c) {
            return c.name.toLowerCase() === name.toLowerCase();
        });
        if (exists) { toast('⚠️ Customer exists!'); return; }

        customers.push({
            id: uid(),
            name: name,
            phone: document.getElementById('cust-phone').value.trim(),
            address: document.getElementById('cust-address').value.trim(),
            createdAt: Date.now()
        });

        saveCustomers();
        updateCustomerDropdown();
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-phone').value = '';
        document.getElementById('cust-address').value = '';
        renderCustomers();
        toast('✅ ' + name + ' saved!');
    });

    function renderCustomers() {
        var box = document.getElementById('customers-container');
        if (customers.length === 0) {
            box.innerHTML = '<div class="empty"><span class="emoji">👥</span>Koi customer nahi</div>';
            return;
        }

        var html = '';
        customers.forEach(function(c) {
            var actualIn = 0;
            var actualOut = 0;
            var cnt = 0;

            bills.forEach(function(b) {
                if (b.customerId === c.id) {
                    cnt++;
                    var paidForBill = getBillPaid(b.id);
                    if (b.type === 'income') {
                        actualIn += paidForBill;
                    } else {
                        actualOut += paidForBill;
                    }
                }
            });

            var net = actualIn - actualOut;

            html += '<div class="customer-card" style="border-left-color:' + (net >= 0 ? '#22c55e' : (cnt === 0 ? '#667eea' : '#ef4444')) + ';">' +
                '<div class="cust-top"><div>' +
                '<div class="cust-name">👤 ' + esc(c.name) + '</div>' +
                '<div class="cust-detail">' +
                    (c.phone ? '📞 ' + esc(c.phone) + ' ' : '') +
                    (c.address ? '📍 ' + esc(c.address) : '') +
                '</div>' +
                '<div class="cust-detail">' + cnt + ' bill' + (cnt !== 1 ? 's' : '') + ' (this company)</div>' +
                '</div><div class="cust-stats">' +
                (cnt > 0 ? (
                    '<div style="color:#22c55e;">Received: ' + fmt(actualIn) + '</div>' +
                    '<div style="color:#ef4444;">Paid: ' + fmt(actualOut) + '</div>' +
                    '<div style="font-weight:700;margin-top:4px;padding-top:4px;border-top:1px solid #eee;color:' + (net >= 0 ? '#22c55e' : '#ef4444') + ';">' +
                        'Net: ' + (net >= 0 ? '+' : '−') + fmt(net) +
                    '</div>'
                ) : '<div style="color:#bbb;">No bills yet</div>') +
                '</div></div>' +
                '<div class="bill-actions">' +
                '<button class="btn btn-sm btn-red" onclick="confirmDel(\'' + c.id + '\',\'customer\')">🗑️</button>' +
                '</div></div>';
        });
        box.innerHTML = html;
    }

    // ═════════════════════════════════════════════════════
    // ITEMS MANAGEMENT
    // ═════════════════════════════════════════════════════
    document.getElementById('add-item-btn').addEventListener('click', addItem);

    itemPriceEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); addItem(); }
    });

    function addItem() {
        var name = itemNameEl.value.trim();
        var qty = parseInt(itemQtyEl.value) || 1;
        var price = parseFloat(itemPriceEl.value) || 0;
        if (!name) { toast('⚠️ Item name!'); itemNameEl.focus(); return; }
        if (price <= 0) { toast('⚠️ Price daalein!'); itemPriceEl.focus(); return; }
        items.push({ name: name, qty: qty, price: price, total: qty * price });
        itemNameEl.value = '';
        itemQtyEl.value = '1';
        itemPriceEl.value = '';
        itemNameEl.focus();
        renderItems();
        toast('✅ Item added!');
    }

    window.removeItem = function(idx) {
        items.splice(idx, 1);
        renderItems();
    };

    function renderItems() {
        if (items.length === 0) {
            itemsListEl.innerHTML = '';
            totalsArea.style.display = 'none';
            updateRemainingPreview();
            return;
        }
        totalsArea.style.display = 'block';
        var html = '';
        items.forEach(function(it, i) {
            html += '<div class="item-row">' +
                '<span class="item-name">' + esc(it.name) + '</span>' +
                '<span>' + it.qty + '</span>' +
                '<span>' + fmt(it.price) + '</span>' +
                '<span class="item-total">' + fmt(it.total) + '</span>' +
                '<button class="item-remove" onclick="removeItem(' + i + ')">✕</button></div>';
        });
        itemsListEl.innerHTML = html;
        calcTotals();
    }

    function calcTotals() {
        var sub = 0;
        items.forEach(function(it) { sub += it.total; });
        var taxP = parseFloat(taxPercentEl.value) || 0;
        var disc = parseFloat(discountEl.value) || 0;
        var taxAmt = sub * taxP / 100;
        var grand = Math.max(0, sub + taxAmt - disc);
        document.getElementById('subtotal').textContent = fmt(sub);
        document.getElementById('tax-amount').textContent = fmt(taxAmt);
        document.getElementById('discount-show').textContent = '-' + fmt(disc);
        document.getElementById('grand-total').textContent = fmt(grand);
        updateRemainingPreview();
    }

    taxPercentEl.addEventListener('input', calcTotals);
    discountEl.addEventListener('input', calcTotals);
    billPaidEl.addEventListener('input', updateRemainingPreview);

    function updateRemainingPreview() {
        var sub = 0;
        items.forEach(function(it) { sub += it.total; });
        var taxP = parseFloat(taxPercentEl.value) || 0;
        var disc = parseFloat(discountEl.value) || 0;
        var grand = Math.max(0, sub + (sub * taxP / 100) - disc);
        var paid = parseFloat(billPaidEl.value) || 0;

        // Paid amount grand total se zyada na ho
        if (paid > grand && grand > 0) {
            billPaidEl.value = grand;
            paid = grand;
            toast('⚠️ Paid amount total se zyada nahi ho sakta!');
        }

        var rem = Math.max(0, grand - paid);

        if (grand > 0 && paid < grand) {
            remainingBox.style.display = 'flex';
            document.getElementById('remaining-amount').textContent = fmt(rem);
        } else {
            remainingBox.style.display = 'none';
        }
    }
    // ═════════════════════════════════════════════════════
    // SAVE BILL
    // ═════════════════════════════════════════════════════
    saveBtnEl.addEventListener('click', function() {
        var custId = billCustomerEl.value;
        var date = billDateEl.value;
        var type = billTypeEl.value;
        var billNo = billNumberEl.value.trim();
        var notes = billNotesEl.value.trim();
        var taxP = parseFloat(taxPercentEl.value) || 0;
        var disc = parseFloat(discountEl.value) || 0;
        var paidAmt = parseFloat(billPaidEl.value) || 0;
        var payMode = billPayModeEl.value;

        if (!custId) { toast('⚠️ Customer select karein!'); return; }
        if (items.length === 0) { toast('⚠️ Item add karein!'); return; }

        var sub = 0;
        items.forEach(function(it) { sub += it.total; });
        var taxAmt = sub * taxP / 100;
        var grand = Math.max(0, sub + taxAmt - disc);

        // ── PAID VALIDATION ──
        if (paidAmt > grand) {
            paidAmt = grand;
            billPaidEl.value = grand;
            toast('⚠️ Paid amount adjust ho gaya — total se zyada nahi ho sakta!');
        }

        if (paidAmt < 0) {
            paidAmt = 0;
            billPaidEl.value = 0;
        }

        var bill = {
            id: editId || uid(),
            customerId: custId,
            customerName: getCustomerName(custId),
            date: date || today(),
            type: type,
            billNo: billNo,
            items: items.map(function(it) { return { name: it.name, qty: it.qty, price: it.price, total: it.total }; }),
            subtotal: sub,
            taxPercent: taxP,
            taxAmount: taxAmt,
            discount: disc,
            grandTotal: grand,
            notes: notes,
            createdAt: editId ? (function() {
                var o = bills.find(function(b) { return b.id === editId; });
                return o ? o.createdAt : Date.now();
            })() : Date.now()
        };

        if (editId) {
            // ── EDIT MODE ──
            payments = payments.filter(function(p) {
                return p.billId !== editId;
            });

            var idx = -1;
            for (var i = 0; i < bills.length; i++) {
                if (bills[i].id === editId) { idx = i; break; }
            }
            if (idx !== -1) bills[idx] = bill;

            if (paidAmt > 0) {
                payments.push({
                    id: uid(),
                    billId: bill.id,
                    amount: paidAmt,
                    mode: payMode,
                    date: date || today(),
                    note: 'Updated payment',
                    createdAt: Date.now()
                });
            }

            savePayments();
            toast('✅ Bill updated!');
        } else {
            // ── NEW BILL ──
            bills.push(bill);

            if (paidAmt > 0) {
                payments.push({
                    id: uid(),
                    billId: bill.id,
                    amount: paidAmt,
                    mode: payMode,
                    date: date || today(),
                    note: 'Initial payment',
                    createdAt: Date.now()
                });
                savePayments();
            }
            toast('✅ Bill saved!');
        }

        saveBills();
        clearForm();
        updateSummary();
        renderCustomers();
        renderBills();
    });
    
    document.getElementById('clear-btn').addEventListener('click', clearForm);

    function clearForm() {
        billCustomerEl.value = '';
        billDateEl.value = today();
        billTypeEl.value = 'income';
        billNumberEl.value = '';
        billNotesEl.value = '';
        taxPercentEl.value = '0';
        discountEl.value = '0';
        billPaidEl.value = '0';
        billPayModeEl.value = 'cash';
        items = [];
        editId = null;
        renderItems();
        saveBtnEl.textContent = '💾 Save Bill';
        remainingBox.style.display = 'none';
        document.getElementById('add-customer-box').style.display = 'none';
    }

    // ═════════════════════════════════════════════════════
    // BILLS LIST
    // ═════════════════════════════════════════════════════
    function getFilteredBills() {
        var list = bills.slice();
        var search = (document.getElementById('f-search').value || '').toLowerCase();
        var type = document.getElementById('f-type').value;
        var status = document.getElementById('f-status').value;
        var month = document.getElementById('f-month').value;

        if (search) list = list.filter(function(b) {
            return b.customerName.toLowerCase().indexOf(search) !== -1 ||
                b.items.some(function(it) { return it.name.toLowerCase().indexOf(search) !== -1; }) ||
                (b.billNo && b.billNo.toLowerCase().indexOf(search) !== -1);
        });
        if (type !== 'all') list = list.filter(function(b) { return b.type === type; });
        if (status !== 'all') list = list.filter(function(b) { return getBillStatus(b.id) === status; });
        if (month) list = list.filter(function(b) { return b.date.indexOf(month) === 0; });

        list.sort(function(a, b) {
            var d = b.date.localeCompare(a.date);
            return d !== 0 ? d : b.createdAt - a.createdAt;
        });
        return list;
    }

    function renderBills() {
        var box = document.getElementById('bills-container');
        var list = getFilteredBills();

        if (list.length === 0) {
            box.innerHTML = '<div class="empty"><span class="emoji">📭</span>Koi bill nahi mila</div>';
            return;
        }

        var html = '';
        list.forEach(function(b) {
            var paid = getBillPaid(b.id);
            var rem = Math.max(0, b.grandTotal - paid);
            var status = getBillStatus(b.id);
            var pct = b.grandTotal > 0 ? Math.min(100, (paid / b.grandTotal) * 100) : 0;
            var isIncome = b.type === 'income';

            var statusBadge = '<span class="status-badge status-' + status + '">';
            if (status === 'paid') statusBadge += '✅ Paid';
            else if (status === 'partial') statusBadge += '🟡 Partial';
            else statusBadge += '🔴 Unpaid';
            statusBadge += '</span>';

            var itemsStr = '';
            b.items.forEach(function(it) {
                itemsStr += '<span>' + esc(it.name) + ' × ' + it.qty + ' = ' + fmt(it.total) + '</span>';
            });

            var fillClass = status === 'paid' ? 'fill-full' : status === 'partial' ? 'fill-partial' : 'fill-zero';

            var billPayments = payments.filter(function(p) { return p.billId === b.id; });
            var payHtml = '';
            if (billPayments.length > 0) {
                payHtml = '<div class="pay-history">';
                billPayments.forEach(function(p) {
                    payHtml += '<div class="pay-entry' + (b.type === 'expense' ? ' expense-pay' : '') + '">' +
                        '<span>' + fmtDate(p.date) + ' • ' + p.mode + (p.note ? ' • ' + esc(p.note) : '') + '</span>' +
                        '<span style="font-weight:700;color:' + (b.type === 'income' ? '#22c55e' : '#ef4444') + ';">' + fmt(p.amount) + '</span>' +
                    '</div>';
                });
                payHtml += '</div>';
            }

            html += '<div class="bill-card ' + b.type + '-bill">' +
                '<div class="bill-top"><div>' +
                '<div class="bill-customer">' + esc(b.customerName) + '</div>' +
                '<div class="bill-meta">' +
                    '<span>📅 ' + fmtDate(b.date) + '</span>' +
                    (b.billNo ? '<span>🧾 ' + esc(b.billNo) + '</span>' : '') +
                    '<span>' + (isIncome ? '🟢 Income' : '🔴 Expense') + '</span>' +
                    statusBadge +
                '</div></div>' +
                '<div class="bill-amount ' + b.type + '-text">' + (isIncome ? '+' : '-') + fmt(b.grandTotal) + '</div>' +
                '</div>' +
                '<div class="bill-items">' + itemsStr + '</div>' +
                '<div class="payment-bar">' +
                    '<div class="payment-fill ' + fillClass + '" style="width:' + pct + '%"></div>' +
                    '<div class="payment-text">Paid: ' + fmt(paid) + ' / ' + fmt(b.grandTotal) +
                    (rem > 0 ? ' | Rem: ' + fmt(rem) : '') + '</div>' +
                '</div>' +
                payHtml +
                (b.notes ? '<div style="font-size:0.78rem;color:#999;margin-top:5px;">📝 ' + esc(b.notes) + '</div>' : '') +
                '<div class="bill-actions">' +
                    (rem > 0 ? '<button class="btn btn-sm btn-green" onclick="quickPay(\'' + b.id + '\')">💰 Pay</button>' : '') +
                    '<button class="btn btn-sm btn-primary" onclick="editBill(\'' + b.id + '\')">✏️</button>' +
                    '<button class="btn btn-sm btn-red" onclick="confirmDel(\'' + b.id + '\',\'bill\')">🗑️</button>' +
                '</div></div>';
        });
        box.innerHTML = html;
    }

    document.getElementById('f-search').addEventListener('input', renderBills);
    document.getElementById('f-type').addEventListener('change', renderBills);
    document.getElementById('f-status').addEventListener('change', renderBills);
    document.getElementById('f-month').addEventListener('change', renderBills);
    document.getElementById('clear-filter-btn').addEventListener('click', function() {
        document.getElementById('f-search').value = '';
        document.getElementById('f-type').value = 'all';
        document.getElementById('f-status').value = 'all';
        document.getElementById('f-month').value = '';
        renderBills();
    });

    // Quick Pay
    window.quickPay = function(billId) {
        for (var j = 0; j < tabBtns.length; j++) tabBtns[j].classList.remove('active');
        for (var k = 0; k < sections.length; k++) sections[k].classList.remove('active');
        document.querySelector('[data-tab="payments"]').classList.add('active');
        document.getElementById('sec-payments').classList.add('active');
        updatePayBillDropdown();
        document.getElementById('pay-bill-select').value = billId;
        showPayBillInfo();
        document.getElementById('pay-amount').focus();
        renderPaymentHistory();
    };

    // Edit Bill
        window.editBill = function(id) {
        var b = bills.find(function(x) { return x.id === id; });
        if (!b) return;
        editId = id;
        billCustomerEl.value = b.customerId;
        billDateEl.value = b.date;
        billTypeEl.value = b.type;
        billNumberEl.value = b.billNo || '';
        billNotesEl.value = b.notes || '';
        taxPercentEl.value = b.taxPercent || 0;
        discountEl.value = b.discount || 0;

        // Current paid amount load karo
        var currentPaid = getBillPaid(b.id);
        billPaidEl.value = currentPaid;

        items = b.items.map(function(it) {
            return { name: it.name, qty: it.qty, price: it.price, total: it.total };
        });
        renderItems();
        saveBtnEl.textContent = '✏️ Update Bill';

        for (var j = 0; j < tabBtns.length; j++) tabBtns[j].classList.remove('active');
        for (var k = 0; k < sections.length; k++) sections[k].classList.remove('active');
        tabBtns[0].classList.add('active');
        document.getElementById('sec-new').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast('✏️ Edit mode — Paid amount bhi change kar sakte ho');
    };
    
    // ═════════════════════════════════════════════════════
    // PAYMENTS TAB
    // ═════════════════════════════════════════════════════
    function updatePayBillDropdown() {
        var sel = document.getElementById('pay-bill-select');
        sel.innerHTML = '<option value="">-- Select Bill --</option>';
        bills.forEach(function(b) {
            var rem = getBillRemaining(b.id);
            var o = document.createElement('option');
            o.value = b.id;
            var label = b.customerName + ' | ' + fmtDate(b.date);
            if (b.billNo) label += ' | ' + b.billNo;
            label += ' | Total: ' + fmt(b.grandTotal) + ' | Rem: ' + fmt(rem);
            label += ' | ' + (b.type === 'income' ? '🟢' : '🔴');
            if (rem <= 0) label += ' ✅';
            o.textContent = label;
            if (rem <= 0) o.style.color = '#999';
            sel.appendChild(o);
        });
    }

    document.getElementById('pay-bill-select').addEventListener('change', showPayBillInfo);

    function showPayBillInfo() {
        var billId = document.getElementById('pay-bill-select').value;
        var infoBox = document.getElementById('pay-bill-info');
        if (!billId) { infoBox.style.display = 'none'; return; }

        var b = bills.find(function(x) { return x.id === billId; });
        if (!b) { infoBox.style.display = 'none'; return; }

        var paid = getBillPaid(billId);
        var rem = Math.max(0, b.grandTotal - paid);

        infoBox.style.display = 'block';
        infoBox.innerHTML =
            '<div class="pi-row"><span class="pi-label">Customer:</span><span class="pi-val">' + esc(b.customerName) + '</span></div>' +
            '<div class="pi-row"><span class="pi-label">Bill Total:</span><span class="pi-val">' + fmt(b.grandTotal) + '</span></div>' +
            '<div class="pi-row"><span class="pi-label">Already Paid:</span><span class="pi-val" style="color:#22c55e;">' + fmt(paid) + '</span></div>' +
            '<div class="pi-row"><span class="pi-label">⏳ Remaining:</span><span class="pi-val" style="color:#f59e0b;font-size:1.1rem;">' + fmt(rem) + '</span></div>' +
            '<div class="pi-row"><span class="pi-label">Type:</span><span class="pi-val">' + (b.type === 'income' ? '🟢 Income' : '🔴 Expense') + '</span></div>';

        document.getElementById('pay-amount').value = rem > 0 ? rem : '';
    }

    document.getElementById('pay-save-btn').addEventListener('click', function() {
        var billId = document.getElementById('pay-bill-select').value;
        var amount = parseFloat(document.getElementById('pay-amount').value) || 0;
        var mode = document.getElementById('pay-mode').value;
        var date = document.getElementById('pay-date').value || today();
        var note = document.getElementById('pay-note').value.trim();

        if (!billId) { toast('⚠️ Bill select karein!'); return; }
        if (amount <= 0) { toast('⚠️ Amount daalein!'); return; }

        var rem = getBillRemaining(billId);
        if (amount > rem) { toast('⚠️ Amount remaining (' + fmt(rem) + ') se zyada!'); return; }

        payments.push({
            id: uid(),
            billId: billId,
            amount: amount,
            mode: mode,
            date: date,
            note: note,
            createdAt: Date.now()
        });

        savePayments();
        toast('✅ Payment ' + fmt(amount) + ' added!');
        document.getElementById('pay-amount').value = '';
        document.getElementById('pay-note').value = '';
        showPayBillInfo();
        updatePayBillDropdown();
        updateSummary();
        renderPaymentHistory();
        renderCustomers();  // <-- Customer tab bhi refresh
        renderBills();      // <-- Bills tab bhi refresh
    });

    function renderPaymentHistory() {
        var box = document.getElementById('payments-list');
        var sorted = payments.slice().sort(function(a, b) { return b.createdAt - a.createdAt; });

        if (sorted.length === 0) {
            box.innerHTML = '<div class="empty">Koi payment nahi</div>';
            return;
        }

        var html = '';
        sorted.slice(0, 50).forEach(function(p) {
            var b = bills.find(function(x) { return x.id === p.billId; });
            var custName = b ? b.customerName : '?';
            var billType = b ? b.type : 'income';

            html += '<div class="pay-entry' + (billType === 'expense' ? ' expense-pay' : '') + '">' +
                '<div>' +
                    '<div style="font-weight:600;">' + esc(custName) + '</div>' +
                    '<div style="font-size:0.72rem;color:#999;">' +
                        fmtDate(p.date) + ' • ' + p.mode +
                        (p.note ? ' • ' + esc(p.note) : '') +
                        (b && b.billNo ? ' • ' + esc(b.billNo) : '') +
                    '</div>' +
                '</div>' +
                '<div style="text-align:right;">' +
                    '<div style="font-weight:700;color:' + (billType === 'income' ? '#22c55e' : '#ef4444') + ';">' +
                        (billType === 'income' ? '+' : '-') + fmt(p.amount) +
                    '</div>' +
                '</div>' +
            '</div>';
        });
        box.innerHTML = html;
    }

    // ═════════════════════════════════════════════════════
    // DELETE
    // ═════════════════════════════════════════════════════
    window.confirmDel = function(id, type) {
        delId = id;
        delType = type;
        if (type === 'bill') {
            document.getElementById('modal-title').textContent = '🗑️ Delete Bill?';
            document.getElementById('modal-msg').textContent = 'Bill aur payments bhi delete honge!';
        } else if (type === 'customer') {
            document.getElementById('modal-title').textContent = '🗑️ Delete Customer?';
            document.getElementById('modal-msg').textContent = 'Customer delete hoga (agar kisi company me bills nahi hain toh).';
        } else if (type === 'company') {
            document.getElementById('modal-title').textContent = '🗑️ Delete Company?';
            document.getElementById('modal-msg').textContent = 'Company aur uske SAARE bills/payments delete honge! Customers nahi hatenge.';
        }
        modalEl.style.display = 'flex';
    };

    document.getElementById('modal-yes').addEventListener('click', function() {
        if (delType === 'bill') {
            payments = payments.filter(function(p) { return p.billId !== delId; });
            bills = bills.filter(function(b) { return b.id !== delId; });
            if (editId === delId) clearForm();
            saveBills();
            savePayments();
            renderBills();
            toast('🗑️ Bill deleted!');
        } else if (delType === 'customer') {
            // Check ALL companies for bills with this customer
            var hasAnyBills = false;
            companies.forEach(function(comp) {
                var cBills = loadBillsFor(comp.id);
                if (cBills.some(function(b) { return b.customerId === delId; })) {
                    hasAnyBills = true;
                }
            });

            if (hasAnyBills) {
                toast('⚠️ Pehle saare companies se is customer ke bills delete karein!');
            } else {
                customers = customers.filter(function(c) { return c.id !== delId; });
                saveCustomers();
                updateCustomerDropdown();
                renderCustomers();
                renderGlobalCustomers();
                toast('🗑️ Customer deleted!');
            }
        } else if (delType === 'company') {
            // Delete company and its data
            try {
                localStorage.removeItem(billsKey(delId));
                localStorage.removeItem(paymentsKey(delId));
            } catch(e) {}

            companies = companies.filter(function(c) { return c.id !== delId; });
            saveCompanies();

            if (activeCompanyId === delId) {
                activeCompanyId = null;
                saveActive();
            }

            renderCompanyList();
            toast('🗑️ Company deleted!');
        }

        modalEl.style.display = 'none';
        delId = null;
        delType = null;
        updateSummary();
    });

    document.getElementById('modal-no').addEventListener('click', function() {
        modalEl.style.display = 'none';
        delId = null;
        delType = null;
    });

    modalEl.addEventListener('click', function(e) {
        if (e.target === modalEl) {
            modalEl.style.display = 'none';
            delId = null;
            delType = null;
        }
    });

    // ═════════════════════════════════════════════════════
    // SUMMARY
    // ═════════════════════════════════════════════════════
    function updateSummary() {
        var totalReceived = 0;
        var totalPaid = 0;
        var receivable = 0;
        var payable = 0;

        bills.forEach(function(b) {
            var paidForBill = getBillPaid(b.id);
            var remaining = Math.max(0, b.grandTotal - paidForBill);

            if (b.type === 'income') {
                totalReceived += paidForBill;
                receivable += remaining;
            } else {
                totalPaid += paidForBill;
                payable += remaining;
            }
        });

        var bal = totalReceived - totalPaid;

        document.getElementById('sum-income').textContent = fmt(totalReceived);
        document.getElementById('sum-expense').textContent = fmt(totalPaid);
        document.getElementById('sum-balance').textContent = (bal < 0 ? '-' : '') + fmt(bal);
        document.getElementById('sum-receivable').textContent = fmt(receivable);
        document.getElementById('sum-payable').textContent = fmt(payable);
    }

    // ═════════════════════════════════════════════════════
    // EXPORT CSV
    // ═════════════════════════════════════════════════════
    document.getElementById('export-btn').addEventListener('click', function() {
        var list = getFilteredBills();
        if (list.length === 0) { toast('⚠️ Koi bill nahi!'); return; }

        var comp = companies.find(function(c) { return c.id === activeCompanyId; });
        var compName = comp ? comp.name : 'Unknown';

        var csv = 'Company,Date,Bill No,Customer,Type,Items,Subtotal,Tax%,Tax Amt,Discount,Grand Total,Paid,Remaining,Status,Notes\n';
        var tIn = 0, tEx = 0;

        list.forEach(function(b) {
            var paid = getBillPaid(b.id);
            var rem = Math.max(0, b.grandTotal - paid);
            var status = getBillStatus(b.id);
            var itemsStr = b.items.map(function(it) {
                return it.name + ' x' + it.qty + ' @' + it.price;
            }).join(' | ');

            if (b.type === 'income') tIn += paid;
            else tEx += paid;

            csv += [
                csvSafe(compName), b.date, csvSafe(b.billNo || ''),
                csvSafe(b.customerName),
                b.type === 'income' ? 'Income' : 'Expense',
                csvSafe(itemsStr),
                b.subtotal.toFixed(2), b.taxPercent,
                b.taxAmount.toFixed(2), b.discount.toFixed(2),
                b.grandTotal.toFixed(2), paid.toFixed(2),
                rem.toFixed(2), status,
                csvSafe(b.notes || '')
            ].join(',') + '\n';
        });

        csv += '\n,,,,,,,,,,,Total Received,' + tIn.toFixed(2) + ',,\n';
        csv += ',,,,,,,,,,,Total Paid,' + tEx.toFixed(2) + ',,\n';
        csv += ',,,,,,,,,,,Balance,' + (tIn - tEx).toFixed(2) + ',,\n';

        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = compName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + today() + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('📥 CSV downloaded!');
    });

    // ═════════════════════════════════════════════════════
    // INIT
    // ═════════════════════════════════════════════════════
    loadCompanies();
    loadCustomers();
    loadActive();

    // Migration from old version
    if (companies.length === 0) {
        migrateOldData();
        loadCompanies(); // reload after migration
    }

    billDateEl.value = today();
    document.getElementById('pay-date').value = today();

    // Decide which screen to show
    if (activeCompanyId && companies.some(function(c) { return c.id === activeCompanyId; })) {
        showMainScreen();
    } else {
        showCompanyScreen();
    }

})();
