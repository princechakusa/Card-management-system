// Simple front-end prototype using localStorage for persistence.
// Key data model:
// - apartments: [{id, name}]
// - cards: [{id, unitId, type, number, status, assignedTo, history: [{when, action, note}]}]

const STORAGE_KEY = 'cardMgmtData_v1';

const defaultData = {
  apartments: [
    // sample
    // { id: 'u101', name: '103 Studio - Azizi Rivera' }
  ],
  cards: [
    // { id:'c1', unitId:'u101', type:'Access Card', number:'A-001', status:'Available', assignedTo:'', history:[] }
  ]
};

let store = loadStore();

// UI nodes
const statTotal = document.getElementById('statTotalCards');
const statAssigned = document.getElementById('statAssigned');
const statAvailable = document.getElementById('statAvailable');
const statMissing = document.getElementById('statMissing');

const cardsTableBody = document.querySelector('#cardsTable tbody');
const apartmentsList = document.getElementById('apartmentsList');
const filterUnit = document.getElementById('filterUnit');
const filterType = document.getElementById('filterType');
const filterStatus = document.getElementById('filterStatus');
const searchInput = document.getElementById('searchInput');

const modal = document.getElementById('modalBackdrop');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');

document.getElementById('openAddApartment').addEventListener('click', showAddApartment);
document.getElementById('openAddCard').addEventListener('click', showAddCard);
document.getElementById('applyFilters').addEventListener('click', render);
document.getElementById('clearFilters').addEventListener('click', clearFilters);
document.getElementById('exportBtn').addEventListener('click', exportCSV);
modalClose.addEventListener('click', closeModal);
searchInput.addEventListener('input', render);

render();

function loadStore(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
      return JSON.parse(JSON.stringify(defaultData));
    }
    return JSON.parse(raw);
  } catch(e){
    console.error('loadStore error', e);
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function saveStore(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function uid(prefix='id') {
  return prefix + Math.random().toString(36).slice(2,9);
}

/* ------------------ Render ------------------ */
function render(){
  // update filters dropdown (units)
  populateUnitFilter();

  // compute stats
  const total = store.cards.length;
  const assigned = store.cards.filter(c=>c.status==='Assigned').length;
  const available = store.cards.filter(c=>c.status==='Available').length;
  const missing = store.cards.filter(c=>c.status==='Missing').length;
  statTotal.textContent = total;
  statAssigned.textContent = assigned;
  statAvailable.textContent = available;
  statMissing.textContent = missing;

  // table list with search & filters
  const q = searchInput.value.trim().toLowerCase();
  const unitFilter = filterUnit.value;
  const typeFilter = filterType.value;
  const statusFilter = filterStatus.value;

  const rows = store.cards.filter(card=>{
    if(unitFilter && card.unitId!==unitFilter) return false;
    if(typeFilter && card.type!==typeFilter) return false;
    if(statusFilter && card.status!==statusFilter) return false;
    if(q){
      const unitName = (store.apartments.find(a=>a.id===card.unitId)||{name:''}).name.toLowerCase();
      if(!(card.number.toLowerCase().includes(q) ||
           card.type.toLowerCase().includes(q) ||
           (card.assignedTo||'').toLowerCase().includes(q) ||
           unitName.includes(q))) return false;
    }
    return true;
  });

  // render table
  cardsTableBody.innerHTML = '';
  rows.forEach(card=>{
    const tr = document.createElement('tr');
    const unitName = (store.apartments.find(a=>a.id===card.unitId)||{name:'-' }).name;
    tr.innerHTML = `
      <td>${unitName}</td>
      <td>${card.type}</td>
      <td>${card.number}</td>
      <td><span class="status-pill status-${card.status.replace(/\s/g,'')}">${card.status}</span></td>
      <td>${card.assignedTo || '-'}</td>
      <td class="actions">
        <button class="tiny secondary" data-id="${card.id}" data-action="assign">Assign</button>
        <button class="tiny" data-id="${card.id}" data-action="return">Return</button>
        <button class="tiny" data-id="${card.id}" data-action="history">History</button>
        <button class="tiny danger" data-id="${card.id}" data-action="delete">Delete</button>
      </td>
    `;
    cardsTableBody.appendChild(tr);
  });

  // action handlers (delegation)
  cardsTableBody.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if(action === 'assign') showAssignCard(id);
      if(action === 'return') markReturn(id);
      if(action === 'history') showCardHistory(id);
      if(action === 'delete') deleteCard(id);
    });
  });

  // render apartments list
  apartmentsList.innerHTML = '';
  store.apartments.forEach(a=>{
    const el = document.createElement('div');
    const countAssigned = store.cards.filter(c=>c.unitId===a.id && c.status==='Assigned').length;
    const countMissing = store.cards.filter(c=>c.unitId===a.id && c.status==='Missing').length;
    el.className = 'apartment-pill';
    el.textContent = ${a.name} • A:${countAssigned} M:${countMissing};
    apartmentsList.appendChild(el);
  });
}

/* ------------------ UI: Add Apartment / Card ------------------ */

function showAddApartment(){
  openModal(`
    <h3>Add apartment</h3>
    <div class="form-row">
      <div class="full">
        <label>Unit name or number</label>
        <input id="newUnitName" placeholder="e.g. 103 Studio - Azizi Rivera" />
      </div>
    </div>
    <div style="margin-top:12px;text-align:right">
      <button class="btn" id="saveApartment">Save</button>
    </div>
  `);
  document.getElementById('saveApartment').addEventListener('click', ()=>{
    const name = document.getElementById('newUnitName').value.trim();
    if(!name){ alert('Please enter a unit name'); return; }
    const id = uid('u');
    store.apartments.push({id,name});
    saveStore();
    closeModal();
    render();
  });
}

function showAddCard(){
  // build unit options
  const options = store.apartments.map(a=><option value="${a.id}">${a.name}</option>).join('');
  openModal(`
    <h3>Add card</h3>
    <div class="form-row">
      <div>
        <label>Unit</label>
        <select id="cardUnit">${options}</select>
      </div>
      <div>
        <label>Card type</label>
        <select id="cardTypeField">
          <option>Access Card</option>
          <option>Parking Card</option>
          <option>Utility Card</option>
        </select>
      </div>

      <div class="full">
        <label>Card number</label>
        <input id="cardNumberField" placeholder="e.g. A-001" />
      </div>

      <div class="full">
        <label>Status</label>
        <select id="cardStatusField">
          <option>Available</option>
          <option>Assigned</option>
          <option>Missing</option>
        </select>
      </div>
    </div>

    <div style="margin-top:12px;text-align:right">
      <button class="btn" id="saveCard">Save card</button>
    </div>
  `);

  document.getElementById('saveCard').addEventListener('click', ()=>{
    const unitId = document.getElementById('cardUnit').value;
    const type = document.getElementById('cardTypeField').value;
    const number = document.getElementById('cardNumberField').value.trim();
    const status = document.getElementById('cardStatusField').value;

    if(!unitId || !number){ alert('Please select unit and enter card number'); return; }
    const id = uid('c');
    const card = { id, unitId, type, number, status, assignedTo:'', history:[] };
    card.history.push({ when: new Date().toISOString(), action: 'Created', note: Status ${status} });
    store.cards.push(card);
    saveStore();
    closeModal();
    render();
  });
}

/* ------------------ Actions ------------------ */

function showAssignCard(cardId){
  const card = store.cards.find(c=>c.id===cardId);
  if(!card) return;
  openModal(`
    <h3>Assign card ${card.number}</h3>
    <div>
      <label>Unit</label>
      <div class="text-muted">${(store.apartments.find(a=>a.id===card.unitId)||{name:'-' }).name}</div>

      <label>Assign to (tenant name)</label>
      <input id="assignName" placeholder="Tenant name" />

      <label>Mark status</label>
      <select id="assignStatus">
        <option>Assigned</option>
        <option>Missing</option>
      </select>
    </div>
    <div style="margin-top:12px;text-align:right">
      <button class="btn" id="doAssign">Assign</button>
    </div>
  `);

  document.getElementById('doAssign').addEventListener('click', ()=>{
    const name = document.getElementById('assignName').value.trim();
    const status = document.getElementById('assignStatus').value;
    if(!name){ alert('Enter tenant name'); return; }
    card.assignedTo = name;
    card.status = status;
    card.history.push({when: new Date().toISOString(), action: 'Assigned', note: Assigned to ${name}});
    saveStore();
    closeModal();
    render();
  });
}

function markReturn(cardId){
  const card = store.cards.find(c=>c.id===cardId);
  if(!card) return;
  // mark returned (available) and log
  const previous = card.status;
  card.status = 'Available';
  card.assignedTo = '';
  card.history.push({when:new Date().toISOString(), action:'Returned', note:Previous ${previous}});
  saveStore();
  render();
}

function showCardHistory(cardId){
  const card = store.cards.find(c=>c.id===cardId);
  if(!card) return;
  const historyHtml = (card.history || []).map(h=>{
    const time = new Date(h.when).toLocaleString();
    return <div style="margin-bottom:8px"><strong>${h.action}</strong> • ${time}<div class="text-muted">${h.note||''}</div></div>;
  }).join('') || '<div class="text-muted">No history</div>';

  openModal(`
    <h3>Card history — ${card.number}</h3>
    <div>
      <div><strong>Type:</strong> ${card.type}</div>
      <div><strong>Status:</strong> ${card.status}</div>
      <div style="margin-top:10px">${historyHtml}</div>
    </div>
  `);
}

function deleteCard(cardId){
  if(!confirm('Delete this card permanently?')) return;
  store.cards = store.cards.filter(c=>c.id!==cardId);
  saveStore();
  render();
}

/* ------------------ helpers ------------------ */

function populateUnitFilter(){
  filterUnit.innerHTML = '<option value="">All units</option>';
  store.apartments.forEach(a=>{
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.name;
    filterUnit.appendChild(opt);
  });
  // also set unit options in add card modal when opened (render handles that)
}

function clearFilters(){
  filterUnit.value = '';
  filterType.value = '';
  filterStatus.value = '';
  searchInput.value = '';
  render();
}

function openModal(html){
  modalContent.innerHTML = html;
  modal.setAttribute('aria-hidden','false');
  modal.addEventListener('click', backdropClick);
}

function closeModal(){
  modal.setAttribute('aria-hidden','true');
  modalContent.innerHTML = '';
  modal.removeEventListener('click', backdropClick);
}

function backdropClick(e){
  if(e.target === modal) closeModal();
}

/* ------------------ Export CSV ------------------ */
function exportCSV(){
  const header = ['unit','unitId','type','number','status','assignedTo','historyCount'];
  const rows = store.cards.map(c=>{
    const unit = (store.apartments.find(a=>a.id===c.unitId)||{name:''}).name;
    return [unit, c.unitId, c.type, c.number, c.status, c.assignedTo, (c.history||[]).length];
  });

  let csv = header.join(',') + '\n' + rows.map(r=>r.map(cell => "${String(cell||'').replace(/"/g,'""')}").join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'card-management-export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------ Init: add sample data if empty ------------------ */
(function initSample(){
  if(store.apartments.length===0 && store.cards.length===0){
    const u1 = uid('u'); const u2 = uid('u');
    const c1 = uid('c'); const c2 = uid('c'); const c3 = uid('c');
    store.apartments.push({id:u1,name:'103 Studio - Azizi Rivera'});
    store.apartments.push({id:u2,name:'402A - Marina View'});
    store.cards.push({id:c1, unitId:u1, type:'Access Card', number:'A-001', status:'Assigned', assignedTo:'John Doe', history:[{when:new Date().toISOString(), action:'Created', note:'Initial sample'},{when:new Date().toISOString(), action:'Assigned', note:'Assigned to John Doe'}]});
    store.cards.push({id:c2, unitId:u1, type:'Parking Card', number:'P-101', status:'Available', assignedTo:'', history:[{when:new Date().toISOString(), action:'Created', note:'Initial sample'}]});
    store.cards.push({id:c3, unitId:u2, type:'Utility Card', number:'U-200', status:'Missing', assignedTo:'', history:[{when:new Date().toISOString(), action:'Created', note:'Initial sample'},{when:new Date().toISOString(), action:'Marked Missing', note:'Not returned'}]});
    saveStore();
    render();
  }
})();
