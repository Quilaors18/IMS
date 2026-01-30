const STORAGE_KEY_ITEMS = 'inventory_items';
const STORAGE_KEY_SYSTEM_UNITS = 'inventory_system_units';
const STORAGE_KEY_BORROWED = 'inventory_borrowed';
const STORAGE_KEY_AUTH = 'inventory_auth';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

function initData() {
    if (!localStorage.getItem(STORAGE_KEY_ITEMS)) {
        const initialItems = [
            { id: 1, name: 'Dell Latitude 5420', category: 'Laptop', quantity: 10, serialNumber: 'DL-5420-001', location: 'IT Dept', description: 'Standard issue laptop' },
            { id: 2, name: 'HP LaserJet Pro', category: 'Printer', quantity: 2, serialNumber: 'HP-LJP-002', location: 'HR Office', description: 'Network printer' },
            { id: 3, name: 'Logitech Mouse', category: 'Accessory', quantity: 50, serialNumber: 'LG-M-003', location: 'Storage A', description: 'Wireless mouse' }
        ];
        localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(initialItems));
    }
    if (!localStorage.getItem(STORAGE_KEY_SYSTEM_UNITS)) {
        localStorage.setItem(STORAGE_KEY_SYSTEM_UNITS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_BORROWED)) {
        localStorage.setItem(STORAGE_KEY_BORROWED, JSON.stringify([]));
    }
}

const app = {
    state: {
        currentUser: null,
        currentView: 'home',
        items: [],
        systemUnits: [],
        borrowedItems: []
    },

    init: function() {
        this.checkAuth();
        this.loadData();
        
        const urlParams = new URLSearchParams(window.location.search);
        const scanId = urlParams.get('scan');
        const unitCode = urlParams.get('unit');

        if (scanId) {
            setTimeout(() => this.showScanResult(parseInt(scanId)), 500);
        } else if (unitCode) {
            setTimeout(() => this.showSystemUnitPublic(unitCode), 500);
        } else {
            this.navigate('home');
        }
    },

    loadData: function() {
        Promise.all([
            fetch('/api/items').then(r => r.json()),
            fetch('/api/system_units').then(r => r.json()),
            fetch('/api/borrowed').then(r => r.json())
        ]).then(([items, units, borrowed]) => {
            this.state.items = Array.isArray(items) ? items : (items && Object.keys(items).length > 0 ? [items] : []);
            this.state.systemUnits = Array.isArray(units) ? units : (units && Object.keys(units).length > 0 ? [units] : []);
            this.state.borrowedItems = Array.isArray(borrowed) ? borrowed : (borrowed && Object.keys(borrowed).length > 0 ? [borrowed] : []);
            
            this.renderDashboard();
            this.renderBorrowing();
            console.log('Data loaded from server');
        }).catch(err => {
            console.error('Failed to load data from server:', err);
            this.showAlert('Error: Could not connect to server. Ensure server.ps1 is running.', 'danger');
        });
    },

    saveData: function() {
        fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.state.items)
        }).catch(e => console.error('Save items failed', e));

        fetch('/api/system_units', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.state.systemUnits)
        }).catch(e => console.error('Save units failed', e));

        fetch('/api/borrowed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.state.borrowedItems)
        }).catch(e => console.error('Save borrowed failed', e));
    },

    importLegacyData: function() {
        if (!confirm('Import data from LocalStorage? This will overwrite server data.')) return;
        
        const localItems = JSON.parse(localStorage.getItem(STORAGE_KEY_ITEMS) || '[]');
        const localUnits = JSON.parse(localStorage.getItem(STORAGE_KEY_SYSTEM_UNITS) || '[]');
        const localBorrowed = JSON.parse(localStorage.getItem(STORAGE_KEY_BORROWED) || '[]');
        
        this.state.items = localItems;
        this.state.systemUnits = localUnits;
        this.state.borrowedItems = localBorrowed;
        
        this.saveData();
        this.showAlert('Legacy data imported to server successfully!', 'success');
        this.renderDashboard();
    },

    getModal: function(elementId) {
        if (typeof bootstrap === 'undefined') {
            console.error('Bootstrap is not loaded');
            return null;
        }
        const el = document.getElementById(elementId);
        if (!el) return null;
        
        let modal = bootstrap.Modal.getInstance(el);
        if (!modal) {
            modal = new bootstrap.Modal(el);
        }
        return modal;
    },

    saveItems: function() {
        if (!this.validateAdminAction()) return;
        this.saveData();
        this.renderDashboard();
    },

    saveSystemUnitsToStorage: function() {
        this.saveData();
        this.renderDashboard();
    },

    saveBorrowedToStorage: function() {
        this.saveData();
        this.renderBorrowing();
    },

    navigate: function(viewName) {

        document.querySelectorAll('.view-section').forEach(el => el.classList.add('d-none'));
        
        const target = document.getElementById(`view-${viewName}`);
        if (target) {
            target.classList.remove('d-none');
            this.state.currentView = viewName;
        }

        this.updateNav();

        if (viewName === 'dashboard') {
            if (!this.state.currentUser) {
                this.navigate('login');
                return;
            }
            this.renderDashboard();
        } else if (viewName === 'borrowing') {
            if (!this.state.currentUser) {
                this.navigate('login');
                return;
            }
            this.renderBorrowing();
        }
    },

    updateNav: function() {
        const isLoggedIn = !!this.state.currentUser;
        const loginLink = document.getElementById('nav-login');
        const dashboardLink = document.getElementById('nav-dashboard');
        const borrowingLink = document.getElementById('nav-borrowing');
        const logoutLink = document.getElementById('nav-logout');

        if (isLoggedIn) {
            loginLink.classList.add('d-none');
            dashboardLink.classList.remove('d-none');
            borrowingLink.classList.remove('d-none');
            logoutLink.classList.remove('d-none');
        } else {
            loginLink.classList.remove('d-none');
            dashboardLink.classList.add('d-none');
            borrowingLink.classList.add('d-none');
            logoutLink.classList.add('d-none');
        }
    },

    checkAuth: function() {
        const storedAuth = sessionStorage.getItem(STORAGE_KEY_AUTH);
        if (storedAuth) {
            this.state.currentUser = JSON.parse(storedAuth);
        }
    },

    login: function(event) {
        event.preventDefault();
        const user = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;

        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            
            const csrfToken = 'csrf-' + Math.random().toString(36).substr(2) + Date.now();
            
            this.state.currentUser = { 
                username: user,
                roles: ['ROLE_ADMIN'],
                csrfToken: csrfToken 
            };
            
            sessionStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(this.state.currentUser));
            this.showAlert('Login successful! Authorized as ROLE_ADMIN.', 'success');
            this.navigate('dashboard');
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
        } else {
            this.showAlert('Invalid credentials', 'danger');
        }
    },

    hasRole: function(role) {
        return this.state.currentUser && this.state.currentUser.roles.includes(role);
    },

    validateAdminAction: function() {
        if (!this.hasRole('ROLE_ADMIN')) {
            this.showAlert('Access Denied: ROLE_ADMIN required.', 'danger');
            return false;
        }
        
        if (!this.state.currentUser.csrfToken || !this.state.currentUser.csrfToken.startsWith('csrf-')) {
             this.showAlert('Security Error: Invalid CSRF Token.', 'danger');
             return false;
        }
        return true;
    },

    logout: function() {
        this.state.currentUser = null;
        sessionStorage.removeItem(STORAGE_KEY_AUTH);
        this.showAlert('Logged out successfully', 'info');
        this.navigate('home');
    },

    renderDashboard: function() {

        const receivedUnits = this.state.systemUnits.filter(u => u.status === 'RECEIVED');
        const stockCount = receivedUnits.length;
        const draftCount = this.state.systemUnits.filter(u => u.status === 'DRAFT').length;

        const borrowedUnits = this.state.systemUnits.filter(u => u.status === 'BORROWED').length;

        const borrowedOtherItems = this.state.borrowedItems
            .filter(item => item.status === 'BORROWED' && !item.linkedUnitId)
            .reduce((sum, item) => sum + (item.quantityBorrowed || 0), 0);

        document.getElementById('stat-stock').innerText = stockCount;
        document.getElementById('stat-drafts').innerText = draftCount;
        
        const statBorrowedUnits = document.getElementById('stat-borrowed-units');
        if (statBorrowedUnits) statBorrowedUnits.innerText = borrowedUnits;
        
        const statBorrowedOthers = document.getElementById('stat-borrowed-others');
        if (statBorrowedOthers) statBorrowedOthers.innerText = borrowedOtherItems;

        const tbody = document.getElementById('inventory-table-body');
        if (tbody) {
            tbody.innerHTML = '';

            const categoryFilter = document.getElementById('filter-items-category');
            let currentCategorySelection = 'ALL';
            
            if (categoryFilter) {
                currentCategorySelection = categoryFilter.value;
                const categories = [...new Set(this.state.items.map(i => i.category || 'Uncategorized'))].sort();
                
                categoryFilter.innerHTML = '<option value="ALL">All Categories</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.text = cat;
                    categoryFilter.appendChild(option);
                });
                
                if (currentCategorySelection !== 'ALL' && categories.includes(currentCategorySelection)) {
                    categoryFilter.value = currentCategorySelection;
                } else {
                    categoryFilter.value = 'ALL';
                }
            }

            const filterValue = categoryFilter ? categoryFilter.value : 'ALL';
            let filteredItems = this.state.items;
            
            if (filterValue !== 'ALL') {
                filteredItems = filteredItems.filter(i => (i.category || 'Uncategorized') === filterValue);
            }

            // Sort by Name A-Z, then by ID
            filteredItems.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return a.id - b.id;
            });

            filteredItems.forEach(item => {
                let issuesIndicator = '';
                if (item.issues && item.issues.length > 0) {
                     issuesIndicator = `<span class="badge bg-danger ms-2" style="cursor: pointer;" title="Click to View Issues" onclick="app.showItemIssues(${item.id})"><i class="bi bi-exclamation-triangle-fill"></i> Issues</span>`;
                }

                let lowStockBadge = '';
                if (item.quantity <= 5 && item.enableLowStock) {
                    lowStockBadge = ' <span class="badge bg-danger ms-1" title="Low Stock">Low</span>';
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.id}</td>
                    <td><strong>${item.name}</strong>${issuesIndicator}</td>
                    <td><span class="badge bg-secondary">${item.category || '-'}</span></td>
                    <td>${item.serialNumber || '-'}</td>
                    <td>${item.quantity}${lowStockBadge}</td>
                    <td>${item.location || '-'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-info text-white me-1" onclick="app.showQR(${item.id})"><i class="bi bi-qr-code"></i></button>
                        <button class="btn btn-sm btn-primary me-1" onclick="app.viewItem(${item.id})">View</button>
                        <button class="btn btn-sm btn-warning me-1" onclick="app.editItem(${item.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteItem(${item.id})">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        const tbodyUnits = document.getElementById('system-units-table-body');
        if (tbodyUnits) {
            tbodyUnits.innerHTML = '';

            const filterValue = document.getElementById('filter-units') ? document.getElementById('filter-units').value : 'ALL';
            let filteredUnits = this.state.systemUnits;
            if (filterValue !== 'ALL') {
                filteredUnits = filteredUnits.filter(u => u.status === filterValue);
            }

            filteredUnits.forEach(unit => {
                const tr = document.createElement('tr');
                const isReceived = unit.status === 'RECEIVED';
                const isBorrowed = unit.status === 'BORROWED';
                
                let statusBadgeClass = 'secondary';
                if (isReceived) statusBadgeClass = 'success';
                else if (isBorrowed) statusBadgeClass = 'warning text-dark';
                
                const statusBadge = `<span class="badge bg-${statusBadgeClass} text-uppercase">${unit.status}</span>`;
                
                const isLocked = isReceived || isBorrowed;

                let actionButtons = '';
                if (!isLocked) {
                    actionButtons = `
                        <button class="btn btn-sm btn-warning me-1" title="Edit" onclick="app.editSystemUnit(${unit.id})">Edit</button>
                        <button class="btn btn-sm btn-success me-1" title="Receive Unit" onclick="app.receiveSystemUnit(${unit.id})">Receive</button>
                        <button class="btn btn-sm btn-danger" title="Delete" onclick="app.deleteSystemUnit(${unit.id})">Del</button>
                    `;
                } else {
                    actionButtons = `
                        <span class="badge bg-secondary"><i class="bi bi-lock"></i> Locked</span>
                        <div class="dropdown d-inline-block ms-1">
                            <button class="btn btn-sm btn-light border dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item text-danger" href="#" onclick="app.deleteSystemUnit(${unit.id})"><i class="bi bi-trash me-2"></i>Remove Unit</a></li>
                            </ul>
                        </div>
                    `;
                }

                let issuesIndicator = '';
                if (unit.issues && unit.issues.length > 0) {
                    issuesIndicator = `<span class="badge bg-danger ms-2" style="cursor: pointer;" title="Click to View Issues" onclick="app.showSystemUnitIssues('${unit.id}')"><i class="bi bi-exclamation-triangle-fill"></i> Issues</span>`;
                }

                tr.innerHTML = `
                    <td>${unit.id}</td>
                    <td><code>${unit.code}</code></td>
                    <td><strong>${unit.name}</strong>${issuesIndicator}</td>
                    <td>${statusBadge}</td>
                    <td>${unit.parts.length} parts</td>
                    <td>${unit.createdAt}</td>
                    <td class="text-end">
                         <button class="btn btn-sm btn-info text-white me-1" title="Show QR Code" onclick="app.showSystemUnitQR(${unit.id})"><i class="bi bi-qr-code"></i> QR</button>
                         <button class="btn btn-sm btn-primary me-1" title="View Details" onclick="app.viewSystemUnit(${unit.id})">View</button>
                         ${actionButtons}
                     </td>
                `;
                tbodyUnits.appendChild(tr);
            });
        }
    },

    showAddSystemUnitModal: function() {
        try {
            if (typeof bootstrap === 'undefined') {
                alert('Error: Bootstrap library not loaded. Please check your internet connection.');
                return;
            }

            const form = document.getElementById('systemUnitForm');
            if (form) form.reset();
            
            const unitIdEl = document.getElementById('unit-id');
            if (unitIdEl) unitIdEl.value = '';
            
            const codeInput = document.getElementById('unit-code-input');
            if (codeInput) {
                codeInput.value = '';
                codeInput.disabled = false;
            }

            const titleEl = document.getElementById('systemUnitModalTitle');
            if (titleEl) titleEl.innerText = 'Create New System Unit';
            
            const btnSave = document.getElementById('btn-save-unit');
            if (btnSave) btnSave.innerText = 'Create Unit';
            
            const container = document.getElementById('parts-container');
            if (container) {
                container.innerHTML = '';
                this.addPartField();
            } else {
                console.error('parts-container not found');
            }

            const modalEl = document.getElementById('systemUnitModal');
            if (modalEl) {
                const modal = this.getModal('systemUnitModal');
                if (modal) modal.show();
            } else {
                alert('Error: Modal element not found!');
            }
        } catch (e) {
            console.error(e);
            alert('An error occurred while opening the modal: ' + e.message);
        }
    },

    editSystemUnit: function(id) {
        const unit = this.state.systemUnits.find(u => u.id === id);
        if (!unit) return;

        document.getElementById('unit-id').value = unit.id;
        
        const codeInput = document.getElementById('unit-code-input');
        if (codeInput) {
            codeInput.value = unit.code || '';
            codeInput.disabled = (unit.status === 'RECEIVED'); 
        }
        
        document.getElementById('unit-name').value = unit.name;
        document.getElementById('systemUnitModalTitle').innerText = 'Edit System Unit (DRAFT)';
        document.getElementById('btn-save-unit').innerText = 'Update Unit';
        
        const container = document.getElementById('parts-container');
        container.innerHTML = '';
        unit.parts.forEach((part, index) => {
            const div = document.createElement('div');
            div.className = 'row mb-2 part-row';
            div.innerHTML = `
                <div class="col-md-6">
                    <input type="text" class="form-control" placeholder="Part Name (e.g., RAM)" name="partName_${index}" value="${part.name}" required>
                </div>
                <div class="col-md-5">
                    <input type="text" class="form-control" placeholder="Serial Number" name="partSerial_${index}" value="${part.serialNumber === null ? '' : part.serialNumber}">
                </div>
                <div class="col-md-1">
                    <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">X</button>
                </div>
            `;
            container.appendChild(div);
        });

        if (unit.parts.length === 0) {
            this.addPartField();
        }

        const modal = this.getModal('systemUnitModal');
        if (modal) modal.show();
    },

    addPartField: function() {
        const container = document.getElementById('parts-container');
        if (!container) return;
        
        const index = container.children.length;
        const div = document.createElement('div');
        div.className = 'row mb-2 part-row';
        div.innerHTML = `
            <div class="col-md-6">
                <input type="text" class="form-control" placeholder="Part Name (e.g., RAM)" name="partName_${index}" required>
            </div>
            <div class="col-md-5">
                <input type="text" class="form-control" placeholder="Serial Number" name="partSerial_${index}">
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">X</button>
            </div>
        `;
        container.appendChild(div);
    },

    saveSystemUnit: function(event) {
        event.preventDefault();
        
        if (!this.validateAdminAction()) return;

        const idStr = document.getElementById('unit-id').value;
        const codeInput = document.getElementById('unit-code-input');
        const customCode = codeInput ? codeInput.value.trim() : '';
        const name = document.getElementById('unit-name').value;
        const partRows = document.querySelectorAll('.part-row');
        const parts = [];

        partRows.forEach(row => {
            const nameInput = row.querySelector('input[name^="partName"]');
            const serialInput = row.querySelector('input[name^="partSerial"]');
            
            if (nameInput && nameInput.value.trim()) {
                let serial = serialInput.value.trim();
                if (serial === '') {
                    serial = null;
                }
                parts.push({
                    name: nameInput.value.trim(),
                    serialNumber: serial
                });
            }
        });

        if (parts.length === 0) {
            this.showAlert('Validation Error: A system unit must have at least one part.', 'danger');
            return;
        }

        const currentId = idStr ? parseInt(idStr) : null;
        if (customCode) {
            const duplicate = this.state.systemUnits.find(u => u.code === customCode && u.id !== currentId);
            if (duplicate) {
                this.showAlert(`Validation Error: System Unit Code '${customCode}' already exists.`, 'danger');
                return;
            }
        }

        if (idStr) {

            const id = parseInt(idStr);
            const unit = this.state.systemUnits.find(u => u.id === id);
            
            if (unit) {

                if (unit.status === 'RECEIVED') {
                    this.showAlert('Validation Error: Cannot modify a System Unit that has already been RECEIVED.', 'danger');
                    return;
                }
                
                if (customCode) unit.code = customCode;
                unit.name = name;
                unit.parts = parts;
                
                unit.qrUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?unit=${unit.code}`;

                this.showAlert('System Unit updated', 'success');
            }
        } else {

            const id = Date.now();
            const code = customCode || `SU-${id}`;

            const qrUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?unit=${code}`;

            const newUnit = {
                id: id,
                code: code,
                qrUrl: qrUrl,
                name: name,
                status: 'DRAFT',
                parts: parts,
                createdAt: new Date().toLocaleDateString()
            };
            this.state.systemUnits.push(newUnit);
            this.showAlert('System Unit created as DRAFT', 'success');
        }

        this.saveSystemUnitsToStorage();
        
        const modal = this.getModal('systemUnitModal');
        if (modal) modal.hide();
    },

    deleteSystemUnit: function(id) {
        if (!this.validateAdminAction()) return;

        if (confirm('Delete this system unit?')) {
            this.state.systemUnits = this.state.systemUnits.filter(u => u.id !== id);
            this.saveSystemUnitsToStorage();
            this.showAlert('System Unit deleted', 'warning');
            
            if (this.state.currentView === 'unit-public') {
                this.navigate('home');
            }
        }
    },

    viewItem: function(id) {
        const item = this.state.items.find(i => i.id === id);
        if (!item) return;

        let issuesHtml = '';
        if (item.issues && item.issues.length > 0) {
            issuesHtml = `<div class="mt-3">
                <h6 class="text-danger fw-bold border-bottom pb-2">Reported Issues</h6>
                <ul class="list-group list-group-flush">`;
            
            item.issues.forEach(issue => {
                const date = new Date(issue.date).toLocaleString();
                issuesHtml += `
                    <li class="list-group-item px-0">
                        <div class="d-flex justify-content-between">
                            <span class="badge bg-danger">${issue.status}</span>
                            <small class="text-muted">${date}</small>
                        </div>
                        <div class="small mt-1"><strong>${issue.borrower}</strong>: ${issue.remarks}</div>
                    </li>
                `;
            });
            issuesHtml += `</ul></div>`;
        } else {
             issuesHtml = `<div class="mt-3 text-success"><i class="bi bi-check-circle-fill"></i> No reported issues</div>`;
        }

        const modalBody = `
            <div class="text-center mb-3">
                <h4 class="fw-bold">${item.name}</h4>
                <span class="badge bg-secondary">${item.category || 'Uncategorized'}</span>
            </div>
            <table class="table table-sm table-borderless">
                <tbody>
                    <tr>
                        <td class="fw-bold text-muted" style="width: 120px;">Serial Number:</td>
                        <td>${item.serialNumber || '<span class="text-muted fst-italic">N/A</span>'}</td>
                    </tr>
                    <tr>
                        <td class="fw-bold text-muted">Quantity:</td>
                        <td>${item.quantity} ${item.enableLowStock && item.quantity <= 5 ? '<span class="badge bg-danger ms-1">Low Stock</span>' : ''}</td>
                    </tr>
                    <tr>
                        <td class="fw-bold text-muted">Location:</td>
                        <td>${item.location || '-'}</td>
                    </tr>
                    <tr>
                        <td class="fw-bold text-muted">Description:</td>
                        <td>${item.description || '-'}</td>
                    </tr>
                </tbody>
            </table>
            ${issuesHtml}
        `;

        const viewModalBody = document.getElementById('viewUnitModalBody');
        if (viewModalBody) {
             document.getElementById('viewUnitModalTitle').innerText = 'Item Details';
             viewModalBody.innerHTML = modalBody;
             const modal = this.getModal('viewUnitModal');
             if (modal) modal.show();
        }
    },

    viewSystemUnit: function(id) {
        const unit = this.state.systemUnits.find(u => u.id === id);
        if (!unit) return;
        
        let partsHtml = '<ul class="list-group">';
        unit.parts.forEach(p => {
            const serialDisplay = p.serialNumber === null ? '<span class="text-muted">N/A</span>' : p.serialNumber;
            
            let issueContent = '';
            if (unit.issues) {
                const issue = unit.issues.find(i => i.partName === p.name);
                if (issue) {
                    issueContent = `
                        <div class="mt-1 text-danger small border-top pt-1">
                            <i class="bi bi-exclamation-triangle-fill"></i> <strong>${issue.status}</strong>: ${issue.remarks}
                        </div>
                    `;
                }
            }

            partsHtml += `<li class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    ${p.name}
                    <span class="badge bg-light text-dark border">${serialDisplay}</span>
                </div>
                ${issueContent}
            </li>`;
        });
        partsHtml += '</ul>';

        let receivedDisplay = '';
        if (unit.status === 'RECEIVED' && unit.dateReceived) {
            const date = new Date(unit.dateReceived);
            const dateStr = !isNaN(date.getTime()) 
                ? date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : unit.dateReceived;
            receivedDisplay = `<p class="text-success"><strong>Date Received:</strong> ${dateStr}</p>`;
        }

        const modalBody = `
            <p><strong>Status:</strong> ${unit.status}</p>
            ${receivedDisplay}
            <p><strong>Code:</strong> ${unit.code}</p>
            <p class="mb-2"><strong>Parts (Audit & Warranty Only):</strong></p>
            ${partsHtml}
        `;

        const viewModalBody = document.getElementById('viewUnitModalBody');
        if (viewModalBody) {
             document.getElementById('viewUnitModalTitle').innerText = unit.name;
             viewModalBody.innerHTML = modalBody;
             const modal = this.getModal('viewUnitModal');
             if (modal) modal.show();
        }
    },

    showSystemUnitIssues: function(id) {
        const unit = this.state.systemUnits.find(u => u.id == id);
        
        if (!unit) {
            console.error('Unit not found for ID:', id);
            return;
        }

        if (!unit.issues || unit.issues.length === 0) {
            this.showAlert('No issues recorded for this unit.', 'info');
            return;
        }

        let issuesHtml = '<div class="alert alert-warning"><i class="bi bi-exclamation-triangle-fill me-2"></i>The following issues were reported upon return:</div>';
        issuesHtml += '<ul class="list-group">';
        
        unit.issues.forEach(issue => {
            const safePartName = issue.partName.replace(/'/g, "\\'");
            issuesHtml += `
                <li class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <strong>${issue.partName}</strong>
                        <div>
                            <span class="badge bg-danger me-2">${issue.status}</span>
                            <button class="btn btn-sm btn-outline-success" onclick="app.restoreSystemUnitIssue('${unit.id}', '${safePartName}')" title="Mark as Restored">
                                <i class="bi bi-check-lg"></i> Restore
                            </button>
                        </div>
                    </div>
                    <div class="text-muted small fst-italic">"${issue.remarks}"</div>
                </li>
            `;
        });
        issuesHtml += '</ul>';

        const viewModalBody = document.getElementById('viewUnitModalBody');
        if (viewModalBody) {
             document.getElementById('viewUnitModalTitle').innerHTML = `<span class="text-danger">Issues:</span> ${unit.name}`;
             viewModalBody.innerHTML = issuesHtml;
             const modal = this.getModal('viewUnitModal');
             if (modal) {
                 modal.show();
             } else {
                 console.error('Failed to get modal instance');
                 alert('Error: Could not open details modal.');
             }
        }
    },

    restoreSystemUnitIssue: function(id, partName) {
        if (!confirm(`Are you sure you want to mark ${partName} as restored? This will remove the issue from the record.`)) return;

        const unit = this.state.systemUnits.find(u => u.id == id);
        if (!unit) return;

        if (unit.issues) {
            unit.issues = unit.issues.filter(i => i.partName !== partName);
            
            if (unit.issues.length === 0) {
                delete unit.issues;
                const modalEl = document.getElementById('viewUnitModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
            } else {
                this.showSystemUnitIssues(id);
            }
            
            this.saveSystemUnitsToStorage();
            this.renderDashboard();
            this.showAlert(`Issue for ${partName} has been resolved.`, 'success');
        }
    },

    showItemIssues: function(id) {
        const item = this.state.items.find(i => i.id === id);
        if (!item) return;

        if (!item.issues || item.issues.length === 0) {
            this.showAlert('No issues recorded for this item.', 'info');
            return;
        }

        let issuesHtml = '<div class="alert alert-warning"><i class="bi bi-exclamation-triangle-fill me-2"></i>Reported issues for this item:</div>';
        issuesHtml += '<ul class="list-group">';
        
        item.issues.forEach(issue => {
            const issueDate = new Date(issue.date).toLocaleDateString() + ' ' + new Date(issue.date).toLocaleTimeString();
            issuesHtml += `
                <li class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div>
                            <span class="badge bg-danger me-2">${issue.status}</span>
                            <span class="fw-bold text-dark small">Returned by: ${issue.borrower}</span>
                        </div>
                        <button class="btn btn-sm btn-outline-success" onclick="app.resolveItemIssue(${item.id}, '${issue.id}')" title="Mark as Resolved">
                            <i class="bi bi-check-lg"></i> Resolve
                        </button>
                    </div>
                    <div class="mb-1 text-muted small"><i class="bi bi-clock"></i> ${issueDate}</div>
                    <div class="text-dark small fst-italic">"${issue.remarks}"</div>
                </li>
            `;
        });
        issuesHtml += '</ul>';

        const viewModalBody = document.getElementById('viewUnitModalBody');
        if (viewModalBody) {
             document.getElementById('viewUnitModalTitle').innerHTML = `<span class="text-danger">Issues:</span> ${item.name}`;
             viewModalBody.innerHTML = issuesHtml;
             const modal = this.getModal('viewUnitModal');
             if (modal) modal.show();
        }
    },

    resolveItemIssue: function(itemId, issueId) {
        if (!confirm('Are you sure you want to mark this issue as resolved?')) return;

        const item = this.state.items.find(i => i.id === itemId);
        if (!item) return;

        if (item.issues) {
            item.issues = item.issues.filter(i => i.id !== issueId);
            
            if (item.issues.length === 0) {
                delete item.issues;
                const modalEl = document.getElementById('viewUnitModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
            } else {
                this.showItemIssues(itemId);
            }
            
            this.saveItems();
            this.showAlert('Issue resolved successfully.', 'success');
        }
    },

    receiveSystemUnit: function(id) {
        if (!this.validateAdminAction()) return;

        if (!confirm('Mark this unit as RECEIVED? This will lock the parts list and serial numbers.')) return;

        const unit = this.state.systemUnits.find(u => u.id === id);
        if (unit) {
            unit.status = 'RECEIVED';
            unit.dateReceived = new Date().toISOString();
            this.saveSystemUnitsToStorage();
            this.showAlert('System Unit marked as RECEIVED', 'success');

            if (this.state.currentView === 'unit-public') {
                this.showSystemUnitPublic(unit.code);
            }
        }
    },

    showAddItemModal: function() {
        document.getElementById('itemForm').reset();
        document.getElementById('item-id').value = '';
        document.getElementById('itemModalTitle').innerText = 'Add Item';
        
        const lowStockCheck = document.getElementById('item-enable-low-stock');
        if (lowStockCheck) {
            lowStockCheck.checked = false;
        }

        const multiCheck = document.getElementById('item-multi-serial-mode');
        if (multiCheck) {
            multiCheck.checked = false;
            multiCheck.disabled = false;
            multiCheck.parentElement.classList.remove('d-none');
        }
        
        this.renderSerialInputs();
        const modal = this.getModal('itemModal');
        if (modal) modal.show();
    },

    editItem: function(id) {
        const item = this.state.items.find(i => i.id === id);
        if (!item) return;

        document.getElementById('item-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-desc').value = item.description || '';
        document.getElementById('item-category').value = item.category || '';
        document.getElementById('item-qty').value = item.quantity;
        document.getElementById('item-serial').value = item.serialNumber;
        document.getElementById('item-location').value = item.location || '';
        
        const lowStockCheck = document.getElementById('item-enable-low-stock');
        if (lowStockCheck) {
            lowStockCheck.checked = !!item.enableLowStock;
        }

        const multiCheck = document.getElementById('item-multi-serial-mode');
        if (multiCheck) {
            multiCheck.checked = false;
            multiCheck.disabled = true;
            multiCheck.parentElement.classList.add('d-none');
        }
        this.renderSerialInputs();

        document.getElementById('itemModalTitle').innerText = 'Edit Item';
        const modal = this.getModal('itemModal');
        if (modal) modal.show();
    },

    renderSerialInputs: function() {
        const qtyInput = document.getElementById('item-qty');
        const multiCheck = document.getElementById('item-multi-serial-mode');
        const singleGroup = document.getElementById('single-serial-group');
        const multiGroup = document.getElementById('multi-serial-group');
        const singleInput = document.getElementById('item-serial');

        if (!qtyInput || !multiCheck) return;

        const qty = parseInt(qtyInput.value) || 0;
        const isMulti = multiCheck.checked;

        if (isMulti && qty > 0) {
            singleGroup.classList.add('d-none');
            multiGroup.classList.remove('d-none');
            singleInput.required = false;

            const currentInputs = multiGroup.querySelectorAll('input').length;
            if (currentInputs !== qty) {
                multiGroup.innerHTML = '';
                for (let i = 0; i < qty; i++) {
                    const div = document.createElement('div');
                    div.className = 'mb-2';
                    div.innerHTML = `
                        <input type="text" class="form-control form-control-sm multi-serial-input" 
                            placeholder="Serial #${i + 1}" required>
                    `;
                    multiGroup.appendChild(div);
                }
            }
        } else {
            singleGroup.classList.remove('d-none');
            multiGroup.classList.add('d-none');
            singleInput.required = true;
            
            if (isMulti) {
                 multiGroup.innerHTML = '<div class="text-danger small">Please enter a valid quantity first.</div>';
                 multiGroup.classList.remove('d-none');
                 singleGroup.classList.add('d-none');
            }
        }
    },

    saveItem: function(event) {
        event.preventDefault();
        
        if (!this.validateAdminAction()) return;

        const idStr = document.getElementById('item-id').value;
        const name = document.getElementById('item-name').value;
        const desc = document.getElementById('item-desc').value;
        const category = document.getElementById('item-category').value;
        const location = document.getElementById('item-location').value;
        const qty = parseInt(document.getElementById('item-qty').value);
        
        const isMulti = document.getElementById('item-multi-serial-mode').checked;
        const enableLowStock = document.getElementById('item-enable-low-stock').checked;

        if (isMulti && !idStr) {
           
            const serialInputs = document.querySelectorAll('.multi-serial-input');
            const serials = Array.from(serialInputs).map(input => input.value.trim());

            if (serials.some(s => !s)) {
                this.showAlert('Please fill in all serial numbers.', 'warning');
                return;
            }

            let addedCount = 0;
            serials.forEach((serial, index) => {
                const newItem = {
                    id: Date.now() + index,
                    name: name,
                    description: desc,
                    category: category,
                    quantity: 1,
                    serialNumber: serial,
                    location: location,
                    enableLowStock: enableLowStock
                };
                this.state.items.push(newItem);
                addedCount++;
            });
            
            this.showAlert(`${addedCount} items added successfully!`, 'success');

        } else {
            const newItem = {
                name: name,
                description: desc,
                category: category,
                quantity: qty,
                serialNumber: document.getElementById('item-serial').value,
                location: location,
                enableLowStock: enableLowStock
            };

            if (idStr) {
                const index = this.state.items.findIndex(i => i.id === parseInt(idStr));
                if (index !== -1) {
                    this.state.items[index] = { ...this.state.items[index], ...newItem };
                    this.showAlert('Item updated', 'success');
                }
            } else {
                newItem.id = Date.now();
                this.state.items.push(newItem);
                this.showAlert('Item added', 'success');
            }
        }

        this.saveItems();
        
        const modal = this.getModal('itemModal');
        if (modal) modal.hide();
    },

    deleteItem: function(id) {
        if (!this.validateAdminAction()) return;

        if (confirm('Are you sure you want to delete this item?')) {
            this.state.items = this.state.items.filter(i => i.id !== id);
            this.saveItems();
            this.showAlert('Item deleted', 'warning');
        }
    },

    showQR: function(id) {
        const item = this.state.items.find(i => i.id === id);
        if (!item) return;

        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';

        document.getElementById('qr-item-name').innerText = `${item.name} (${item.serialNumber})`;

        const scanUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?scan=${item.id}`;

        new QRCode(qrContainer, {
            text: scanUrl,
            width: 128,
            height: 128
        });

        const modal = this.getModal('qrModal');
        if (modal) modal.show();
    },

    simulateScan: function() {
        
        if (this.state.items.length > 0) {
            const randomItem = this.state.items[Math.floor(Math.random() * this.state.items.length)];

        } else {
            this.showAlert('No items to scan!', 'warning');
        }
    },

    showScanResult: function(id) {
        const item = this.state.items.find(i => i.id === id);
        
        if (item) {
            this.navigate('scan-result');
            
            document.getElementById('scan-id').innerText = `#${item.id}`;
            document.getElementById('scan-name').innerText = item.name;
            document.getElementById('scan-desc').innerText = item.description || 'No description provided';
            document.getElementById('scan-category').innerText = item.category || '-';
            document.getElementById('scan-serial').innerText = item.serialNumber || '-';
            document.getElementById('scan-location').innerText = item.location || '-';
            document.getElementById('scan-qty').innerText = item.quantity;
            
            const statusEl = document.getElementById('scan-status');
            if (item.quantity > 0) {
                statusEl.innerHTML = '<span class="badge bg-success">Available In Stock</span>';
            } else {
                statusEl.innerHTML = '<span class="badge bg-danger">Out of Stock</span>';
            }

            const actionsEl = document.getElementById('scan-actions');
            if (actionsEl) {
                actionsEl.innerHTML = `
                    <button class="btn btn-danger" onclick="app.deleteItem(${item.id})">Remove Item</button>
                `;
            }
        } else {
            const unit = this.state.systemUnits.find(u => u.id === id);
            if (unit) {
                this.showPublicUnitView(id);
            } else {
                this.navigate('scan-result');
                document.getElementById('scan-name').innerText = 'Item Not Found';
                document.getElementById('scan-desc').innerText = 'The requested item ID does not exist in the inventory.';
                document.getElementById('scan-id').innerText = '-';
                document.getElementById('scan-category').innerText = '-';
                document.getElementById('scan-serial').innerText = '-';
                document.getElementById('scan-location').innerText = '-';
                document.getElementById('scan-qty').innerText = '-';
                document.getElementById('scan-status').innerHTML = '<span class="badge bg-secondary">Unknown</span>';
            }
        }
    },

    showSystemUnitQR: function(id) {
        const unit = this.state.systemUnits.find(u => u.id === id);
        if (!unit) return;

        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';
        document.getElementById('qr-item-name').innerText = `${unit.name} (${unit.code})`;

        const qrUrl = unit.qrUrl;

        new QRCode(qrContainer, {
            text: qrUrl,
            width: 128,
            height: 128
        });

        const modal = this.getModal('qrModal');
        if (modal) modal.show();
    },

    downloadQR: function() {
        const qrImg = document.querySelector('#qrcode img');
        if (qrImg) {
            const link = document.createElement('a');
            link.href = qrImg.src;
            link.download = 'system-unit-qr.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            this.showAlert('QR Code not generated yet', 'warning');
        }
    },

    showSystemUnitPublic: function(code) {
        const unit = this.state.systemUnits.find(u => u.code === code);
        this.navigate('unit-public');

        if (unit) {
            document.getElementById('public-unit-code').innerText = unit.code;
            document.getElementById('public-unit-name').innerText = unit.name;
            
            const isReceived = unit.status === 'RECEIVED';
            const statusClass = isReceived ? 'success' : 'warning';
            const statusIcon = isReceived ? '<i class="bi bi-check-circle-fill"></i>' : '<i class="bi bi-hourglass-split"></i>';
            
            document.getElementById('public-unit-status').innerHTML = 
                `<span class="badge bg-${statusClass} px-3 py-2 text-uppercase">${statusIcon} ${unit.status}</span>`;
            
            const dateContainer = document.getElementById('public-unit-received-container');
            const dateEl = document.getElementById('public-unit-received-date');
            
            if (unit.dateReceived) {
                dateContainer.classList.remove('d-none');
                
                const date = new Date(unit.dateReceived);
                if (!isNaN(date.getTime())) {
                    dateEl.innerText = date.toLocaleString('en-US', { 
                        year: 'numeric', month: 'long', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                    });
                } else {

                }
            } else {
                dateContainer.classList.add('d-none');
            }

            let partsHtml = '<ul class="list-group list-group-flush text-start">';
            unit.parts.forEach(p => {
                const serialDisplay = p.serialNumber === null ? '<span class="text-muted fst-italic">N/A</span>' : `<code class="text-dark">${p.serialNumber}</code>`;
                partsHtml += `<li class="list-group-item d-flex justify-content-between align-items-center py-3">
                    <span class="fw-medium">${p.name}</span>
                    ${serialDisplay}
                </li>`;
            });
            partsHtml += '</ul>';
            document.getElementById('public-unit-parts').innerHTML = partsHtml;
        } else {
            document.getElementById('public-unit-name').innerText = 'System Unit Not Found';
            document.getElementById('public-unit-parts').innerHTML = '<div class="alert alert-danger">The requested System Unit Code does not exist.</div>';
            document.getElementById('public-unit-status').innerText = '-';
            document.getElementById('public-unit-code').innerText = '-';
        }
    },

    renderBorrowing: function() {
        const tbody = document.getElementById('borrowing-table-body');
        tbody.innerHTML = '';
        
        const checkAll = document.getElementById('borrow-check-all');
        if (checkAll) checkAll.checked = false;
        this.updateBatchActionState();

        const searchInput = document.getElementById('borrow-search');
        const filterStatusEl = document.getElementById('borrow-filter-status');
        const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filterStatus = filterStatusEl ? filterStatusEl.value : 'ALL';

        let sortedItems = this.state.borrowedItems.filter(item => {
            if (filterStatus === 'ALL') return true;
            return item.status === filterStatus;
        });

        if (searchQuery) {
            sortedItems = sortedItems.filter(item => {
                const name = String(item.itemName || '').toLowerCase();
                const borrower = String(item.borrower || '').toLowerCase();
                return name.includes(searchQuery) || borrower.includes(searchQuery);
            });
        }

        sortedItems.sort((a, b) => {
            const getDate = (d) => {
                if (!d) return 0;
                const ms = new Date(d).getTime();
                return isNaN(ms) ? 0 : ms;
            };

            if (a.status !== b.status) {
                return a.status === 'BORROWED' ? -1 : 1;
            }

            if (a.status === 'BORROWED') {
                return getDate(b.dateBorrowed) - getDate(a.dateBorrowed);
            } else {
                return getDate(b.dateReturned) - getDate(a.dateReturned);
            }
        });

        const formatDateTime = (isoString) => {
            if (!isoString) return '-';
            const date = new Date(isoString);
            return date.toLocaleString('en-US', { 
                year: 'numeric', month: 'short', day: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });
        };

        sortedItems.forEach(item => {
            const isReturned = item.status === 'RETURNED';
            const isReleased = item.status === 'RELEASED';
            
            let statusBadge = '';
            if (isReturned) {
                statusBadge = '<span class="badge bg-success">RETURNED</span>';
            } else if (isReleased) {
                statusBadge = '<span class="badge bg-secondary">RELEASED</span>';
            } else {
                statusBadge = '<span class="badge bg-warning text-dark">BORROWED</span>';
            }
            
            const checkbox = `<input type="checkbox" class="form-check-input borrow-item-checkbox ms-2" value="${item.id}" data-status="${item.status}" onchange="app.updateBatchActionState()">`;

            const actions = (isReturned || isReleased) 
                ? '' 
                : `<button class="btn btn-sm btn-outline-success me-1" onclick="app.returnItem('${item.id}')">Return</button>`;

            const displayName = (item.itemName || 'Unknown Item').replace(/\s*\(Qty: \d+\)/, '').trim();
            
            let serialDisplay = '';
            if (item.serialNumber && item.serialNumber !== 'N/A') {
                serialDisplay = `<div class="small text-muted"><i class="bi bi-upc-scan"></i> SN: ${item.serialNumber}</div>`;
            } else if (item.serialNumber === 'N/A') {
                serialDisplay = `<div class="small text-muted"><i class="bi bi-upc-scan"></i> SN: N/A</div>`;
            }

            const currentQty = item.quantityBorrowed || 1;
            
            let partsDisplay = '';
            if (item.partsReport && item.partsReport.length > 0) {
                partsDisplay = '<div class="mt-2 small bg-light p-2 rounded border">';
                partsDisplay += '<div class="fw-bold text-danger mb-1"><i class="bi bi-exclamation-triangle-fill"></i> Parts Issues:</div>';
                item.partsReport.forEach(p => {
                    partsDisplay += `
                        <div class="mb-1">
                            <span class="fw-bold text-dark">• ${p.partName}:</span> 
                            <span class="badge bg-danger">${p.status}</span>
                            <span class="text-muted fst-italic">"${p.remarks}"</span>
                        </div>
                    `;
                });
                partsDisplay += '</div>';
            }

            const qtyDisplay = `<span class="fw-bold">${currentQty}</span>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${statusBadge}</td>
                <td>
                    ${displayName}
                    ${serialDisplay}
                    ${partsDisplay}
                </td>
                <td>${qtyDisplay}</td>
                <td>${item.borrower}</td>
                <td>${item.event}</td>
                <td>${formatDateTime(item.dateBorrowed)}</td>
                <td>${formatDateTime(item.dateReturned)}</td>
                <td class="text-end">
                    ${actions}
                    <button class="btn btn-sm btn-outline-danger" onclick="app.deleteBorrowedItem('${item.id}')"><i class="bi bi-trash"></i></button>
                    ${checkbox}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    toggleBorrowCheckAll: function() {
        const checkAll = document.getElementById('borrow-check-all');
        const checkboxes = document.querySelectorAll('.borrow-item-checkbox');
        checkboxes.forEach(cb => cb.checked = checkAll.checked);
        this.updateBatchActionState();
    },

    updateBatchActionState: function() {
        const checkboxes = document.querySelectorAll('.borrow-item-checkbox:checked');
        const returnBtn = document.getElementById('btn-return-batch');
        const deleteBtn = document.getElementById('btn-delete-batch');
        
        let hasBorrowed = false;
        checkboxes.forEach(cb => {
            if (cb.dataset.status === 'BORROWED') {
                hasBorrowed = true;
            }
        });

        if (checkboxes.length > 0) {

            if (deleteBtn) {
                deleteBtn.classList.remove('d-none');
                deleteBtn.innerText = `Delete Selected (${checkboxes.length})`;
            }

            if (returnBtn) {
                if (hasBorrowed) {
                    returnBtn.classList.remove('d-none');
                    const borrowCount = Array.from(checkboxes).filter(cb => cb.dataset.status === 'BORROWED').length;
                    returnBtn.innerText = `Return Selected (${borrowCount})`;
                } else {
                    returnBtn.classList.add('d-none');
                }
            }
        } else {
            if (returnBtn) returnBtn.classList.add('d-none');
            if (deleteBtn) deleteBtn.classList.add('d-none');
        }
    },

    deleteSelectedItems: function() {
        if (!this.validateAdminAction()) return;

        const checkboxes = document.querySelectorAll('.borrow-item-checkbox:checked');
        if (checkboxes.length === 0) {
            this.showAlert('Please select at least one item to delete.', 'warning');
            return;
        }

        const activeBorrowedCount = Array.from(checkboxes).filter(cb => cb.dataset.status === 'BORROWED').length;
        if (activeBorrowedCount > 0) {
            this.showAlert(`Cannot delete ${activeBorrowedCount} item(s) that are still borrowed. Please return them first.`, 'warning');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${checkboxes.length} record(s)? This cannot be undone.`)) return;

        const idsToDelete = Array.from(checkboxes).map(cb => cb.value);

        this.state.borrowedItems = this.state.borrowedItems.filter(item => !idsToDelete.includes(String(item.id)));

        this.saveBorrowedToStorage();
        this.renderBorrowing();
        this.showAlert('Selected records deleted successfully.', 'success');
        this.renderBorrowing();
    },

    returnSelectedItems: function() {
        if (!this.validateAdminAction()) return;

        const checkboxes = document.querySelectorAll('.borrow-item-checkbox:checked');
        if (checkboxes.length === 0) {
            this.showAlert('Please select at least one item to return.', 'warning');
            return;
        }

        const items = [];
        checkboxes.forEach(cb => {
            const item = this.state.borrowedItems.find(i => String(i.id) === cb.value);
            if (item && item.status === 'BORROWED') {
                items.push(item);
            }
        });

        if (items.length > 0) {
            this.openReturnModal(items);
        }
    },

    openReturnModal: function(items) {
        const tbody = document.getElementById('return-table-body');
        tbody.innerHTML = '';
        
        items.forEach(item => {
            const displayName = item.itemName.replace(/\s*\(Qty: \d+\)/, '').trim();
            
            let partsHtml = '';
            if (item.linkedUnitId) {
                const unit = this.state.systemUnits.find(u => u.id === item.linkedUnitId);
                if (unit && unit.parts && unit.parts.length > 0) {
                    partsHtml = '<div class="mt-2 small border-top pt-2 bg-light p-2 rounded">';
                    partsHtml += '<div class="fw-bold mb-2 text-secondary">Verify Parts:</div>';
                    partsHtml += '<div class="parts-verification-container">';
                    unit.parts.forEach((p, idx) => {
                        const serial = p.serialNumber ? `(${p.serialNumber})` : '';
                        const partId = `part-${item.id}-${idx}`;
                        
                        partsHtml += `
                            <div class="mb-3 border-bottom pb-2 part-row" data-part-name="${p.name}">
                                <div class="d-flex align-items-center justify-content-between mb-1">
                                    <label class="fw-medium text-truncate" title="${p.name} ${serial}">
                                        ${p.name} <span class="text-muted small">${serial}</span>
                                    </label>
                                    <select class="form-select form-select-sm w-auto part-status-select" onchange="app.togglePartRemark(this)">
                                        <option value="OK" selected>OK</option>
                                        <option value="MISSING">Missing</option>
                                        <option value="BROKEN">Broken</option>
                                    </select>
                                </div>
                                <input type="text" class="form-control form-control-sm part-remark d-none" placeholder="Reason / Description (Required)" required disabled>
                            </div>
                        `;
                    });
                    partsHtml += '</div></div>';
                }
            } else {
                partsHtml = '<div class="mt-2 small border-top pt-2 bg-light p-2 rounded">';
                partsHtml += '<div class="fw-bold mb-2 text-secondary">Item Condition:</div>';
                partsHtml += '<div class="parts-verification-container">';
                
                const safeItemName = item.itemName.replace(/"/g, '&quot;');
                
                partsHtml += `
                    <div class="mb-3 border-bottom pb-2 part-row" data-part-name="${safeItemName}">
                        <div class="d-flex align-items-center justify-content-between mb-1">
                            <label class="fw-medium">Condition</label>
                            <select class="form-select form-select-sm w-auto part-status-select" onchange="app.togglePartRemark(this)">
                                <option value="OK" selected>Good / OK</option>
                                <option value="DAMAGED">Damaged</option>
                                <option value="BROKEN">Broken</option>
                                <option value="MISSING">Missing</option>
                            </select>
                        </div>
                        <input type="text" class="form-control form-control-sm part-remark d-none" placeholder="Issue Description (Required)" required disabled>
                    </div>
                `;
                partsHtml += '</div></div>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="fw-bold">${displayName}</div>
                    <div class="small text-muted mb-2"><i class="bi bi-person"></i> ${item.borrower}</div>
                    ${partsHtml}
                    <input type="hidden" class="return-item-id" value="${item.id}">
                </td>
                <td class="text-center align-middle">${item.quantityBorrowed}</td>
                <td class="align-middle">
                    <input type="number" class="form-control return-item-qty" 
                        value="${item.quantityBorrowed}" min="1" max="${item.quantityBorrowed}">
                </td>
            `;
            tbody.appendChild(tr);
        });

        const modal = this.getModal('returnModal');
        if (modal) modal.show();
    },

    togglePartRemark: function(selectEl) {
        const remarkInput = selectEl.parentElement.nextElementSibling;
        if (selectEl.value === 'OK') {
            remarkInput.classList.add('d-none');
            remarkInput.disabled = true;
            remarkInput.required = false;
        } else {
            remarkInput.classList.remove('d-none');
            remarkInput.disabled = false;
            remarkInput.required = true;
            remarkInput.focus();
        }
    },

    confirmReturn: function() {
        const rows = document.querySelectorAll('#return-table-body tr');
        let successCount = 0;
        let validationError = false;

        rows.forEach(row => {
            if (validationError) return;

            const partsContainer = row.querySelector('.parts-verification-container');
            if (partsContainer) {
                const partRows = partsContainer.querySelectorAll('.part-row');
                partRows.forEach(pRow => {
                    if (validationError) return;

                    const status = pRow.querySelector('.part-status-select').value;
                    const remarkInput = pRow.querySelector('.part-remark');
                    const remark = remarkInput.value.trim();
                    
                    if (status !== 'OK' && !remark) {
                        validationError = true;
                        remarkInput.classList.add('is-invalid');
                        remarkInput.focus();
                        this.showAlert('Please provide a reason/description for all issues.', 'danger');
                    } else {
                        remarkInput.classList.remove('is-invalid');
                    }
                });
            }
        });

        if (validationError) return;

        rows.forEach(row => {
            const id = row.querySelector('.return-item-id').value;
            const qtyInput = row.querySelector('.return-item-qty');
            const returnQty = parseInt(qtyInput.value);
            
            const item = this.state.borrowedItems.find(i => String(i.id) === String(id));

            let partsReport = null;
            const partsContainer = row.querySelector('.parts-verification-container');
            if (partsContainer) {
                partsReport = [];
                const partRows = partsContainer.querySelectorAll('.part-row');
                partRows.forEach(pRow => {
                    const name = pRow.dataset.partName;
                    const status = pRow.querySelector('.part-status-select').value;
                    const remark = pRow.querySelector('.part-remark').value;
                    
                    if (status !== 'OK') {
                        partsReport.push({
                            partName: name,
                            status: status,
                            remarks: remark
                        });
                    }
                });
                
                if (partsReport.length === 0) partsReport = null;
            }

            if (item && item.status !== 'RETURNED') {
                if (this.processReturnTransaction(item, returnQty, partsReport)) {
                    successCount++;
                }
            }
        });

        if (successCount > 0) {
            this.saveSystemUnitsToStorage();
            this.saveItems();
            this.saveBorrowedToStorage();
            this.showAlert(`${successCount} item(s) returned successfully.`, 'success');
            
            const modal = this.getModal('returnModal');
            if (modal) modal.hide();
        }
    },

    showBorrowModal: function() {
        document.getElementById('borrow-form').reset();
        document.getElementById('borrow-id').value = '';
        
        // Ensure System Unit is selected by default
        const typeUnitRadio = document.getElementById('type-unit');
        if (typeUnitRadio) typeUnitRadio.checked = true;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const dateTimeLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
        document.getElementById('borrow-date').value = dateTimeLocal;

        const warningEl = document.getElementById('borrow-stock-warning');
        if (warningEl) warningEl.innerText = '';
        
        const unitContainer = document.getElementById('borrow-unit-checkboxes');
        unitContainer.innerHTML = '';
        
        const availableUnits = this.state.systemUnits.filter(u => u.status === 'RECEIVED');
        
        if (availableUnits.length === 0) {
            unitContainer.innerHTML = '<div class="text-muted small text-center p-2">No available units</div>';
        } else {
            availableUnits.forEach(u => {
                const div = document.createElement('div');
                div.className = 'form-check';
                div.innerHTML = `
                    <input class="form-check-input borrow-unit-checkbox" type="checkbox" value="${u.id}" id="unit-check-${u.id}">
                    <label class="form-check-label" for="unit-check-${u.id}">
                        ${u.name} <small class="text-muted">(${u.code})</small>
                    </label>
                `;
                unitContainer.appendChild(div);
            });
        }

        const categoryFilter = document.getElementById('borrow-category-filter');
        if (categoryFilter) {
            const categories = [...new Set(this.state.items.map(i => i.category || 'Uncategorized'))].sort();
            categoryFilter.innerHTML = '<option value="ALL">All Categories</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.text = cat;
                categoryFilter.appendChild(option);
            });
            categoryFilter.value = 'ALL';
        }

        this.filterBorrowItems();

        this.toggleBorrowType();
        
        const modal = this.getModal('borrowModal');
        if (modal) modal.show();
    },

    filterBorrowItems: function() {
        const categoryFilter = document.getElementById('borrow-category-filter');
        const listContainer = document.getElementById('borrow-item-list');
        const filterValue = categoryFilter ? categoryFilter.value : 'ALL';
        
        listContainer.innerHTML = '';
        
        let filteredItems = this.state.items;
        if (filterValue !== 'ALL') {
            filteredItems = filteredItems.filter(i => (i.category || 'Uncategorized') === filterValue);
        }
        
        if (filteredItems.length === 0) {
             listContainer.innerHTML = '<div class="text-muted small text-center p-2">No items found</div>';
             return;
        }

        filteredItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'd-flex justify-content-between align-items-center mb-2 border-bottom pb-1';
            
            let stockText = `Stock: ${item.quantity}`;
            let stockClass = 'text-muted';
            let isDisabled = false;
            
            if (item.quantity <= 0) {
                stockText = 'Out of Stock';
                stockClass = 'text-danger fw-bold';
                isDisabled = true;
            } else if (item.quantity <= 5 && item.enableLowStock) {
                stockText += ' (Low)';
                stockClass = 'text-warning fw-bold';
            }

            const serialInfo = item.serialNumber ? `<span class="badge bg-light text-dark border ms-1">${item.serialNumber}</span>` : '';

            div.innerHTML = `
                <div class="form-check text-truncate me-2" style="flex: 1;">
                    <input class="form-check-input borrow-manual-item-checkbox" type="checkbox" value="${item.id}" id="manual-item-${item.id}" onchange="app.toggleManualItemQty('${item.id}')" ${isDisabled ? 'disabled' : ''}>
                    <label class="form-check-label small" for="manual-item-${item.id}" title="${item.name}">
                        ${item.name} 
                        ${serialInfo}
                        <div style="font-size: 0.75rem;" class="${stockClass}">${stockText}</div>
                    </label>
                </div>
                <div class="d-flex align-items-center" style="width: 70px;">
                    <input type="number" class="form-control form-control-sm manual-item-qty" id="manual-qty-${item.id}" value="1" min="1" max="${item.quantity}" disabled>
                </div>
            `;
            listContainer.appendChild(div);
        });
    },

    toggleBorrowType: function() {
        const checkedInput = document.querySelector('input[name="borrowType"]:checked');
        const type = checkedInput ? checkedInput.value : 'unit';
        
        const unitGroup = document.getElementById('group-unit-select');
        const manualGroup = document.getElementById('group-manual-input');

        if (type === 'unit') {
            if (unitGroup) unitGroup.classList.remove('d-none');
            if (manualGroup) manualGroup.classList.add('d-none');
        } else {
            if (unitGroup) unitGroup.classList.add('d-none');
            if (manualGroup) manualGroup.classList.remove('d-none');
        }
    },
    
    toggleManualItemQty: function(id) {
        const checkbox = document.getElementById(`manual-item-${id}`);
        const qtyInput = document.getElementById(`manual-qty-${id}`);
        if (checkbox && qtyInput) {
            qtyInput.disabled = !checkbox.checked;
            if (!checkbox.checked) qtyInput.value = 1;
        }
    },

    saveBorrowedItem: function(event) {
        event.preventDefault();
        if (!this.validateAdminAction()) return;

        const checkedInput = document.querySelector('input[name="borrowType"]:checked');
        const type = checkedInput ? checkedInput.value : 'unit';
        
        const borrower = document.getElementById('borrower-name').value;
        const eventName = document.getElementById('borrow-event').value;
        const dateBorrowed = document.getElementById('borrow-date').value;
        
        const isReturnable = document.getElementById('borrow-returnable').checked;
        const status = isReturnable ? 'BORROWED' : 'RELEASED';

        if (type === 'unit') {

            const checkboxes = document.querySelectorAll('.borrow-unit-checkbox:checked');
            if (checkboxes.length === 0) {
                this.showAlert('Please select at least one System Unit.', 'warning');
                return;
            }

            checkboxes.forEach(cb => {
                const unitId = parseInt(cb.value);
                const unit = this.state.systemUnits.find(u => u.id === unitId);
                if (unit) {

                    unit.status = status;
                    
                    const newItem = {
                        id: 'B-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                        itemName: `${unit.name} (${unit.code})`,
                        borrower: borrower,
                        event: eventName,
                        dateBorrowed: dateBorrowed,
                        status: status,
                        linkedUnitId: unit.id,
                        linkedUnitCode: unit.code,
                        quantityBorrowed: 1,
                        createdAt: new Date().toISOString()
                    };
                    this.state.borrowedItems.unshift(newItem);
                }
            });
            
            this.saveSystemUnitsToStorage();
            this.saveBorrowedToStorage();

        } else {

            const manualCheckboxes = document.querySelectorAll('.borrow-manual-item-checkbox:checked');
            
            if (manualCheckboxes.length === 0) {
                this.showAlert('Please select at least one item.', 'warning');
                return;
            }

            let validationFailed = false;
            manualCheckboxes.forEach(cb => {
                if (validationFailed) return;
                const itemId = parseInt(cb.value);
                const qtyInput = document.getElementById(`manual-qty-${itemId}`);
                const qty = parseInt(qtyInput.value);
                const item = this.state.items.find(i => i.id === itemId);
                
                if (item) {
                    if (isNaN(qty) || qty <= 0) {
                        this.showAlert(`Invalid quantity for ${item.name}`, 'warning');
                        validationFailed = true;
                    } else if (item.quantity < qty) {
                        this.showAlert(`Insufficient stock for ${item.name}. Available: ${item.quantity}`, 'danger');
                        validationFailed = true;
                    }
                }
            });
            if (validationFailed) return;

            manualCheckboxes.forEach(cb => {
                const itemId = parseInt(cb.value);
                const qtyInput = document.getElementById(`manual-qty-${itemId}`);
                const qty = parseInt(qtyInput.value);
                const item = this.state.items.find(i => i.id === itemId);
                
                if (item) {
                    item.quantity -= qty;
                    
                    const newItem = {
                        id: 'B-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                        itemName: item.name,
                        borrower: borrower,
                        event: eventName,
                        dateBorrowed: dateBorrowed,
                        status: status,
                        quantityBorrowed: qty,
                        linkedItemId: item.id,
                        serialNumber: item.serialNumber || 'N/A',
                        createdAt: new Date().toISOString()
                    };
                    this.state.borrowedItems.unshift(newItem);
                }
            });

            this.saveData();
            this.renderDashboard();
            this.renderBorrowing();
            this.showAlert(status === 'RELEASED' ? 'Items marked as released.' : 'Items recorded as borrowed.', 'success');
        }

        const modal = this.getModal('borrowModal');
        if (modal) modal.hide();
    },

    returnItem: function(id) {
        if (!this.validateAdminAction()) return;
        const item = this.state.borrowedItems.find(i => String(i.id) === String(id));
        if (item && item.status === 'BORROWED') {
             this.openReturnModal([item]);
        }
    },

    processReturnTransaction: function(item, returnQty, partsReport = null) {
        if (isNaN(returnQty) || returnQty <= 0 || returnQty > item.quantityBorrowed) return false;

        if (item.linkedUnitId) {
            const unit = this.state.systemUnits.find(u => u.id === item.linkedUnitId);
            if (unit) {
                unit.status = 'RECEIVED';
                if (partsReport) {
                    unit.issues = partsReport;
                } else {
                    delete unit.issues;
                }
            }
        } else if (item.linkedItemId) {
            const inventoryItem = this.state.items.find(i => i.id === item.linkedItemId);
            if (inventoryItem) {
                inventoryItem.quantity += returnQty;

                if (partsReport) {
                    if (!inventoryItem.issues) inventoryItem.issues = [];
                    
                    partsReport.forEach(report => {
                         inventoryItem.issues.push({
                             id: Date.now() + Math.random().toString(36).substr(2, 9),
                             date: new Date().toISOString(),
                             borrower: item.borrower,
                             status: report.status,
                             remarks: report.remarks
                         });
                    });
                }
            }
        }

        if (returnQty < item.quantityBorrowed) {

            const returnedItem = {
                ...item,
                id: 'B-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                quantityBorrowed: returnQty,
                status: 'RETURNED',
                dateReturned: new Date().toISOString(),
                partsReport: partsReport
            };
            
            this.state.borrowedItems.unshift(returnedItem);

            item.quantityBorrowed -= returnQty;

        } else {
            item.status = 'RETURNED';
            item.dateReturned = new Date().toISOString();
            if (partsReport) {
                item.partsReport = partsReport;
            }
        }

        return true;
    },

    deleteBorrowedItem: function(id) {
        if (!this.validateAdminAction()) return;
        if (!confirm('Are you sure you want to delete this record?')) return;

        this.state.borrowedItems = this.state.borrowedItems.filter(i => String(i.id) !== String(id));
        this.saveData();
        this.showAlert('Record deleted.', 'info');
        this.renderBorrowing();
    },

    showAlert: function(message, type) {
        const container = document.getElementById('alert-container');
        if (!container) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        container.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    }
};

window.app = app;

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
