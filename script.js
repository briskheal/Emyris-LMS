// Initialize Lucide Icons
function initIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// State Management
let currentRole = 'employee';
let loggedInUser = null;
const API_URL = '/api';

// --- BRANDING ---
async function fetchBranding() {
    try {
        const res = await fetch(`${API_URL}/company`);
        const data = await res.json();
        if (data.logo) {
            document.getElementById('appLogoAuth').src = data.logo;
            document.getElementById('appLogoNav').src = data.logo;
        }
        if (data.phone || data.tollFree) {
            document.getElementById('display_contact').innerText = `📞 Contact: ${data.phone || data.tollFree}`;
        }
        if (data.website) {
            document.getElementById('display_website').innerText = `🌐 ${data.website}`;
        }

        // Fetch and Render Categories
        const catRes = await fetch(`${API_URL}/categories`);
        const cats = await catRes.json();
        const activeCats = cats.filter(c => c.active);
        const filterDiv = document.getElementById('categoryFilter');
        if (filterDiv) {
            filterDiv.innerHTML = `<button class="btn btn-primary" onclick="filterProducts('All')">All Portfolio</button>` + 
                activeCats.map(c => `<button class="btn btn-glass" onclick="filterProducts('${c.name}')">${c.name}</button>`).join('');
        }
    } catch (e) { console.error('Branding fetch failed', e); }
}

// --- UI HELPERS ---

function setRole(role) {
    currentRole = role;
    const idLabel = document.getElementById('idLabel');
    const usernameInput = document.getElementById('username');
    const subtext = document.getElementById('roleSubtext');

    if (role === 'admin') {
        idLabel.innerText = 'Admin Username';
        usernameInput.placeholder = 'e.g. EMYRISLMS';
        subtext.innerHTML = `Administrative Mode. <a href="#" onclick="setRole('employee')" style="color: var(--secondary); text-decoration: none; font-weight: 600;">Back to Employee Login</a>`;
    } else {
        idLabel.innerText = 'Employee Code';
        usernameInput.placeholder = 'e.g. user';
        subtext.innerHTML = `Secure Access Only. <a href="#" onclick="setRole('admin')" style="color: var(--primary); text-decoration: none; font-weight: 600;">Administrator Portal</a>`;
    }
}

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// --- AUTHENTICATION ---

async function handleLogin() {
    const empCode = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!empCode || !password) {
        alert('Please enter credentials');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empCode, password, isAdmin: currentRole === 'admin' })
        });

        const data = await response.json();

        if (data.success) {
            loggedInUser = data;
            showPortal(data.role);
        } else {
            alert(data.message || 'Login Failed');
        }
    } catch (e) {
        console.error(e);
        alert('Connection Error');
    }
}

function showPortal(role) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainNav').style.display = 'flex';
    document.getElementById('userInfo').innerText = role === 'admin' ? 'Administrator' : `Welcome, ${loggedInUser.name}`;
    document.getElementById('navTitle').innerText = role === 'admin' ? 'EMYRIS ADMIN' : 'EMYRIS LMS';

    if (role === 'admin') {
        document.getElementById('adminPortal').style.display = 'block';
        fetchAdminProducts();
    } else {
        document.getElementById('employeePortal').style.display = 'block';
        filterProducts('All');
    }
    initIcons();
}

function logout() {
    window.location.reload();
}

// --- PRODUCT MANAGEMENT ---

async function fetchAdminProducts() {
    const res = await fetch(`${API_URL}/products`);
    const data = await res.json();
    renderProducts(data.products, 'adminProductGrid', true);
}

async function filterProducts(category) {
    const query = category === 'All' ? '' : `?category=${category}`;
    const res = await fetch(`${API_URL}/products${query}`);
    const data = await res.json();
    renderProducts(data.products, 'empProductGrid', false);
    
    // Update active state of filter buttons
    const btns = document.querySelectorAll('#employeePortal .btn');
    btns.forEach(btn => {
        if (btn.innerText.includes(category) || (category === 'All' && btn.innerText.includes('Portfolio'))) {
            btn.className = 'btn btn-primary';
        } else if (btn.onclick) {
            btn.className = 'btn btn-glass';
        }
    });
}

function renderProducts(products, gridId, isAdmin) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = products.map(p => `
        <div class="glass-panel product-card animate-fade">
            ${p.image ? `<img src="${p.image}" class="product-image" alt="${p.title}">` : `<div style="height:200px; background: rgba(255,255,255,0.02); display:flex; align-items:center; justify-content:center; color:var(--text-dim)">No Image</div>`}
            <div class="product-content">
                <span class="badge">${p.category}</span>
                <h3 style="margin-bottom: 0.5rem; font-size: 1.4rem;">${p.title}</h3>
                <p style="color: var(--text-dim); font-size: 0.9rem; margin-bottom: 1.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${p.scientificInfo}
                </p>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-glass" style="flex: 1;" onclick="viewDetails('${p._id}')">
                        <i data-lucide="eye"></i> Details
                    </button>
                    ${isAdmin ? `
                        <button class="btn btn-glass" style="color: var(--accent); border-color: rgba(244, 63, 94, 0.2);" onclick="deleteProduct('${p._id}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
    initIcons();
}

async function saveProduct() {
    const p_title = document.getElementById('p_title').value;
    const p_category = document.getElementById('p_category').value;
    const p_info = document.getElementById('p_info').value;
    const p_video = document.getElementById('p_video').value;
    const imgFile = document.getElementById('p_image').files[0];
    const docFiles = document.getElementById('p_docs').files;

    if (!p_title || !p_info) {
        alert('Title and Information are required');
        return;
    }

    let imageBase64 = '';
    if (imgFile) imageBase64 = await toBase64(imgFile);

    let documents = [];
    for (let f of docFiles) {
        const b64 = await toBase64(f);
        documents.push({ name: f.name, data: b64 });
    }

    const payload = {
        title: p_title,
        category: p_category,
        scientificInfo: p_info,
        videoUrl: p_video,
        image: imageBase64,
        documents: documents
    };

    const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        closeModal('productModal');
        fetchAdminProducts();
        alert('Product Added to Vault');
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure? This action is permanent.')) return;
    const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    if (res.ok) fetchAdminProducts();
}

async function viewDetails(id) {
    const res = await fetch(`${API_URL}/products`);
    const data = await res.json();
    const p = data.products.find(x => x._id === id);

    let videoHtml = '';
    if (p.videoUrl) {
        if (p.videoUrl.includes('youtube.com') || p.videoUrl.includes('youtu.be')) {
            const vidId = p.videoUrl.split('v=')[1]?.split('&')[0] || p.videoUrl.split('/').pop();
            videoHtml = `
                <div class="video-container" style="margin-top: 2rem;">
                    <iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen></iframe>
                </div>`;
        } else {
            videoHtml = `
                <div class="video-container" style="margin-top: 2rem;">
                    <video controls style="width: 100%; border-radius: 15px; border: 1px solid var(--glass-border);">
                        <source src="${p.videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>`;
        }
    }

    let docsHtml = '';
    if (p.documents && p.documents.length > 0) {
        docsHtml = `
            <div style="margin-top: 2rem;">
                <h4 style="color: var(--primary); text-transform: uppercase; font-size: 0.8rem; margin-bottom: 1rem;">Scientific Journals & Content</h4>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${p.documents.map(doc => `
                        <div class="glass-panel" style="padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-radius: 10px;">
                            <span style="font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">${doc.name}</span>
                            <button class="btn btn-glass" style="padding: 5px 12px; font-size: 0.8rem;" onclick="downloadDoc('${doc.name}', '${doc.data}')">
                                <i data-lucide="download"></i> Download
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const detailContent = document.getElementById('detailContent');
    detailContent.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 2.5rem;">
            <div>
                ${p.image ? `<img src="${p.image}" style="width:100%; border-radius:16px; border:1px solid var(--glass-border);">` : ''}
                <div style="margin-top: 1.5rem;">
                    <span class="badge">${p.category}</span>
                    <h2 style="font-size: 2rem; margin-top: 0.5rem;">${p.title}</h2>
                </div>
                ${videoHtml}
            </div>
            <div>
                <h4 style="color: var(--primary); text-transform: uppercase; font-size: 0.8rem; margin-bottom: 1rem;">Scientific Overview</h4>
                <p style="line-height: 1.8; color: var(--text-dim); margin-bottom: 1rem; font-size: 1.1rem;">${p.scientificInfo}</p>
                
                ${docsHtml}
                
                <div style="margin-top: 2.5rem; text-align: right;">
                    <button class="btn btn-primary" onclick="closeModal('detailModal')">Close View</button>
                </div>
            </div>
        </div>
    `;
    openModal('detailModal');
    initIcons();
}

function downloadDoc(name, data) {
    const link = document.createElement('a');
    link.href = data;
    link.download = name;
    link.click();
}

// --- UTILS ---

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// On Load
window.onload = () => {
    initIcons();
    fetchBranding();
};
