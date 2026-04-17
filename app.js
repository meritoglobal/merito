/* ══════════════════════════════════════════════
   SUPABASE CONFIG
   ▶ REPLACE the two lines below with YOUR keys
     from supabase.com → Settings → API
══════════════════════════════════════════════ */
const SUPABASE_URL = 'https://bpjfrdfvvcvxocigqjyl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwamZyZGZ2dmN2eG9jaWdxanlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NzAwOTMsImV4cCI6MjA5MTI0NjA5M30.UVIK_l8z1FybbGy08PwBbbg7G6_i8hMMkhoARKUNIp4';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── App state ── */
let currentUser = null;
let COURSES = [];
let ALL_CATEGORIES = []; // all categories including admin-added ones with no courses yet
let ALL_INSTRUCTORS = []; // all instructors loaded from DB
let activeCart = []; // [{courseId, title, price, icon, orderId}]
let currentCourseId = null;
let activePaymentMethod = 'bkash';
let _pendingCourseId = null;    // course to add-to-cart after login
let _loginReturnState = null;  // { page, courseId } — page user was on before login redirect
let _cartKeyCounter = 0;    // unique key for each cart item
let _paySettings = {
  bkash_instructions: 'Send the total amount to our bKash Merchant number: 01XXXXXXXXX\nPlease include your full name as a reference.',
  nagad_instructions:  'Send the total amount to our Nagad Merchant number: 01XXXXXXXXX\nPlease include your full name as a reference.',
  bank_instructions:   'Bank: Dutch-Bangla Bank\nAccount Name: Merito Global\nAccount No: XXXX-XXXX-XXXX\nBranch: Dhaka Main\nAfter transfer, enter the reference number below.'
};

/* ── On page load ── */
window.addEventListener('DOMContentLoaded', async () => {
  go('home'); // show navbar immediately

  // Restore session directly from localStorage — instant, no network, same
  // approach the admin panel uses. Supabase stores the session under a known key.
  try {
    const _lsKey = 'sb-' + SUPABASE_URL.replace('https://','').split('.')[0] + '-auth-token';
    const _stored = JSON.parse(localStorage.getItem(_lsKey) || 'null');
    if (_stored?.user && !currentUser) {
      currentUser = _stored.user;
      updateNavUI(true);
      loadNotifications();
    }
  } catch(e) {}

  await Promise.all([loadSiteText(), loadCourses()]);
});

/* ── Ocoya-style scroll-shrink navbar ── */
function _applyNavScroll() {
  const wrap = document.getElementById('main-nav-wrap');
  if (!wrap) return;
  wrap.classList.toggle('scrolled', window.scrollY > 50);
}
window.addEventListener('scroll', _applyNavScroll, { passive: true });
document.addEventListener('scroll', _applyNavScroll, { passive: true });

/* ── Load site text from site_settings ── */
async function loadSiteText() {
  const { data } = await sb.from('site_settings').select('key,value');
  if (!data) return;
  const map = {};
  data.forEach(r => { map[r.key] = r.value; });

  // Helper: set textContent if value exists
  function st(id, val, attr) {
    const el = document.getElementById('st-' + id);
    if (!el || !val) return;
    if (attr === 'placeholder') { el.placeholder = val; }
    else { el.textContent = val; }
  }

  st('hero_title',             map.hero_title);
  st('hero_subtitle',          map.hero_subtitle);
  st('hero_btn1',              map.hero_btn1);
  st('hero_btn2',              map.hero_btn2);
  st('hero_search_placeholder',map.hero_search_placeholder, 'placeholder');
  st('hero_search_btn',        map.hero_search_btn);

  // Hero video
  if (map.hero_video_url) {
    const vid = extractYTId(map.hero_video_url);
    const iframe = document.getElementById('hero-video');
    if (vid && iframe) iframe.src = `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1`;
  }

  st('stat1_num',   map.stat1_num);   st('stat1_label', map.stat1_label);
  st('stat2_num',   map.stat2_num);   st('stat2_label', map.stat2_label);
  st('stat3_num',   map.stat3_num);   st('stat3_label', map.stat3_label);
  st('stat4_num',   map.stat4_num);   st('stat4_label', map.stat4_label);

  st('courses_label',   map.courses_label);
  st('courses_heading', map.courses_heading);
  st('courses_sub',     map.courses_sub);
  st('featured_label',  map.featured_label);
  st('featured_heading',map.featured_heading);
  st('featured_sub',    map.featured_sub);
  st('viewall_btn',     map.viewall_btn);

  st('about_label',   map.about_label);
  st('about_heading', map.about_heading);
  st('about_body',    map.about_body);
  st('about_btn',     map.about_btn);

  // About video
  if (map.homepage_video_url) {
    const vid = extractYTId(map.homepage_video_url);
    const iframe = document.getElementById('homepage-video');
    if (vid && iframe) iframe.src = `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1`;
  }

  st('testi_label',   map.testi_label);
  st('testi_heading', map.testi_heading);
  st('testi_sub',     map.testi_sub);
  ['1','2','3'].forEach(n => {
    if (map['testi'+n+'_name']) {
      st('testi'+n+'_name',   map['testi'+n+'_name']);
      st('testi'+n+'_result', map['testi'+n+'_result']);
      st('testi'+n+'_text',   map['testi'+n+'_text']);
      // Update initials avatar
      const initEl = document.getElementById('st-testi'+n+'_initials');
      if (initEl && map['testi'+n+'_name']) {
        const parts = map['testi'+n+'_name'].trim().split(/\s+/);
        initEl.textContent = (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
      }
    }
  });

  st('app_label',     map.app_label);
  st('app_heading',   map.app_heading);
  st('app_sub',       map.app_sub);
  st('app_downloads', map.app_downloads);

  st('footer_tagline',   map.footer_tagline);
  st('footer_addr1',     map.footer_addr1);
  st('footer_addr2',     map.footer_addr2);
  st('footer_addr3',     map.footer_addr3);
  st('footer_copyright', map.footer_copyright);
  if (map.footer_email) {
    const emailEl = document.getElementById('st-footer_email');
    if (emailEl) { emailEl.textContent = map.footer_email; emailEl.href = 'mailto:'+map.footer_email; }
  }

  // Payment settings
  if (map.bkash_instructions) _paySettings.bkash_instructions = map.bkash_instructions;
  if (map.nagad_instructions)  _paySettings.nagad_instructions  = map.nagad_instructions;
  if (map.bank_instructions)   _paySettings.bank_instructions   = map.bank_instructions;
  // Re-render current payment info if payment page is open
  const info = document.getElementById('pm-info');
  if (info) _renderPayInfo(activePaymentMethod);
}

function extractYTId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

/* ── Auth state listener ── */
sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'INITIAL_SESSION') {
    // Page refresh — restore session silently, never navigate away
    if (!session) return; // not logged in
    currentUser = session.user;
    upsertProfile(currentUser); // fire-and-forget, don't block
    updateNavUI(true);
    loadNotifications();

  } else if (event === 'SIGNED_IN') {
    currentUser = session.user;
    await upsertProfile(currentUser);
    updateNavUI(true);
    loadNotifications();
    const complete = await checkProfileComplete(currentUser);
    if (!complete) { showProfileSetup(currentUser); return; }
    _redirectAfterLogin();

  } else if (event === 'TOKEN_REFRESHED') {
    currentUser = session.user;
    updateNavUI(true);

  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    activeCart = [];
    updateNavUI(false);
    _clearBell();
    go('home');
  }
});

/* ── Check if user profile is fully complete ── */
async function checkProfileComplete(user) {
  if (!user) return false;
  try {
    const { data: profile } = await sb.from('profiles').select('full_name,phone,has_password').eq('id', user.id).single();
    // Accept has_password from profiles table OR user_metadata (legacy fallback)
    const hasPassword = !!(profile?.has_password || user.user_metadata?.has_password);
    return !!(profile?.full_name && profile?.phone && hasPassword);
  } catch(e) {
    // If has_password column doesn't exist yet, fall back to simpler check
    const { data: profile } = await sb.from('profiles').select('full_name,phone').eq('id', user.id).single();
    const hasPassword = !!(user.user_metadata?.has_password);
    return !!(profile?.full_name && profile?.phone && hasPassword);
  }
}

/* ── Show forced profile setup page ── */
function showProfileSetup(user) {
  const meta = user.user_metadata || {};
  document.getElementById('reg-email-display').value = user.email || '';
  document.getElementById('reg-name').value  = meta.full_name || meta.name || '';
  document.getElementById('reg-phone').value = meta.phone || '';
  document.getElementById('reg-pass').value  = '';
  document.getElementById('reg-pass2').value = '';
  document.getElementById('reg-error').style.display = 'none';
  go('register');
}

/* ── Upsert user into profiles table ── */
async function upsertProfile(user) {
  if (!user) return;
  const meta = user.user_metadata || {};
  const payload = {
    id:         user.id,
    email:      user.email,
    full_name:  meta.full_name || meta.name || user.email.split('@')[0],
    phone:      meta.phone || null,
    avatar_url: meta.avatar_url || meta.picture || null,
  };
  const { error } = await sb.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) console.warn('Profile upsert failed:', error.message);
}

/* ══════════════════════════════════════════════
   NOTIFICATION SYSTEM
══════════════════════════════════════════════ */
let _notifData    = [];
let _notifPanelOpen = false;
let _notifReadSet   = new Set(JSON.parse(localStorage.getItem('notif_read')||'[]'));

function _saveReadSet() {
  localStorage.setItem('notif_read', JSON.stringify([..._notifReadSet]));
}

async function loadNotifications() {
  if (!currentUser) return;
  const userEmail = currentUser.email;

  // Get course IDs this user is enrolled in (to match course-targeted notifications)
  const { data: enrollData } = await sb
    .from('course_enrollments')
    .select('course_id')
    .eq('user_email', userEmail);
  const enrolledCourseIds = (enrollData||[]).map(r => r.course_id);

  // Fetch all active notifications
  const { data: notifs } = await sb
    .from('notifications')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!notifs) return;

  // Filter: show if audience=all, OR audience=course_users AND user is enrolled in that course
  _notifData = notifs.filter(n => {
    if (n.audience === 'all') return true;
    if (n.audience === 'course_users' && n.course_id && enrolledCourseIds.includes(n.course_id)) return true;
    return false;
  });

  renderNotifPanel();
  updateBellBadge();
}

function renderNotifPanel() {
  const listEl = document.getElementById('notif-list');
  if (!listEl) return;
  if (!_notifData.length) {
    listEl.innerHTML = '<div class="notif-empty">No notifications yet</div>';
    return;
  }
  listEl.innerHTML = _notifData.map(n => {
    const isRead  = _notifReadSet.has(n.id);
    const timeAgo = _timeAgo(n.created_at);
    const linkHtml = n.action_url
      ? `<a class="notif-msg-link" href="${n.action_url}" target="_blank">Open link →</a>`
      : '';
    return `<div class="notif-item${isRead?'':' unread'}" id="nitem-${n.id}" onclick="markOneRead(${n.id})">
      <div class="notif-dot"></div>
      <div class="notif-body">
        <div class="notif-msg-title">${n.title}</div>
        <div class="notif-msg-body">${n.body||''}</div>
        ${linkHtml}
        <div class="notif-time">${timeAgo}</div>
      </div>
    </div>`;
  }).join('');
}

function updateBellBadge() {
  const unread = _notifData.filter(n => !_notifReadSet.has(n.id)).length;
  const badge  = document.getElementById('bell-badge');
  const bell   = document.getElementById('nav-bell');
  if (!badge || !bell) return;
  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.classList.add('has-notif');
  } else {
    badge.classList.remove('has-notif');
  }
  bell.classList.add('visible');
}

function _clearBell() {
  const bell  = document.getElementById('nav-bell');
  const badge = document.getElementById('bell-badge');
  if (bell)  bell.classList.remove('visible');
  if (badge) badge.classList.remove('has-notif');
  _notifData = [];
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  _notifPanelOpen = !_notifPanelOpen;
  panel.classList.toggle('open', _notifPanelOpen);
}

// Close panel when clicking outside
document.addEventListener('click', e => {
  if (!document.getElementById('notif-bell-wrap')?.contains(e.target)) {
    document.getElementById('notif-panel')?.classList.remove('open');
    _notifPanelOpen = false;
  }
});

function markOneRead(id) {
  _notifReadSet.add(id);
  _saveReadSet();
  document.getElementById('nitem-'+id)?.classList.remove('unread');
  const dot = document.querySelector('#nitem-'+id+' .notif-dot');
  if (dot) dot.style.opacity = '0';
  updateBellBadge();
}

function markAllRead() {
  _notifData.forEach(n => _notifReadSet.add(n.id));
  _saveReadSet();
  document.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
  document.querySelectorAll('.notif-dot').forEach(el => el.style.opacity='0');
  updateBellBadge();
}

function _timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return d + ' day' + (d>1?'s':'') + ' ago';
  if (h > 0) return h + ' hr' + (h>1?'s':'') + ' ago';
  if (m > 0) return m + ' min ago';
  return 'Just now';
}

/* ══════════════════════════════════════════════
   LOAD COURSES FROM SUPABASE
══════════════════════════════════════════════ */
async function loadCourses() {
  // Fetch courses, site_settings, and instructors in parallel
  const [{ data, error }, { data: settings }, { data: instrData }] = await Promise.all([
    sb.from('courses').select('*').eq('is_active', true),
    sb.from('site_settings').select('key,value'),
    sb.from('instructors').select('*').order('created_at', {ascending:true})
  ]);
  ALL_INSTRUCTORS = instrData || [];

  const getVal = key => settings?.find(r => r.key === key)?.value;

  if (error || !data || data.length === 0) {
    COURSES = [
      {id:1,cat:'iba',catName:'IBA MBA',title:'IBA MBA Admission 2026',instructor:'M. Hasanuzzaman',lessons:60,rating:'4.9',price:2500,oldPrice:4000,icon:'📊',badge:'Bestseller',desc:'Complete IBA MBA admission preparation with 60+ lessons, mock tests and mentor Q&A.'},
      {id:2,cat:'ielts',catName:'IELTS Prep',title:'IELTS Hero — Complete Course',instructor:'S. Rahman',lessons:80,rating:'4.8',price:3000,oldPrice:5000,icon:'📝',badge:'New',desc:'Full IELTS preparation covering Listening, Reading, Writing & Speaking with mock tests.'},
      {id:3,cat:'vocab',catName:'Vocabulary',title:'Mnemonic Vocabulary Mastery',instructor:'R. Ahmed',lessons:45,rating:'4.7',price:1200,oldPrice:2000,icon:'💬',badge:'',desc:'Master 3000+ English words using memory-based mnemonic techniques.'},
      {id:4,cat:'hsc',catName:'HSC 2026',title:'HSC 2026 Complete Prep',instructor:'HSC Team',lessons:100,rating:'4.9',price:1800,oldPrice:3000,icon:'📚',badge:'Popular',desc:'Comprehensive HSC 2026 preparation for all subjects with board exam practice.'},
      {id:5,cat:'iba',catName:'IBA MBA',title:'IBA BUP BBA Admission 2026',instructor:'M. Karim',lessons:55,rating:'4.8',price:2200,oldPrice:3500,icon:'🎓',badge:'',desc:'Strategic preparation for IBA BUP BBA admission examination.'},
      {id:6,cat:'iba',catName:'IBA MBA',title:'IBA Question Bank',instructor:'Merito Team',lessons:40,rating:'4.9',price:800,oldPrice:1500,icon:'📋',badge:'Bestseller',desc:'10 years of IBA previous year question papers with detailed solutions.'},
      {id:7,cat:'hsc',catName:'HSC 2026',title:'HSC Physics Master Class',instructor:'Dr. Kamal',lessons:70,rating:'4.8',price:1500,oldPrice:2500,icon:'⚛️',badge:'',desc:'HSC Physics with shortcut techniques and problem-solving approaches.'},
      {id:8,cat:'abroad',catName:'Go Abroad',title:'Study Abroad Consultation',instructor:'Global Team',lessons:20,rating:'4.9',price:5000,oldPrice:8000,icon:'✈️',badge:'New',desc:'Personalized guidance for studying in UK, Canada, Australia and Germany.'},
    ];
    // Derive ALL_CATEGORIES from fallback courses
    const seenFb = {};
    ALL_CATEGORIES = [];
    COURSES.forEach(c => {
      if (!seenFb[c.cat]) { seenFb[c.cat]=1; ALL_CATEGORIES.push({cat:c.cat, name:c.catName}); }
    });
  } else {
    COURSES = data.map(c => {
      let cats = [c.cat];
      try { if (c.extra_cats) cats = JSON.parse(c.extra_cats); } catch(e) {}
      let instructorIds = [];
      try { if (c.course_instructors) instructorIds = JSON.parse(c.course_instructors); } catch(e) {}
      let learnPoints = [];
      try { if (c.learn_points) learnPoints = JSON.parse(c.learn_points); } catch(e) {}
      let descBlocks = [];
      try { if (c.course_description_blocks) descBlocks = JSON.parse(c.course_description_blocks); } catch(e) {}
      let curriculum = [];
      try { if (c.curriculum) curriculum = JSON.parse(c.curriculum); } catch(e) {}
      let includesItems = [];
      try { if (c.includes_items) includesItems = JSON.parse(c.includes_items); } catch(e) {}
      let featuresItems = [];
      try { if (c.features_items) featuresItems = JSON.parse(c.features_items); } catch(e) {}
      return {
        id: c.id, cat: c.cat, catName: c.cat_name, cats,
        title: c.title, instructor: c.instructor,
        instructorIds,
        lessons: c.lessons, rating: String(c.rating),
        price: c.price, oldPrice: c.old_price,
        icon: c.icon, badge: c.badge || '', desc: c.description,
        introVideo: c.intro_video_url || '',
        learnPoints, descBlocks, curriculum,
        enrolledBase: c.enrolled_base || 0,
        reviewCount:  c.review_count  || 0,
        includesItems, featuresItems
      };
    });

    // Apply admin-saved course order
    try {
      const orderVal = getVal('course_order');
      if (orderVal) {
        const order = JSON.parse(orderVal);
        COURSES.sort((a,b) => {
          const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
          return (ai===-1?999:ai) - (bi===-1?999:bi);
        });
      }
    } catch(e) {}

    // Build ALL_CATEGORIES: course-derived + admin-added extra_categories, in admin-defined order
    try {
      const seen = {};
      const cats = [];
      COURSES.forEach(c => {
        if (!seen[c.cat]) { seen[c.cat]=1; cats.push({cat:c.cat, name:c.catName}); }
      });
      const extrasVal = getVal('extra_categories');
      if (extrasVal) {
        JSON.parse(extrasVal).forEach(e => {
          if (!seen[e.cat]) { seen[e.cat]=1; cats.push({cat:e.cat, name:e.cat_name}); }
        });
      }
      const catOrderVal = getVal('category_order');
      if (catOrderVal) {
        const order = JSON.parse(catOrderVal);
        cats.sort((a,b) => {
          const ai = order.indexOf(a.cat), bi = order.indexOf(b.cat);
          return (ai===-1?999:ai) - (bi===-1?999:bi);
        });
      }
      ALL_CATEGORIES = cats;
    } catch(e) {
      // Fallback: just derive from courses
      const seen = {};
      ALL_CATEGORIES = [];
      COURSES.forEach(c => {
        if (!seen[c.cat]) { seen[c.cat]=1; ALL_CATEGORIES.push({cat:c.cat, name:c.catName}); }
      });
    }
  }

  renderAllCourseGrids();

  // Apply video settings
  if (settings) {
    const heroRow  = settings.find(r => r.key === 'hero_video_url');
    const aboutRow = settings.find(r => r.key === 'homepage_video_url');
    if (heroRow?.value) {
      const vid = extractYouTubeId(heroRow.value);
      const heroIframe = document.getElementById('hero-video');
      if (vid && heroIframe) heroIframe.src = `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1`;
    }
    if (aboutRow?.value) {
      const vid = extractYouTubeId(aboutRow.value);
      const aboutIframe = document.getElementById('homepage-video');
      if (vid && aboutIframe) aboutIframe.src = `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1`;
    }
  }
}

function renderAllCourseGrids() {
  const hg = document.getElementById('home-grid');
  const pg = document.getElementById('prof-grid');
  if (hg) hg.innerHTML = COURSES.slice(0,4).map(courseCard).join('');
  if (pg) pg.innerHTML = COURSES.slice(0,2).map(courseCard).join('');
  // Build dynamic filter buttons + dropdown from real course data
  buildCourseFilters();
  buildCourseDropdown();
  applyCourseView();
}

/* ══════════════════════════════════════════════
   AUTH FLOW
   Existing user : email → password → home
   New user      : email → OTP → profile setup
══════════════════════════════════════════════ */
let _authEmail   = '';
let _otpTimerRef = null;

// ── Step 1: Email submit — check if existing or new user ──
async function handleEmailSubmit() {
  const email  = document.getElementById('login-email').value.trim().toLowerCase();
  const errBox = document.getElementById('login-error');
  errBox.style.display = 'none';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errBox.textContent = 'Please enter a valid email address.';
    errBox.style.display = 'block'; return;
  }

  const btn = document.getElementById('btn-email-continue');
  btn.textContent = 'Checking…'; btn.disabled = true;

  // Check if email already exists in profiles (10s timeout guard)
  let profile = null;
  try {
    const _timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
    const { data } = await Promise.race([
      sb.from('profiles').select('id').eq('email', email).maybeSingle(),
      _timeout
    ]);
    profile = data;
  } catch (e) {
    btn.textContent = 'Continue'; btn.disabled = false;
    errBox.textContent = e.message === 'timeout'
      ? 'Connection timed out — please check your internet and try again.'
      : (e.message || 'Something went wrong. Please try again.');
    errBox.style.display = 'block'; return;
  }

  btn.textContent = 'Continue'; btn.disabled = false;
  _authEmail = email;

  if (profile) {
    // Existing user → show password step
    document.getElementById('login-email-display').textContent = email;
    document.getElementById('login-step-email').style.display = 'none';
    document.getElementById('login-step-pass').style.display  = 'block';
    document.getElementById('login-pass-error').style.display = 'none';
    document.getElementById('login-pass').value = '';
    setTimeout(() => document.getElementById('login-pass').focus(), 100);
  } else {
    // New user → send OTP
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      errBox.textContent = error.message || 'Failed to send code. Try again.';
      errBox.style.display = 'block'; return;
    }
    document.getElementById('verify-email-display').textContent = email;
    document.querySelectorAll('#otp-row .otp-input').forEach(i => i.value = '');
    document.getElementById('verify-error').style.display = 'none';
    go('verify');
    _startOTPTimer(120);
    setTimeout(() => { const f = document.querySelector('#otp-row .otp-input'); if(f) f.focus(); }, 200);
  }
}

function _loginBackToEmail() {
  document.getElementById('login-step-pass').style.display  = 'none';
  document.getElementById('login-step-email').style.display = 'block';
  document.getElementById('login-pass').value = '';
}

// ── Password login (existing users) ──
async function handlePasswordLogin() {
  const pass   = document.getElementById('login-pass').value;
  const errBox = document.getElementById('login-pass-error');
  errBox.style.display = 'none';

  if (!pass) {
    errBox.textContent = 'Please enter your password.';
    errBox.style.display = 'block'; return;
  }

  const btn = document.getElementById('btn-password-login');
  btn.textContent = 'Signing in…'; btn.disabled = true;

  const { error } = await sb.auth.signInWithPassword({ email: _authEmail, password: pass });

  btn.textContent = 'Sign In'; btn.disabled = false;

  if (error) {
    errBox.textContent = 'Wrong password. Please try again.';
    errBox.style.display = 'block'; return;
  }
  // onAuthStateChange SIGNED_IN will handle the redirect
}

// ── Step 2: OTP Verify ──
async function handleVerifyOTP() {
  const inputs = document.querySelectorAll('#otp-row .otp-input');
  const token  = Array.from(inputs).map(i => i.value.trim()).join('');
  const errBox = document.getElementById('verify-error');
  errBox.style.display = 'none';

  if (token.length < 6) {
    errBox.textContent = 'Enter the 6-digit code sent to your email.';
    errBox.style.display = 'block'; return;
  }

  const btn = document.getElementById('btn-verify-otp');
  btn.textContent = 'Verifying…'; btn.disabled = true;

  const { data, error } = await sb.auth.verifyOtp({
    email: _authEmail,
    token,
    type: 'email'
  });

  btn.textContent = 'Verify & Continue'; btn.disabled = false;

  if (error) {
    errBox.textContent = error.message || 'Invalid or expired code. Try again.';
    errBox.style.display = 'block'; return;
  }

  // OTP verified — session is now active
  if (_otpTimerRef) clearInterval(_otpTimerRef);
  currentUser = data.user;
  await upsertProfile(currentUser);
  updateNavUI(true);
  loadNotifications();
  // Profile completeness check handles both new and returning users
  const complete = await checkProfileComplete(currentUser);
  if (!complete) {
    showProfileSetup(currentUser);
    setTimeout(() => { const n = document.getElementById('reg-name'); if(n) n.focus(); }, 200);
  } else {
    _redirectAfterLogin();
    toast('Welcome back!', 'success');
  }
}

// ── Step 3: Profile setup (new users) ──
async function handleProfileSetup() {
  const name   = document.getElementById('reg-name').value.trim();
  const phone  = document.getElementById('reg-phone').value.trim();
  const pass   = document.getElementById('reg-pass').value;
  const pass2  = document.getElementById('reg-pass2').value;
  const errBox = document.getElementById('reg-error');
  errBox.style.display = 'none';

  if (!name) {
    errBox.textContent = 'Please enter your full name.';
    errBox.style.display = 'block'; return;
  }
  if (!phone) {
    errBox.textContent = 'Phone number is required.';
    errBox.style.display = 'block'; return;
  }
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

  // Check phone uniqueness
  const { data: existingPhone } = await sb.from('profiles')
    .select('id').eq('phone', phone).neq('id', currentUser?.id || '').maybeSingle();
  if (existingPhone) {
    errBox.textContent = 'This phone number is already linked to another account.';
    errBox.style.display = 'block'; return;
  }

  const btn = document.querySelector('#page-register .btn-auth');
  btn.textContent = 'Saving…'; btn.disabled = true;

  // Set password + mark has_password in metadata
  const { error: pwErr } = await sb.auth.updateUser({
    password: pass,
    data: { full_name: name, phone, has_password: true }
  });
  if (pwErr) {
    btn.textContent = 'Complete Setup'; btn.disabled = false;
    errBox.textContent = pwErr.message || 'Failed to set password.';
    errBox.style.display = 'block'; return;
  }

  // Upsert profile with name + phone + has_password flag
  const { data: { user } } = await sb.auth.getUser();
  currentUser = user;
  await sb.from('profiles').upsert({
    id: currentUser.id,
    email: currentUser.email,
    full_name: name,
    phone: phone,
    has_password: true,
  }, { onConflict: 'id' });

  btn.textContent = 'Complete Setup'; btn.disabled = false;
  updateNavUI(true);
  _redirectAfterLogin();
  toast('Welcome to Merito!', 'success');
}

// ── Resend OTP ──
async function handleResendOTP() {
  const link = document.getElementById('resend-link');
  if (!_authEmail || link.style.pointerEvents === 'none') return;

  link.style.pointerEvents = 'none'; link.style.opacity = '.5';
  await sb.auth.signInWithOtp({ email: _authEmail, options: { shouldCreateUser: true } });
  document.querySelectorAll('#otp-row .otp-input').forEach(i => i.value = '');
  document.getElementById('verify-error').style.display = 'none';
  _startOTPTimer(120);
  toast('Code resent!', 'success');
}

function _startOTPTimer(secs) {
  if (_otpTimerRef) clearInterval(_otpTimerRef);
  const timerEl  = document.getElementById('otp-timer');
  const resendEl = document.getElementById('resend-link');
  resendEl.style.pointerEvents = 'none';
  resendEl.style.opacity = '.5';

  let remaining = secs;
  const tick = () => {
    const m = String(Math.floor(remaining / 60)).padStart(2,'0');
    const s = String(remaining % 60).padStart(2,'0');
    timerEl.textContent = `(${m}:${s})`;
    if (remaining <= 0) {
      clearInterval(_otpTimerRef);
      timerEl.textContent = '';
      resendEl.style.pointerEvents = 'auto';
      resendEl.style.opacity = '1';
    }
    remaining--;
  };
  tick();
  _otpTimerRef = setInterval(tick, 1000);
}

function togglePwVis(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

// ── Login step visibility helper ──
function _showLoginStep(step) {
  const steps = ['email','pass','fp-otp','fp-newpass'];
  steps.forEach(s => {
    const el = document.getElementById('login-step-' + s);
    if (el) el.style.display = (s === step) ? 'block' : 'none';
  });
}

// ── Forgot Password: Step C — send OTP ──
let _fpTimerRef = null;
async function handleForgotPassword(isResend) {
  if (!_authEmail) {
    // If called from outside password step, grab email from input
    _authEmail = document.getElementById('login-email')?.value?.trim().toLowerCase() || '';
  }
  if (!_authEmail) {
    toast('Please enter your email first.', 'error'); return;
  }

  if (!isResend) {
    // Show Step C
    _showLoginStep('fp-otp');
    const disp = document.getElementById('fp-email-display');
    if (disp) disp.textContent = _authEmail;
    document.querySelectorAll('#fp-otp-row .otp-input').forEach(i => i.value = '');
    document.getElementById('fp-otp-error').style.display = 'none';
    setTimeout(() => { const f = document.querySelector('#fp-otp-row .otp-input'); if(f) f.focus(); }, 200);
  }

  const { error } = await sb.auth.signInWithOtp({ email: _authEmail, options: { shouldCreateUser: false } });
  if (error) {
    const errBox = document.getElementById('fp-otp-error');
    errBox.textContent = error.message || 'Failed to send code. Try again.';
    errBox.style.display = 'block'; return;
  }

  _startFPTimer(120);
  if (isResend) toast('Code resent!', 'success');
}

// ── Forgot Password: Step C — verify OTP ──
async function handleFPVerifyOTP() {
  const inputs = document.querySelectorAll('#fp-otp-row .otp-input');
  const token  = Array.from(inputs).map(i => i.value.trim()).join('');
  const errBox = document.getElementById('fp-otp-error');
  errBox.style.display = 'none';

  if (token.length < 6) {
    errBox.textContent = 'Enter the 6-digit code sent to your email.';
    errBox.style.display = 'block'; return;
  }

  const btn = document.getElementById('btn-fp-verify');
  btn.textContent = 'Verifying…'; btn.disabled = true;

  const { data, error } = await sb.auth.verifyOtp({
    email: _authEmail,
    token,
    type: 'email'
  });

  btn.textContent = 'Verify Code'; btn.disabled = false;

  if (error) {
    errBox.textContent = error.message || 'Invalid or expired code. Try again.';
    errBox.style.display = 'block'; return;
  }

  // OTP verified — user is now logged in
  if (_fpTimerRef) clearInterval(_fpTimerRef);
  currentUser = data.user;
  await upsertProfile(currentUser);
  updateNavUI(true);

  // Show Step D (set new password)
  _showLoginStep('fp-newpass');
  document.getElementById('fp-new-pass').value  = '';
  document.getElementById('fp-new-pass2').value = '';
  document.getElementById('fp-newpass-error').style.display = 'none';
  setTimeout(() => document.getElementById('fp-new-pass').focus(), 150);
}

// ── Forgot Password: Step D — set new password ──
async function handleFPSetPassword() {
  const pass   = document.getElementById('fp-new-pass').value;
  const pass2  = document.getElementById('fp-new-pass2').value;
  const errBox = document.getElementById('fp-newpass-error');
  errBox.style.display = 'none';

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

  const btn = document.querySelector('#login-step-fp-newpass .btn-auth:first-of-type');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  const { error } = await sb.auth.updateUser({ password: pass, data: { has_password: true } });
  if (btn) { btn.textContent = 'Set New Password'; btn.disabled = false; }

  if (error) {
    errBox.textContent = error.message || 'Failed to update password. Try again.';
    errBox.style.display = 'block'; return;
  }

  // Sync has_password to profiles table + check completeness
  if (currentUser) {
    const { data: profile } = await sb.from('profiles').select('full_name,phone').eq('id', currentUser.id).single();
    await sb.from('profiles').update({ has_password: true }).eq('id', currentUser.id);
    if (!profile?.full_name || !profile?.phone) {
      showProfileSetup(currentUser); return;
    }
  }
  _redirectAfterLogin();
  toast('Password updated! Welcome back.', 'success');
}

// ── Forgot Password: Step D — skip password change ──
function handleFPSkip() {
  if (currentUser) {
    checkProfileComplete(currentUser).then(complete => {
      if (!complete) { showProfileSetup(currentUser); }
      else { go('home'); toast('Welcome back!', 'success'); }
    });
  } else {
    go('home');
  }
}

// ── FP timer (separate from main OTP timer) ──
function _startFPTimer(secs) {
  if (_fpTimerRef) clearInterval(_fpTimerRef);
  const timerEl  = document.getElementById('fp-otp-timer');
  const resendEl = document.getElementById('fp-resend-link');
  resendEl.style.pointerEvents = 'none';
  resendEl.style.opacity = '.5';

  let remaining = secs;
  const tick = () => {
    const m = String(Math.floor(remaining / 60)).padStart(2,'0');
    const s = String(remaining % 60).padStart(2,'0');
    timerEl.textContent = `(${m}:${s})`;
    if (remaining <= 0) {
      clearInterval(_fpTimerRef);
      timerEl.textContent = '';
      resendEl.style.pointerEvents = 'auto';
      resendEl.style.opacity = '1';
    }
    remaining--;
  };
  tick();
  _fpTimerRef = setInterval(tick, 1000);
}

/* ══════════════════════════════════════════════
   GOOGLE LOGIN
══════════════════════════════════════════════ */
async function handleGoogleLogin() {
  // Build correct redirect URL — works for GitHub Pages (/merito/) and local file
  const loc = window.location;
  let redirectTo;
  if (loc.protocol === 'file:') {
    redirectTo = 'http://localhost:3000';
  } else {
    // Use the current page URL without hash/query, e.g. https://meritoglobal.github.io/merito/index.html
    redirectTo = loc.origin + loc.pathname;
  }
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) alert('Google login failed: ' + error.message);
}

/* ══════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════ */
async function handleLogout() {
  // Clear state immediately so UI updates without waiting for network
  currentUser = null;
  activeCart  = [];
  updateNavUI(false);
  // Clear the localStorage session key directly (same key our restore reads from)
  try {
    const _lsKey = 'sb-' + SUPABASE_URL.replace('https://','').split('.')[0] + '-auth-token';
    localStorage.removeItem(_lsKey);
  } catch(e) {}
  go('home');
  // Sign out from Supabase in background
  sb.auth.signOut().catch(() => {});
}

/* ══════════════════════════════════════════════
   REDIRECT AFTER LOGIN
══════════════════════════════════════════════ */
function _redirectAfterLogin() {
  // 1. User was trying to add a course to cart — open that course detail
  if (_pendingCourseId) {
    const id = _pendingCourseId;
    _pendingCourseId = null;
    _loginReturnState = null;
    if (COURSES.length) openCourse(id); // openCourse already calls go('detail')
    else loadCourses().then(() => COURSES.length ? openCourse(id) : go('courses'));
    return;
  }
  // 2. User was on a specific page — return them there
  if (_loginReturnState) {
    const { page: rp, courseId: rc } = _loginReturnState;
    _loginReturnState = null;
    if (rp === 'detail' && rc) {
      if (COURSES.length) openCourse(rc);
      else loadCourses().then(() => COURSES.length ? openCourse(rc) : go('courses'));
    } else {
      go(rp);
    }
    return;
  }
  // 3. Default
  go('home');
}

/* ══════════════════════════════════════════════
   CART — Add course to cart
══════════════════════════════════════════════ */
async function addToCartAndGo(courseId) {
  if (!currentUser) {
    _pendingCourseId = courseId; // remember which course they wanted
    go('login'); return;
  }
  const c = COURSES.find(x => x.id === courseId);
  if (!c) return;
  const already = activeCart.find(x => x.courseId === courseId);
  if (!already) {
    // Save to DB as 'cart' status so admin can track abandoned carts
    let orderId = null;
    try {
      const { data: newOrder } = await sb.from('orders').insert({
        user_id: currentUser.id, course_id: c.id, amount: c.price,
        payment_method: 'pending', status: 'cart',
        order_ref: 'CART-' + Date.now()
      }).select('id').single();
      orderId = newOrder?.id || null;
    } catch(e) { /* non-critical */ }
    activeCart.push({ cartKey: 'c_' + (++_cartKeyCounter), courseId: c.id, title: c.title, price: c.price, icon: c.icon, type: 'course', orderId });
  }
  renderCart();
  go('cart');
}

/* ─ Add a book to cart ─ */
function addBookToCart(title, price, icon) {
  if (!currentUser) {
    _pendingCourseId = null; // no specific course to redirect to
    go('login'); return;
  }
  const cartKey = 'b_' + (++_cartKeyCounter);
  const already = activeCart.find(x => x.type === 'book' && x.title === title);
  if (!already) {
    activeCart.push({ cartKey, courseId: null, title, price, icon: icon || '📚', type: 'book', orderId: null });
    toast(title + ' added to cart!', 'success');
  } else {
    toast('Already in cart!', 'success');
  }
  renderCart();
  go('cart');
}

/* ─ Called when user clicks Proceed to Payment ─ */
async function proceedToPayment() {
  // Mark all cart items as 'almost_bought'
  const ids = activeCart.map(i => i.orderId).filter(Boolean);
  if (ids.length) {
    try { await sb.from('orders').update({ status: 'almost_bought' }).in('id', ids); } catch(e) {}
  }
  go('payment');
}

function updateCartBadge() {
  const badge = document.getElementById('nav-cart-badge');
  if (!badge) return;
  const n = activeCart.length;
  if (n === 0) { badge.style.display = 'none'; return; }
  badge.style.display = 'flex';
  badge.textContent = n > 99 ? '99+' : n;
}

function renderCart() {
  updateCartBadge();
  const container  = document.getElementById('cart-items-container');
  const countLabel = document.getElementById('cart-count-label');
  const totalEl    = document.getElementById('cart-total');
  const subtotalEl = document.getElementById('cart-subtotal');
  const proceedBtn = document.getElementById('cart-proceed-btn');
  if (!container) return;

  const n = activeCart.length;
  if (countLabel) countLabel.textContent = n ? `(${n} item${n > 1 ? 's' : ''})` : '';

  if (n === 0) {
    container.innerHTML = `
      <div style="padding:60px 0;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">🛒</div>
        <p style="color:var(--text-dim);font-size:15px;margin-bottom:12px;">Your cart is empty.</p>
        <a onclick="go('courses')" style="color:var(--text-acc);cursor:pointer;font-size:14px;font-weight:600;">Browse Courses →</a>
        <span style="margin:0 12px;color:var(--text-dim);">•</span>
        <a onclick="go('books')" style="color:var(--text-acc);cursor:pointer;font-size:14px;font-weight:600;">Browse Books →</a>
      </div>`;
    if (totalEl)    totalEl.textContent    = '৳0';
    if (subtotalEl) subtotalEl.textContent = '৳0';
    if (proceedBtn) proceedBtn.style.display = 'none';
    return;
  }

  const total = activeCart.reduce((s, i) => s + i.price, 0);
  container.innerHTML = activeCart.map(item => `
    <div class="cart-item">
      <div class="cart-thumb">${item.icon}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.title}</div>
        <span class="cart-item-badge">${item.type === 'book' ? '📚 Book' : '🎓 Course'}</span>
      </div>
      <div class="cart-item-price">৳${item.price.toLocaleString()}</div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.cartKey}')" title="Remove">×</button>
    </div>`).join('');

  if (totalEl)    totalEl.textContent    = '৳' + total.toLocaleString();
  if (subtotalEl) subtotalEl.textContent = '৳' + total.toLocaleString();
  if (proceedBtn) proceedBtn.style.display = '';
}

function removeFromCart(cartKey) {
  activeCart = activeCart.filter(x => x.cartKey !== cartKey);
  renderCart();
}

/* ══════════════════════════════════════════════
   PAYMENT CONFIRM — Save order to Supabase
══════════════════════════════════════════════ */
async function handlePaymentConfirm() {
  if (!currentUser) { go('login'); return; }

  const txnId = document.getElementById('txn-id') ? document.getElementById('txn-id').value.trim() : '';
  if (!txnId) { alert('Please enter your Transaction ID.'); return; }
  if (activeCart.length === 0) { alert('Your cart is empty!'); return; }

  const btn = document.querySelector('#page-payment .btn-confirm');
  btn.textContent = 'Submitting…'; btn.disabled = true;

  const orderRef = 'MBD-' + Date.now();

  // Try to update existing tracked order IDs first (cart → pending)
  const trackedIds = activeCart.map(i => i.orderId).filter(Boolean);
  let error;
  if (trackedIds.length === activeCart.length && trackedIds.length > 0) {
    // All items have DB order IDs — update them
    const res = await sb.from('orders').update({
      payment_method: activePaymentMethod,
      transaction_id: txnId,
      status: 'pending',
      order_ref: orderRef
    }).in('id', trackedIds);
    error = res.error;
  } else {
    // Fallback: insert new rows (e.g. user refreshed and lost cart state)
    const rows = activeCart.map(item => ({
      user_id: currentUser.id, course_id: item.courseId, amount: item.price,
      payment_method: activePaymentMethod, transaction_id: txnId,
      status: 'pending', order_ref: orderRef
    }));
    const res = await sb.from('orders').insert(rows);
    error = res.error;
  }

  btn.textContent = 'Confirm Payment'; btn.disabled = false;

  if (error) {
    alert('Something went wrong. Please try again or contact support.');
    console.error(error); return;
  }

  activeCart = []; // clear cart after order placed
  go('order-track');
  loadOrderHistory();
}

/* ══════════════════════════════════════════════
   ORDER HISTORY
══════════════════════════════════════════════ */
async function loadOrderHistory() {
  if (!currentUser) return;

  const list   = document.getElementById('order-track-list');
  const banner = document.getElementById('order-track-banner');
  if (!list) return;

  list.innerHTML = '<p style="color:var(--text-dim);font-size:14px;padding:20px 0;">Loading…</p>';
  if (banner) banner.style.display = 'none';

  // Load orders + actual enrollments in parallel
  const [ordersRes, enrollRes] = await Promise.all([
    sb.from('orders').select('*, courses(title, icon)').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
    sb.from('course_enrollments').select('course_id').eq('user_email', currentUser.email)
  ]);

  const orders      = ordersRes.data || [];
  const enrolledIds = new Set((enrollRes.data || []).map(e => String(e.course_id)));

  // Skip cart-only entries (user never paid)
  const visible = orders.filter(o => o.status !== 'cart');

  if (!visible.length) {
    list.innerHTML = '<p style="color:var(--text-dim);font-size:14px;padding:20px 0;">No orders yet.</p>';
    return;
  }

  const fmt = d => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

  list.innerHTML = visible.map(o => {
    // Enrollment check takes priority over order status
    const isEnrolled = enrolledIds.has(String(o.course_id));
    let label, cls;
    if (isEnrolled) {
      label = '✓ Enrolled'; cls = 'status-ok';
    } else {
      switch (o.status) {
        case 'verified':      label = '✓ Payment Verified'; cls = 'status-ok';   break;
        case 'almost_bought': label = '💳 Payment Submitted'; cls = 'status-wait'; break;
        case 'pending':       label = '⏳ Under Review';      cls = 'status-wait'; break;
        case 'rejected':      label = '✗ Rejected';          cls = 'status-bad';  break;
        default:              label = '⏳ Pending';           cls = 'status-wait';
      }
    }
    return `
    <div class="order-step-row">
      <div class="order-step-icon">${o.courses?.icon || '📚'}</div>
      <div class="order-step-info">
        <div class="order-step-title">${o.courses?.title || 'Course'}</div>
        <div class="order-step-sub">Order #${o.order_ref || o.id} • ${fmt(o.created_at)} • ৳${Number(o.amount||0).toLocaleString()}</div>
      </div>
      <span class="order-status ${cls}">${label}</span>
    </div>`;
  }).join('');

  // Show relevant banner based on highest-priority status
  if (banner) {
    const hasEnrolled  = visible.some(o => enrolledIds.has(String(o.course_id)) || o.status === 'verified');
    const hasRejected  = visible.some(o => o.status === 'rejected');
    const hasPending   = visible.some(o => ['almost_bought','pending'].includes(o.status));

    if (hasEnrolled) {
      banner.style.display = 'block';
      banner.innerHTML = `<div style="background:rgba(0,196,94,0.08);border:1px solid rgba(0,196,94,0.25);border-radius:8px;padding:18px;">
        <div style="font-size:14px;font-weight:800;color:#00C25E;margin-bottom:6px;">✓ Payment Received</div>
        <p style="font-size:13px;color:var(--text-mid);margin:0;">Your payment has been verified. Access your enrolled courses from <span onclick="go('profile')" style="color:var(--text-acc);cursor:pointer;">My Profile → My Courses</span>.</p></div>`;
    } else if (hasRejected) {
      banner.style.display = 'block';
      banner.innerHTML = `<div style="background:rgba(255,60,60,0.08);border:1px solid rgba(255,60,60,0.25);border-radius:8px;padding:18px;">
        <div style="font-size:14px;font-weight:800;color:#ff6b6b;margin-bottom:6px;">✗ Order Rejected</div>
        <p style="font-size:13px;color:var(--text-mid);margin:0;">One or more orders were rejected. Please contact support or re-submit your payment.</p></div>`;
    } else if (hasPending) {
      banner.style.display = 'block';
      banner.innerHTML = `<div style="background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.25);border-radius:8px;padding:18px;">
        <div style="font-size:14px;font-weight:800;color:#ffa500;margin-bottom:6px;">⏳ Under Review</div>
        <p style="font-size:13px;color:var(--text-mid);margin:0;">Your payment is being reviewed. You'll receive access once verified — usually within a few hours.</p></div>`;
    }
  }
}

/* ══════════════════════════════════════════════
   PROFILE
══════════════════════════════════════════════ */
async function loadProfileData() {
  if (!currentUser) return;

  const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (profile) {
    const nameEl  = document.querySelector('.profile-name');
    const emailEl = document.querySelector('.profile-email');
    const avEl    = document.querySelector('.profile-av');
    if (nameEl)  nameEl.textContent  = profile.full_name || 'Student';
    if (emailEl) emailEl.textContent = profile.email || currentUser.email || '';
    if (avEl)    avEl.textContent    = (profile.full_name || 'ST').slice(0,2).toUpperCase();
  }

  // Load enrolled courses via course_enrollments (uses user_email)
  const userEmail = currentUser.email;
  const { data: enrollments } = await sb
    .from('course_enrollments')
    .select('course_id')
    .eq('user_email', userEmail);

  const pg = document.getElementById('prof-grid');
  if (!pg) return;

  if (!enrollments || enrollments.length === 0) {
    pg.innerHTML = '<p style="color:var(--text-dim);font-size:14px;grid-column:1/-1;">You have no enrolled courses yet. <a onclick="go(\'courses\')" style="color:var(--text-acc);cursor:pointer;">Browse courses →</a></p>';
    return;
  }

  const enrolledIds = enrollments.map(e => e.course_id);
  const { data: coursesData } = await sb.from('courses').select('*').in('id', enrolledIds);
  if (!coursesData) { pg.innerHTML = '<p style="color:var(--text-dim);grid-column:1/-1;">Could not load courses.</p>'; return; }

  pg.innerHTML = coursesData.map(c => {
    const mapped = {
      id: c.id, cat: c.cat, catName: c.cat_name, title: c.title,
      instructor: c.instructor, lessons: c.lessons, rating: String(c.rating||'5.0'),
      price: c.price, oldPrice: c.old_price, icon: c.icon || '📚', badge: c.badge || '', desc: c.description
    };
    return enrolledCourseCard(mapped);
  }).join('');
}

/* ══════════════════════════════════════════════
   COURSE PLAYER
══════════════════════════════════════════════ */
let _cpCourseId = null;
let _cpItems    = [];   // flat list of all content items
let _cpCompleted = {};  // { itemId: true }

async function openCoursePlayer(courseId) {
  _cpCourseId  = courseId;
  _cpCompleted = JSON.parse(localStorage.getItem('cp_done_'+courseId) || '{}');

  // Set course title immediately while loading
  const known = [...(window.COURSES||[])];
  const c = known.find(x => x.id == courseId);
  document.getElementById('cp-course-title').textContent = c ? c.title : 'Course';

  // Navigate to the player page
  history.pushState({ page: 'learn', courseId }, '', '#learn/' + courseId);
  go('course-player', true); // skip go()'s own history push

  // Reset viewer
  document.getElementById('cp-viewer').innerHTML = `
    <div class="cp-viewer-inner" id="cp-viewer-placeholder">
      <div>
        <div class="cp-viewer-icon">⏳</div>
        <div class="cp-viewer-label">Loading course content…</div>
        <div class="cp-viewer-sub">Please wait</div>
      </div>
    </div>`;
  document.getElementById('cp-info').style.display = 'none';
  document.getElementById('cp-sidebar-list').innerHTML =
    '<div class="cp-empty"><div class="cp-empty-icon">📂</div><div style="font-size:14px;">Loading…</div></div>';

  await loadCourseContent(courseId);
}

async function loadCourseContent(courseId) {
  // Fetch course info for title
  const { data: courseRow } = await sb.from('courses').select('title').eq('id', courseId).single();
  if (courseRow) document.getElementById('cp-course-title').textContent = courseRow.title;

  // Fetch content items grouped by section
  const { data: items, error } = await sb
    .from('course_content')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error || !items || items.length === 0) {
    document.getElementById('cp-sidebar-list').innerHTML =
      '<div class="cp-empty"><div class="cp-empty-icon">📭</div><div style="font-size:14px;">No content yet.</div><div style="font-size:12px;margin-top:6px;color:var(--text-dim);">The instructor hasn\'t uploaded lessons yet.</div></div>';
    document.getElementById('cp-viewer').innerHTML = `
      <div class="cp-viewer-inner">
        <div>
          <div class="cp-viewer-icon">📭</div>
          <div class="cp-viewer-label">No lessons available yet</div>
          <div class="cp-viewer-sub">Check back soon — the instructor is preparing content.</div>
        </div>
      </div>`;
    return;
  }

  _cpItems = items;
  document.getElementById('cp-item-count').textContent = items.length + ' item' + (items.length !== 1 ? 's' : '');
  _renderCPSidebar(items);
  _updateCPProgress();

  // Auto-play first item
  _playCPItem(items[0]);
}

function _renderCPSidebar(items) {
  const list = document.getElementById('cp-sidebar-list');
  // Build 3-level tree: section → subsection (or null) → items
  const secMap = new Map(), secOrder = [];
  items.forEach(item => {
    const sl  = item.section_label    || 'Lessons';
    const sub = item.subsection_label || null;
    if (!secMap.has(sl)) { secMap.set(sl, new Map()); secOrder.push(sl); }
    const subMap = secMap.get(sl);
    const subKey = sub || '__direct__';
    if (!subMap.has(subKey)) subMap.set(subKey, []);
    subMap.get(subKey).push(item);
  });

  function _row(item) {
    const done     = !!_cpCompleted[item.id];
    const itype    = item.content_type || 'link';
    const iname    = item.content_name || 'Untitled';
    const meta     = _cpItemMeta(itype);
    const duration = item.duration ? `<span style="font-size:10px;color:var(--cp-muted,#888);margin-left:4px;">${item.duration}</span>` : '';
    const freeBadge= item.is_free   ? `<span style="font-size:9px;font-weight:700;color:#22a;background:rgba(74,0,177,0.1);padding:1px 5px;border-radius:8px;margin-left:4px;">FREE</span>` : '';
    return `<div class="cp-item-row" id="cprow-${item.id}" onclick="_playCPById('${item.id}')">
      <div class="cp-irow-icon t-${itype}">${meta.icon}</div>
      <div class="cp-irow-body">
        <div class="cp-irow-name">${iname}${freeBadge}</div>
        <div class="cp-irow-type">${meta.label}${duration}</div>
      </div>
      <div class="cp-irow-check ${done?'done':''}">${done?'✓':''}</div>
    </div>`;
  }

  let html = '';
  secOrder.forEach(sl => {
    const subMap = secMap.get(sl);
    html += `<div class="cp-section-head">${sl}</div>`;
    // Direct items first
    if (subMap.has('__direct__')) subMap.get('__direct__').forEach(i => { html += _row(i); });
    // Then subsections
    subMap.forEach((subItems, subKey) => {
      if (subKey === '__direct__') return;
      html += `<div style="padding:6px 14px 2px;font-size:11px;font-weight:700;color:var(--primary);opacity:.75;letter-spacing:.04em;">${subKey}</div>`;
      subItems.forEach(i => { html += _row(i); });
    });
  });
  list.innerHTML = html;
}

function _cpItemMeta(type) {
  switch(type) {
    case 'video':   return { icon: '▶', label: 'Video' };
    case 'pdf':     return { icon: '📄', label: 'PDF' };
    case 'picture': return { icon: '🖼', label: 'Image' };
    case 'link':    return { icon: '🔗', label: 'Link' };
    default:        return { icon: '📌', label: type || 'Content' };
  }
}

function _playCPById(id) {
  const item = _cpItems.find(x => String(x.id) === String(id));
  if (item) _playCPItem(item);
}

function _playCPItem(item) {
  // Update URL to reflect the specific lesson
  history.replaceState({ page: 'learn', courseId: _cpCourseId, itemId: item.id }, '',
    '#learn/' + _cpCourseId + '/' + item.id);

  // Mark active in sidebar
  document.querySelectorAll('.cp-item-row').forEach(r => r.classList.remove('active-item'));
  const row = document.getElementById('cprow-' + item.id);
  if (row) { row.classList.add('active-item'); row.scrollIntoView({ block: 'nearest' }); }

  // Mark as completed
  _cpCompleted[item.id] = true;
  localStorage.setItem('cp_done_' + _cpCourseId, JSON.stringify(_cpCompleted));
  _updateCPProgress();
  if (row) { const chk = row.querySelector('.cp-irow-check'); if (chk) { chk.classList.add('done'); chk.textContent = '✓'; } }

  // Normalise field names (admin uses content_type/content_name, fallback to type/title)
  const itype = item.content_type || item.type || 'link';
  const iname = item.content_name || item.title || 'Untitled';
  const iurl  = item.content_url  || '';

  // Show info strip
  const info = document.getElementById('cp-info');
  info.style.display = 'block';
  document.getElementById('cp-item-title').textContent = iname;
  const meta = _cpItemMeta(itype);
  document.getElementById('cp-item-type').textContent = meta.label;
  document.getElementById('cp-item-desc').textContent  = item.description || '';

  // Show the right panel area, hide all others
  const ytArea   = document.getElementById('cpv-yt-area');
  const pdfArea  = document.getElementById('cpv-pdf-area');
  const viewer   = document.getElementById('cp-viewer');
  const linkCard = document.getElementById('cpv-link-card');
  if (ytArea)   ytArea.style.display   = 'none';
  if (pdfArea)  pdfArea.style.display  = 'none';
  if (viewer)   viewer.style.display   = 'none';
  if (linkCard) { linkCard.style.display = 'none'; linkCard.innerHTML = ''; }

  if (itype === 'video') {
    const videoId = extractYouTubeId(iurl);
    if (ytArea) ytArea.style.display = '';
    if (videoId) {
      _fpLoadYT().then(() => {
        if (_cpYTPlayer && typeof _cpYTPlayer.loadVideoById === 'function') {
          _cpYTPlayer.loadVideoById(videoId);
        } else {
          _cpYTPlayer = new YT.Player('cpv-ytplayer', {
            videoId,
            playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1, origin: location.origin },
            events: {
              onReady(e) { e.target.playVideo(); _cpvStartProgress(); },
              onStateChange: _cpvOnStateChange,
            }
          });
        }
      });
    } else if (ytArea) {
      // Non-YouTube video URL — fall back to iframe
      ytArea.querySelector('#cpv-ytplayer').innerHTML = `<iframe src="${iurl}" allowfullscreen allow="autoplay" style="width:100%;height:100%;border:none;position:absolute;inset:0;"></iframe>`;
    }

  } else if (itype === 'pdf') {
    if (pdfArea) {
      pdfArea.style.display = '';
      document.getElementById('cpv-pdf-iframe').src = iurl || '';
    }

  } else if (itype === 'picture') {
    if (viewer) viewer.style.display = '';
    viewer.innerHTML = iurl
      ? `<div class="cp-viewer-inner" style="background:#0a0214;"><img src="${iurl}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;" alt="${iname}"></div>`
      : `<div class="cp-viewer-inner"><div class="cp-viewer-icon">🖼</div><div class="cp-viewer-label">No image URL</div></div>`;

  } else if (itype === 'link') {
    // Compact strip — no huge viewer box
    const linkCard = document.getElementById('cpv-link-card');
    if (linkCard) {
      linkCard.style.display = '';
      linkCard.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;padding:18px 24px;background:rgba(74,0,177,0.07);border-bottom:1px solid rgba(74,0,177,0.15);">
          <div style="width:38px;height:38px;border-radius:10px;background:rgba(74,0,177,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🔗</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px;">${iname || 'External Link'}</div>
            ${iurl ? `<div style="font-size:12px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${iurl}</div>` : ''}
          </div>
          ${iurl ? `<a href="${iurl}" target="_blank" rel="noopener" style="flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:8px 18px;background:linear-gradient(135deg,#4A00B1,#7B2FBE);color:#fff;font-size:13px;font-weight:700;border-radius:8px;text-decoration:none;white-space:nowrap;">
            Open Link
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>` : ''}
        </div>`;
    }
  } else {
    // Fallback for unknown types
    const linkCard = document.getElementById('cpv-link-card');
    if (linkCard) {
      linkCard.style.display = '';
      linkCard.innerHTML = `<div style="padding:18px 24px;display:flex;align-items:center;gap:12px;background:rgba(74,0,177,0.07);border-bottom:1px solid rgba(74,0,177,0.15);">
        <span style="font-size:22px;">📌</span>
        <div style="font-size:14px;font-weight:600;color:var(--text);">${iname}</div>
        ${item.description ? `<div style="font-size:12px;color:var(--text-dim);">${item.description}</div>` : ''}
      </div>`;
    }
  }
}

function _updateCPProgress() {
  if (!_cpItems.length) return;
  const pct = Math.round(Object.keys(_cpCompleted).length / _cpItems.length * 100);
  document.getElementById('cp-progress-fill').style.width = pct + '%';
  document.getElementById('cp-progress-txt').textContent  = pct + '%';
}

function enrolledCourseCard(c) {
  return `<div class="course-card" onclick="openCoursePlayer(${c.id})" style="cursor:pointer;">
    <div class="course-thumb">
      <div class="course-thumb-inner">
        <div class="course-thumb-emoji">${c.icon}</div>
      </div>
      <div style="position:absolute;top:10px;left:10px;z-index:2;">
        <span class="badge badge-purple" style="background:rgba(74,0,177,0.85);color:#fff;font-size:10px;padding:3px 10px;border-radius:20px;">ENROLLED</span>
      </div>
    </div>
    <div class="course-body">
      <div class="course-cat">${c.catName||''}</div>
      <div class="course-title">${c.title}</div>
      <div class="course-meta"><span>📹 ${c.lessons||0}+ lessons</span><span class="course-rating">★ ${c.rating}</span></div>
      <button class="btn-enroll" style="background:linear-gradient(135deg,#4A00B1,#7B2FBE);margin-top:10px;">▶ Continue Learning</button>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════
   UPDATE NAV BUTTONS based on login state
══════════════════════════════════════════════ */
function updateNavUI(loggedIn) {
  document.querySelectorAll('.nav-cta').forEach(btn => {
    if (loggedIn) {
      btn.textContent = 'My Profile';
      btn.onclick = () => { go('profile'); loadProfileData(); };
    } else {
      btn.textContent = 'Login / Reg.';
      btn.onclick = () => go('login');
    }
  });
}

/* ══════════════════════════════════════════════
   COURSE CARD HTML
══════════════════════════════════════════════ */
function courseCard(c) {
  const badgeHtml = c.badge
    ? `<div style="position:absolute;top:10px;left:10px;z-index:2;"><span class="badge badge-purple">${c.badge}</span></div>`
    : '';
  return `<div class="course-card" onclick="openCourse(${c.id})">
    <div class="course-thumb">
      <div class="course-thumb-inner">
        <div class="course-thumb-emoji">${c.icon}</div>
      </div>
      ${badgeHtml}
    </div>
    <div class="course-body">
      <div class="course-cat">${c.catName}</div>
      <div class="course-title">${c.title}</div>
      <div class="course-meta">
        <span>📹 ${c.lessons}+ lessons</span>
        <span class="course-rating">★ ${c.rating}</span>
      </div>
      <div class="course-price-row">
        <div><span class="price">৳${c.price.toLocaleString()}</span><span class="price-old">৳${c.oldPrice.toLocaleString()}</span></div>
      </div>
      <button class="btn-enroll" onclick="event.stopPropagation();addToCartAndGo(${c.id})">Enroll Now</button>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════
   ROUTING
══════════════════════════════════════════════ */
const _pageHashes = {
  'home': '', 'courses': 'courses', 'books': 'books', 'blogs': 'blogs',
  'login': 'login', 'register': 'register', 'profile': 'profile',
  'cart': 'cart', 'order-track': 'orders', 'payment': 'payment', 'verify': 'verify'
};

function _stopHomeVideos() {
  ['hero-video', 'homepage-video'].forEach(id => {
    const f = document.getElementById(id);
    if (f && f.src) { f.dataset.savedSrc = f.src; f.src = ''; }
  });
}
function _restoreHomeVideos() {
  ['hero-video', 'homepage-video'].forEach(id => {
    const f = document.getElementById(id);
    if (f && f.dataset.savedSrc) { f.src = f.dataset.savedSrc; delete f.dataset.savedSrc; }
  });
}

const _navStack = [];

function goBack() {
  if (_navStack.length === 0) { go('home', false, true); return; }
  const prev = _navStack.pop();
  go(prev, false, true);
}

function _updateBackBtn(page, noNav) {
  const btn = document.getElementById('back-btn');
  if (!btn) return;
  const noBackPages = ['home'];
  const floatPages  = ['login', 'register', 'verify', 'course-player'];
  btn.style.display = noBackPages.includes(page) ? 'none' : 'flex';
  btn.classList.toggle('back-btn-float', floatPages.includes(page));
}

function go(page, _skipHistory, _noStack) {
  if (!_noStack) {
    const cur = document.querySelector('.page.active');
    if (cur) {
      const curId = cur.id.replace('page-', '');
      if (curId !== page) _navStack.push(curId);
    }
  }
  if (page === 'home') _navStack.length = 0;
  if (page === 'home') _restoreHomeVideos(); else _stopHomeVideos();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-'+page);
  if (!el) return;
  el.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(() => { const w = document.getElementById('main-nav-wrap'); if(w) w.classList.remove('scrolled'); }, 50);
  const noNav = ['login', 'register', 'verify'];
  document.getElementById('main-nav-wrap').style.display = noNav.includes(page) ? 'none' : 'block';
  document.getElementById('mob-nav').style.display  = noNav.includes(page) ? 'none' : 'block';
  _updateBackBtn(page, noNav.includes(page));
  setTimeout(() => { el.querySelectorAll('.reveal').forEach(r => r.classList.add('on')); }, 80);
  if (page === 'profile') loadProfileData();
  if (page === 'order-track') loadOrderHistory();
  if (page === 'cart') renderCart();
  if (page === 'payment') _renderPayInfo(activePaymentMethod);
  if (page === 'blogs') loadBlogs();
  if (page === 'books') loadBooks();
  if (page === 'login') {
    // Remember where the user was so we can return after login
    if (!_loginReturnState && !_noStack) {
      const cur = document.querySelector('.page.active');
      if (cur) {
        const curId = cur.id.replace('page-', '');
        if (!['login','register','verify','home'].includes(curId))
          _loginReturnState = { page: curId, courseId: curId === 'detail' ? currentCourseId : null };
      }
    }
    document.getElementById('login-step-email').style.display = 'block';
    document.getElementById('login-step-pass').style.display  = 'none';
    document.getElementById('login-error').style.display      = 'none';
    document.getElementById('login-email').value = '';
  }
  if (page === 'course-player') {
    document.getElementById('main-nav-wrap').style.display = 'none';
    document.getElementById('mob-nav').style.display  = 'none';
  }
  // Update URL for SEO / bookmarking / back-button
  if (!_skipHistory && page in _pageHashes) {
    const hash = _pageHashes[page];
    history.pushState({ page }, '', hash ? '#' + hash : location.pathname + location.search);
  }
}

function openCourse(id) {
  currentCourseId = id;
  history.pushState({ page: 'course', id }, '', '#course/' + id);
  const c = COURSES.find(x => x.id === id);
  if (c) {
    document.getElementById('det-bc').textContent    = c.title;
    document.getElementById('det-title').textContent = c.title;
    document.getElementById('det-desc').textContent  = c.desc;
    document.getElementById('det-price').textContent = c.price.toLocaleString();
    document.getElementById('det-badge').textContent = c.catName;

    // ── Populate hero stats ──
    const _set = (id, txt) => { const el=document.getElementById(id); if(el) el.textContent=txt; };
    _set('det-stat-lessons',  c.lessons ? `📹 ${c.lessons}+ Lessons` : '');
    _set('det-stat-rating',   c.rating  ? `★ ${c.rating}${c.reviewCount ? ` (${c.reviewCount} reviews)` : ''}` : '');
    // fetch actual enrollment count and add to base
    sb.from('course_enrollments').select('id',{count:'exact',head:true}).eq('course_id',c.id)
      .then(({count}) => {
        const total = (c.enrolledBase||0) + (count||0);
        _set('det-stat-enrolled', total ? `👤 ${total.toLocaleString()}+ enrolled` : '');
      });

    // ── Sidebar orig price & discount ──
    const origEl = document.getElementById('det-orig-price');
    const discEl = document.getElementById('det-disc');
    if (origEl) origEl.textContent = c.oldPrice ? `৳${c.oldPrice.toLocaleString()}` : '';
    if (origEl) origEl.style.display = c.oldPrice ? '' : 'none';
    if (discEl && c.oldPrice && c.price < c.oldPrice) {
      const pct = Math.round((c.oldPrice - c.price) / c.oldPrice * 100);
      discEl.textContent = `${pct}% OFF`;
      discEl.style.display = '';
    } else if (discEl) { discEl.style.display = 'none'; }

    // ── Includes bar ──
    const incBar = document.getElementById('det-includes-bar');
    if (incBar && c.includesItems?.length) {
      incBar.innerHTML = c.includesItems.map(item => `<span>${item}</span>`).join('');
    }

    // ── Sidebar features ──
    const featEl = document.getElementById('det-features-list');
    if (featEl && c.featuresItems?.length) {
      featEl.innerHTML = c.featuresItems.map(f => `<li>${f}</li>`).join('');
    }

    // Handle intro video
    const videoWrap = document.getElementById('det-video-wrap');
    const thumbWrap = document.getElementById('det-thumb-wrap');
    const iframe    = document.getElementById('det-video-iframe');

    if (c.introVideo) {
      const videoId = extractYouTubeId(c.introVideo);
      if (videoId) {
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1`;
        videoWrap.style.display = 'block';
        thumbWrap.style.display = 'none';
      } else {
        videoWrap.style.display = 'none';
        thumbWrap.style.display = 'flex';
        thumbWrap.textContent = c.icon;
      }
    } else {
      videoWrap.style.display = 'none';
      thumbWrap.style.display = 'flex';
      thumbWrap.textContent = c.icon;
    }

    // Wire up Add to Cart & Buy Now buttons — check enrollment first
    const addBtn = document.querySelector('#page-detail .detail-sidebar .btn-hero-primary');
    const buyBtn = document.querySelector('#page-detail .detail-sidebar .btn-hero-secondary');
    if (currentUser) {
      sb.from('course_enrollments').select('id').eq('user_email', currentUser.email).eq('course_id', c.id).maybeSingle()
        .then(({ data: enr }) => {
          if (enr) {
            // Already enrolled — show Start Learning
            if (addBtn) { addBtn.textContent = '▶ Start Learning'; addBtn.onclick = () => openCoursePlayer(c.id); }
            if (buyBtn) buyBtn.style.display = 'none';
          } else {
            if (addBtn) addBtn.onclick = () => addToCartAndGo(c.id);
            if (buyBtn) buyBtn.onclick = () => addToCartAndGo(c.id);
          }
        });
    } else {
      if (addBtn) addBtn.onclick = () => addToCartAndGo(c.id);
      if (buyBtn) buyBtn.onclick = () => addToCartAndGo(c.id);
    }

    // ── Render Overview: What You'll Learn ──
    const overviewEl = document.getElementById('dt-overview');
    if (overviewEl) {
      const lp = c.learnPoints || [];
      if (lp.length) {
        overviewEl.innerHTML = `<div class="det-section-hd">What You'll Learn</div>
          <div class="learn-grid">${lp.map(p => `<div class="learn-item"><span class="learn-tick">✓</span>${p}</div>`).join('')}</div>`;
        overviewEl.style.display = 'block';
      } else {
        overviewEl.style.display = 'none';
      }
    }

    // ── Render Course Description Blocks ──
    const descEl = document.getElementById('dt-description');
    if (descEl) {
      const blks = c.descBlocks || [];
      if (blks.length) {
        descEl.innerHTML = `<div class="det-section-hd">Course Description</div>
          ${blks.map(b => b.type === 'highlight'
            ? `<div class="cdesc-block-highlight">${b.text}</div>`
            : `<div class="cdesc-block-text">${b.text}</div>`
          ).join('')}`;
        descEl.style.display = 'block';
      } else {
        descEl.style.display = 'none';
      }
    }

    // ── Render Curriculum (from course_content table) ──
    const currEl = document.getElementById('dt-curriculum');
    if (currEl) {
      currEl.innerHTML = `<div class="det-section-hd">Course Curriculum
        <span style="font-size:13px;color:var(--text-dim);font-weight:500;margin-left:auto;">Loading…</span>
      </div>`;
      currEl.style.display = 'block';
      // Async fetch from course_content
      sb.from('course_content').select('*').eq('course_id', c.id)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true })
        .then(({ data: rows }) => {
          _renderCourseCurriculum(currEl, rows || []);
        });
    }

    // ── Render Instructors ──
    const instTab = document.getElementById('dt-instructor');
    if (instTab) {
      const instructors = (c.instructorIds || [])
        .map(id => ALL_INSTRUCTORS.find(i => i.id === id))
        .filter(Boolean);
      if (!instructors.length && !c.instructor) {
        instTab.style.display = 'none';
      } else {
        instTab.style.display = 'block';
        const instBodyHtml = instructors.length
          ? instructors.map(inst => {
              const avatarHtml = inst.photo_url
                ? `<img src="${inst.photo_url}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
                : `<div class="testi-avatar" style="width:72px;height:72px;font-size:26px;flex-shrink:0;">${inst.name[0].toUpperCase()}</div>`;
              return `<div style="display:flex;gap:18px;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.07);">
                ${avatarHtml}
                <div>
                  <div style="font-size:17px;font-weight:800;color:var(--text);margin-bottom:3px;">${inst.name}</div>
                  ${inst.designation ? `<div style="font-size:13px;color:var(--text-dim);margin-bottom:4px;">${inst.designation}</div>` : ''}
                  ${inst.experience  ? `<div style="font-size:13px;color:var(--text-acc);font-weight:600;">${inst.experience}</div>` : ''}
                </div>
              </div>`;
            }).join('')
          : `<div style="display:flex;gap:16px;align-items:center;">
               <div class="testi-avatar" style="width:64px;height:64px;font-size:22px;">${c.instructor?.[0]||'?'}</div>
               <div><div style="font-size:17px;font-weight:800;color:var(--text);">${c.instructor||''}</div></div>
             </div>`;
        instTab.innerHTML = `<div class="det-section-hd">Instructors</div>${instBodyHtml}`;
      }
    }

    // ── Reset tab highlights ──
    document.querySelectorAll('.detail-tab').forEach((t,i) => t.classList.toggle('active', i===0));
    // Set up scroll spy
    _setupScrollSpy();
  }
  go('detail');
}

function _renderCourseCurriculum(currEl, rows) {
  // Build section → subsection → items tree
  const secMap = new Map(), secOrder = [];
  rows.forEach(row => {
    const sl  = row.section_label    || 'Lessons';
    const sub = row.subsection_label || null;
    if (!secMap.has(sl)) { secMap.set(sl, { subsMap: new Map(), subOrder: [], directItems: [] }); secOrder.push(sl); }
    const sec = secMap.get(sl);
    if (sub) {
      if (!sec.subsMap.has(sub)) { sec.subsMap.set(sub, []); sec.subOrder.push(sub); }
      sec.subsMap.get(sub).push(row);
    } else {
      sec.directItems.push(row);
    }
  });

  // Register free items for the preview player
  window._fpItems = window._fpItems || {};
  rows.forEach(row => { if (row.is_free && row.content_url) window._fpItems[row.id] = row; });

  const typeEmoji = { video:'▶', pdf:'📄', link:'🔗', picture:'🖼️' };

  function _ctRow(item) {
    const em = typeEmoji[item.content_type] || '▶';
    const canPreview = item.is_free && item.content_url;
    return `<div class="curb-content-item${canPreview ? ' fp-free' : ''}"${canPreview ? ` onclick="openFreePreview(${item.id})"` : ''}>
      <div class="curb-ct-icon">${em}</div>
      <span class="curb-ct-name">${item.content_name || 'Untitled'}</span>
      ${item.duration ? `<span class="curb-ct-dur">${item.duration}</span>` : ''}
      ${item.is_free ? `<span class="curb-ct-badge-free">FREE</span>` : `<span class="curb-ct-badge-lock">🔒</span>`}
    </div>`;
  }

  let totalLessons = rows.length;
  let totalSecs = secOrder.length;

  let html = `<div class="det-section-hd">Course Curriculum
    <span style="font-size:13px;color:var(--text-dim);font-weight:500;margin-left:auto;display:flex;gap:14px;">
      <span>${totalSecs} section${totalSecs!==1?'s':''}</span>
      <span>${totalLessons} lesson${totalLessons!==1?'s':''}</span>
    </span>
  </div>`;

  if (!rows.length) {
    html += `<p style="color:var(--text-dim);font-size:14px;padding:8px 0;">Curriculum coming soon.</p>`;
    currEl.innerHTML = html;
    return;
  }

  html += `<div class="curb-outer">`;
  secOrder.forEach((sl, si) => {
    const sec = secMap.get(sl);
    const secTotal = sec.directItems.length + sec.subOrder.reduce((a, sk) => a + sec.subsMap.get(sk).length, 0);
    html += `<div class="curb-web-block open" id="cwb-${si}">
      <div class="curb-web-sec-hd" onclick="toggleCurbSec(${si})">
        <span class="curb-web-sec-title">${sl}</span>
        <span class="curb-web-sec-meta">
          <span class="curb-sec-count">${secTotal} lesson${secTotal!==1?'s':''}</span>
          <span class="curb-arrow">▼</span>
        </span>
      </div>
      <div class="curb-web-sec-body">`;
    // Direct items under section (no subsection)
    if (sec.directItems.length) {
      html += sec.directItems.map(_ctRow).join('');
    }
    // Subsections
    sec.subOrder.forEach((subLabel, subi) => {
      const subItems = sec.subsMap.get(subLabel);
      const firstType = subItems[0]?.content_type || 'video';
      const subIcon = typeEmoji[firstType] || '▶';
      html += `<div class="curb-sub-block open" id="cwb-${si}-${subi}">
        <div class="curb-web-sub-hd" onclick="toggleCurbSub(${si},${subi})">
          <div class="curb-sub-icon">${subIcon}</div>
          <span class="curb-sub-title">${subLabel}</span>
          <span class="curb-sub-meta">${subItems.length} item${subItems.length!==1?'s':''}</span>
          <span class="curb-sub-arrow">▼</span>
        </div>
        <div class="curb-sub-body">${subItems.map(_ctRow).join('')}</div>
      </div>`;
    });
    html += `</div></div>`;
  });
  html += `</div>`;
  currEl.innerHTML = html;
}

function toggleCurbSec(idx) {
  const el = document.getElementById('cwb-' + idx);
  if (el) el.classList.toggle('open');
}

/* ══════════════════════════════════════════════
   FREE CONTENT PREVIEW PLAYER
══════════════════════════════════════════════ */
window._fpItems = window._fpItems || {};
let _fpYTPlayer = null;
let _fpProgressInterval = null;
let _fpMuted = false;

function _fpLoadYT() {
  return new Promise(resolve => {
    if (window.YT && window.YT.Player) { resolve(); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { resolve(); if (prev) prev(); };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
}

function openFreePreview(itemId) {
  const item = window._fpItems[itemId];
  if (!item) return;
  const overlay  = document.getElementById('free-preview-overlay');
  const titleEl  = document.getElementById('fp-title');
  const videoWrap = document.getElementById('fp-video-wrap');
  const pdfWrap   = document.getElementById('fp-pdf-wrap');
  if (!overlay) return;
  if (titleEl) titleEl.textContent = item.content_name || 'Free Preview';

  if (item.content_type === 'video') {
    const videoId = extractYouTubeId(item.content_url);
    if (!videoId) { window.open(item.content_url, '_blank'); return; }
    if (videoWrap) videoWrap.style.display = '';
    if (pdfWrap)   pdfWrap.style.display = 'none';
    overlay.style.display = 'flex';
    _fpLoadYT().then(() => {
      if (_fpYTPlayer && typeof _fpYTPlayer.loadVideoById === 'function') {
        _fpYTPlayer.loadVideoById(videoId);
      } else {
        _fpYTPlayer = new YT.Player('fp-ytplayer', {
          videoId,
          playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1, origin: location.origin },
          events: {
            onReady(e) { e.target.playVideo(); _fpStartProgress(); },
            onStateChange: _fpOnStateChange,
          }
        });
      }
    });
  } else if (item.content_type === 'pdf') {
    if (videoWrap) videoWrap.style.display = 'none';
    if (pdfWrap) {
      pdfWrap.style.display = '';
      document.getElementById('fp-pdf-iframe').src = item.content_url;
    }
    overlay.style.display = 'flex';
  } else {
    window.open(item.content_url, '_blank');
  }
}

function closeFreePreview() {
  const overlay = document.getElementById('free-preview-overlay');
  if (overlay) overlay.style.display = 'none';
  if (_fpYTPlayer && typeof _fpYTPlayer.pauseVideo === 'function') _fpYTPlayer.pauseVideo();
  clearInterval(_fpProgressInterval); _fpProgressInterval = null;
  const pdfIframe = document.getElementById('fp-pdf-iframe');
  if (pdfIframe) pdfIframe.src = '';
}

function _fpStartProgress() {
  clearInterval(_fpProgressInterval);
  _fpProgressInterval = setInterval(() => {
    if (!_fpYTPlayer || typeof _fpYTPlayer.getDuration !== 'function') return;
    const cur = _fpYTPlayer.getCurrentTime() || 0;
    const dur = _fpYTPlayer.getDuration()    || 0;
    const pct = dur > 0 ? (cur / dur * 100) : 0;
    const fill    = document.getElementById('fp-progress-fill');
    const timeCur = document.getElementById('fp-time-cur');
    const timeDur = document.getElementById('fp-time-dur');
    if (fill)    fill.style.width = pct + '%';
    if (timeCur) timeCur.textContent = _fpFmt(cur);
    if (timeDur) timeDur.textContent = _fpFmt(dur);
  }, 400);
}

function _fpFmt(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

function _fpOnStateChange(e) {
  const btn = document.getElementById('fp-play-btn');
  if (!btn) return;
  if (e.data === 1) { // PLAYING
    btn.innerHTML = '<svg width="14" height="16" viewBox="0 0 14 16" fill="black"><rect x="0" y="0" width="4.5" height="16" rx="1"/><rect x="9.5" y="0" width="4.5" height="16" rx="1"/></svg>';
    _fpStartProgress();
  } else {
    btn.innerHTML = '<svg width="16" height="18" viewBox="0 0 16 18" fill="black"><path d="M1 1l14 8L1 17V1z"/></svg>';
  }
}

function fpTogglePlay() {
  if (!_fpYTPlayer) return;
  _fpYTPlayer.getPlayerState() === 1 ? _fpYTPlayer.pauseVideo() : _fpYTPlayer.playVideo();
}

function fpSkip(secs) {
  if (!_fpYTPlayer || typeof _fpYTPlayer.getCurrentTime !== 'function') return;
  _fpYTPlayer.seekTo(Math.max(0, _fpYTPlayer.getCurrentTime() + secs), true);
}

function fpSeek(event) {
  if (!_fpYTPlayer || typeof _fpYTPlayer.getDuration !== 'function') return;
  const bar = document.getElementById('fp-progress-bar');
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  _fpYTPlayer.seekTo(_fpYTPlayer.getDuration() * pct, true);
}

function fpSetSpeed(rate) {
  if (_fpYTPlayer && typeof _fpYTPlayer.setPlaybackRate === 'function') {
    _fpYTPlayer.setPlaybackRate(parseFloat(rate));
  }
}

function fpToggleMute() {
  if (!_fpYTPlayer) return;
  const btn = document.getElementById('fp-vol-btn');
  if (_fpMuted) { _fpYTPlayer.unMute(); _fpMuted = false; if (btn) btn.textContent = '🔊'; }
  else          { _fpYTPlayer.mute();   _fpMuted = true;  if (btn) btn.textContent = '🔇'; }
}

function fpFullscreen() {
  const wrap = document.getElementById('fp-video-wrap');
  if (!wrap) return;
  const el = wrap.querySelector('div') || wrap;
  (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || (()=>{})).call(el);
}

/* ══════════════════════════════════════════════
   COURSE PLAYER — Custom Video Controls (cpv*)
══════════════════════════════════════════════ */
let _cpYTPlayer = null;
let _cpvProgressInterval = null;
let _cpvMuted = false;

function _cpvStartProgress() {
  clearInterval(_cpvProgressInterval);
  _cpvProgressInterval = setInterval(() => {
    if (!_cpYTPlayer || typeof _cpYTPlayer.getDuration !== 'function') return;
    const cur = _cpYTPlayer.getCurrentTime() || 0;
    const dur = _cpYTPlayer.getDuration()    || 0;
    const pct = dur > 0 ? (cur / dur * 100) : 0;
    const fill    = document.getElementById('cpv-progress-fill');
    const timeCur = document.getElementById('cpv-time-cur');
    const timeDur = document.getElementById('cpv-time-dur');
    if (fill)    fill.style.width = pct + '%';
    if (timeCur) timeCur.textContent = _fpFmt(cur);
    if (timeDur) timeDur.textContent = _fpFmt(dur);
  }, 400);
}

function _cpvOnStateChange(e) {
  const btn = document.getElementById('cpv-play-btn');
  if (!btn) return;
  if (e.data === 1) { // PLAYING
    btn.innerHTML = '<svg width="14" height="16" viewBox="0 0 14 16" fill="black"><rect x="0" y="0" width="4.5" height="16" rx="1"/><rect x="9.5" y="0" width="4.5" height="16" rx="1"/></svg>';
    _cpvStartProgress();
  } else {
    btn.innerHTML = '<svg width="16" height="18" viewBox="0 0 16 18" fill="black"><path d="M1 1l14 8L1 17V1z"/></svg>';
  }
}

function cpvTogglePlay() {
  if (!_cpYTPlayer) return;
  _cpYTPlayer.getPlayerState() === 1 ? _cpYTPlayer.pauseVideo() : _cpYTPlayer.playVideo();
}

function cpvSkip(secs) {
  if (!_cpYTPlayer || typeof _cpYTPlayer.getCurrentTime !== 'function') return;
  _cpYTPlayer.seekTo(Math.max(0, _cpYTPlayer.getCurrentTime() + secs), true);
}

function cpvSeek(event) {
  if (!_cpYTPlayer || typeof _cpYTPlayer.getDuration !== 'function') return;
  const bar = document.getElementById('cpv-progress-bar');
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  _cpYTPlayer.seekTo(_cpYTPlayer.getDuration() * pct, true);
}

function cpvSetSpeed(rate) {
  if (_cpYTPlayer && typeof _cpYTPlayer.setPlaybackRate === 'function') {
    _cpYTPlayer.setPlaybackRate(parseFloat(rate));
  }
}

function cpvToggleMute() {
  if (!_cpYTPlayer) return;
  const btn = document.getElementById('cpv-vol-btn');
  if (_cpvMuted) { _cpYTPlayer.unMute(); _cpvMuted = false; if (btn) btn.textContent = '🔊'; }
  else           { _cpYTPlayer.mute();   _cpvMuted = true;  if (btn) btn.textContent = '🔇'; }
}

function cpvFullscreen() {
  const area = document.getElementById('cpv-yt-area');
  if (!area) return;
  (area.requestFullscreen || area.webkitRequestFullscreen || area.mozRequestFullScreen || (()=>{})).call(area);
}
function toggleCurbSub(secIdx, subIdx) {
  const el = document.getElementById(`cwb-${secIdx}-${subIdx}`);
  if (el) el.classList.toggle('open');
}

function scrollToSection(id, btn) {
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 100;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

let _spyObserver = null;
function _setupScrollSpy() {
  if (_spyObserver) _spyObserver.disconnect();
  const sections = ['dt-overview','dt-description','dt-curriculum','dt-instructor','dt-reviews'];
  _spyObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        document.querySelectorAll('.detail-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.target === id);
        });
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none') _spyObserver.observe(el);
  });
}

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/* detTab / resetDetTabs removed — replaced by scrollToSection + scroll-spy */

/* ── Course category icons map ── */
const CAT_ICONS = {
  ielts:'📝', iba:'🎓', hsc:'📚', vocab:'💬',
  job:'💼', abroad:'✈️', default:'📖'
};

/* ── Build filter buttons dynamically from COURSES data ── */
let activeCatFilter = 'all';

function buildCourseFilters() {
  const row = document.getElementById('course-filter-row');
  const sortEl = document.getElementById('course-sort');
  if (!row || !sortEl) return;

  // Remove old filter buttons
  row.querySelectorAll('.filter-btn').forEach(b => b.remove());

  // Use ALL_CATEGORIES (includes admin-added ones) in admin-defined order
  const cats = [{cat:'all', name:'All'}, ...ALL_CATEGORIES];

  cats.forEach(({cat, name}) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (cat === activeCatFilter ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = name;
    btn.onclick = () => filterCourses(cat, btn);
    row.insertBefore(btn, sortEl);
  });
}

/* ── Build nav hover dropdown from ALL_CATEGORIES ── */
function buildCourseDropdown() {
  const grid = document.getElementById('nav-dd-cat-grid');
  if (!grid) return;
  grid.innerHTML = ALL_CATEGORIES.map(c => `
    <a class="nav-dd-item" onclick="goCat('${c.cat}')">
      <span class="nav-dd-icon">${CAT_ICONS[c.cat]||CAT_ICONS.default}</span>
      <span>${c.name}</span>
    </a>`).join('');
}

/* ── Navigate to courses page with optional category filter ── */
function goCat(cat) {
  const hash = cat === 'all' ? '#courses' : '#courses/' + cat;
  history.pushState({ page: 'courses', cat }, '', hash);
  go('courses', true); // skip go()'s own pushState
  activeCatFilter = cat;
  setTimeout(() => { buildCourseFilters(); applyCourseView(); }, 0);
}

/* ── Filter ── */
function filterCourses(cat, btn) {
  activeCatFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Update hash
  history.replaceState(null, '', cat === 'all' ? '#courses' : '#courses/' + cat);
  applyCourseView();
}

/* ── Sort ── */
function sortCourses(method) {
  applyCourseView();
}

/* ── Apply current filter + sort to the grid ── */
function applyCourseView() {
  let list = activeCatFilter === 'all'
    ? [...COURSES]
    : COURSES.filter(c => (c.cats || [c.cat]).includes(activeCatFilter));

  const method = document.getElementById('course-sort')?.value || 'default';
  if (method === 'price-low')  list.sort((a,b) => Number(a.price) - Number(b.price));
  if (method === 'price-high') list.sort((a,b) => Number(b.price) - Number(a.price));
  if (method === 'newest')     list.sort((a,b) => b.id - a.id);
  if (method === 'rating')     list.sort((a,b) => parseFloat(b.rating||0) - parseFloat(a.rating||0));

  const grid = document.getElementById('all-grid');
  if (grid) grid.innerHTML = list.length
    ? list.map(courseCard).join('')
    : '<p style="color:var(--text-dim);font-size:14px;grid-column:1/-1;padding:40px 0;">No courses in this category yet — check back soon!</p>';
}

/* ── Handle hash-based navigation (back/forward + direct links) ── */
function handleHashNav() {
  const hash  = window.location.hash.slice(1); // strip leading #
  const parts = hash.split('/');
  const root  = parts[0];

  if (!hash || root === 'home') {
    go('home', true);
  } else if (root === 'courses') {
    activeCatFilter = parts[1] || 'all';
    go('courses', true);
    setTimeout(() => {
      buildCourseFilters();
      applyCourseView();
    }, 50);
  } else if (root === 'course' && parts[1]) {
    const id = parseInt(parts[1]);
    if (!isNaN(id)) openCourse(id);
  } else if (root === 'learn' && parts[1]) {
    const cid = parseInt(parts[1]);
    if (!isNaN(cid)) {
      openCoursePlayer(cid).then(() => {
        if (parts[2]) setTimeout(() => _playCPById(parts[2]), 500);
      });
    }
  } else if (root === 'books')    { go('books', true); }
  else if (root === 'blogs')      { go('blogs', true); }
  else if (root === 'profile')    { if (currentUser) go('profile', true); else go('login', true); }
  else if (root === 'cart')       { go('cart', true); }
  else if (root === 'orders')     { go('order-track', true); }
  else if (root === 'login')      { go('login', true); }
}

window.addEventListener('hashchange', handleHashNav);
window.addEventListener('popstate',   handleHashNav);

/* ── Payment method selector ── */
function selPM(el, method) {
  activePaymentMethod = method;
  document.querySelectorAll('.pm-option').forEach(o => {
    o.classList.remove('selected');
    const r = o.querySelector('.pm-radio');
    if (r) r.classList.remove('checked');
  });
  el.classList.add('selected');
  const r = el.querySelector('.pm-radio');
  if (r) r.classList.add('checked');

  _renderPayInfo(method);
}

function _renderPayInfo(method) {
  const info = document.getElementById('pm-info');
  if (!info) return;
  const total = activeCart.reduce((s, i) => s + i.price, 0);
  const totalLabel = document.getElementById('pm-total-label');
  if (totalLabel) totalLabel.textContent = '৳' + total.toLocaleString();
  const amt = '৳' + total.toLocaleString();

  const placeholders = { bkash:'Enter bKash Transaction ID', nagad:'Enter Nagad Transaction ID', bank:'Enter Reference / Transaction Number' };
  const ph = placeholders[method] || 'Enter Transaction ID';

  let instructionKey = method === 'bkash' ? 'bkash_instructions' : method === 'nagad' ? 'nagad_instructions' : 'bank_instructions';
  const instructionText = (_paySettings[instructionKey] || '').split('\n').map(l => `<p style="margin:0 0 6px;font-size:14px;color:var(--text);line-height:1.7;">${l}</p>`).join('');

  info.innerHTML = `
    <div style="margin-bottom:14px;">${instructionText}</div>
    <div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;">Total amount to send: <strong style="color:var(--text-acc);font-size:16px;">${amt}</strong></div>
    <input id="txn-id" class="pm-number" placeholder="${ph}">`;
}

/* ── Profile tabs ── */
function profTab(tab, el) {
  document.querySelectorAll('.profile-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  const content = document.getElementById('prof-content');
  if (tab==='enrolled') {
    content.innerHTML = `<h3 style="font-size:17px;font-weight:800;color:var(--text);margin-bottom:20px;">My Enrolled Courses</h3><div class="courses-grid" id="prof-grid"></div>`;
    loadProfileData();
  } else {
    // Load real profile data then populate form
    (async () => {
      let name = '', phone = '', email = currentUser?.email || '';
      if (currentUser) {
        const { data: p } = await sb.from('profiles').select('full_name,phone').eq('id', currentUser.id).single();
        name  = p?.full_name || currentUser.user_metadata?.full_name || '';
        phone = p?.phone     || currentUser.user_metadata?.phone     || '';
      }
      content.innerHTML = `
        <h3 style="font-size:17px;font-weight:800;color:var(--text);margin-bottom:20px;">Edit Profile</h3>
        <div id="edit-prof-msg" style="display:none;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px;font-weight:600;"></div>
        <div class="form-group"><label class="form-label">Full Name</label>
          <input id="ep-name" class="form-input" value="${name.replace(/"/g,'&quot;')}"></div>
        <div class="form-group"><label class="form-label">Phone</label>
          <input id="ep-phone" class="form-input" type="tel" value="${phone.replace(/"/g,'&quot;')}"></div>
        <div class="form-group"><label class="form-label">Email</label>
          <input class="form-input" value="${email}" disabled style="opacity:0.5;cursor:not-allowed;"></div>
        <div class="form-group"><label class="form-label">New Password <span style="font-weight:400;color:var(--text-dim);font-size:12px;">(leave blank to keep current)</span></label>
          <input id="ep-pass" class="form-input" type="password" placeholder="4–16 characters" maxlength="16"></div>
        <button id="ep-save-btn" class="btn-hero-primary" onclick="saveEditProfile()" style="border-radius:8px;padding:12px 28px;margin-top:4px;">Save Changes</button>`;
    })();
  }
}

/* ── Save edited profile ── */
async function saveEditProfile() {
  const name  = document.getElementById('ep-name')?.value.trim();
  const phone = document.getElementById('ep-phone')?.value.trim();
  const pass  = document.getElementById('ep-pass')?.value;
  const msg   = document.getElementById('edit-prof-msg');
  const btn   = document.getElementById('ep-save-btn');

  if (!name)  { _epMsg('Full name is required.', 'error'); return; }
  if (!phone) { _epMsg('Phone number is required.', 'error'); return; }

  btn.textContent = 'Saving…'; btn.disabled = true;

  // Update profiles table
  const profilePayload = { full_name: name, phone };
  if (pass) profilePayload.has_password = true;

  const { error: dbErr } = await sb.from('profiles').update(profilePayload).eq('id', currentUser.id);
  if (dbErr) { btn.textContent = 'Save Changes'; btn.disabled = false; _epMsg(dbErr.message || 'Failed to save.', 'error'); return; }

  // Update auth user metadata
  const metaUpdate = { data: { full_name: name, phone } };
  if (pass) {
    if (pass.length < 4) { btn.textContent = 'Save Changes'; btn.disabled = false; _epMsg('Password must be at least 4 characters.', 'error'); return; }
    metaUpdate.password = pass;
    metaUpdate.data.has_password = true;
  }
  const { error: authErr } = await sb.auth.updateUser(metaUpdate);
  if (authErr) { btn.textContent = 'Save Changes'; btn.disabled = false; _epMsg(authErr.message || 'Profile saved but password update failed.', 'error'); return; }

  btn.textContent = 'Save Changes'; btn.disabled = false;

  // Update sidebar display name
  const nameEl = document.querySelector('.profile-name');
  const avEl   = document.querySelector('.profile-av');
  if (nameEl) nameEl.textContent = name;
  if (avEl)   avEl.textContent   = name.slice(0,2).toUpperCase();

  _epMsg('Profile updated successfully!', 'success');
}

function _epMsg(text, type) {
  const el = document.getElementById('edit-prof-msg');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = type === 'success' ? 'rgba(0,200,100,0.12)' : 'rgba(255,60,60,0.12)';
  el.style.color      = type === 'success' ? '#00c864'              : '#ff6b6b';
  el.style.border     = `1px solid ${type === 'success' ? 'rgba(0,200,100,0.3)' : 'rgba(255,60,60,0.3)'}`;
}

/* ── OTP inputs ── */
/* ── Toast notification ── */
function toast(msg, type) {
  let el = document.getElementById('site-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'site-toast';
    el.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:#1e0a35;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;z-index:9999;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;border:1px solid rgba(74,0,177,0.4);box-shadow:0 8px 32px rgba(0,0,0,0.4);';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  if (type === 'success') el.style.borderColor = 'rgba(0,200,100,0.5)';
  else el.style.borderColor = 'rgba(74,0,177,0.4)';
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(20px)'; }, 2800);
}

function _setupOtpRow(rowId, onComplete) {
  const arr = Array.from(document.querySelectorAll('#' + rowId + ' .otp-input'));
  arr.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g,'').slice(0,1);
      if (inp.value && i < arr.length - 1) arr[i+1].focus();
      const full = arr.every(x => x.value.length === 1);
      if (full) onComplete();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) arr[i-1].focus();
    });
    inp.addEventListener('paste', e => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'');
      arr.forEach((box, j) => { box.value = paste[j] || ''; });
      const last = Math.min(paste.length, arr.length) - 1;
      if (last >= 0) arr[last].focus();
      const full = arr.every(x => x.value.length === 1);
      if (full) onComplete();
    });
  });
}
_setupOtpRow('otp-row', handleVerifyOTP);
_setupOtpRow('fp-otp-row', handleFPVerifyOTP);

/* ══════════════════════════════════════════════
   BLOG SYSTEM
══════════════════════════════════════════════ */
let _blogsLoaded = false;
let _allBlogs    = [];

async function loadBlogs() {
  if (_blogsLoaded) return;
  const grid = document.getElementById('blogs-grid');
  if (!grid) return;

  const { data: blogs, error } = await sb
    .from('blogs')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error || !blogs || !blogs.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--text-dim);">No articles published yet.</div>';
    return;
  }

  _allBlogs    = blogs;
  _blogsLoaded = true;
  const fmt = d => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

  grid.innerHTML = blogs.map(b => `
    <a class="blog-card" onclick="openBlog(${b.id})" style="cursor:pointer;">
      <div class="blog-thumb"><div class="blog-thumb-inner">${b.emoji || '📖'}</div></div>
      <div class="blog-body">
        <div class="blog-tag">${b.tag || 'Article'}</div>
        <div class="blog-title">${b.title}</div>
        <div class="blog-excerpt">${b.excerpt || ''}</div>
        <div class="blog-meta">
          <span>👤 ${b.author || 'Merito Team'}</span><span>•</span>
          <span>${fmt(b.created_at)}</span><span>•</span>
          <span>${b.read_time || '5'} min</span>
        </div>
      </div>
    </a>`).join('');
}

function openBlog(id) {
  const b = _allBlogs.find(x => x.id === id);
  if (!b) return;
  const fmt = d => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  document.getElementById('blog-modal-tag').textContent   = b.tag || 'Article';
  document.getElementById('blog-modal-title').textContent = b.title;
  document.getElementById('blog-modal-meta').innerHTML    =
    `<span>👤 ${b.author || 'Merito Team'}</span><span>•</span><span>${fmt(b.created_at)}</span><span>•</span><span>${b.read_time || '5'} min read</span>`;
  document.getElementById('blog-modal-body').textContent  = b.content || b.excerpt || '';
  document.getElementById('blog-modal').style.display     = 'block';
  window.scrollTo({ top: 0 });
}

/* ══════════════════════════════════════════════
   BOOKS SYSTEM
══════════════════════════════════════════════ */
let _booksLoaded = false;

async function loadBooks() {
  if (_booksLoaded) return;
  const grid = document.getElementById('books-grid');
  if (!grid) return;

  const { data: books, error } = await sb
    .from('books')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error || !books || !books.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--text-dim);">No books available yet.</div>';
    return;
  }

  _booksLoaded = true;
  grid.innerHTML = books.map(b => `
    <div class="book-card">
      <div class="book-cover"><div class="book-cover-inner">${b.emoji || '📚'}</div></div>
      <div class="book-body">
        <div class="book-title">${b.title}</div>
        <div class="book-author">By ${b.author || 'Merito Team'}</div>
        <div class="book-price">৳${Number(b.price||0).toLocaleString()}</div>
        ${b.file_url
          ? `<a href="${b.file_url}" target="_blank" class="btn-enroll" style="margin-top:10px;width:100%;display:block;text-align:center;text-decoration:none;">📥 Download Free</a>`
          : `<button class="btn-enroll" style="margin-top:10px;width:100%;" onclick="addBookToCart('${b.title.replace(/'/g,"\\'")}',${b.price},'${b.emoji||'📚'}')">Add to Cart</button>`
        }
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════════════
   USER-TARGETED NOTIFICATIONS
   Admin can target: all / specific user_id
══════════════════════════════════════════════ */
// Extend loadNotifications to also fetch user_id-targeted notifications
const _origLoadNotifications = loadNotifications;
async function loadNotifications() {
  if (!currentUser) return;
  const userEmail = currentUser.email;

  const { data: enrollData } = await sb.from('course_enrollments').select('course_id').eq('user_email', userEmail);
  const enrolledCourseIds = (enrollData||[]).map(r => r.course_id);

  const { data: notifs } = await sb
    .from('notifications')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!notifs) return;

  _notifData = notifs.filter(n => {
    if (n.audience === 'all') return true;
    if (n.audience === 'single_user' && n.user_id === currentUser.id) return true;
    if (n.audience === 'course_users' && n.course_id && enrolledCourseIds.includes(n.course_id)) return true;
    return false;
  });

  renderNotifPanel();
  updateBellBadge();
}
