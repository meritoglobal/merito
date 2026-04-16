/* ══════════════════════════════════════════
   ADMIN CREDENTIALS  (defined first so login
   always works even if Supabase fails to load)
══════════════════════════════════════════ */
const ADMIN_EMAIL = 'meritoglobalbd@gmail.com';
const ADMIN_PASS  = 'asdqwe12';

/* ══════════════════════════════════════════
   SUPABASE CONFIG
══════════════════════════════════════════ */
const SUPABASE_URL = 'https://bpjfrdfvvcvxocigqjyl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwamZyZGZ2dmN2eG9jaWdxanlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NzAwOTMsImV4cCI6MjA5MTI0NjA5M30.UVIK_l8z1FybbGy08PwBbbg7G6_i8hMMkhoARKUNIp4';

// ─── SERVICE ROLE KEY ───────────────────────────────────────────────────────
// Never hardcode this. It is entered once by the admin and stored in
// localStorage on their machine only — never committed to source code.
let SUPABASE_SERVICE_KEY = localStorage.getItem('meritoSvcKey') || '';
// ───────────────────────────────────────────────────────────────────────────

// ─── EMAILJS CONFIG ─────────────────────────────────────────────────────────
// Sign up free at https://www.emailjs.com/ then:
// 1. Create a service (Gmail/SMTP) and note the Service ID
// 2. Create a template with variables: {{to_email}}, {{to_name}}, {{new_password}}
//    Subject: "Your Merito password has been updated"
//    Body: "Hi {{to_name}},\n\nYour Merito account password was updated by an admin.\nNew password: {{new_password}}\n\nPlease log in and change it. — Merito Team"
// 3. Copy your Public Key from Account → General
const EMAILJS_PUBLIC_KEY  = 'gvhuPslh3hgNSALYv';
const EMAILJS_SERVICE_ID  = 'service_x34gzab';
const EMAILJS_TEMPLATE_ID = 'template_j719rck';
// ───────────────────────────────────────────────────────────────────────────

let sb, sbAdmin;
try {
  sb      = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  sbAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  if (EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY') {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }
} catch(e) {
  console.error('Supabase/EmailJS failed to initialize:', e);
}

async function adminLogout() {
  if (confirm('Are you sure you want to logout?')) {
    await sb.auth.signOut();
    localStorage.removeItem('meritoAdminLoggedIn');
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('adm-email').value = '';
    document.getElementById('adm-pass').value = '';
  }
}

/* ══ ADMIN LOGIN ══ */

// Check if already logged in on page load
window.addEventListener('DOMContentLoaded', () => {
  // Disable browser autocomplete on all non-credential inputs
  document.querySelectorAll('input[placeholder]').forEach(inp => {
    if (!['email','password'].includes(inp.type)) {
      inp.setAttribute('autocomplete', 'new-password');
    }
  });

  if (localStorage.getItem('meritoAdminLoggedIn') === 'yes') {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    loadDashboard();
    loadOrders();
    loadCourses();
    loadUsers();
    loadCategories();
    loadInstructors();
    loadHomepageVideo();
    loadNotifications();
    nav('dashboard');
  }
});

async function adminLogin() {
  const email = document.getElementById('adm-email').value.trim();
  const pass  = document.getElementById('adm-pass').value;
  const err   = document.getElementById('login-error');
  const btn   = document.querySelector('.login-btn');
  err.style.display = 'none';

  if (email !== ADMIN_EMAIL || pass !== ADMIN_PASS) {
    err.style.display = 'block'; return;
  }

  btn.textContent = 'Signing in…'; btn.disabled = true;
  // Authenticate with Supabase so RLS policies allow full admin access
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.textContent = 'Sign In'; btn.disabled = false;

  if (error) {
    // Supabase auth failed — still allow admin via localStorage only (fallback)
    console.warn('Supabase auth failed, using local auth:', error.message);
  }

  // Save service key to localStorage if provided; reinit sbAdmin
  const svcKeyInput = document.getElementById('adm-svckey').value.trim();
  if (svcKeyInput) {
    localStorage.setItem('meritoSvcKey', svcKeyInput);
    SUPABASE_SERVICE_KEY = svcKeyInput;
  }
  if (SUPABASE_SERVICE_KEY) {
    try {
      sbAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
    } catch(e) { console.warn('sbAdmin init failed:', e); }
  }

  localStorage.setItem('meritoAdminLoggedIn', 'yes');
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadDashboard(); loadOrders(); loadCourses(); loadUsers();
  loadCategories(); loadInstructors(); loadHomepageVideo(); loadNotifications();
}

// Allow Enter key on login
document.getElementById('adm-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') adminLogin();
});

// Pre-fill service key field if already saved
(function() {
  const saved = localStorage.getItem('meritoSvcKey');
  if (saved) document.getElementById('adm-svckey').value = saved;
})();

/* ══ NAVIGATION ══ */
let currentPage = 'dashboard';
function nav(page) {
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  const pv = document.getElementById('pv-' + page);
  if (pv) pv.classList.add('active');
  // highlight sidebar item
  document.querySelectorAll('.sb-item').forEach(i => {
    if (i.getAttribute('onclick') && i.getAttribute('onclick').includes("'"+page+"'")) i.classList.add('active');
  });
  currentPage = page;
  // render generic store pages on demand
  if (page === 'site-settings') loadSiteSettings();
  if (page === 'notification') loadNotifications();
  if (page === 'blog')  loadAdminBlogs();
  if (page === 'books') loadAdminBooks();
  if (page === 'manage-users') { loadUsers(); }
  if (page === 'store-videos')   loadStoreVideos();
  if (page === 'store-pictures') loadStorePictures();
  if (page === 'store-pdfs')     loadStorePDFs();
  if (page === 'store-links')    loadStoreLinks();
  if (page === 'course-content') initCourseContent();
  if (page === 'exam-questions') loadExamQuestions();
  if (page === 'exams')          loadExams();
  if (page === 'exam-results')   loadExamResults();

  const storeMap = {
    'blog-category':      {title:'Blog Categories', menuLabel:null},
    'blog':               {title:'Blog',             menuLabel:'Author'},
    'job-circular-category':{title:'Job Circular Categories',menuLabel:null},
    'job-circular':       {title:'Job Circular',     menuLabel:'Image'},
    'notice-category':    {title:'Notice Categories',menuLabel:null},
    'notice':             {title:'Notice',           menuLabel:null},
    'advertisement':      {title:'Advertisement',    menuLabel:null},
    'testimonial':        {title:'Testimonial',      menuLabel:null},
    'affiliation':        {title:'Affiliation',      menuLabel:null},
    'popup':              {title:'PopUp Notification',menuLabel:null},
  };
  if (storeMap[page]) renderGenericStore(page, storeMap[page]);
}

/* ══ GENERIC STORE RENDERER ══ */
const storeData = {};
function renderGenericStore(key, cfg) {
  const el = document.getElementById('gs-' + key);
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';
  const hasMenu = cfg.menuLabel !== null;
  const rows = (storeData[key] || []).map(item => `
    <tr>
      <td class="td-name">${item.name || item.title || '—'}</td>
      ${hasMenu ? `<td><span class="td-link">${cfg.menuLabel}</span></td>` : ''}
      ${key==='advertisement' ? `<td>${item.type||'—'}</td><td>${item.link||'—'}</td>` : ''}
      ${key==='testimonial' ? `<td>${item.designation||'—'}</td><td>${item.rating||5}</td>` : ''}
      ${key==='affiliation' ? `<td>${item.code||'—'}</td><td>${item.discount||0}%</td><td>${item.commission||0}%</td><td>${item.balance||0}</td>` : ''}
      ${key==='popup' ? `<td>${item.photo||'—'}</td><td>${item.link||'—'}</td><td>${item.button||'—'}</td><td>${item.type||'—'}</td><td>${item.active?'Yes':'No'}</td>` : ''}
      ${key==='blog' ? `<td></td><td><span class="td-link">Author</span></td><td><span class="badge badge-gray">Not Featured</span></td>` : ''}
      <td><div class="action-btns">
        ${key==='affiliation'?`<button class="btn-verify">View Commissions</button><button class="btn-verify" style="background:#00897B">Withdraws</button>`:''}
        <button class="btn-icon btn-edit">✎</button>
        <button class="btn-icon btn-delete">🗑</button>
      </div></td>
    </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim)">No items yet. Click + to add.</td></tr>`;

  // Build header columns
  let extraCols = '';
  if (hasMenu) extraCols += '<th>Menus</th>';
  if (key==='advertisement') extraCols = '<th>Type</th><th>Link</th>';
  if (key==='testimonial') extraCols = '<th>Designation</th><th>Ratings</th>';
  if (key==='affiliation') extraCols = '<th>Code</th><th>Discount(%)</th><th>Commission(%)</th><th>Balance</th>';
  if (key==='popup') extraCols = '<th>Photo</th><th>Link</th><th>Button</th><th>Type</th><th>Active</th>';
  if (key==='blog') extraCols = '<th>Image</th><th>Toggles</th><th>Status</th>';

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title">${cfg.title}</div>
      <div class="search-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input placeholder="Search ${cfg.title}"></div>
      <button class="btn-add" onclick="openModal('modal-generic-add');document.getElementById('generic-modal-title').textContent='Add to ${cfg.title}'">+</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th>${extraCols}<th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="table-footer"><span>0-0 of 0</span></div>
    </div>`;
}

/* ══ SITE SETTINGS PAGE ══ */

// All known site_settings keys mapped to their input IDs
const SS_KEYS = [
  'hero_title','hero_subtitle','hero_btn1','hero_btn2',
  'hero_search_placeholder','hero_search_btn','hero_video_url',
  'stat1_num','stat1_label','stat2_num','stat2_label',
  'stat3_num','stat3_label','stat4_num','stat4_label',
  'courses_label','courses_heading','courses_sub',
  'featured_label','featured_heading','featured_sub','viewall_btn',
  'about_label','about_btn','about_heading','about_body','homepage_video_url',
  'testi_label','testi_heading','testi_sub',
  'testi1_name','testi1_result','testi1_text',
  'testi2_name','testi2_result','testi2_text',
  'testi3_name','testi3_result','testi3_text',
  'app_label','app_downloads','app_heading','app_sub',
  'footer_tagline','footer_addr1','footer_addr2','footer_addr3','footer_email','footer_copyright',
  'bkash_instructions','nagad_instructions','bank_instructions'
];

async function loadSiteSettings() {
  const { data } = await sb.from('site_settings').select('key,value');
  if (!data) return;
  const map = {};
  data.forEach(r => { map[r.key] = r.value; });
  SS_KEYS.forEach(key => {
    const el = document.getElementById('ss-' + key);
    if (el && map[key] !== undefined) el.value = map[key];
  });
}

function toggleSS(id) {
  const body  = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
}

async function saveSSection(sectionId, keys) {
  const upserts = keys.map(key => ({
    key,
    value: (document.getElementById('ss-' + key)?.value || '').trim()
  }));
  const { error } = await sb.from('site_settings').upsert(upserts);
  if (error) { toast('Error saving: ' + error.message, 'error'); return; }
  toast('✅ Saved! Changes will appear on the website on reload.', 'success');
}

// Legacy stubs kept for safety (dashboard homepage video)
async function saveHeroVideo() {
  saveSSection('hero', ['hero_video_url']);
}
async function saveAboutVideo() {
  saveSSection('about-sec', ['homepage_video_url']);
}
function showSSPreview(type, url) {
  // no-op - previews removed in new layout
}

/* ══ HOMEPAGE VIDEO (Dashboard) ══ */
async function loadHomepageVideo() {
  const { data } = await sb.from('site_settings').select('value').eq('key','homepage_video_url').single();
  if (data?.value) {
    document.getElementById('homepage-video-url').value = data.value;
    const cur = document.getElementById('current-hp-url');
    if (cur) cur.textContent = data.value;
    const vid = extractYTId(data.value);
    if (vid) showHPPreview(vid);
  } else {
    const cur = document.getElementById('current-hp-url');
    if (cur) cur.textContent = 'Not set yet';
  }
}

async function saveHomepageVideo() {
  const url = document.getElementById('homepage-video-url').value.trim();
  if (!url) { toast('Please enter a YouTube URL','error'); return; }
  const { error } = await sb.from('site_settings').upsert({ key: 'homepage_video_url', value: url });
  if (error) { toast('Error saving: ' + error.message, 'error'); return; }
  const cur = document.getElementById('current-hp-url');
  if (cur) cur.textContent = url;
  const vid = extractYTId(url);
  if (vid) showHPPreview(vid);
  toast('✅ Homepage video saved! It will appear on the live site.', 'success');
}

function showHPPreview(vid) {
  const wrap = document.getElementById('homepage-video-preview');
  const iframe = document.getElementById('hp-preview-iframe');
  iframe.src = `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1`;
  wrap.style.display = 'block';
}

function extractYTId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

/* ══ LOAD DASHBOARD ══ */
let _allOrders = [];
let _activePreset = 'month';

async function loadDashboard() {
  // Orders stats
  const { data: orders } = await sb.from('orders').select('status,amount,created_at');
  if (orders) {
    _allOrders = orders;
    const now = new Date();
    const thisMonth = o => new Date(o.created_at).getMonth() === now.getMonth() && new Date(o.created_at).getFullYear() === now.getFullYear();
    const thisYear  = o => new Date(o.created_at).getFullYear() === now.getFullYear();
    const complete  = orders.filter(o => o.status === 'verified');
    const pending   = orders.filter(o => o.status === 'pending');
    const almostBought = orders.filter(o => o.status === 'almost_bought');
    const cartItems    = orders.filter(o => o.status === 'cart');
    document.getElementById('d-orders-month').textContent = complete.filter(thisMonth).length;
    document.getElementById('d-orders-year').textContent  = complete.filter(thisYear).length;
    document.getElementById('d-pending-month').textContent = (pending.length + almostBought.length + cartItems.length);
    document.getElementById('d-pending-year').textContent  = (pending.filter(thisYear).length + almostBought.filter(thisYear).length);
    document.getElementById('pending-count').textContent   = pending.length;
    const totalSales = complete.reduce((s,o) => s + Number(o.amount), 0);
    const yearSales  = complete.filter(thisYear).reduce((s,o) => s + Number(o.amount), 0);
    const monthSales = complete.filter(thisMonth).reduce((s,o) => s + Number(o.amount), 0);
    document.getElementById('d-total-sales').textContent = '৳' + totalSales.toLocaleString();
    document.getElementById('d-year-sales').textContent  = '৳' + yearSales.toLocaleString();
    document.getElementById('d-month-sales').textContent = '৳' + monthSales.toLocaleString();
    document.getElementById('d-sales-month').textContent = '৳' + monthSales.toLocaleString();
    applyPreset('month');
  }
  // Courses
  const { data: courses } = await sb.from('courses').select('id').eq('is_active', true);
  document.getElementById('d-active-courses').textContent = courses ? courses.length : 0;
  // Users
  const { data: profiles } = await sb.from('profiles').select('id');
  document.getElementById('d-total-students').textContent = profiles ? profiles.length : 0;
  const now = new Date();
  const thisMonth = p => new Date(p.created_at||Date.now()).getMonth() === now.getMonth();
  const { data: allProfiles } = await sb.from('profiles').select('id,created_at');
  if (allProfiles) {
    document.getElementById('d-reg-month').textContent = allProfiles.filter(thisMonth).length;
    document.getElementById('d-reg-year').textContent  = allProfiles.length;
  }
}

function applyPreset(preset) {
  _activePreset = preset;
  document.querySelectorAll('.filter-preset').forEach(b => b.classList.remove('active'));
  const presetMap = {today:'Today',week:'This Week',month:'This Month',year:'This Year',all:'All Time'};
  document.querySelectorAll('.filter-preset').forEach(b => {
    if (b.textContent.trim() === presetMap[preset]) b.classList.add('active');
  });
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';

  const now = new Date();
  let from = null, to = null;
  if (preset === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    to   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (preset === 'week') {
    const day = now.getDay();
    from = new Date(now); from.setDate(now.getDate() - day); from.setHours(0,0,0,0);
    to   = new Date(now); to.setDate(from.getDate() + 6); to.setHours(23,59,59,999);
  } else if (preset === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (preset === 'year') {
    from = new Date(now.getFullYear(), 0, 1);
    to   = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  const labelEl = document.getElementById('filter-active-label');
  if (labelEl) labelEl.textContent = 'Showing: ' + presetMap[preset];
  buildChart(_allOrders, from, to);
}

function applyCustomRange() {
  const fromVal = document.getElementById('filter-from').value;
  const toVal   = document.getElementById('filter-to').value;
  if (!fromVal || !toVal) { toast('Please select both From and To dates','error'); return; }
  const from = new Date(fromVal + 'T00:00:00');
  const to   = new Date(toVal   + 'T23:59:59');
  if (from > to) { toast('From date must be before To date','error'); return; }
  document.querySelectorAll('.filter-preset').forEach(b => b.classList.remove('active'));
  const labelEl = document.getElementById('filter-active-label');
  if (labelEl) labelEl.textContent = `Showing: ${fromVal} → ${toVal}`;
  buildChart(_allOrders, from, to);
}

function buildChart(orders, from, to) {
  const filtered = orders.filter(o => {
    if (o.status !== 'verified') return false;
    if (!from && !to) return true;
    const d = new Date(o.created_at);
    return (!from || d >= from) && (!to || d <= to);
  });

  // If range spans more than ~60 days, group by month; else group by day
  const spanDays = (from && to) ? Math.ceil((to - from) / 86400000) : 366;
  let html = '';

  if (!from || spanDays > 60) {
    // Monthly view
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const totals = Array(12).fill(0);
    filtered.forEach(o => {
      totals[new Date(o.created_at).getMonth()] += Number(o.amount);
    });
    const max = Math.max(...totals, 1);
    html = months.map((m,i) => `
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="height:${Math.round((totals[i]/max)*100)}px;${totals[i]===0?'opacity:.2':''}"></div>
        <div class="chart-month">${m}</div>
      </div>`).join('');
  } else if (spanDays > 14) {
    // Weekly grouping within range
    const weeks = {};
    filtered.forEach(o => {
      const d = new Date(o.created_at);
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay()); weekStart.setHours(0,0,0,0);
      const key = weekStart.toISOString().slice(0,10);
      weeks[key] = (weeks[key] || 0) + Number(o.amount);
    });
    const keys = Object.keys(weeks).sort();
    if (keys.length === 0) {
      html = '<div style="width:100%;text-align:center;color:var(--text-dim);font-size:13px;padding:20px;">No sales data for this period</div>';
    } else {
      const max = Math.max(...Object.values(weeks), 1);
      html = keys.map(k => `
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height:${Math.round((weeks[k]/max)*100)}px;${weeks[k]===0?'opacity:.2':''}"></div>
          <div class="chart-month">${k.slice(5)}</div>
        </div>`).join('');
    }
  } else {
    // Daily view
    const days = {};
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      days[d.toISOString().slice(0,10)] = 0;
    }
    filtered.forEach(o => {
      const key = new Date(o.created_at).toISOString().slice(0,10);
      if (days[key] !== undefined) days[key] += Number(o.amount);
    });
    const keys = Object.keys(days).sort();
    const max = Math.max(...Object.values(days), 1);
    html = keys.map(k => `
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="height:${Math.round((days[k]/max)*100)}px;${days[k]===0?'opacity:.2':''}"></div>
        <div class="chart-month">${k.slice(5)}</div>
      </div>`).join('');
  }

  document.getElementById('chart-bars').innerHTML = html;

  // Update summary for filtered range
  const filteredTotal = filtered.reduce((s,o) => s + Number(o.amount), 0);
  document.getElementById('d-total-sales').textContent = '৳' + filteredTotal.toLocaleString();
}

/* ══ LOAD CATEGORIES ══ */
let categories = [];
async function loadCategories() {
  const [{ data }, { data: orderRow }, { data: extrasRow }] = await Promise.all([
    sb.from('courses').select('cat,cat_name'),
    sb.from('site_settings').select('value').eq('key','category_order').maybeSingle(),
    sb.from('site_settings').select('value').eq('key','extra_categories').maybeSingle()
  ]);

  const seen = {};
  let cats = [];
  // From courses table
  (data || []).forEach(r => { if (!seen[r.cat]) { seen[r.cat]=1; cats.push({cat:r.cat, cat_name:r.cat_name}); } });
  // From extra_categories (admin-added, may have no courses yet)
  try {
    const extras = extrasRow?.value ? JSON.parse(extrasRow.value) : [];
    extras.forEach(e => { if (!seen[e.cat]) { seen[e.cat]=1; cats.push(e); } });
  } catch(e) {}

  // Apply saved drag order
  if (orderRow?.value) {
    try {
      const order = JSON.parse(orderRow.value);
      cats.sort((a,b) => {
        const ai = order.indexOf(a.cat), bi = order.indexOf(b.cat);
        return (ai===-1?999:ai) - (bi===-1?999:bi);
      });
    } catch(e) {}
  }
  categories = cats;
  renderCategories();
}

function renderCategories() {
  const tbody = document.getElementById('cat-tbody');
  if (!tbody) return;
  tbody.innerHTML = categories.map((c,i) => `
    <tr draggable="true" data-cat="${c.cat}" data-idx="${i}">
      <td class="th-drag"><span class="drag-handle" title="Drag to reorder">⠿</span></td>
      <td class="td-name">${c.cat_name}</td>
      <td><div class="action-btns">
        <button class="btn-icon btn-edit" onclick="openEditCategory('${c.cat}','${c.cat_name.replace(/'/g,"\\'")}')">✎</button>
        <button class="btn-icon btn-delete" onclick="openDeleteModal(${i},'category')">🗑</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-dim)">No categories yet.</td></tr>';
  document.getElementById('cat-count').textContent = `1-${categories.length} of ${categories.length}`;
  initDragTable('cat-tbody', categories, 'cat', saveCategoryOrder);
}

function openEditCategory(cat, catName) {
  document.getElementById('edit-cat-slug').value = cat;
  document.getElementById('edit-cat-name').value = catName;
  openModal('modal-edit-cat');
}

async function saveEditCategory() {
  const cat     = document.getElementById('edit-cat-slug').value;
  const newName = document.getElementById('edit-cat-name').value.trim();
  if (!newName) { toast('Name cannot be empty','error'); return; }
  const { error } = await sb.from('courses').update({ cat_name: newName }).eq('cat', cat);
  if (error) { toast('Error: ' + error.message,'error'); return; }
  categories = categories.map(c => c.cat === cat ? {...c, cat_name: newName} : c);
  renderCategories();
  closeModal('modal-edit-cat');
  toast('✅ Category name updated on all courses!','success');
}

async function saveCategoryOrder() {
  const order = categories.map(c => c.cat);
  const { error } = await sb.from('site_settings').upsert({ key:'category_order', value:JSON.stringify(order) });
  if (!error) toast('✅ Category order saved!','success');
}

/* ══ SHARED DRAG ENGINE (event-delegation, survives re-renders) ══ */
const _dragState = {}; // keyed by tbodyId

function initDragTable(tbodyId, dataArr, idKey, onSave) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  // Remove any previous delegation listeners to avoid duplicates
  if (_dragState[tbodyId]?.cleanup) _dragState[tbodyId].cleanup();

  let dragSrc = null;

  // Helper: find closest draggable <tr> from an event target
  const getRow = el => el?.closest('tr[draggable]');

  function onDragStart(e) {
    const tr = getRow(e.target);
    if (!tr) return;
    dragSrc = tr;
    tr.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragEnd(e) {
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('dragging','drag-over'));
    dragSrc = null;
  }
  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tr = getRow(e.target);
    if (!tr || tr === dragSrc) return;
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
    tr.classList.add('drag-over');
  }
  function onDragLeave(e) {
    const tr = getRow(e.target);
    if (tr) tr.classList.remove('drag-over');
  }
  function onDrop(e) {
    e.preventDefault();
    const tr = getRow(e.target);
    if (!tr || !dragSrc || dragSrc === tr) return;
    const fromIdx = parseInt(dragSrc.dataset.idx);
    const toIdx   = parseInt(tr.dataset.idx);
    if (isNaN(fromIdx) || isNaN(toIdx)) return;
    const moved = dataArr.splice(fromIdx, 1)[0];
    dataArr.splice(toIdx, 0, moved);
    if (tbodyId === 'cat-tbody')         renderCategories();
    else if (tbodyId === 'course-tbody') renderCourses(allCourses);
    onSave();
  }

  tbody.addEventListener('dragstart',  onDragStart);
  tbody.addEventListener('dragend',    onDragEnd);
  tbody.addEventListener('dragover',   onDragOver);
  tbody.addEventListener('dragleave',  onDragLeave);
  tbody.addEventListener('drop',       onDrop);

  // Store cleanup for next call
  _dragState[tbodyId] = {
    cleanup() {
      tbody.removeEventListener('dragstart',  onDragStart);
      tbody.removeEventListener('dragend',    onDragEnd);
      tbody.removeEventListener('dragover',   onDragOver);
      tbody.removeEventListener('dragleave',  onDragLeave);
      tbody.removeEventListener('drop',       onDrop);
    }
  };
}

/* ══ LOAD COURSES ══ */
let allCourses = [];
async function loadCourses() {
  const [{ data }, { data: orderRow }] = await Promise.all([
    sb.from('courses').select('*'),
    sb.from('site_settings').select('value').eq('key','course_order').maybeSingle()
  ]);
  if (data) {
    let courses = [...data];
    if (orderRow?.value) {
      try {
        const order = JSON.parse(orderRow.value);
        courses.sort((a,b) => {
          const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
          return (ai===-1?999:ai) - (bi===-1?999:bi);
        });
      } catch(e) {}
    }
    allCourses = courses;
    renderCourses(allCourses);
  }
}

function renderCourses(data) {
  const tbody = document.getElementById('course-tbody');
  if (!tbody) return;
  tbody.innerHTML = data.map((c,i) => `
    <tr draggable="true" data-id="${c.id}" data-idx="${i}">
      <td class="th-drag"><span class="drag-handle" title="Drag to reorder">⠿</span></td>
      <td class="td-name">${c.title}</td>
      <td>${c.cat_name || c.cat}</td>
      <td>৳${Number(c.price).toLocaleString()}</td>
      <td>${c.lessons}+</td>
      <td><span class="toggle-pill ${c.is_active?'toggle-on':'toggle-off'}" onclick="toggleCourse(${c.id},${c.is_active})">${c.is_active?'Active':'Inactive'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon btn-edit" onclick="openEditCourse(${c.id})">✎</button>
        <button class="btn-icon btn-delete" onclick="openDeleteModal(${c.id},'course')">🗑</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-dim)">No courses.</td></tr>';
  document.getElementById('course-count').textContent = `1-${data.length} of ${data.length}`;
  initDragTable('course-tbody', allCourses, 'id', saveCourseOrder);
}

async function saveCourseOrder() {
  const order = allCourses.map(c => c.id);
  const { error } = await sb.from('site_settings').upsert({ key:'course_order', value:JSON.stringify(order) });
  if (!error) toast('✅ Course order saved!','success');
}

async function toggleCourse(id, current) {
  await sb.from('courses').update({is_active: !current}).eq('id', id);
  loadCourses();
  toast('Course status updated','success');
}

/* ══ LOAD ORDERS ══ */
let allOrders = [];
let currentOrderId = null;
async function loadOrders() {
  const { data } = await sb.from('orders').select('*,profiles(full_name,phone,email),courses(title)').order('created_at', {ascending:false});
  if (data) {
    allOrders = data;
    renderOrders(data);
    document.getElementById('pending-count').textContent = data.filter(o=>o.status==='pending').length;
  }
}

function _orderStatusBadge(status) {
  const map = {
    cart:          { label:'🛒 Cart Item',     bg:'#e3f2fd', color:'#1565c0' },
    almost_bought: { label:'⏳ Almost Bought',  bg:'#fff8e1', color:'#e65100' },
    pending:       { label:'📬 Pending',        bg:'#fff3e0', color:'#bf360c' },
    verified:      { label:'✅ Complete',       bg:'#e8f5e9', color:'#1b5e20' },
    rejected:      { label:'❌ Rejected',       bg:'#fce4ec', color:'#880e4f' },
  };
  const s = map[status] || { label: status, bg:'#f5f5f5', color:'#555' };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${s.bg};color:${s.color};font-size:11px;font-weight:700;white-space:nowrap;">${s.label}</span>`;
}

function renderOrders(data) {
  const tbody = document.getElementById('order-tbody');
  if (!tbody) return;
  tbody.innerHTML = data.map(o => `
    <tr>
      <td>${o.profiles?.full_name || '—'}</td>
      <td>${o.profiles?.phone || '—'}</td>
      <td style="font-size:12px;">${o.profiles?.email || o.user_id?.slice(0,16)+'...'}</td>
      <td>${o.courses?.title || '—'}</td>
      <td>৳${Number(o.amount).toLocaleString()}</td>
      <td>0</td>
      <td>${_orderStatusBadge(o.status)}</td>
      <td><button class="btn-icon btn-view" onclick="viewOrder('${o.id}')">👁</button></td>
    </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-dim)">No orders yet.</td></tr>';
  document.getElementById('order-count').textContent = `1-${data.length} of ${data.length}`;
}

async function viewOrder(id) {
  const o = allOrders.find(x => String(x.id) === String(id));
  if (!o) return;
  currentOrderId = o.id;
  document.getElementById('od-name').textContent   = o.profiles?.full_name || '—';
  document.getElementById('od-email').textContent  = o.profiles?.email || o.user_id || '—';
  document.getElementById('od-phone').textContent  = o.profiles?.phone || '—';
  document.getElementById('od-id').textContent     = o.id;
  document.getElementById('od-date').textContent   = new Date(o.created_at).toLocaleString();
  document.getElementById('od-item').textContent   = o.courses?.title || '—';
  document.getElementById('od-status').innerHTML   = _orderStatusBadge(o.status);
  document.getElementById('od-amount').textContent = '৳' + Number(o.amount).toLocaleString();
  document.getElementById('od-txn').textContent    = o.transaction_id || '—';

  const isPending  = o.status === 'pending';
  const isVerified = o.status === 'verified';
  document.getElementById('od-btn-complete').style.display  = isPending  ? '' : 'none';
  document.getElementById('od-btn-reject').style.display    = isPending  ? '' : 'none';
  document.getElementById('od-btn-reenroll').style.display  = 'none';

  const enrBanner = document.getElementById('od-enr-status');
  enrBanner.style.display = 'none';

  openModal('modal-order');

  // For complete orders, check whether enrollment actually exists
  if (isVerified && o.profiles?.email && o.course_id) {
    const { data: enr } = await sb.from('course_enrollments')
      .select('id').eq('user_email', o.profiles.email).eq('course_id', o.course_id).maybeSingle();

    if (enr) {
      enrBanner.style.cssText = 'margin-top:16px;padding:12px 16px;border-radius:8px;font-size:13px;background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7;display:block;';
      enrBanner.innerHTML = '✅ Student is enrolled — <strong>' + (o.profiles?.email) + '</strong> has access to <strong>' + (o.courses?.title || 'this course') + '</strong>.';
    } else {
      enrBanner.style.cssText = 'margin-top:16px;padding:12px 16px;border-radius:8px;font-size:13px;background:#fff3e0;color:#bf360c;border:1px solid #ffcc80;display:block;';
      enrBanner.innerHTML = '⚠️ <strong>Enrollment missing!</strong> This order is marked Complete but the student does NOT have course access yet. Click <strong>Re-enroll Student</strong> to fix.';
      document.getElementById('od-btn-reenroll').style.display = '';
    }
  }
}

async function updateOrderStatus(status) {
  if (!currentOrderId) return;

  const o = allOrders.find(x => x.id === currentOrderId);

  const { error: orderErr } = await sb.from('orders').update({ status }).eq('id', currentOrderId);
  if (orderErr) { toast('Failed to update order: ' + orderErr.message, 'error'); return; }

  if (status === 'verified' && o) {
    const userEmail = o.profiles?.email;
    const courseId  = o.course_id;

    if (!userEmail) {
      toast('⚠ Order marked complete but could not enroll — user email not found.', 'error');
    } else if (!courseId) {
      toast('⚠ Order marked complete but course ID is missing.', 'error');
    } else {
      // Write to the same course_enrollments table the site reads from
      const { error: enrErr } = await sb.from('course_enrollments').upsert(
        { user_email: userEmail, course_id: courseId },
        { onConflict: 'user_email,course_id', ignoreDuplicates: true }
      );
      if (enrErr) {
        // Fallback: insert without upsert in case no unique constraint exists
        await sb.from('course_enrollments').insert({ user_email: userEmail, course_id: courseId });
      }

      // If the user detail modal is currently open for this user, refresh enrollment list
      const openEmail = document.getElementById('ud-user-email')?.value;
      if (openEmail && openEmail === userEmail) {
        const { data: enrs } = await sb.from('course_enrollments').select('*').eq('user_email', userEmail);
        _udEnrollments = enrs || [];
        renderUDEnrollments();
      }

      toast('✅ Order complete — ' + userEmail + ' enrolled in course!', 'success');
    }
  } else {
    toast(status === 'rejected' ? '✗ Order rejected.' : 'Order updated.', status === 'rejected' ? 'error' : 'success');
  }

  closeModal('modal-order');
  loadOrders();
  loadDashboard();
}

/* Re-enroll a student for a completed order that was broken by old code */
async function reEnrollStudent() {
  const o = allOrders.find(x => x.id === currentOrderId);
  if (!o) return;

  const userEmail = o.profiles?.email;
  const courseId  = o.course_id;
  const courseName = o.courses?.title || 'the course';

  if (!userEmail || !courseId) {
    toast('Cannot enroll — missing email or course ID.', 'error'); return;
  }

  const btn = document.getElementById('od-btn-reenroll');
  btn.textContent = 'Enrolling…'; btn.disabled = true;

  // Insert into course_enrollments (try upsert, fallback to insert)
  const { error } = await sb.from('course_enrollments').upsert(
    { user_email: userEmail, course_id: courseId },
    { onConflict: 'user_email,course_id', ignoreDuplicates: true }
  );
  if (error) {
    await sb.from('course_enrollments').insert({ user_email: userEmail, course_id: courseId });
  }

  btn.textContent = '🔁 Re-enroll Student'; btn.disabled = false;

  // Refresh enrollment banner
  const enrBanner = document.getElementById('od-enr-status');
  enrBanner.style.cssText = 'margin-top:16px;padding:12px 16px;border-radius:8px;font-size:13px;background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7;display:block;';
  enrBanner.innerHTML = '✅ Done! <strong>' + userEmail + '</strong> now has access to <strong>' + courseName + '</strong>. Student just needs to refresh.';
  btn.style.display = 'none';

  // Refresh user detail modal if open for this user
  const openEmail = document.getElementById('ud-user-email')?.value;
  if (openEmail && openEmail === userEmail) {
    const { data: enrs } = await sb.from('course_enrollments').select('*').eq('user_email', userEmail);
    _udEnrollments = enrs || [];
    renderUDEnrollments();
  }

  toast('✅ ' + userEmail + ' enrolled in ' + courseName + '!', 'success');
  loadOrders();
}

function filterOrders(val) {
  const filtered = allOrders.filter(o =>
    (o.profiles?.full_name||'').toLowerCase().includes(val.toLowerCase()) ||
    (o.courses?.title||'').toLowerCase().includes(val.toLowerCase())
  );
  renderOrders(filtered);
}
function filterOrderStatus(val) {
  const filtered = val ? allOrders.filter(o => o.status === val) : allOrders;
  renderOrders(filtered);
}

/* ══ USERS ══ */
let allUsers = [];
let _udEnrollments = []; // enrollments for currently open user modal

async function loadUsers() {
  const { data } = await sb.from('profiles').select('*').order('created_at',{ascending:false});
  allUsers = data || [];
  applyUserFilter();
}

function applyUserFilter() {
  const q    = (document.getElementById('user-search-input')?.value || '').toLowerCase().trim();
  const from = document.getElementById('uf-from')?.value;
  const to   = document.getElementById('uf-to')?.value;

  let rows = allUsers;

  // Text search: name, email, phone
  if (q) {
    rows = rows.filter(u =>
      (u.full_name||'').toLowerCase().includes(q) ||
      (u.email||'').toLowerCase().includes(q) ||
      (u.phone||'').toLowerCase().includes(q)
    );
  }

  // Incomplete profile filter
  if (_showIncompleteOnly) {
    rows = rows.filter(u => !u.full_name || !u.phone || !u.has_password);
  }

  // Date range filter
  if (from) {
    const fromTs = new Date(from).getTime();
    rows = rows.filter(u => u.created_at && new Date(u.created_at).getTime() >= fromTs);
  }
  if (to) {
    const toTs = new Date(to).getTime() + 86399999; // end of day
    rows = rows.filter(u => u.created_at && new Date(u.created_at).getTime() <= toTs);
  }

  // Filter label
  const label = document.getElementById('users-filter-label');
  if (label) {
    const parts = [];
    if (q) parts.push(`"${q}"`);
    if (from || to) parts.push(`${from||'…'} → ${to||'…'}`);
    label.textContent = parts.length ? `Showing: ${parts.join(', ')} — ${rows.length} result${rows.length!==1?'s':''}` : `${allUsers.length} users total`;
  }

  renderUsers(rows);
}

let _showIncompleteOnly = false;
function toggleIncompleteFilter() {
  _showIncompleteOnly = !_showIncompleteOnly;
  const btn = document.getElementById('btn-incomplete-filter');
  if (btn) {
    btn.style.background = _showIncompleteOnly ? '#e65100' : '#fff3e0';
    btn.style.color      = _showIncompleteOnly ? '#fff'    : '#e65100';
    btn.textContent      = _showIncompleteOnly ? '⚠ Incomplete Only ✕' : '⚠ Incomplete Only';
  }
  applyUserFilter();
}

function clearUserFilter() {
  const si = document.getElementById('user-search-input');
  const fr = document.getElementById('uf-from');
  const to = document.getElementById('uf-to');
  if (si) si.value = '';
  if (fr) fr.value = '';
  if (to) to.value = '';
  _showIncompleteOnly = false;
  const btn = document.getElementById('btn-incomplete-filter');
  if (btn) { btn.style.background = '#fff3e0'; btn.style.color = '#e65100'; btn.textContent = '⚠ Incomplete Only'; }
  applyUserFilter();
}

function renderUsers(data) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  document.getElementById('users-count').textContent = `1-${data.length} of ${data.length}`;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-dim)">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(u => {
    const initials = (u.full_name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const avatar = u.avatar_url
      ? `<img src="${u.avatar_url}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid var(--border);vertical-align:middle;margin-right:8px;" onerror="this.style.display='none'">`
      : `<span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--blue);color:#fff;font-size:11px;font-weight:700;margin-right:8px;vertical-align:middle;">${initials}</span>`;
    const joined = u.created_at ? new Date(u.created_at).toLocaleDateString('en-BD',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const enrCount = u._enr_count != null ? `<span class="badge badge-blue">${u._enr_count}</span>` : '<span class="badge badge-gray">—</span>';

    // Profile completeness badges
    const missing = [];
    if (!u.full_name) missing.push('Name');
    if (!u.phone)     missing.push('Phone');
    if (!u.has_password) missing.push('Password');
    const profileBadge = missing.length === 0
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:#e8f5e9;color:#2e7d32;font-size:11px;font-weight:600;">✓ Complete</span>`
      : `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:#fff3e0;color:#e65100;font-size:11px;font-weight:600;cursor:pointer;" onclick="openUserDetail('${u.id}')" title="Missing: ${missing.join(', ')}">⚠ ${missing.join(', ')}</span>`;

    return `<tr${missing.length ? ' style="background:#fffdf5;"' : ''}>
      <td>
        <span style="display:inline-flex;align-items:center;vertical-align:middle;">
          ${avatar}<span class="td-name" onclick="openUserDetail('${u.id}')" style="vertical-align:middle;">${u.full_name||'—'}</span>
        </span>
      </td>
      <td style="font-size:12px;color:var(--text-mid);">${u.email||'—'}</td>
      <td style="font-size:12px;">${u.phone||'—'}</td>
      <td style="font-size:12px;color:var(--text-mid);">${u.institution||'—'}</td>
      <td style="text-align:center;">${enrCount}</td>
      <td>${profileBadge}</td>
      <td style="font-size:12px;color:var(--text-dim);">${joined}</td>
      <td><div class="action-btns">
        <button class="btn-icon btn-edit" onclick="openUserDetail('${u.id}')" title="Edit / View">✎</button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── USER DETAIL MODAL ── */
async function openUserDetail(userId) {
  const u = allUsers.find(x => x.id === userId);
  if (!u) return;

  // Fill fields
  document.getElementById('ud-id').value          = u.id;
  document.getElementById('ud-user-email').value  = u.email||'';
  document.getElementById('ud-name').value        = u.full_name||'';
  document.getElementById('ud-phone').value       = u.phone||'';
  document.getElementById('ud-email').value       = u.email||'';
  document.getElementById('ud-institution').value = u.institution||'';
  document.getElementById('ud-avatar').value      = u.avatar_url||'';
  document.getElementById('ud-joined').textContent = u.created_at ? new Date(u.created_at).toLocaleString('en-BD',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
  document.getElementById('ud-uid').textContent   = u.id;
  document.getElementById('modal-ud-head').textContent = u.full_name ? `${u.full_name}'s Profile` : 'User Profile';

  // Avatar preview
  previewUDAvatar(u.avatar_url||'');

  // Populate add-course dropdown (only courses not yet enrolled)
  const addSel = document.getElementById('ud-add-course');
  addSel.innerHTML = '<option value="">— Select course to enroll —</option>' +
    allCourses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');

  // Reset password section to collapsed
  document.getElementById('ud-pass-section').style.display = 'none';
  document.getElementById('ud-pass-toggle-icon').textContent = '▼ Show';
  document.getElementById('ud-new-pass').value  = '';
  document.getElementById('ud-new-pass2').value = '';
  document.getElementById('ud-pass-error').style.display   = 'none';
  document.getElementById('ud-pass-success').style.display = 'none';

  openModal('modal-user-detail');

  // Load enrollments async
  document.getElementById('ud-enrolled-list').innerHTML = '<div style="padding:14px;text-align:center;font-size:12px;color:var(--text-dim);">Loading…</div>';
  document.getElementById('ud-enr-badge').textContent = '…';

  const userEmail = document.getElementById('ud-user-email').value;
  const { data: enrs } = await sb.from('course_enrollments').select('*').eq('user_email', userEmail);
  _udEnrollments = enrs || [];
  renderUDEnrollments();
}

function renderUDEnrollments() {
  const list = document.getElementById('ud-enrolled-list');
  document.getElementById('ud-enr-badge').textContent = _udEnrollments.length;
  if (!_udEnrollments.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-dim);">Not enrolled in any course yet.</div>';
    return;
  }
  list.innerHTML = _udEnrollments.map(e => {
    const course = allCourses.find(c => c.id == e.course_id);
    const date   = e.created_at ? new Date(e.created_at).toLocaleDateString('en-BD',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid #f0f0f0;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${course?.title||`Course #${e.course_id}`}</div>
        <div style="font-size:11px;color:var(--text-dim);">Enrolled ${date}</div>
      </div>
      <button onclick="udRemoveCourse(${e.course_id})" style="background:none;border:1px solid var(--red-light);color:var(--red-light);border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s;" onmouseover="this.style.background='var(--red-light)';this.style.color='#fff'" onmouseout="this.style.background='none';this.style.color='var(--red-light)'">Remove</button>
    </div>`;
  }).join('');
}

function previewUDAvatar(url) {
  const wrap = document.getElementById('ud-avatar-wrap');
  if (!wrap) return;
  const name = document.getElementById('ud-name')?.value || '?';
  const initials = name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() || '?';
  if (url) {
    wrap.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:28px;font-weight:700;\\'>${initials}</span>'">`;
  } else {
    wrap.innerHTML = `<span style="font-size:28px;font-weight:700;">${initials}</span>`;
  }
}

async function saveUserProfile() {
  const id          = document.getElementById('ud-id').value;
  const full_name   = document.getElementById('ud-name').value.trim();
  const phone       = document.getElementById('ud-phone').value.trim();
  const email       = document.getElementById('ud-email').value.trim();
  const institution = document.getElementById('ud-institution').value.trim();
  const avatar_url  = document.getElementById('ud-avatar').value.trim();

  if (!full_name) { toast('Name is required','error'); return; }

  const btn = document.querySelector('#modal-user-detail .modal-footer .btn-primary');
  btn.disabled = true; btn.textContent = 'Saving…';

  const payload = { full_name, phone: phone||null, institution: institution||null };
  if (email) payload.email = email;
  if (avatar_url) payload.avatar_url = avatar_url;

  const { error } = await sb.from('profiles').update(payload).eq('id', id);
  btn.disabled = false; btn.textContent = '💾 Save Profile';

  if (error) {
    // If avatar_url column missing, retry without it
    if (error.message && error.message.includes('avatar_url')) {
      delete payload.avatar_url;
      const { error: e2 } = await sb.from('profiles').update(payload).eq('id', id);
      if (e2) { toast('Error: '+e2.message,'error'); return; }
    } else {
      toast('Error: '+error.message,'error'); return;
    }
  }

  // Update local cache
  const idx = allUsers.findIndex(u => u.id === id);
  if (idx > -1) Object.assign(allUsers[idx], payload);

  closeModal('modal-user-detail');
  applyUserFilter();
  toast('Profile updated!','success');
}

// ── Change Password section toggle ──
function toggleUDPassSection() {
  const section = document.getElementById('ud-pass-section');
  const icon    = document.getElementById('ud-pass-toggle-icon');
  if (section.style.display === 'none') {
    section.style.display = 'block'; icon.textContent = '▲ Hide';
    document.getElementById('ud-new-pass').value  = '';
    document.getElementById('ud-new-pass2').value = '';
    document.getElementById('ud-pass-error').style.display   = 'none';
    document.getElementById('ud-pass-success').style.display = 'none';
    // Show service key banner if key not set
    document.getElementById('ud-svckey-banner').style.display = SUPABASE_SERVICE_KEY ? 'none' : 'block';
  } else {
    section.style.display = 'none'; icon.textContent = '▼ Show';
  }
}

function saveInlineSvcKey() {
  const key = document.getElementById('inline-svckey').value.trim();
  if (!key) { toast('Paste the service role key first', 'error'); return; }
  localStorage.setItem('meritoSvcKey', key);
  SUPABASE_SERVICE_KEY = key;
  try {
    sbAdmin = supabase.createClient(SUPABASE_URL, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  } catch(e) { console.warn('sbAdmin reinit failed:', e); }
  document.getElementById('ud-svckey-banner').style.display = 'none';
  document.getElementById('inline-svckey').value = '';
  toast('Service key saved!', 'success');
}

function toggleUDPassVis(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

// ── Admin change user password + email notification ──
async function adminChangeUserPassword() {
  const userId   = document.getElementById('ud-id').value;
  const userEmail= document.getElementById('ud-user-email').value;
  const userName = document.getElementById('ud-name').value.trim() || 'User';
  const pass     = document.getElementById('ud-new-pass').value;
  const pass2    = document.getElementById('ud-new-pass2').value;
  const errBox   = document.getElementById('ud-pass-error');
  const successEl= document.getElementById('ud-pass-success');
  errBox.style.display = 'none'; successEl.style.display = 'none';

  // Validate
  if (!pass || pass.length < 4) {
    errBox.textContent = 'Password must be at least 4 characters.';
    errBox.style.display = 'block'; return;
  }
  if (pass.length > 16) {
    errBox.textContent = 'Password cannot exceed 16 characters.';
    errBox.style.display = 'block'; return;
  }
  if (pass !== pass2) {
    errBox.textContent = 'Passwords do not match.';
    errBox.style.display = 'block'; return;
  }
  if (!userId || !userEmail) {
    errBox.textContent = 'User data missing. Please reopen this profile.';
    errBox.style.display = 'block'; return;
  }
  if (!SUPABASE_SERVICE_KEY) {
    errBox.textContent = 'Service role key not set. Log out and log back in, entering the key on the login screen.';
    errBox.style.display = 'block'; return;
  }

  // Check sbAdmin is properly initialized
  if (!sbAdmin || !SUPABASE_SERVICE_KEY) {
    errBox.textContent = 'Service role key not loaded. Please log out and log in again, entering the service key.';
    errBox.style.display = 'block'; return;
  }

  const btn = document.getElementById('btn-ud-change-pass');
  btn.disabled = true; btn.textContent = 'Updating…';

  try {
    // Use direct REST API call — more reliable than SDK admin methods from browser
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        password: pass,
        user_metadata: { has_password: true }
      })
    });

    const resData = await res.json();
    console.log('Password update response:', res.status, resData);

    if (!res.ok) {
      btn.disabled = false; btn.textContent = '🔑 Update Password & Notify User';
      errBox.textContent = 'Failed: ' + (resData?.msg || resData?.message || `HTTP ${res.status}`);
      errBox.style.display = 'block'; return;
    }
  } catch(e) {
    btn.disabled = false; btn.textContent = '🔑 Update Password & Notify User';
    errBox.textContent = 'Network error: ' + (e.message || 'Check console.');
    errBox.style.display = 'block';
    console.error('adminChangeUserPassword error:', e);
    return;
  }

  // 2. Send email notification
  let emailSent = false;
  let emailError = '';
  if (EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY') {
    try {
      const ejsResult = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email:     userEmail,
        to_name:      userName,
        new_password: pass
      });
      console.log('EmailJS response:', ejsResult);
      emailSent = true;
    } catch(e) {
      emailError = e?.text || e?.message || JSON.stringify(e);
      console.error('EmailJS send failed:', e);
    }
  }

  btn.disabled = false; btn.textContent = '🔑 Update Password & Notify User';
  document.getElementById('ud-new-pass').value  = '';
  document.getElementById('ud-new-pass2').value = '';

  if (emailSent) {
    successEl.textContent = '✓ Password updated & email sent to ' + userEmail;
    successEl.style.color = '';
    successEl.style.display = 'block';
  } else {
    successEl.innerHTML = '✓ Password updated!<br><span style="color:#E65100">⚠ Email failed to send: ' + (emailError || 'EmailJS not configured') + '</span>';
    successEl.style.display = 'block';
  }
  toast('Password changed for ' + userName, 'success');
}

async function udAddCourse() {
  const userEmail = document.getElementById('ud-user-email').value;
  const courseId  = parseInt(document.getElementById('ud-add-course').value);
  if (!userEmail) { toast('No email found for this user','error'); return; }
  if (!courseId)  { toast('Select a course first','error'); return; }
  if (_udEnrollments.find(e => e.course_id == courseId)) { toast('Already enrolled in this course','error'); return; }

  const { error } = await sb.from('course_enrollments').insert({ user_email: userEmail, course_id: courseId });
  if (error) { toast('Error: '+error.message,'error'); return; }

  const { data: enrs } = await sb.from('course_enrollments').select('*').eq('user_email', userEmail);
  _udEnrollments = enrs || [];
  renderUDEnrollments();
  document.getElementById('ud-add-course').value = '';
  toast('Enrolled successfully!','success');
}

async function udRemoveCourse(courseId) {
  const userEmail = document.getElementById('ud-user-email').value;
  const course    = allCourses.find(c => c.id == courseId);
  if (!confirm(`Remove this user from "${course?.title||'this course'}"?`)) return;

  await sb.from('course_enrollments').delete().eq('user_email', userEmail).eq('course_id', courseId);
  _udEnrollments = _udEnrollments.filter(e => e.course_id != courseId);
  renderUDEnrollments();
  toast('Removed from course','');
}

/* ══ ADD CATEGORY ══ */
async function addCategory() {
  const name = document.getElementById('new-cat-name').value.trim();
  const key  = document.getElementById('new-cat-key').value.trim().toLowerCase().replace(/\s+/g,'-');
  if (!name || !key) { toast('Fill all fields','error'); return; }

  // Persist to site_settings as extra_categories JSON
  const { data: existing } = await sb.from('site_settings').select('value').eq('key','extra_categories').maybeSingle();
  let extras = [];
  try { extras = existing?.value ? JSON.parse(existing.value) : []; } catch(e) {}
  // Avoid duplicates
  if (extras.find(c => c.cat === key)) { toast('A category with this key already exists','error'); return; }
  extras.push({ cat: key, cat_name: name });
  const { error } = await sb.from('site_settings').upsert({ key:'extra_categories', value: JSON.stringify(extras) });
  if (error) { toast('Error saving: ' + error.message,'error'); return; }

  categories.push({ cat: key, cat_name: name });
  renderCategories();
  closeModal('modal-add-cat');
  toast('✅ Category saved! It will appear on the website.','success');
  document.getElementById('new-cat-name').value = '';
  document.getElementById('new-cat-key').value  = '';
}

/* ══════════════════════════════════════════
   INSTRUCTORS — load / render / CRUD
══════════════════════════════════════════ */
let allInstructors = [];

async function loadInstructors() {
  const { data } = await sb.from('instructors').select('*').order('created_at', {ascending:true});
  allInstructors = data || [];
  renderInstructors(allInstructors);
}

function renderInstructors(list) {
  const grid  = document.getElementById('inst-card-grid');
  const empty = document.getElementById('inst-page-empty');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  grid.innerHTML = list.map(inst => {
    const avatar = inst.photo_url
      ? `<img class="inst-card-photo" src="${inst.photo_url}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" alt="${inst.name}"><div class="inst-card-fb" style="display:none">${inst.name[0].toUpperCase()}</div>`
      : `<div class="inst-card-fb">${inst.name[0].toUpperCase()}</div>`;
    return `<div class="inst-card">
      ${avatar}
      <div class="inst-card-name">${inst.name}</div>
      <div class="inst-card-desig">${inst.designation || ''}</div>
      <div class="inst-card-exp">${inst.experience || ''}</div>
      <div class="inst-card-actions">
        <button class="btn-icon btn-edit" onclick="openEditInstructor(${inst.id})" title="Edit">✎</button>
        <button class="btn-icon btn-delete" onclick="deleteInstructor(${inst.id})" title="Delete">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function filterInstPage(query) {
  const q = query.toLowerCase();
  renderInstructors(allInstructors.filter(i =>
    i.name.toLowerCase().includes(q) || (i.designation||'').toLowerCase().includes(q)
  ));
}

/* ── Photo upload zone state ── */
const _photoState = {};

function _setPhotoStatus(prefix, msg, type) {
  const el = document.getElementById(prefix + '-photo-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'photo-upload-status' + (type ? ' pu-' + type : '');
}

function _renderPhotoZone(prefix) {
  const url   = _photoState[prefix]?.url || '';
  const inner = document.getElementById(prefix + '-photo-zone-inner');
  if (!inner) return;
  if (url) {
    inner.innerHTML = `
      <img class="pu-preview" src="${url}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <div style="display:none;font-size:28px;margin-bottom:6px;">📷</div>
      <div class="pu-hint" style="color:var(--blue);font-weight:600;">Photo saved ✓</div>
      <div class="pu-sub">Click or drag to replace</div>`;
  } else {
    inner.innerHTML = `
      <div class="pu-icon">📷</div>
      <div class="pu-hint">Drag &amp; drop photo or <span>click to browse</span></div>
      <div class="pu-sub">JPG, PNG, WEBP — max 5MB</div>`;
  }
}

function initPhotoZone(prefix, currentUrl) {
  _photoState[prefix] = { url: currentUrl || '' };
  _renderPhotoZone(prefix);
  _setPhotoStatus(prefix, '', '');
  const gd = document.getElementById(prefix + '-gdrive-input');
  if (gd) gd.value = '';
  const fi = document.getElementById(prefix + '-photo-file');
  if (fi) fi.value = '';
}

function getPhotoUrl(prefix) { return _photoState[prefix]?.url || ''; }

/* Crop any image to a centered square at 400×400 (JPEG) */
function _cropToSquare(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = 400; canvas.height = 400;
        const ctx = canvas.getContext('2d');
        const sx = (img.width  - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('crop failed')), 'image/jpeg', 0.92);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhotoFile(prefix, file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    _setPhotoStatus(prefix, '✗ Please upload an image file (JPG/PNG/WEBP)', 'error'); return;
  }
  if (file.size > 10 * 1024 * 1024) {
    _setPhotoStatus(prefix, '✗ File too large — max 10MB', 'error'); return;
  }
  _setPhotoStatus(prefix, '⏳ Cropping & uploading…', 'loading');

  let blob;
  try   { blob = await _cropToSquare(file); }
  catch { blob = file; } // fallback: upload original if crop fails

  const path = `instructors/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;

  const { error: upErr } = await sb.storage
    .from('instructor-photos')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

  if (upErr) {
    _setPhotoStatus(prefix, '✗ Upload failed: ' + upErr.message, 'error'); return;
  }

  const { data: { publicUrl } } = sb.storage.from('instructor-photos').getPublicUrl(path);
  _photoState[prefix] = { url: publicUrl };
  _renderPhotoZone(prefix);
  _setPhotoStatus(prefix, '✓ Photo uploaded & cropped to circle!', 'success');
}

function applyGDriveLink(prefix) {
  const input = document.getElementById(prefix + '-gdrive-input');
  const raw   = input?.value.trim();
  if (!raw) { _setPhotoStatus(prefix, '✗ Paste a Google Drive link first', 'error'); return; }

  let fileId = null;
  for (const pattern of [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/]) {
    const m = raw.match(pattern);
    if (m) { fileId = m[1]; break; }
  }
  if (!fileId) {
    _setPhotoStatus(prefix, '✗ Could not read file ID from this link', 'error'); return;
  }

  const url = `https://drive.google.com/uc?export=view&id=${fileId}`;
  _photoState[prefix] = { url };
  _renderPhotoZone(prefix);
  if (input) input.value = '';
  _setPhotoStatus(prefix, '✓ Google Drive photo applied! (File must be shared publicly)', 'success');
}

async function saveInstructor() {
  const name  = document.getElementById('ai-name').value.trim();
  const desig = document.getElementById('ai-designation').value.trim();
  const exp   = document.getElementById('ai-experience').value.trim();
  const photo = getPhotoUrl('ai');
  if (!name) { toast('Name is required','error'); return; }
  const { error } = await sb.from('instructors').insert({ name, designation: desig, experience: exp, photo_url: photo || null });
  if (error) { toast('Error: ' + error.message,'error'); return; }
  closeModal('modal-add-instructor');
  document.getElementById('ai-name').value        = '';
  document.getElementById('ai-designation').value = '';
  document.getElementById('ai-experience').value  = '';
  initPhotoZone('ai', '');
  await loadInstructors();
  toast('✅ Instructor added!','success');
}

function openEditInstructor(id) {
  const inst = allInstructors.find(i => i.id === id);
  if (!inst) return;
  document.getElementById('ei-id').value          = inst.id;
  document.getElementById('ei-name').value        = inst.name || '';
  document.getElementById('ei-designation').value = inst.designation || '';
  document.getElementById('ei-experience').value  = inst.experience || '';
  initPhotoZone('ei', inst.photo_url || '');
  openModal('modal-edit-instructor');
}

async function saveEditInstructor() {
  const id    = parseInt(document.getElementById('ei-id').value);
  const name  = document.getElementById('ei-name').value.trim();
  const desig = document.getElementById('ei-designation').value.trim();
  const exp   = document.getElementById('ei-experience').value.trim();
  const photo = getPhotoUrl('ei');
  if (!name) { toast('Name is required','error'); return; }
  const { error } = await sb.from('instructors').update({ name, designation: desig, experience: exp, photo_url: photo || null }).eq('id', id);
  if (error) { toast('Error: ' + error.message,'error'); return; }
  closeModal('modal-edit-instructor');
  await loadInstructors();
  toast('✅ Instructor updated!','success');
}

async function deleteInstructor(id) {
  if (!confirm('Delete this instructor? They will be removed from all courses.')) return;
  await sb.from('instructors').delete().eq('id', id);
  await loadInstructors();
  toast('Instructor deleted','');
}

/* ══ INSTRUCTOR PICKER (for course edit/add modals) ══ */
const _instPicker = {};

function buildInstPicker(prefix, selectedIds) {
  _instPicker[prefix] = { selectedIds: [...selectedIds], query: '' };
  _renderInstPicker(prefix);
}

function _renderInstPicker(prefix) {
  const state = _instPicker[prefix];
  _renderInstSelected(prefix, state.selectedIds);
  _renderInstAvail(prefix, state.selectedIds, state.query);
}

function _renderInstSelected(prefix, selectedIds) {
  const el = document.getElementById(prefix + '-inst-selected');
  if (!el) return;
  if (!selectedIds.length) {
    el.innerHTML = '<div class="inst-picker-empty">No instructors selected yet</div>';
    return;
  }
  el.innerHTML = selectedIds.map((id, idx) => {
    const inst = allInstructors.find(i => i.id === id);
    if (!inst) return '';
    const avatar = inst.photo_url
      ? `<img class="inst-avatar" src="${inst.photo_url}" onerror="this.style.display='none'">`
      : `<div class="inst-avatar inst-avatar-fb">${inst.name[0].toUpperCase()}</div>`;
    return `<div class="inst-sel-item">
      ${avatar}
      <div class="inst-info"><div class="inst-iname">${inst.name}</div><div class="inst-idesig">${inst.designation||''}</div></div>
      <div class="inst-order-btns">
        ${idx > 0 ? `<button class="btn-ism" onclick="_instMoveUp('${prefix}',${id})">↑</button>` : '<span class="btn-ism" style="cursor:default;opacity:.3">↑</span>'}
        ${idx < selectedIds.length-1 ? `<button class="btn-ism" onclick="_instMoveDown('${prefix}',${id})">↓</button>` : '<span class="btn-ism" style="cursor:default;opacity:.3">↓</span>'}
      </div>
      <button class="btn-icon btn-delete inst-remove-btn" onclick="_instRemove('${prefix}',${id})" title="Remove">✕</button>
    </div>`;
  }).join('');
}

function _renderInstAvail(prefix, selectedIds, query) {
  const el = document.getElementById(prefix + '-inst-avail');
  if (!el) return;
  const q = (query||'').toLowerCase();
  const avail = allInstructors.filter(i =>
    !selectedIds.includes(i.id) &&
    (!q || i.name.toLowerCase().includes(q) || (i.designation||'').toLowerCase().includes(q))
  );
  if (!avail.length) {
    el.innerHTML = `<div class="inst-picker-empty">${allInstructors.length ? (q ? 'No match. Try a different search.' : 'All instructors have been added.') : 'No instructors yet — add some in the Instructors section first.'}</div>`;
    return;
  }
  el.innerHTML = avail.map(inst => {
    const avatar = inst.photo_url
      ? `<img class="inst-avatar" src="${inst.photo_url}" onerror="this.style.display='none'">`
      : `<div class="inst-avatar inst-avatar-fb">${inst.name[0].toUpperCase()}</div>`;
    return `<div class="inst-avail-item" onclick="_instAdd('${prefix}',${inst.id})">
      ${avatar}
      <div class="inst-info"><div class="inst-iname">${inst.name}</div><div class="inst-idesig">${[inst.designation, inst.experience].filter(Boolean).join(' • ')}</div></div>
      <span class="inst-add-tag">+ Add</span>
    </div>`;
  }).join('');
}

function _instAdd(prefix, id) {
  const state = _instPicker[prefix];
  if (!state || state.selectedIds.includes(id)) return;
  state.selectedIds.push(id);
  _renderInstPicker(prefix);
}
function _instRemove(prefix, id) {
  const state = _instPicker[prefix];
  if (!state) return;
  state.selectedIds = state.selectedIds.filter(x => x !== id);
  _renderInstPicker(prefix);
}
function _instMoveUp(prefix, id) {
  const s = _instPicker[prefix]; if (!s) return;
  const i = s.selectedIds.indexOf(id); if (i <= 0) return;
  [s.selectedIds[i-1], s.selectedIds[i]] = [s.selectedIds[i], s.selectedIds[i-1]];
  _renderInstPicker(prefix);
}
function _instMoveDown(prefix, id) {
  const s = _instPicker[prefix]; if (!s) return;
  const i = s.selectedIds.indexOf(id); if (i < 0 || i >= s.selectedIds.length-1) return;
  [s.selectedIds[i], s.selectedIds[i+1]] = [s.selectedIds[i+1], s.selectedIds[i]];
  _renderInstPicker(prefix);
}
function filterInstPicker(prefix, query) {
  const state = _instPicker[prefix]; if (!state) return;
  state.query = query;
  _renderInstAvail(prefix, state.selectedIds, query);
}
function getPickerInstIds(prefix) { return _instPicker[prefix]?.selectedIds || []; }

/* ══ CATEGORY CHIP HELPERS ══ */
function buildCatChips(containerId, selectedKeys) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!categories.length) {
    el.innerHTML = '<span class="cats-picker-empty">No categories found. Add categories first.</span>';
    return;
  }
  el.innerHTML = categories.map(c => {
    const sel = selectedKeys.includes(c.cat);
    return `<span class="cat-chip${sel?' selected':''}"
       data-cat="${c.cat}" data-catname="${c.cat_name.replace(/"/g,'&quot;')}"
       onclick="this.classList.toggle('selected')">${c.cat_name}</span>`;
  }).join('');
}

function getChipCats(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return [];
  return [...el.querySelectorAll('.cat-chip.selected')].map(ch => ({
    cat: ch.dataset.cat, cat_name: ch.dataset.catname
  }));
}

/* ══ GENERIC TEXT ITEM LIST (includes bar & sidebar features) ══ */
function buildTextItems(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  (items || []).forEach(v => _addTextItemRow(el, v));
}
function _addTextItemRow(container, value) {
  const row = document.createElement('div');
  row.className = 'text-item-row';
  row.innerHTML = `<input class="form-input" value="${(value||'').replace(/"/g,'&quot;')}" placeholder="e.g. 📹 60+ videos" style="flex:1">
    <button type="button" class="lp-del" onclick="this.closest('.text-item-row').remove()">✕</button>`;
  container.appendChild(row);
}
function addTextItem(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  _addTextItemRow(el, '');
  el.lastElementChild?.querySelector('input')?.focus();
}
function getTextItems(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return '[]';
  return JSON.stringify([...el.querySelectorAll('.text-item-row input')]
    .map(i => i.value.trim()).filter(Boolean));
}

/* ══ ENROLLMENT MANAGEMENT ══ */
let _currentEnrollCourseId = null;
let _currentEnrollBase     = 0;

async function loadEnrollments(courseId, enrolledBase) {
  _currentEnrollCourseId = courseId;
  _currentEnrollBase     = enrolledBase || 0;
  const { data } = await sb.from('course_enrollments').select('*').eq('course_id', courseId).order('created_at', {ascending:false});
  renderEnrollments(data || []);
}
function renderEnrollments(rows) {
  const listEl   = document.getElementById('ec-enrolled-list');
  const totalEl  = document.getElementById('ec-enr-total');
  const baseEl   = document.getElementById('ec-enr-base-display');
  const actualEl = document.getElementById('ec-enr-actual');
  if (!listEl) return;
  const actual = rows.length;
  const total  = _currentEnrollBase + actual;
  if (totalEl)  totalEl.textContent  = total;
  if (baseEl)   baseEl.textContent   = _currentEnrollBase;
  if (actualEl) actualEl.textContent = actual;
  if (!rows.length) {
    listEl.innerHTML = '<div class="enrolled-empty">No students enrolled yet</div>';
    return;
  }
  listEl.innerHTML = rows.map(r => `
    <div class="enrolled-item">
      <div class="enrolled-email">${r.user_email}</div>
      <div class="enrolled-date">${new Date(r.created_at).toLocaleDateString('en-BD',{day:'2-digit',month:'short',year:'numeric'})}</div>
      <button class="lp-del" onclick="removeEnrollment(${r.id})" title="Remove student">✕</button>
    </div>`).join('');
}
async function addEnrollment() {
  const email = document.getElementById('ec-enroll-email')?.value.trim();
  if (!email) { toast('Enter student email','error'); return; }
  if (!_currentEnrollCourseId) { toast('Save the course first, then enroll students','error'); return; }
  const { error } = await sb.from('course_enrollments').insert({ course_id: _currentEnrollCourseId, user_email: email });
  if (error) { toast(error.message.includes('duplicate') ? 'Student already enrolled' : 'Error: '+error.message, 'error'); return; }
  document.getElementById('ec-enroll-email').value = '';
  // Update enrolled_base display to reflect new count
  _currentEnrollBase = parseInt(document.getElementById('ec-enrolled-base')?.value) || 0;
  await loadEnrollments(_currentEnrollCourseId, _currentEnrollBase);
  toast('Student enrolled!', 'success');
}
async function removeEnrollment(enrollId) {
  await sb.from('course_enrollments').delete().eq('id', enrollId);
  _currentEnrollBase = parseInt(document.getElementById('ec-enrolled-base')?.value) || 0;
  await loadEnrollments(_currentEnrollCourseId, _currentEnrollBase);
  toast('Student removed','');
}

/* ══ LEARN POINTS ══ */
function buildLearnPoints(prefix, points) {
  const el = document.getElementById(prefix + '-learn-list');
  if (!el) return;
  el.innerHTML = '';
  (points || []).forEach(p => _addLearnPointRow(el, p));
}
function _addLearnPointRow(container, value) {
  const row = document.createElement('div');
  row.className = 'learn-point-row';
  row.innerHTML = `<span class="lp-tick">✓</span>
    <input class="form-input" value="${(value||'').replace(/"/g,'&quot;')}" placeholder="e.g. IBA MBA exam strategy" style="flex:1">
    <button type="button" class="lp-del" onclick="this.closest('.learn-point-row').remove()">✕</button>`;
  container.appendChild(row);
}
function addLearnPoint(prefix) {
  const el = document.getElementById(prefix + '-learn-list');
  if (!el) return;
  _addLearnPointRow(el, '');
  el.lastElementChild?.querySelector('input')?.focus();
}
function getLearnPoints(prefix) {
  const el = document.getElementById(prefix + '-learn-list');
  if (!el) return '[]';
  return JSON.stringify([...el.querySelectorAll('.learn-point-row input')]
    .map(i => i.value.trim()).filter(Boolean));
}

/* ══ COURSE DESCRIPTION BLOCKS ══ */
function buildDescBlocks(prefix, blocks) {
  const el = document.getElementById(prefix + '-cdesc-blocks');
  if (!el) return;
  el.innerHTML = '';
  (blocks || []).forEach(b => _addDescBlockRow(el, b.type, b.text));
}
function _addDescBlockRow(container, type, text) {
  const row = document.createElement('div');
  row.className = 'cdesc-row cdesc-row-' + (type||'text');
  row.dataset.type = type || 'text';
  const safeText = (text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  row.innerHTML = `<span class="cdesc-type-lbl">${type === 'highlight' ? '★ Highlight' : '¶ Text'}</span>
    <textarea class="form-textarea cdesc-ta" rows="2" placeholder="${type === 'highlight' ? 'e.g. 350+ students placed in IBA MBA' : 'e.g. This course is designed for students who want to...'}">${safeText}</textarea>
    <button type="button" class="lp-del" onclick="this.closest('.cdesc-row').remove()" style="margin-top:4px;">✕</button>`;
  container.appendChild(row);
}
function addDescBlock(prefix, type) {
  const el = document.getElementById(prefix + '-cdesc-blocks');
  if (!el) return;
  _addDescBlockRow(el, type, '');
  el.lastElementChild?.querySelector('textarea')?.focus();
}
function getDescBlocks(prefix) {
  const el = document.getElementById(prefix + '-cdesc-blocks');
  if (!el) return '[]';
  const blocks = [...el.querySelectorAll('.cdesc-row')].map(row => ({
    type: row.dataset.type || 'text',
    text: row.querySelector('textarea')?.value.trim() || ''
  })).filter(b => b.text);
  return JSON.stringify(blocks);
}

/* ══ CURRICULUM BUILDER ══ */
function buildCurriculum(prefix, data) {
  const el = document.getElementById(prefix + '-curriculum');
  if (!el) return;
  el.innerHTML = '';
  (data || []).forEach(sec => _currAddSectionEl(prefix, sec));
}
function _currAddSectionEl(prefix, sec) {
  const el = document.getElementById(prefix + '-curriculum');
  if (!el) return;
  const secEl = document.createElement('div');
  secEl.className = 'curb-section';
  secEl.innerHTML = `
    <div class="curb-section-head">
      <span class="curb-sect-lbl">SECTION</span>
      <input class="form-input curb-title-input" value="${(sec?.title||'').replace(/"/g,'&quot;')}" placeholder="e.g. Math">
      <button type="button" class="lp-del" onclick="this.closest('.curb-section').remove()">✕</button>
    </div>
    <div class="curb-subsections-list"></div>
    <button type="button" class="btn-add-row btn-add-curb-sub" onclick="_currAddSubEl(this.previousElementSibling, null)">+ Add Subsection</button>`;
  el.appendChild(secEl);
  const subList = secEl.querySelector('.curb-subsections-list');
  (sec?.subsections || []).forEach(sub => _currAddSubEl(subList, sub));
}
function _currAddSubEl(subList, sub) {
  const subEl = document.createElement('div');
  subEl.className = 'curb-subsection';
  subEl.innerHTML = `
    <div class="curb-sub-head">
      <span class="curb-sect-lbl curb-sect-lbl-sub">SUB</span>
      <input class="form-input curb-title-input" value="${(sub?.title||'').replace(/"/g,'&quot;')}" placeholder="e.g. Math 01">
      <button type="button" class="lp-del" onclick="this.closest('.curb-subsection').remove()">✕</button>
    </div>
    <div class="curb-contents-list"></div>
    <button type="button" class="btn-add-row btn-add-curb-ct" onclick="_currAddContentEl(this.previousElementSibling, null)">+ Add Content</button>`;
  subList.appendChild(subEl);
  const ctList = subEl.querySelector('.curb-contents-list');
  (sub?.contents || []).forEach(ct => _currAddContentEl(ctList, ct));
}
function _currAddContentEl(ctList, ct) {
  const ctEl = document.createElement('div');
  ctEl.className = 'curb-content-row';
  ctEl.innerHTML = `
    <select class="form-select curb-ct-type" style="width:108px;flex-shrink:0;padding:6px 8px;font-size:12px;">
      <option value="video" ${!ct||ct.type==='video'?'selected':''}>📹 Video</option>
      <option value="pdf"   ${ct?.type==='pdf'  ?'selected':''}>📄 PDF</option>
      <option value="quiz"  ${ct?.type==='quiz' ?'selected':''}>📝 Quiz</option>
    </select>
    <input class="form-input curb-ct-title" value="${(ct?.title||'').replace(/"/g,'&quot;')}" placeholder="Content title" style="flex:2;min-width:0">
    <input class="form-input curb-ct-dur" value="${ct?.duration||''}" placeholder="12:30" style="width:62px;flex-shrink:0" title="Duration">
    <label class="curb-free-lbl" title="Free preview"><input type="checkbox" class="curb-ct-free" ${ct?.free?'checked':''}> Free</label>
    <button type="button" class="lp-del" onclick="this.closest('.curb-content-row').remove()">✕</button>`;
  ctList.appendChild(ctEl);
}
function addCurriculumSection(prefix) {
  _currAddSectionEl(prefix, null);
  const el = document.getElementById(prefix + '-curriculum');
  el?.lastElementChild?.previousElementSibling?.previousElementSibling?.querySelector('.curb-title-input')?.focus();
}
function getCurriculum(prefix) {
  const el = document.getElementById(prefix + '-curriculum');
  if (!el) return '[]';
  const sections = [...el.querySelectorAll(':scope > .curb-section')].map(secEl => ({
    title: secEl.querySelector('.curb-section-head .curb-title-input')?.value.trim() || '',
    subsections: [...secEl.querySelectorAll('.curb-subsection')].map(subEl => ({
      title: subEl.querySelector('.curb-sub-head .curb-title-input')?.value.trim() || '',
      contents: [...subEl.querySelectorAll('.curb-content-row')].map(ctEl => ({
        type:     ctEl.querySelector('.curb-ct-type')?.value  || 'video',
        title:    ctEl.querySelector('.curb-ct-title')?.value.trim() || '',
        duration: ctEl.querySelector('.curb-ct-dur')?.value.trim()  || '',
        free:     ctEl.querySelector('.curb-ct-free')?.checked || false
      })).filter(ct => ct.title)
    })).filter(sub => sub.title || sub.contents.length)
  })).filter(sec => sec.title || sec.subsections.length);
  return JSON.stringify(sections);
}

function openAddCourse() {
  buildCatChips('nc-cats-list', []);
  buildInstPicker('nc', []);
  buildTextItems('nc-includes-list', []);
  buildTextItems('nc-features-list', []);
  buildLearnPoints('nc', []);
  buildDescBlocks('nc', []);
  buildCurriculum('nc', []);
  document.getElementById('nc-enrolled-base').value = '';
  document.getElementById('nc-review-count').value  = '';
  openModal('modal-add-course');
}

/* ══ EDIT COURSE ══ */
function openEditCourse(id) {
  const c = allCourses.find(x => x.id === id);
  if (!c) return;
  document.getElementById('ec-id').value             = c.id;
  document.getElementById('ec-title').value          = c.title || '';
  document.getElementById('ec-price').value          = c.price || '';
  document.getElementById('ec-oldprice').value       = c.old_price || '';
  document.getElementById('ec-lessons').value        = c.lessons || '';
  document.getElementById('ec-icon').value           = c.icon || '';
  document.getElementById('ec-rating').value         = c.rating || '';
  document.getElementById('ec-badge').value          = c.badge || '';
  document.getElementById('ec-desc').value           = c.description || '';
  document.getElementById('ec-video').value          = c.intro_video_url || '';
  document.getElementById('ec-active').value         = c.is_active ? 'true' : 'false';
  document.getElementById('ec-enrolled-base').value  = c.enrolled_base || 0;
  document.getElementById('ec-review-count').value   = c.review_count || 0;
  // Build includes bar & features
  let includesItems = [];
  try { if (c.includes_items) includesItems = JSON.parse(c.includes_items); } catch(e) {}
  buildTextItems('ec-includes-list', includesItems);
  let featuresItems = [];
  try { if (c.features_items) featuresItems = JSON.parse(c.features_items); } catch(e) {}
  buildTextItems('ec-features-list', featuresItems);
  // Build category chips
  let selCats = [c.cat || ''];
  try { if (c.extra_cats) selCats = JSON.parse(c.extra_cats); } catch(e) {}
  buildCatChips('ec-cats-list', selCats);
  // Build instructor picker
  let selInstIds = [];
  try { if (c.course_instructors) selInstIds = JSON.parse(c.course_instructors); } catch(e) {}
  buildInstPicker('ec', selInstIds);
  // Build What You'll Learn
  let learnPts = [];
  try { if (c.learn_points) learnPts = JSON.parse(c.learn_points); } catch(e) {}
  buildLearnPoints('ec', learnPts);
  // Build Course Description Blocks
  let descBlks = [];
  try { if (c.course_description_blocks) descBlks = JSON.parse(c.course_description_blocks); } catch(e) {}
  buildDescBlocks('ec', descBlks);
  // Build Curriculum
  let curric = [];
  try { if (c.curriculum) curric = JSON.parse(c.curriculum); } catch(e) {}
  buildCurriculum('ec', curric);
  // Load enrollments
  loadEnrollments(c.id, c.enrolled_base || 0);
  openModal('modal-edit-course');
}

async function saveEditCourse() {
  const id       = document.getElementById('ec-id').value;
  const title    = document.getElementById('ec-title').value.trim();
  const price    = parseInt(document.getElementById('ec-price').value) || 0;
  const oldPrice = parseInt(document.getElementById('ec-oldprice').value) || 0;
  const lessons  = parseInt(document.getElementById('ec-lessons').value) || 0;
  const icon     = document.getElementById('ec-icon').value.trim();
  const rating   = parseFloat(document.getElementById('ec-rating').value) || 4.5;
  const badge    = document.getElementById('ec-badge').value.trim();
  const desc     = document.getElementById('ec-desc').value.trim();
  const videoUrl = document.getElementById('ec-video').value.trim();
  const isActive = document.getElementById('ec-active').value === 'true';

  const selectedCats = getChipCats('ec-cats-list');
  if (!selectedCats.length) { toast('Select at least one category', 'error'); return; }
  const cat     = selectedCats[0].cat;
  const catName = selectedCats[0].cat_name;
  const extraCats = JSON.stringify(selectedCats.map(c => c.cat));

  if (!title) { toast('Course title is required', 'error'); return; }

  const btn = document.querySelector('#modal-edit-course .btn-primary');
  btn.textContent = 'Saving...'; btn.disabled = true;

  const enrolledBase    = parseInt(document.getElementById('ec-enrolled-base').value) || 0;
  const reviewCount     = parseInt(document.getElementById('ec-review-count').value)  || 0;
  const includesItems   = getTextItems('ec-includes-list');
  const featuresItems   = getTextItems('ec-features-list');

  const instIds = getPickerInstIds('ec');
  const courseInstructors = JSON.stringify(instIds);
  const inst = allInstructors.find(i => i.id === instIds[0])?.name || '';
  const learnPoints = getLearnPoints('ec');
  const descBlocks  = getDescBlocks('ec');
  const curriculum  = getCurriculum('ec');

  const { error } = await sb.from('courses').update({
    title, cat, cat_name: catName, extra_cats: extraCats,
    course_instructors: courseInstructors,
    instructor: inst, price, old_price: oldPrice, lessons, icon, rating, badge,
    description: desc, is_active: isActive, intro_video_url: videoUrl || null,
    learn_points: learnPoints,
    course_description_blocks: descBlocks,
    curriculum: curriculum,
    enrolled_base: enrolledBase,
    review_count: reviewCount,
    includes_items: includesItems,
    features_items: featuresItems
  }).eq('id', id);

  btn.textContent = 'Save Changes'; btn.disabled = false;

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  closeModal('modal-edit-course');
  loadCourses();
  toast('Course updated successfully!', 'success');
}

/* ══ ADD COURSE ══ */
async function addCourse() {
  const title    = document.getElementById('nc-title').value.trim();
  const price    = parseInt(document.getElementById('nc-price').value) || 0;
  const oldPrice = parseInt(document.getElementById('nc-oldprice').value) || 0;
  const lessons  = parseInt(document.getElementById('nc-lessons').value) || 0;
  const icon     = document.getElementById('nc-icon').value.trim() || '📚';
  const badge    = document.getElementById('nc-badge').value.trim();
  const desc     = document.getElementById('nc-desc').value.trim();
  const videoUrl = document.getElementById('nc-video').value.trim();

  const selectedCats = getChipCats('nc-cats-list');
  if (!selectedCats.length) { toast('Select at least one category','error'); return; }
  const cat       = selectedCats[0].cat;
  const catName   = selectedCats[0].cat_name;
  const extraCats = JSON.stringify(selectedCats.map(c => c.cat));

  if (!title) { toast('Course title required','error'); return; }
  const enrolledBase   = parseInt(document.getElementById('nc-enrolled-base').value) || 0;
  const reviewCount    = parseInt(document.getElementById('nc-review-count').value)  || 0;
  const includesItems  = getTextItems('nc-includes-list');
  const featuresItems  = getTextItems('nc-features-list');
  const instIds = getPickerInstIds('nc');
  const courseInstructors = JSON.stringify(instIds);
  const inst = allInstructors.find(i => i.id === instIds[0])?.name || '';
  const learnPoints = getLearnPoints('nc');
  const descBlocks  = getDescBlocks('nc');
  const curriculum  = getCurriculum('nc');

  const { error } = await sb.from('courses').insert({
    cat, cat_name: catName, extra_cats: extraCats, title,
    instructor: inst, course_instructors: courseInstructors,
    price, old_price: oldPrice, lessons, icon, badge,
    description: desc, rating: 4.5, is_active: true,
    intro_video_url: videoUrl || null,
    learn_points: learnPoints,
    course_description_blocks: descBlocks,
    curriculum: curriculum,
    enrolled_base: enrolledBase,
    review_count: reviewCount,
    includes_items: includesItems,
    features_items: featuresItems
  });
  if (error) { toast('Error: '+error.message, 'error'); return; }
  closeModal('modal-add-course');
  loadCourses();
  toast('Course added!', 'success');
}

/* ══ NOTIFICATIONS ══ */
let allNotifications = [];

async function loadNotifications() {
  const { data } = await sb.from('notifications').select('*').order('created_at',{ascending:false});
  allNotifications = data || [];
  renderNotifications(allNotifications);
}

function renderNotifications(rows) {
  const tbody = document.getElementById('notif-tbody');
  if (!tbody) return;
  document.getElementById('notif-count').textContent = `1-${rows.length} of ${rows.length}`;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-dim)">No notifications sent yet.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(n => {
    const audienceMap = {
      all:         '<span style="color:#2e7d32;font-weight:700;">🌐 All Users</span>',
      paid_users:  '<span style="color:#6A1B9A;font-weight:700;">💳 Paid Users</span>',
      free_users:  '<span style="color:#E65100;font-weight:700;">🆓 Free Users</span>',
      course_users:'<span style="color:#1565C0;font-weight:700;">🎓 Course Only</span>',
      single_user: '<span style="color:#C2185B;font-weight:700;">👤 Single User</span>',
    };
    const audienceLabel = audienceMap[n.audience] || n.audience;
    const courseName = n.course_id
      ? (allCourses.find(c => c.id === n.course_id)?.title || `Course #${n.course_id}`)
      : n.user_id
        ? (allUsers.find(u => u.id === n.user_id)?.full_name || n.user_id.slice(0,12)+'…')
        : '—';
    const statusBadge = n.is_active
      ? '<span class="toggle-pill toggle-on">Active</span>'
      : '<span class="toggle-pill toggle-off">Archived</span>';
    const sent = new Date(n.created_at).toLocaleString('en-BD',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    return `<tr>
      <td class="td-name">${n.title}</td>
      <td>${audienceLabel}</td>
      <td style="font-size:12px;color:var(--text-dim);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${courseName}</td>
      <td style="font-size:12px;color:var(--text-mid);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${n.body||''}</td>
      <td>${statusBadge}</td>
      <td style="font-size:12px;color:var(--text-dim);">${sent}</td>
      <td><div class="action-btns">
        <button class="btn-icon btn-delete" onclick="deleteNotification(${n.id})" title="Delete">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openSendNotifModal() {
  document.getElementById('nn-title').value    = '';
  document.getElementById('nn-body').value     = '';
  document.getElementById('nn-url').value      = '';
  document.getElementById('nn-audience').value = 'all';
  toggleNotifAudienceRows('all');
  // Populate course dropdown
  const sel = document.getElementById('nn-course-id');
  sel.innerHTML = allCourses.length
    ? allCourses.map(c => `<option value="${c.id}">${c.title}</option>`).join('')
    : '<option value="">No courses available</option>';
  openModal('modal-add-notification');
}

function toggleNotifAudienceRows(val) {
  const courseRow = document.getElementById('nn-course-row');
  const userRow   = document.getElementById('nn-user-row');
  if (courseRow) courseRow.style.display = val === 'course_users' ? '' : 'none';
  if (userRow)   userRow.style.display   = val === 'single_user'  ? '' : 'none';
  if (val !== 'single_user') clearNotifUser();
}

let _notifUserSearchTimeout = null;
async function searchNotifUser(q) {
  const results = document.getElementById('nn-user-results');
  clearTimeout(_notifUserSearchTimeout);
  if (!q.trim()) { results.style.display = 'none'; return; }
  _notifUserSearchTimeout = setTimeout(async () => {
    const term = q.trim().toLowerCase();
    const matches = allUsers.filter(u =>
      (u.full_name||'').toLowerCase().includes(term) ||
      (u.phone||'').toLowerCase().includes(term) ||
      (u.email||'').toLowerCase().includes(term)
    ).slice(0, 12);
    if (!matches.length) {
      results.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--text-dim);text-align:center;">No users found</div>';
    } else {
      results.innerHTML = matches.map(u => `
        <div onclick="selectNotifUser('${u.id}','${(u.full_name||'Unknown').replace(/'/g,"\\'")}','${(u.phone||'').replace(/'/g,"\\'")}','${(u.email||'').replace(/'/g,"\\'")}' )"
          style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;transition:background .12s;"
          onmouseover="this.style.background='var(--blue-light)'" onmouseout="this.style.background=''">
          <div style="font-size:13px;font-weight:600;color:var(--text);">${u.full_name||'Unknown'}</div>
          <div style="font-size:11px;color:var(--text-dim);">${[u.phone,u.email].filter(Boolean).join(' · ')}</div>
        </div>`).join('');
    }
    results.style.display = '';
  }, 280);
}

function selectNotifUser(id, name, phone, email) {
  document.getElementById('nn-user-id').value = id;
  document.getElementById('nn-user-search').value = '';
  document.getElementById('nn-user-results').style.display = 'none';
  document.getElementById('nn-user-selected-name').textContent = name;
  document.getElementById('nn-user-selected-meta').textContent = [phone, email].filter(Boolean).join(' · ');
  const sel = document.getElementById('nn-user-selected');
  sel.style.display = 'flex';
}

function clearNotifUser() {
  document.getElementById('nn-user-id').value = '';
  document.getElementById('nn-user-search').value = '';
  document.getElementById('nn-user-results').style.display = 'none';
  const sel = document.getElementById('nn-user-selected');
  if (sel) sel.style.display = 'none';
}

async function sendNotification() {
  const title    = document.getElementById('nn-title').value.trim();
  const body     = document.getElementById('nn-body').value.trim();
  const audience = document.getElementById('nn-audience').value;
  const courseId = audience === 'course_users' ? (parseInt(document.getElementById('nn-course-id').value)||null) : null;
  const userId   = audience === 'single_user'  ? (document.getElementById('nn-user-id').value||null) : null;
  const url      = document.getElementById('nn-url').value.trim();

  if (!title) { toast('Title is required','error'); return; }
  if (audience === 'course_users' && !courseId) { toast('Please select a course','error'); return; }
  if (audience === 'single_user'  && !userId)   { toast('Please select a user','error'); return; }

  const btn = document.querySelector('#modal-add-notification .btn-primary');
  btn.textContent = 'Sending…'; btn.disabled = true;

  const payload = { title, body: body||null, audience, course_id: courseId, user_id: userId, action_url: url||null, is_active: true };
  const { error } = await sb.from('notifications').insert(payload);

  btn.textContent = '🔔 Send Notification'; btn.disabled = false;
  if (error) { toast('Error: ' + error.message,'error'); return; }
  closeModal('modal-add-notification');
  await loadNotifications();
  toast('✅ Notification sent!', 'success');
}

async function deleteNotification(id) {
  if (!confirm('Delete this notification? Students will no longer see it.')) return;
  await sb.from('notifications').delete().eq('id', id);
  await loadNotifications();
  toast('Notification deleted','');
}

/* ══ CONTENT STORES ══ */
let storeVideos=[], storePictures=[], storePDFs=[], storeLinks=[], courseContent=[];

/* ── helpers ── */
function _storeEmpty(cols,msg){return `<tr><td colspan="${cols}" style="text-align:center;padding:40px;color:var(--text-dim)">${msg}</td></tr>`;}
function _storeDate(ts){return ts?new Date(ts).toLocaleDateString('en-BD',{day:'2-digit',month:'short',year:'numeric'}):'—';}

/* ── GENERIC STORE MODAL (video / picture / pdf / link) ── */
const _storeConfig = {
  video:   { table:'store_videos',   urlCol:'youtube_url',  urlLabel:'YouTube URL *',        preview:false, hasDesc:false },
  picture: { table:'store_pictures', urlCol:'image_url',    urlLabel:'Image URL *',           preview:true,  hasDesc:false },
  pdf:     { table:'store_pdfs',     urlCol:'file_url',     urlLabel:'File URL * (PDF / Drive link)', preview:false, hasDesc:false },
  link:    { table:'store_links',    urlCol:'url',          urlLabel:'URL *',                 preview:false, hasDesc:true  },
};

function openStoreModal(type, item) {
  const cfg      = _storeConfig[type];
  const hasUpload = type === 'picture' || type === 'pdf';

  document.getElementById('msi-type').value    = type;
  document.getElementById('msi-id').value      = item?.id || '';
  document.getElementById('msi-name').value    = item?.name || '';
  document.getElementById('msi-url').value     = item?.[cfg.urlCol] || '';
  document.getElementById('msi-url-label').textContent = hasUpload ? 'URL (auto-filled after upload)' : cfg.urlLabel;
  document.getElementById('msi-desc').value    = item?.description || '';
  document.getElementById('msi-desc-group').style.display   = cfg.hasDesc  ? '' : 'none';
  document.getElementById('msi-upload-section').style.display = hasUpload ? '' : 'none';
  document.getElementById('msi-img-preview').style.display  = 'none';
  document.getElementById('msi-upload-status').textContent  = '';
  document.getElementById('msi-upload-status').className    = 'photo-upload-status';
  document.getElementById('msi-head').textContent = (item ? 'Edit' : 'Add') + ' ' + {video:'Video',picture:'Picture',pdf:'PDF',link:'Link'}[type];
  document.getElementById('msi-save-btn').textContent = item ? 'Save Changes' : 'Save';

  // Configure drop zone per type
  if (type === 'picture') {
    document.getElementById('msi-file-input').accept = 'image/*';
    document.getElementById('msi-zone-icon').textContent = '🖼️';
    document.getElementById('msi-zone-sub').textContent  = 'PNG, JPG, WebP, GIF — max 10 MB';
  } else if (type === 'pdf') {
    document.getElementById('msi-file-input').accept = '.pdf,application/pdf';
    document.getElementById('msi-zone-icon').textContent = '📄';
    document.getElementById('msi-zone-sub').textContent  = 'PDF files only — max 50 MB';
  }

  // If editing with existing URL, show preview for picture
  if (type === 'picture' && item?.[cfg.urlCol]) {
    const img = document.getElementById('msi-preview-img');
    img.src = item[cfg.urlCol];
    document.getElementById('msi-img-preview').style.display = '';
  }

  // Reset file input so same file can be re-selected
  document.getElementById('msi-file-input').value = '';

  openModal('modal-store-item');
}

function msiURLChange(url) {
  const type = document.getElementById('msi-type').value;
  if (type === 'picture' && url) {
    const img = document.getElementById('msi-preview-img');
    img.src = url;
    img.style.display = '';
    document.getElementById('msi-img-preview').style.display = '';
  } else if (!url) {
    document.getElementById('msi-img-preview').style.display = 'none';
  }
}

async function handleMSIFile(file) {
  if (!file) return;
  const type   = document.getElementById('msi-type').value;
  const status = document.getElementById('msi-upload-status');
  const bucket = type === 'picture' ? 'pictures' : 'pdfs';

  // Validate type
  if (type === 'pdf' && file.type !== 'application/pdf') {
    status.className = 'photo-upload-status pu-error';
    status.textContent = 'Only PDF files are accepted.';
    return;
  }
  if (type === 'picture' && !file.type.startsWith('image/')) {
    status.className = 'photo-upload-status pu-error';
    status.textContent = 'Only image files are accepted.';
    return;
  }

  // Size check
  const maxMB = type === 'pdf' ? 50 : 10;
  if (file.size > maxMB * 1024 * 1024) {
    status.className = 'photo-upload-status pu-error';
    status.textContent = `File too large. Max ${maxMB} MB.`;
    return;
  }

  // Update zone inner to show file name
  document.getElementById('msi-zone-inner').innerHTML =
    `<div class="pu-icon">${type === 'pdf' ? '📄' : '🖼️'}</div>
     <div class="pu-hint" style="color:var(--blue);font-weight:600;">${file.name}</div>
     <div class="pu-sub">${(file.size/1024/1024).toFixed(2)} MB — uploading…</div>`;

  status.className = 'photo-upload-status pu-loading';
  status.textContent = 'Uploading… please wait';

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const { data: upData, error: upErr } = await sb.storage.from(bucket).upload(safeName, file, {
    contentType: file.type,
    upsert: false,
  });

  if (upErr) {
    status.className = 'photo-upload-status pu-error';
    status.textContent = 'Upload failed: ' + upErr.message;
    // Restore zone
    document.getElementById('msi-zone-inner').innerHTML =
      `<div class="pu-icon">${type === 'pdf' ? '📄' : '🖼️'}</div>
       <div class="pu-hint">Drag &amp; drop here or <span>click to browse</span></div>
       <div class="pu-sub">${document.getElementById('msi-zone-sub').textContent}</div>`;
    return;
  }

  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(upData.path);
  const publicURL = urlData.publicUrl;

  document.getElementById('msi-url').value = publicURL;
  status.className = 'photo-upload-status pu-success';
  status.textContent = '✓ Uploaded: ' + file.name;

  // Update zone to show success state
  document.getElementById('msi-zone-inner').innerHTML =
    `<div class="pu-icon">✅</div>
     <div class="pu-hint" style="color:#2e7d32;font-weight:600;">${file.name}</div>
     <div class="pu-sub" style="color:#2e7d32;">${(file.size/1024/1024).toFixed(2)} MB — uploaded successfully</div>`;

  // Show image preview
  if (type === 'picture') {
    const img = document.getElementById('msi-preview-img');
    img.src = publicURL;
    img.style.display = '';
    document.getElementById('msi-img-preview').style.display = '';
  }

  // Auto-fill name if empty
  if (!document.getElementById('msi-name').value.trim()) {
    const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g,' ');
    document.getElementById('msi-name').value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }
}

async function saveStoreItem() {
  const type = document.getElementById('msi-type').value;
  const id   = document.getElementById('msi-id').value;
  const cfg  = _storeConfig[type];
  const name = document.getElementById('msi-name').value.trim();
  const url  = document.getElementById('msi-url').value.trim();
  if (!name) { toast('Name is required','error'); return; }
  if (!url)  { toast('URL is required','error'); return; }
  const payload = { name, [cfg.urlCol]: url };
  if (cfg.hasDesc) payload.description = document.getElementById('msi-desc').value.trim()||null;
  const btn = document.getElementById('msi-save-btn');
  btn.disabled = true;
  const op = id ? sb.from(cfg.table).update(payload).eq('id',id) : sb.from(cfg.table).insert(payload);
  const { error } = await op;
  btn.disabled = false;
  if (error) { toast('Error: '+error.message,'error'); return; }
  closeModal('modal-store-item');
  const loaders = {video:loadStoreVideos, picture:loadStorePictures, pdf:loadStorePDFs, link:loadStoreLinks};
  await loaders[type]();
  toast(id ? 'Updated!' : 'Saved!','success');
}

async function deleteStoreItem(type, id) {
  if (!confirm('Delete this item?')) return;
  await sb.from(_storeConfig[type].table).delete().eq('id',id);
  const loaders = {video:loadStoreVideos, picture:loadStorePictures, pdf:loadStorePDFs, link:loadStoreLinks};
  await loaders[type]();
  toast('Deleted','');
}

function filterStore(prefix, q) {
  const t = q.toLowerCase();
  document.querySelectorAll(`#${prefix}-tbody tr`).forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(t) ? '' : 'none';
  });
}

/* ── VIDEO STORE ── */
async function loadStoreVideos() {
  const { data } = await sb.from('store_videos').select('*').order('created_at',{ascending:false});
  storeVideos = data || [];
  const tbody = document.getElementById('sv-tbody');
  if (!tbody) return;
  document.getElementById('sv-count').textContent = storeVideos.length + ' items';
  if (!storeVideos.length) { tbody.innerHTML = _storeEmpty(4,'No videos yet. Click + to add.'); return; }
  tbody.innerHTML = storeVideos.map(v=>`<tr>
    <td class="td-name" onclick="openStoreModal('video',${JSON.stringify(v).replace(/"/g,'&quot;')})">${v.name}</td>
    <td style="font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
      <a href="${v.youtube_url||'#'}" target="_blank" class="td-link">${v.youtube_url||'—'}</a></td>
    <td style="font-size:11px;color:var(--text-dim);">${_storeDate(v.created_at)}</td>
    <td><div class="action-btns">
      <button class="btn-icon btn-edit" onclick="openStoreModal('video',storeVideos.find(x=>x.id==${v.id}))">✎</button>
      <button class="btn-icon btn-delete" onclick="deleteStoreItem('video',${v.id})">🗑</button>
    </div></td></tr>`).join('');
}

/* ── PICTURE STORE ── */
async function loadStorePictures() {
  const { data } = await sb.from('store_pictures').select('*').order('created_at',{ascending:false});
  storePictures = data || [];
  const tbody = document.getElementById('sp-tbody');
  if (!tbody) return;
  document.getElementById('sp-count').textContent = storePictures.length + ' items';
  if (!storePictures.length) { tbody.innerHTML = _storeEmpty(5,'No pictures yet. Click + to add.'); return; }
  tbody.innerHTML = storePictures.map(p=>`<tr>
    <td class="td-name" onclick="openStoreModal('picture',storePictures.find(x=>x.id==${p.id}))">${p.name}</td>
    <td><img src="${p.image_url||''}" style="width:48px;height:36px;object-fit:cover;border-radius:4px;border:1px solid var(--border);" onerror="this.style.display='none'"></td>
    <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.image_url||'—'}</td>
    <td style="font-size:11px;color:var(--text-dim);">${_storeDate(p.created_at)}</td>
    <td><div class="action-btns">
      <button class="btn-icon btn-edit" onclick="openStoreModal('picture',storePictures.find(x=>x.id==${p.id}))">✎</button>
      <button class="btn-icon btn-delete" onclick="deleteStoreItem('picture',${p.id})">🗑</button>
    </div></td></tr>`).join('');
}

/* ── PDF STORE ── */
async function loadStorePDFs() {
  const { data } = await sb.from('store_pdfs').select('*').order('created_at',{ascending:false});
  storePDFs = data || [];
  const tbody = document.getElementById('sd-tbody');
  if (!tbody) return;
  document.getElementById('sd-count').textContent = storePDFs.length + ' items';
  if (!storePDFs.length) { tbody.innerHTML = _storeEmpty(4,'No PDFs yet. Click + to add.'); return; }
  tbody.innerHTML = storePDFs.map(p=>`<tr>
    <td class="td-name" onclick="openStoreModal('pdf',storePDFs.find(x=>x.id==${p.id}))">${p.name}</td>
    <td style="font-size:12px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
      <a href="${p.file_url||'#'}" target="_blank" class="td-link">${p.file_url||'—'}</a></td>
    <td style="font-size:11px;color:var(--text-dim);">${_storeDate(p.created_at)}</td>
    <td><div class="action-btns">
      <a href="${p.file_url||'#'}" target="_blank" class="btn-icon btn-view" style="display:flex;align-items:center;justify-content:center;text-decoration:none;" title="Open">↗</a>
      <button class="btn-icon btn-edit" onclick="openStoreModal('pdf',storePDFs.find(x=>x.id==${p.id}))">✎</button>
      <button class="btn-icon btn-delete" onclick="deleteStoreItem('pdf',${p.id})">🗑</button>
    </div></td></tr>`).join('');
}

/* ── MCQ STORE ── */

/* ── LINK STORE ── */
async function loadStoreLinks() {
  const { data } = await sb.from('store_links').select('*').order('created_at',{ascending:false});
  storeLinks = data || [];
  const tbody = document.getElementById('sl-tbody');
  if (!tbody) return;
  document.getElementById('sl-count').textContent = storeLinks.length + ' items';
  if (!storeLinks.length) { tbody.innerHTML = _storeEmpty(5,'No links yet. Click + to add.'); return; }
  tbody.innerHTML = storeLinks.map(l=>`<tr>
    <td class="td-name" onclick="openStoreModal('link',storeLinks.find(x=>x.id==${l.id}))">${l.name}</td>
    <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
      <a href="${l.url||'#'}" target="_blank" class="td-link">${l.url||'—'}</a></td>
    <td style="font-size:12px;color:var(--text-mid);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.description||'—'}</td>
    <td style="font-size:11px;color:var(--text-dim);">${_storeDate(l.created_at)}</td>
    <td><div class="action-btns">
      <a href="${l.url||'#'}" target="_blank" class="btn-icon btn-view" style="display:flex;align-items:center;justify-content:center;text-decoration:none;">↗</a>
      <button class="btn-icon btn-edit" onclick="openStoreModal('link',storeLinks.find(x=>x.id==${l.id}))">✎</button>
      <button class="btn-icon btn-delete" onclick="deleteStoreItem('link',${l.id})">🗑</button>
    </div></td></tr>`).join('');
}

/* ── COURSE CONTENT (Inline Curriculum Builder) ── */
let _ccSections = [];
let _ccLidCtr = 0;
const _ccTypeIcons  = { video:'▶', pdf:'📄', link:'🔗', picture:'🖼️' };
const _ccTypeLabels = { video:'Video', pdf:'PDF', link:'Link', picture:'Picture' };
function _ccLid() { return 'lid' + (++_ccLidCtr); }
function _ccEsc(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function initCourseContent() {
  const sel = document.getElementById('cc-course-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select a course —</option>' + allCourses.map(c=>`<option value="${c.id}">${c.title}</option>`).join('');
}

async function loadCourseContentForCourse() {
  const courseId = document.getElementById('cc-course-sel').value;
  const saveBtn  = document.getElementById('cc-save-btn');
  const body     = document.getElementById('cc-body');
  if (!courseId) {
    if (saveBtn) saveBtn.style.display = 'none';
    body.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-dim);font-size:14px;">Select a course above to manage its content.</div>';
    return;
  }
  if (saveBtn) saveBtn.style.display = '';
  body.innerHTML = '<div style="padding:20px;color:var(--text-dim);font-size:13px;">Loading…</div>';
  const { data } = await sb.from('course_content').select('*').eq('course_id', courseId).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
  _ccSections = _dbRowsToSections(data || []);
  renderCCBuilder();
}

function _dbRowsToSections(rows) {
  const secMap = new Map(), secOrder = [];
  rows.forEach(row => {
    const sl = row.section_label || 'General';
    if (!secMap.has(sl)) { secMap.set(sl, { _lid:_ccLid(), label:sl, directItems:[], subsections:new Map(), subOrder:[] }); secOrder.push(sl); }
    const sec = secMap.get(sl);
    const sub = row.subsection_label || null;
    if (sub) {
      if (!sec.subsections.has(sub)) { sec.subsections.set(sub,{_lid:_ccLid(),label:sub,items:[]}); sec.subOrder.push(sub); }
      sec.subsections.get(sub).items.push(_rowToMemItem(row));
    } else {
      sec.directItems.push(_rowToMemItem(row));
    }
  });
  return secOrder.map(sl => { const s=secMap.get(sl); return { _lid:s._lid, label:s.label, directItems:s.directItems, subsections:s.subOrder.map(sl2=>s.subsections.get(sl2)) }; });
}
function _rowToMemItem(row) {
  return { _lid:_ccLid(), content_type:row.content_type||'video', content_name:row.content_name||'', content_url:row.content_url||'', duration:row.duration||'', is_free:row.is_free||false };
}

/* — State helpers — */
function _ccGetSec(lid) { return _ccSections.find(s=>s._lid===lid); }
function _ccGetSub(sLid,subLid) { return _ccGetSec(sLid)?.subsections.find(s=>s._lid===subLid); }
function _ccGetItem(lid) {
  for (const s of _ccSections) {
    for (const i of s.directItems) if (i._lid===lid) return i;
    for (const sub of s.subsections) for (const i of sub.items) if (i._lid===lid) return i;
  }
  return null;
}

/* — oninput handlers (no re-render, just mutate state) — */
function ccSetSecLabel(lid,v)         { const s=_ccGetSec(lid); if(s) s.label=v; }
function ccSetSubLabel(sLid,subLid,v) { const s=_ccGetSub(sLid,subLid); if(s) s.label=v; }
function ccSetItemField(lid,field,v)  { const i=_ccGetItem(lid); if(i) i[field]=v; }

/* — Type chip click (partial DOM update, no full re-render) — */
function ccSetItemType(lid, type, el) {
  const item = _ccGetItem(lid);
  if (!item) return;
  item.content_type = type;
  const chipsWrap = el.closest('[data-chips-wrap]');
  if (chipsWrap) chipsWrap.innerHTML = _ccTypeChips(lid, type);
}
function _ccTypeChips(lid, activeType) {
  return Object.keys(_ccTypeIcons).map(t=>`<span onclick="ccSetItemType('${lid}','${t}',this)" style="cursor:pointer;font-size:11px;padding:3px 9px;border-radius:12px;font-weight:600;transition:background .15s,color .15s;background:${activeType===t?'var(--primary)':'rgba(74,0,177,0.08)'};color:${activeType===t?'#fff':'var(--primary)'};">${_ccTypeIcons[t]} ${_ccTypeLabels[t]}</span>`).join('');
}

/* — Add / delete — */
function ccAddSection() {
  _ccSections.push({_lid:_ccLid(),label:'',directItems:[],subsections:[]});
  renderCCBuilder();
  setTimeout(()=>{const b=document.querySelectorAll('.cc-sec-block');b[b.length-1]?.querySelector('input')?.focus();},40);
}
function ccDeleteSection(lid) { _ccSections=_ccSections.filter(s=>s._lid!==lid); renderCCBuilder(); }
function ccAddDirectContent(sLid) {
  const s=_ccGetSec(sLid); if(!s) return;
  s.directItems.push({_lid:_ccLid(),content_type:'video',content_name:'',content_url:'',duration:'',is_free:false});
  renderCCBuilder();
}
function ccAddSubsection(sLid) {
  const s=_ccGetSec(sLid); if(!s) return;
  s.subsections.push({_lid:_ccLid(),label:'',items:[]});
  renderCCBuilder();
}
function ccDeleteSub(sLid,subLid) { const s=_ccGetSec(sLid); if(s) s.subsections=s.subsections.filter(x=>x._lid!==subLid); renderCCBuilder(); }
function ccAddSubContent(sLid,subLid) {
  const sub=_ccGetSub(sLid,subLid); if(!sub) return;
  sub.items.push({_lid:_ccLid(),content_type:'video',content_name:'',content_url:'',duration:'',is_free:false});
  renderCCBuilder();
}
function ccDeleteItem(lid,sLid,subLid) {
  if (subLid) { const sub=_ccGetSub(sLid,subLid); if(sub) sub.items=sub.items.filter(i=>i._lid!==lid); }
  else        { const s=_ccGetSec(sLid); if(s) s.directItems=s.directItems.filter(i=>i._lid!==lid); }
  renderCCBuilder();
}

/* — Renderers — */
function _ccItemRow(item, sLid, subLid) {
  const sl = subLid||'';
  return `<div class="cc-item-row" data-lid="${item._lid}" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:var(--card);border:1px solid rgba(74,0,177,0.1);border-radius:8px;padding:8px 10px;">
    <div data-chips-wrap style="display:flex;gap:4px;flex-wrap:wrap;">${_ccTypeChips(item._lid,item.content_type)}</div>
    <input value="${_ccEsc(item.content_name)}" oninput="ccSetItemField('${item._lid}','content_name',this.value)" placeholder="Lesson name" style="flex:1;min-width:120px;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:13px;background:var(--bg);color:var(--text);">
    <input value="${_ccEsc(item.content_url)}" oninput="ccSetItemField('${item._lid}','content_url',this.value)" placeholder="YouTube / PDF / any URL" style="flex:2;min-width:180px;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;background:var(--bg);color:var(--text);">
    <input value="${_ccEsc(item.duration)}" oninput="ccSetItemField('${item._lid}','duration',this.value)" placeholder="30:00" title="Duration" style="width:66px;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;background:var(--bg);color:var(--text);">
    <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-mid);cursor:pointer;white-space:nowrap;"><input type="checkbox" ${item.is_free?'checked':''} onchange="ccSetItemField('${item._lid}','is_free',this.checked)" style="width:14px;height:14px;accent-color:var(--primary);"> Free</label>
    <button onclick="ccDeleteItem('${item._lid}','${sLid}','${sl}')" style="background:none;border:none;cursor:pointer;font-size:18px;color:#c03030;line-height:1;padding:0 2px;flex-shrink:0;" title="Remove">×</button>
  </div>`;
}
function _ccSubBlock(sLid, sub) {
  return `<div class="cc-sub-block" style="border:1px solid rgba(74,0,177,0.15);border-radius:8px;overflow:hidden;background:var(--bg);">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(74,0,177,0.05);border-bottom:1px solid rgba(74,0,177,0.1);">
      <span style="font-size:10px;font-weight:800;color:var(--primary);letter-spacing:.08em;">SUB</span>
      <input value="${_ccEsc(sub.label)}" oninput="ccSetSubLabel('${sLid}','${sub._lid}',this.value)" placeholder="Subsection name" style="flex:1;border:none;background:none;font-size:13px;font-weight:600;color:var(--text);outline:none;padding:2px 0;">
      <button onclick="ccDeleteSub('${sLid}','${sub._lid}')" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--text-dim);line-height:1;padding:0 4px;" title="Delete subsection">×</button>
    </div>
    <div style="padding:8px 12px;display:flex;flex-direction:column;gap:6px;">
      ${sub.items.map(item=>_ccItemRow(item,sLid,sub._lid)).join('')}
      <button onclick="ccAddSubContent('${sLid}','${sub._lid}')" style="align-self:flex-start;background:none;border:1.5px dashed rgba(74,0,177,0.3);border-radius:6px;padding:5px 14px;font-size:12px;color:var(--primary);cursor:pointer;font-weight:600;">+ Add Content</button>
    </div>
  </div>`;
}
function _ccSecBlock(sec) {
  return `<div class="cc-sec-block" style="border:1.5px solid rgba(192,48,48,0.3);border-radius:10px;overflow:hidden;background:var(--card);">
    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,200,200,0.22);border-bottom:1px solid rgba(192,48,48,0.18);">
      <span style="font-size:10px;font-weight:800;color:#c03030;letter-spacing:.09em;">SECTION</span>
      <input value="${_ccEsc(sec.label)}" oninput="ccSetSecLabel('${sec._lid}',this.value)" placeholder="Section name" style="flex:1;border:none;background:none;font-size:14px;font-weight:700;color:var(--text);outline:none;padding:2px 0;">
      <button onclick="ccDeleteSection('${sec._lid}')" style="background:none;border:none;cursor:pointer;font-size:20px;color:#c03030;line-height:1;padding:0 4px;" title="Delete section">×</button>
    </div>
    <div style="padding:10px 14px;display:flex;flex-direction:column;gap:8px;">
      ${sec.directItems.map(item=>_ccItemRow(item,sec._lid,null)).join('')}
      ${sec.subsections.map(sub=>_ccSubBlock(sec._lid,sub)).join('')}
      <div style="display:flex;gap:8px;margin-top:2px;flex-wrap:wrap;">
        <button onclick="ccAddDirectContent('${sec._lid}')" style="background:none;border:1.5px dashed rgba(74,0,177,0.3);border-radius:6px;padding:6px 14px;font-size:12px;color:var(--primary);cursor:pointer;font-weight:600;">+ Add Content</button>
        <button onclick="ccAddSubsection('${sec._lid}')" style="background:none;border:1.5px dashed rgba(74,0,177,0.2);border-radius:6px;padding:6px 14px;font-size:12px;color:var(--text-dim);cursor:pointer;font-weight:600;">+ Add Subsection</button>
      </div>
    </div>
  </div>`;
}

function renderCCBuilder() {
  const body = document.getElementById('cc-body');
  if (!body) return;
  body.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px;max-width:760px;padding-bottom:40px;">
    ${_ccSections.map(_ccSecBlock).join('')}
    <button onclick="ccAddSection()" style="align-self:flex-start;background:none;border:2px dashed var(--border);border-radius:8px;padding:8px 22px;font-size:13px;color:var(--text-dim);cursor:pointer;font-weight:600;">+ Add Section</button>
  </div>`;
}

/* — Save All — */
async function saveAllCourseContent() {
  const courseId = document.getElementById('cc-course-sel').value;
  if (!courseId) return;
  const btn = document.getElementById('cc-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const rows = [];
  let idx = 0;
  for (const sec of _ccSections) {
    for (const item of sec.directItems) {
      if (!item.content_name && !item.content_url) continue;
      rows.push({ course_id:parseInt(courseId), section_label:sec.label||null, subsection_label:null,
        content_type:item.content_type, content_name:item.content_name, content_url:item.content_url||null,
        duration:item.duration||null, is_free:item.is_free||false, sort_order:idx++ });
    }
    for (const sub of sec.subsections) {
      for (const item of sub.items) {
        if (!item.content_name && !item.content_url) continue;
        rows.push({ course_id:parseInt(courseId), section_label:sec.label||null, subsection_label:sub.label||null,
          content_type:item.content_type, content_name:item.content_name, content_url:item.content_url||null,
          duration:item.duration||null, is_free:item.is_free||false, sort_order:idx++ });
      }
    }
  }

  const { error: delErr } = await sb.from('course_content').delete().eq('course_id', courseId);
  if (delErr) { toast('Delete failed: '+delErr.message,'error'); btn.disabled=false; btn.textContent='💾 Save All'; return; }

  if (rows.length) {
    const { error: insErr } = await sb.from('course_content').insert(rows);
    if (insErr) { toast('Save failed: '+insErr.message,'error'); btn.disabled=false; btn.textContent='💾 Save All'; return; }
  }

  btn.disabled = false; btn.textContent = '💾 Save All';
  toast(`Saved ${rows.length} lesson${rows.length!==1?'s':''}!`, 'success');
  await loadCourseContentForCourse();
}

/* ══ SEND SMS ══ */
async function sendSMS() {
  const audience = document.getElementById('sms-audience').value;
  const body     = document.getElementById('sms-body').value.trim();
  if (!audience || !body) { toast('Please fill all fields','error'); return; }
  // Save to sms_logs table (optional - records the send)
  toast('SMS recorded successfully! (Connect SMS API to send real messages)', 'success');
  document.getElementById('sms-body').value = '';
}

/* ══ FILTER TABLE ══ */
function filterTable(tbodyId, val, col) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    if (!cells.length) return;
    const text = cells[col]?.textContent.toLowerCase() || '';
    tr.style.display = text.includes(val.toLowerCase()) ? '' : 'none';
  });
}

/* ══ MODALS ══ */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

/* ══ DELETE ══ */
let deleteTarget = null;
let deleteType   = null;
function openDeleteModal(id, type) {
  deleteTarget = id;
  deleteType   = type;
  openModal('modal-delete');
}
async function confirmDelete() {
  if (deleteType === 'course') {
    await sb.from('courses').delete().eq('id', deleteTarget);
    loadCourses();
    toast('Course deleted', 'success');
  } else if (deleteType === 'category') {
    categories.splice(deleteTarget, 1);
    renderCategories();
    toast('Category deleted', 'success');
  }
  closeModal('modal-delete');
  deleteTarget = null; deleteType = null;
}

/* ══ TOAST ══ */
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (type||'');
  setTimeout(() => el.className = 'toast', 3000);
}

/* ══════════════════════════════════════════
   EXAM SYSTEM
══════════════════════════════════════════ */

/* ── Question Categories ── */
let eqCategories = [];
let _eqActiveCat = ''; // '' = all

async function loadEQCategories() {
  const { data } = await sb.from('exam_question_categories').select('*').order('name', { ascending: true });
  eqCategories = data || [];
  populateEQCatDropdown();
  renderEQChips();
}

function populateEQCatDropdown() {
  const sel = document.getElementById('eqm-category');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— Select a category —</option>' +
    eqCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (current) sel.value = current;
}

function renderEQChips() {
  const wrap = document.getElementById('eq-chips');
  if (!wrap) return;
  if (!eqCategories.length) { wrap.innerHTML = '<span style="font-size:12px;color:var(--text-dim);">No categories yet — click ⚙ Categories to create one first.</span>'; return; }
  wrap.innerHTML = `<span class="cat-chip ${_eqActiveCat===''?'selected':''}" onclick="setEQCatFilter('')">All</span>` +
    eqCategories.map(c =>
      `<span class="cat-chip ${_eqActiveCat===String(c.id)?'selected':''}" onclick="setEQCatFilter('${c.id}')">${c.name}</span>`
    ).join('');
}

function setEQCatFilter(catId) {
  _eqActiveCat = catId;
  renderEQChips();
  applyEQFilter();
}

function applyEQFilter() {
  const q = document.querySelector('#pv-exam-questions .search-box input')?.value.toLowerCase() || '';
  let list = allExamQuestions;
  if (_eqActiveCat) list = list.filter(x => String(x.category_id) === _eqActiveCat);
  if (q) list = list.filter(x => (x.question||'').toLowerCase().includes(q) || (x.description||'').toLowerCase().includes(q));
  renderExamQuestions(list);
}

async function openEQCatModal() {
  await loadEQCategories();
  renderEQCatList();
  document.getElementById('eqcat-name').value = '';
  openModal('modal-eq-cat');
}

function renderEQCatList() {
  const wrap = document.getElementById('eqcat-list');
  if (!wrap) return;
  if (!eqCategories.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:13px;">No categories yet. Add one above.</div>';
    return;
  }
  wrap.innerHTML = eqCategories.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--blue-light);border-radius:8px;border:1px solid var(--border);">
      <span style="font-size:13px;font-weight:600;flex:1;color:var(--text);">${c.name}</span>
      <span id="eqcat-count-${c.id}" style="font-size:11px;color:var(--text-dim);">— questions</span>
      <button class="btn-icon btn-delete" style="width:28px;height:28px;" onclick="deleteEQCategory(${c.id})">🗑</button>
    </div>`).join('');
  // Load question counts per category
  eqCategories.forEach(c => {
    const cnt = allExamQuestions.filter(q => q.category_id === c.id).length;
    const el = document.getElementById('eqcat-count-' + c.id);
    if (el) el.textContent = cnt + ' question' + (cnt !== 1 ? 's' : '');
  });
}

async function saveEQCategory() {
  const name = document.getElementById('eqcat-name').value.trim();
  if (!name) { toast('Enter a category name', 'error'); return; }
  const { error } = await sb.from('exam_question_categories').insert({ name });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  document.getElementById('eqcat-name').value = '';
  toast('Category added!', 'success');
  await loadEQCategories();
  renderEQCatList();
}

async function deleteEQCategory(id) {
  const cnt = allExamQuestions.filter(q => q.category_id === id).length;
  const msg = cnt > 0
    ? `This category has ${cnt} question(s). Deleting it will remove the category tag from those questions. Continue?`
    : 'Delete this category?';
  if (!confirm(msg)) return;
  const { error } = await sb.from('exam_question_categories').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  toast('Category deleted', 'success');
  await loadEQCategories();
  renderEQCatList();
  await loadExamQuestions();
}

/* ── Question Bank ── */
let allExamQuestions = [];
let _eqEditId = null;

async function loadExamQuestions() {
  if (!eqCategories.length) await loadEQCategories();
  const { data, error } = await sb.from('exam_questions').select('*').order('created_at', { ascending: false });
  if (error) { toast('Error loading questions: ' + error.message, 'error'); return; }
  allExamQuestions = data || [];
  renderEQChips();
  applyEQFilter();
}

function renderExamQuestions(list) {
  const tbody = document.getElementById('eq-tbody');
  const count = document.getElementById('eq-count');
  if (!tbody) return;
  count.textContent = list.length + ' question' + (list.length !== 1 ? 's' : '');
  if (!list.length) {
    const isEmpty = !allExamQuestions.length;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">${isEmpty ? 'No questions yet. First create a category (⚙ Categories), then click + to add questions.' : 'No questions match this filter.'}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((q, i) => {
    const catName = eqCategories.find(c => c.id === q.category_id)?.name || '—';
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
      .filter(Boolean).map((o, idx) => `<span style="font-size:10px;background:var(--blue-light);color:var(--blue-dark);padding:2px 6px;border-radius:10px;margin:1px;">${'ABCDE'[idx]}: ${o.length > 20 ? o.slice(0,20)+'…' : o}</span>`).join('');
    const ansLabel = ['A','B','C','D','E'][['a','b','c','d','e'].indexOf(q.correct_option)] || q.correct_option?.toUpperCase() || '?';
    return `<tr>
      <td style="color:var(--text-dim);font-size:12px;">${i+1}</td>
      <td style="max-width:260px;">
        <div style="font-weight:600;font-size:13px;color:var(--text);line-height:1.4;">${q.question}</div>
        ${q.description ? `<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">${q.description.length > 60 ? q.description.slice(0,60)+'…' : q.description}</div>` : ''}
      </td>
      <td><span class="badge badge-blue" style="white-space:nowrap;">${catName}</span></td>
      <td style="max-width:180px;"><div style="display:flex;flex-wrap:wrap;gap:2px;">${opts}</div></td>
      <td><span class="badge badge-green">${ansLabel}</span></td>
      <td>${q.video_url ? `<a href="${q.video_url}" target="_blank" class="td-link" style="font-size:11px;">▶ Video</a>` : '<span style="color:var(--text-dim);font-size:11px;">—</span>'}</td>
      <td><div class="action-btns">
        <button class="btn-icon btn-edit" onclick="openExamQModal(${q.id})">✎</button>
        <button class="btn-icon btn-delete" onclick="deleteExamQuestion(${q.id})">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

function filterExamQuestions(val) {
  applyEQFilter();
}

async function openExamQModal(id) {
  _eqEditId = id;
  document.getElementById('eqm-title').textContent = id ? 'Edit Question' : 'Add Question';
  // Reset form
  ['eqm-id','eqm-question','eqm-desc','eqm-a','eqm-b','eqm-c','eqm-d','eqm-e','eqm-correct','eqm-ans-desc','eqm-video']
    .forEach(i => { const el = document.getElementById(i); if (el) el.value = ''; });
  document.querySelectorAll('.eq-correct-btn').forEach(b => b.classList.remove('selected'));
  // Refresh category dropdown
  if (!eqCategories.length) await loadEQCategories();
  populateEQCatDropdown();
  // Pre-select active category chip filter if one is active
  const catSel = document.getElementById('eqm-category');
  if (_eqActiveCat && catSel) catSel.value = _eqActiveCat;

  if (id) {
    const q = allExamQuestions.find(x => x.id === id);
    if (!q) return;
    document.getElementById('eqm-id').value = q.id;
    document.getElementById('eqm-category').value = q.category_id || '';
    document.getElementById('eqm-question').value = q.question || '';
    document.getElementById('eqm-desc').value = q.description || '';
    document.getElementById('eqm-a').value = q.option_a || '';
    document.getElementById('eqm-b').value = q.option_b || '';
    document.getElementById('eqm-c').value = q.option_c || '';
    document.getElementById('eqm-d').value = q.option_d || '';
    document.getElementById('eqm-e').value = q.option_e || '';
    document.getElementById('eqm-correct').value = q.correct_option || '';
    document.getElementById('eqm-ans-desc').value = q.answer_description || '';
    document.getElementById('eqm-video').value = q.video_url || '';
    if (q.correct_option) {
      const idx = ['a','b','c','d','e'].indexOf(q.correct_option);
      const btns = document.querySelectorAll('.eq-correct-btn');
      if (btns[idx]) btns[idx].classList.add('selected');
    }
  }
  openModal('modal-exam-question');
}

function setCorrectOption(opt, el) {
  document.querySelectorAll('.eq-correct-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('eqm-correct').value = opt;
}

async function saveExamQuestion() {
  const id       = document.getElementById('eqm-id').value;
  const catId    = document.getElementById('eqm-category').value;
  const question = document.getElementById('eqm-question').value.trim();
  const opt_a    = document.getElementById('eqm-a').value.trim();
  const opt_b    = document.getElementById('eqm-b').value.trim();
  const correct  = document.getElementById('eqm-correct').value;

  if (!catId)               { toast('Select a category', 'error'); return; }
  if (!question)            { toast('Question text is required', 'error'); return; }
  if (!opt_a || !opt_b)     { toast('At least options A and B are required', 'error'); return; }
  if (!correct)             { toast('Select the correct answer', 'error'); return; }

  const payload = {
    category_id:        parseInt(catId),
    question,
    description:        document.getElementById('eqm-desc').value.trim() || null,
    option_a:           opt_a,
    option_b:           opt_b,
    option_c:           document.getElementById('eqm-c').value.trim() || null,
    option_d:           document.getElementById('eqm-d').value.trim() || null,
    option_e:           document.getElementById('eqm-e').value.trim() || null,
    correct_option:     correct,
    answer_description: document.getElementById('eqm-ans-desc').value.trim() || null,
    video_url:          document.getElementById('eqm-video').value.trim() || null,
  };

  let error;
  if (id) {
    ({ error } = await sb.from('exam_questions').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('exam_questions').insert(payload));
  }
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  closeModal('modal-exam-question');
  toast(id ? 'Question updated!' : 'Question added!', 'success');
  await loadExamQuestions();
}

async function deleteExamQuestion(id) {
  if (!confirm('Delete this question? It will also be removed from any exams that include it.')) return;
  const { error } = await sb.from('exam_questions').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  toast('Question deleted', 'success');
  await loadExamQuestions();
}

/* ── Exams ── */
let allExams = [];
let _examEditId = null;
let _examSelQuestions = []; // array of question objects selected for current exam modal

async function loadExams() {
  const { data, error } = await sb.from('exams').select('*').order('created_at', { ascending: false });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  allExams = data || [];
  // Also refresh results filter dropdown
  const erSel = document.getElementById('er-exam-filter');
  if (erSel) {
    erSel.innerHTML = '<option value="">All Exams</option>' +
      allExams.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
  }
  renderExams(allExams);
}

function renderExams(list) {
  const tbody = document.getElementById('exams-tbody');
  const count = document.getElementById('exams-count');
  if (!tbody) return;
  count.textContent = list.length + ' exam' + (list.length !== 1 ? 's' : '');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">No exams yet. Click + to create your first exam.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(e => `<tr>
    <td style="font-weight:600;color:var(--text);">${e.title}</td>
    <td>${e.duration_min} min</td>
    <td id="exam-q-count-${e.id}" style="font-size:12px;color:var(--text-dim);">—</td>
    <td>${e.pass_marks}/${e.total_questions||'—'}</td>
    <td><span class="badge ${e.is_active ? 'badge-green' : 'badge-gray'}">${e.is_active ? 'Active' : 'Inactive'}</span></td>
    <td style="font-size:12px;color:var(--text-dim);">${new Date(e.created_at).toLocaleDateString()}</td>
    <td><div class="action-btns">
      <button class="btn-icon btn-edit" onclick="openExamModal(${e.id})">✎</button>
      <button class="btn-icon btn-delete" onclick="deleteExam(${e.id})">🗑</button>
    </div></td>
  </tr>`).join('');
  // Load question counts in background
  list.forEach(e => loadExamQCount(e.id));
}

async function loadExamQCount(examId) {
  const { count } = await sb.from('exam_question_map').select('*', { count: 'exact', head: true }).eq('exam_id', examId);
  const el = document.getElementById('exam-q-count-' + examId);
  if (el) el.textContent = (count || 0) + ' Qs';
}

function filterExams(val) {
  const t = val.toLowerCase();
  renderExams(t ? allExams.filter(e => (e.title||'').toLowerCase().includes(t)) : allExams);
}

async function openExamModal(id) {
  _examEditId = id;
  _examSelQuestions = [];
  document.getElementById('exm-title').textContent = id ? 'Edit Exam' : 'Create Exam';
  document.getElementById('exm-id').value = id || '';
  document.getElementById('exm-name').value = '';
  document.getElementById('exm-desc').value = '';
  document.getElementById('exm-duration').value = '';
  document.getElementById('exm-pass').value = '';
  document.getElementById('exm-active').value = 'true';
  document.getElementById('exm-q-search').value = '';

  // Ensure questions are loaded
  if (!allExamQuestions.length) await loadExamQuestions();

  if (id) {
    const exam = allExams.find(e => e.id === id);
    if (exam) {
      document.getElementById('exm-name').value     = exam.title || '';
      document.getElementById('exm-desc').value     = exam.description || '';
      document.getElementById('exm-duration').value = exam.duration_min || '';
      document.getElementById('exm-pass').value     = exam.pass_marks || '';
      document.getElementById('exm-active').value   = String(exam.is_active !== false);
      // Load existing question map
      const { data: mapData } = await sb.from('exam_question_map')
        .select('question_id, sort_order')
        .eq('exam_id', id)
        .order('sort_order', { ascending: true });
      if (mapData) {
        mapData.forEach(m => {
          const q = allExamQuestions.find(x => x.id === m.question_id);
          if (q) _examSelQuestions.push(q);
        });
      }
    }
  }

  renderExamPicker(allExamQuestions);
  renderExamSelList();
  openModal('modal-exam');
}

function renderExamPicker(list) {
  const container = document.getElementById('exm-q-list');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;font-size:12px;color:var(--text-dim);">No questions in the bank. Add questions first.</div>';
    return;
  }
  container.innerHTML = list.map(q => {
    const isSel = _examSelQuestions.some(s => s.id === q.id);
    const snippet = q.question.length > 80 ? q.question.slice(0,80)+'…' : q.question;
    const catName = eqCategories.find(c => c.id === q.category_id)?.name || '';
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
      .filter(Boolean).map((o,i)=>`${'ABCDE'[i]}: ${o.length>18?o.slice(0,18)+'…':o}`).join('  ·  ');
    return `<div class="eq-picker-item ${isSel?'selected-q':''}" id="epick-${q.id}" onclick="toggleExamQuestion(${q.id})">
      <div class="eq-pick-check">${isSel?'✓':''}</div>
      <div style="flex:1;min-width:0;">
        <div class="eq-pick-q">${snippet}${catName ? ` <span style="font-size:10px;background:var(--blue-light);color:var(--blue-dark);padding:1px 6px;border-radius:8px;margin-left:4px;">${catName}</span>` : ''}</div>
        <div class="eq-pick-opts">${opts}</div>
      </div>
    </div>`;
  }).join('');
}

function filterExamPicker(val) {
  const t = val.toLowerCase();
  renderExamPicker(t ? allExamQuestions.filter(q =>
    (q.question||'').toLowerCase().includes(t)
  ) : allExamQuestions);
}

function toggleExamQuestion(qId) {
  const q = allExamQuestions.find(x => x.id === qId);
  if (!q) return;
  const idx = _examSelQuestions.findIndex(s => s.id === qId);
  if (idx >= 0) {
    _examSelQuestions.splice(idx, 1);
  } else {
    _examSelQuestions.push(q);
  }
  // Update picker item appearance
  const el = document.getElementById('epick-' + qId);
  if (el) {
    const isSel = _examSelQuestions.some(s => s.id === qId);
    el.classList.toggle('selected-q', isSel);
    el.querySelector('.eq-pick-check').textContent = isSel ? '✓' : '';
  }
  renderExamSelList();
}

function renderExamSelList() {
  const list = document.getElementById('exm-q-selected-list');
  const count = document.getElementById('exm-q-count');
  if (!list) return;
  count.textContent = _examSelQuestions.length;
  if (!_examSelQuestions.length) { list.innerHTML = ''; return; }
  list.innerHTML = _examSelQuestions.map((q, i) => {
    const snippet = q.question.length > 60 ? q.question.slice(0,60)+'…' : q.question;
    return `<div class="eq-sel-row">
      <div class="eq-sel-row-num">${i+1}</div>
      <div style="flex:1;min-width:0;font-size:12px;">${snippet}</div>
      <button class="eq-sel-remove" onclick="toggleExamQuestion(${q.id})" title="Remove">×</button>
    </div>`;
  }).join('');
}

async function saveExam() {
  const id        = document.getElementById('exm-id').value;
  const title     = document.getElementById('exm-name').value.trim();
  const duration  = parseInt(document.getElementById('exm-duration').value) || 0;
  const passMarks = parseInt(document.getElementById('exm-pass').value) || 0;
  const isActive  = document.getElementById('exm-active').value === 'true';

  if (!title)              { toast('Exam title is required', 'error'); return; }
  if (!duration)           { toast('Duration is required', 'error'); return; }
  if (!_examSelQuestions.length) { toast('Select at least one question', 'error'); return; }

  const payload = {
    title,
    description:     document.getElementById('exm-desc').value.trim() || null,
    duration_min:    duration,
    pass_marks:      passMarks,
    total_questions: _examSelQuestions.length,
    is_active:       isActive,
  };

  const btn = document.querySelector('#modal-exam .btn-primary');
  btn.disabled = true;

  let examId = id ? parseInt(id) : null;
  let error;

  if (id) {
    ({ error } = await sb.from('exams').update(payload).eq('id', id));
    examId = parseInt(id);
  } else {
    const { data: newExam, error: insertErr } = await sb.from('exams').insert(payload).select().single();
    error = insertErr;
    if (newExam) examId = newExam.id;
  }

  if (error) { btn.disabled = false; toast('Error: ' + error.message, 'error'); return; }

  // Replace question map
  if (id) await sb.from('exam_question_map').delete().eq('exam_id', examId);
  if (_examSelQuestions.length && examId) {
    const mapRows = _examSelQuestions.map((q, i) => ({
      exam_id: examId,
      question_id: q.id,
      sort_order: i,
    }));
    const { error: mapErr } = await sb.from('exam_question_map').insert(mapRows);
    if (mapErr) { btn.disabled = false; toast('Error saving questions: ' + mapErr.message, 'error'); return; }
  }

  btn.disabled = false;
  closeModal('modal-exam');
  toast(id ? 'Exam updated!' : 'Exam created!', 'success');
  await loadExams();
}

async function deleteExam(id) {
  if (!confirm('Delete this exam? All student submissions for this exam will also be deleted.')) return;
  await sb.from('exam_submissions').delete().eq('exam_id', id);
  await sb.from('exam_question_map').delete().eq('exam_id', id);
  const { error } = await sb.from('exams').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  toast('Exam deleted', 'success');
  await loadExams();
}

/* ── Exam Results ── */
let allExamResults = [];

async function loadExamResults() {
  // Load exams list for filter dropdown
  if (!allExams.length) await loadExams();

  const { data, error } = await sb.from('exam_submissions')
    .select('*, exams(title)')
    .order('submitted_at', { ascending: false });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  allExamResults = data || [];
  // Also load user info where possible
  renderExamResults(allExamResults);
}

function renderExamResults(list) {
  const tbody = document.getElementById('er-tbody');
  const count = document.getElementById('er-count');
  if (!tbody) return;
  count.textContent = list.length + ' result' + (list.length !== 1 ? 's' : '');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">No exam submissions yet.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r => {
    const examTitle = r.exams?.title || 'Exam #' + r.exam_id;
    const total = r.total_questions || '—';
    const score = r.score !== null ? r.score : '—';
    const pct   = (r.score !== null && r.total_questions) ? Math.round((r.score / r.total_questions) * 100) : null;
    const passed = r.passed;
    const submittedDate = r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—';
    const studentId = (r.user_id || '').slice(0,8) + '…';
    return `<tr>
      <td style="font-size:12px;color:var(--text-dim);" title="${r.user_id||''}">${studentId}</td>
      <td style="font-weight:600;font-size:13px;">${examTitle}</td>
      <td>${score}/${total}${pct !== null ? ` <span style="font-size:11px;color:var(--text-dim);">(${pct}%)</span>` : ''}</td>
      <td><span class="badge ${passed ? 'badge-green' : 'badge-red'}">${passed ? '✓ Passed' : '✗ Failed'}</span></td>
      <td style="font-size:12px;color:var(--text-dim);">${submittedDate}</td>
      <td><div class="action-btns">
        <button class="btn-icon btn-view" onclick="viewExamResult(${r.id})" title="View Details">👁</button>
        <button class="btn-icon btn-delete" onclick="deleteExamResult(${r.id})">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

function filterExamResults() {
  const examFilter = document.getElementById('er-exam-filter')?.value || '';
  const searchVal  = document.querySelector('#pv-exam-results .search-box input')?.value.toLowerCase() || '';
  let filtered = allExamResults;
  if (examFilter) filtered = filtered.filter(r => String(r.exam_id) === examFilter);
  if (searchVal) filtered = filtered.filter(r =>
    (r.user_id||'').toLowerCase().includes(searchVal) ||
    (r.exams?.title||'').toLowerCase().includes(searchVal)
  );
  renderExamResults(filtered);
}

async function viewExamResult(submissionId) {
  const sub = allExamResults.find(r => r.id === submissionId);
  if (!sub) return;

  // Load the full exam questions with correct answers
  const { data: mapData } = await sb.from('exam_question_map')
    .select('question_id, sort_order')
    .eq('exam_id', sub.exam_id)
    .order('sort_order', { ascending: true });

  let questions = [];
  if (mapData?.length) {
    const qIds = mapData.map(m => m.question_id);
    const { data: qData } = await sb.from('exam_questions').select('*').in('id', qIds);
    if (qData) {
      // preserve sort order
      questions = mapData.map(m => qData.find(q => q.id === m.question_id)).filter(Boolean);
    }
  }

  const answers = sub.answers || {};
  const examTitle = sub.exams?.title || 'Exam';
  const pct = (sub.score !== null && sub.total_questions) ? Math.round((sub.score / sub.total_questions) * 100) : 0;
  const passed = sub.passed;

  const body = document.getElementById('erd-body');
  body.innerHTML = `
    <div class="result-score-box ${passed ? 'passed' : ''}">
      <div class="rs-score">${sub.score ?? '—'}<span style="font-size:24px;opacity:.7;">/${sub.total_questions||'?'}</span></div>
      <div class="rs-total">${examTitle} · ${pct}%</div>
      <div class="rs-badge">${passed ? '✅ PASSED' : '❌ FAILED'}</div>
    </div>
    ${questions.map((q, i) => {
      const userAns = answers[String(q.id)];
      const isCorrect = userAns === q.correct_option;
      const optKeys = ['a','b','c','d','e'];
      const optVals = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e];
      const optionsHtml = optKeys.map((k, idx) => {
        if (!optVals[idx]) return '';
        const isCorrectOpt = k === q.correct_option;
        const isUserOpt    = k === userAns;
        let cls = 'result-opt';
        if (isCorrectOpt) cls += ' correct';
        else if (isUserOpt && !isCorrect) cls += ' wrong';
        return `<div class="${cls}">
          <div class="result-opt-lbl">${'ABCDE'[idx]}</div>
          <div style="flex:1;">${optVals[idx]}</div>
          ${isCorrectOpt ? '<span style="font-size:11px;font-weight:700;margin-left:auto;">✓ Correct</span>' : ''}
          ${isUserOpt && !isCorrect ? '<span style="font-size:11px;font-weight:700;margin-left:auto;">✗ Your answer</span>' : ''}
        </div>`;
      }).join('');
      return `<div class="result-q-item">
        <div class="result-q-head">
          <div class="result-q-num">${i+1}</div>
          <div style="flex:1;">
            <div>${q.question}</div>
            ${q.description ? `<div style="font-size:11px;color:var(--text-dim);margin-top:3px;">${q.description}</div>` : ''}
          </div>
          <span class="badge ${isCorrect ? 'badge-green' : 'badge-red'}" style="flex-shrink:0;">${isCorrect ? '+1' : '0'}</span>
        </div>
        <div class="result-q-body">
          ${optionsHtml}
          ${q.answer_description ? `<div class="result-answer-desc">💡 ${q.answer_description}</div>` : ''}
          ${q.video_url ? `<button class="result-video-btn" onclick="window.open('${q.video_url}','_blank')">▶ Watch Video Solution</button>` : ''}
        </div>
      </div>`;
    }).join('')}`;

  openModal('modal-exam-result');
}

async function deleteExamResult(id) {
  if (!confirm('Delete this submission record?')) return;
  const { error } = await sb.from('exam_submissions').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  toast('Result deleted', 'success');
  await loadExamResults();
}

/* ══════════════════════════════════════════════
   BLOG MANAGEMENT
══════════════════════════════════════════════ */
let _adminBlogs = [];

async function loadAdminBlogs() {
  const { data } = await sb.from('blogs').select('*').order('created_at', { ascending: false });
  _adminBlogs = data || [];
  const tbody = document.getElementById('blog-tbody');
  const count = document.getElementById('blog-count');
  if (!tbody) return;
  const fmt = d => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  count.textContent = `1-${_adminBlogs.length} of ${_adminBlogs.length}`;
  tbody.innerHTML = _adminBlogs.length ? _adminBlogs.map(b => `
    <tr>
      <td><strong>${b.title}</strong><div style="font-size:11px;color:var(--text-dim);margin-top:2px;">${b.excerpt||''}</div></td>
      <td><span class="badge badge-purple" style="font-size:11px;">${b.tag||'—'}</span></td>
      <td>${b.author||'—'}</td>
      <td>${b.read_time||'—'} min</td>
      <td>${b.is_published ? '<span class="badge badge-green">Published</span>' : '<span class="badge badge-gray">Draft</span>'}</td>
      <td>${fmt(b.created_at)}</td>
      <td><div class="action-btns">
        <button class="btn-icon btn-edit" onclick="editBlog(${b.id})">✎</button>
        <button class="btn-icon btn-delete" onclick="deleteBlog(${b.id})">🗑</button>
      </div></td>
    </tr>`).join('')
  : '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-dim)">No blog posts yet. Click + to add.</td></tr>';
}

function openBlogModal(blog) {
  document.getElementById('blog-edit-id').value    = blog?.id || '';
  document.getElementById('blog-title').value      = blog?.title || '';
  document.getElementById('blog-tag').value        = blog?.tag || '';
  document.getElementById('blog-author').value     = blog?.author || '';
  document.getElementById('blog-emoji').value      = blog?.emoji || '📖';
  document.getElementById('blog-readtime').value   = blog?.read_time || '5';
  document.getElementById('blog-excerpt').value    = blog?.excerpt || '';
  document.getElementById('blog-content').value    = blog?.content || '';
  document.getElementById('blog-published').value  = blog?.is_published !== false ? 'true' : 'false';
  document.getElementById('blog-modal-head').textContent = blog ? 'Edit Blog Post' : 'Add Blog Post';
  openModal('modal-blog');
}

function editBlog(id) {
  const b = _adminBlogs.find(x => x.id === id);
  if (b) openBlogModal(b);
}

async function saveBlog() {
  const id      = document.getElementById('blog-edit-id').value;
  const payload = {
    title:        document.getElementById('blog-title').value.trim(),
    tag:          document.getElementById('blog-tag').value.trim() || null,
    author:       document.getElementById('blog-author').value.trim() || 'Merito Team',
    emoji:        document.getElementById('blog-emoji').value.trim() || '📖',
    read_time:    parseInt(document.getElementById('blog-readtime').value) || 5,
    excerpt:      document.getElementById('blog-excerpt').value.trim() || null,
    content:      document.getElementById('blog-content').value.trim(),
    is_published: document.getElementById('blog-published').value === 'true',
  };
  if (!payload.title || !payload.content) { toast('Title and content are required', 'error'); return; }
  const { error } = id
    ? await sb.from('blogs').update(payload).eq('id', id)
    : await sb.from('blogs').insert(payload);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  closeModal('modal-blog');
  await loadAdminBlogs();
  toast('Blog post saved ✅', 'success');
}

async function deleteBlog(id) {
  if (!confirm('Delete this blog post? This cannot be undone.')) return;
  await sb.from('blogs').delete().eq('id', id);
  await loadAdminBlogs();
  toast('Blog post deleted', '');
}

/* ══════════════════════════════════════════════
   BOOKS MANAGEMENT
══════════════════════════════════════════════ */
let _adminBooks = [];

async function loadAdminBooks() {
  const { data } = await sb.from('books').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  _adminBooks = data || [];
  const tbody = document.getElementById('books-tbody');
  const count = document.getElementById('books-count');
  if (!tbody) return;
  count.textContent = `1-${_adminBooks.length} of ${_adminBooks.length}`;
  tbody.innerHTML = _adminBooks.length ? _adminBooks.map(b => `
    <tr>
      <td><span style="font-size:18px;">${b.emoji||'📚'}</span> <strong>${b.title}</strong></td>
      <td>${b.author||'—'}</td>
      <td>৳${Number(b.price||0).toLocaleString()}</td>
      <td>${b.file_url ? `<a href="${b.file_url}" target="_blank" style="color:var(--purple);font-size:12px;">📥 Link</a>` : '<span style="color:var(--text-dim);font-size:12px;">Paid only</span>'}</td>
      <td>${b.is_published ? '<span class="badge badge-green">Published</span>' : '<span class="badge badge-gray">Draft</span>'}</td>
      <td><div class="action-btns">
        <button class="btn-icon btn-edit" onclick="editBook(${b.id})">✎</button>
        <button class="btn-icon btn-delete" onclick="deleteBook(${b.id})">🗑</button>
      </div></td>
    </tr>`).join('')
  : '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim)">No books yet. Click + to add.</td></tr>';
}

function openBookModal(book) {
  document.getElementById('book-edit-id').value   = book?.id || '';
  document.getElementById('book-title').value     = book?.title || '';
  document.getElementById('book-author').value    = book?.author || '';
  document.getElementById('book-price').value     = book?.price || '';
  document.getElementById('book-emoji').value     = book?.emoji || '📚';
  document.getElementById('book-category').value  = book?.category || '';
  document.getElementById('book-desc').value      = book?.description || '';
  document.getElementById('book-fileurl').value   = book?.file_url || '';
  document.getElementById('book-published').value = book?.is_published !== false ? 'true' : 'false';
  document.getElementById('book-sort').value      = book?.sort_order || 0;
  document.getElementById('book-modal-head').textContent = book ? 'Edit Book' : 'Add Book';
  openModal('modal-book');
}

function editBook(id) {
  const b = _adminBooks.find(x => x.id === id);
  if (b) openBookModal(b);
}

async function saveBook() {
  const id      = document.getElementById('book-edit-id').value;
  const payload = {
    title:        document.getElementById('book-title').value.trim(),
    author:       document.getElementById('book-author').value.trim() || 'Merito Team',
    price:        parseFloat(document.getElementById('book-price').value) || 0,
    emoji:        document.getElementById('book-emoji').value.trim() || '📚',
    category:     document.getElementById('book-category').value.trim() || null,
    description:  document.getElementById('book-desc').value.trim() || null,
    file_url:     document.getElementById('book-fileurl').value.trim() || null,
    is_published: document.getElementById('book-published').value === 'true',
    sort_order:   parseInt(document.getElementById('book-sort').value) || 0,
  };
  if (!payload.title) { toast('Title is required', 'error'); return; }
  const { error } = id
    ? await sb.from('books').update(payload).eq('id', id)
    : await sb.from('books').insert(payload);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  closeModal('modal-book');
  await loadAdminBooks();
  toast('Book saved ✅', 'success');
}

async function deleteBook(id) {
  if (!confirm('Delete this book?')) return;
  await sb.from('books').delete().eq('id', id);
  await loadAdminBooks();
  toast('Book deleted', '');
}

/* ══ INIT ══ */
nav('dashboard');
