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

// --- MACHINE IDENTIFICATION ---
function getMachineId() {
    let machineId = localStorage.getItem('emyris_lms_machine_id');
    if (!machineId) {
        machineId = 'M-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('emyris_lms_machine_id', machineId);
    }
    return machineId;
}

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
        if (data.appFont) {
            document.documentElement.style.setProperty('--app-font', data.appFont);
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

function playBeep() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    function beep(freq, duration, delay) {
        setTimeout(() => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = freq;
            oscillator.type = 'square';
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            setTimeout(() => oscillator.stop(), duration);
        }, delay);
    }

    beep(440, 150, 0);   // First beep
    beep(440, 150, 300); // Second beep
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
            body: JSON.stringify({ 
                empCode, 
                password, 
                isAdmin: currentRole === 'admin',
                machineId: currentRole === 'admin' ? null : getMachineId()
            })
        });

        const data = await response.json();

        if (data.success) {
            loggedInUser = data;
            showPortal(data.role);
        } else {
            if (data.securityCode === 'IP_MISMATCH' || data.securityCode === 'DEVICE_MISMATCH') {
                playBeep();
                alert(`🚨 ${data.message}`);
            } else {
                alert(data.message || 'Login Failed');
            }
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
    
    if (isAdmin) {
        // Keep Admin Grid as is for management
        grid.innerHTML = products.map(p => `
            <div class="glass-panel product-card animate-fade">
                ${p.image ? `<img src="${p.image}" class="product-image" alt="${p.title}">` : `<div style="height:200px; background: rgba(255,255,255,0.02); display:flex; align-items:center; justify-content:center; color:var(--text-dim)">No Image</div>`}
                <div class="product-content">
                    <span class="badge">${p.category}</span>
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.4rem;">${p.title}</h3>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-glass" style="flex: 1;" onclick="viewDetails('${p._id}')"><i data-lucide="eye"></i> Details</button>
                        <button class="btn btn-glass" style="color: var(--accent); border-color: rgba(244, 63, 94, 0.2);" onclick="deleteProduct('${p._id}')"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        // USER PORTAL: High-Density Hyperlinked Index
        grid.style.display = 'block'; 
        if (products.length === 0) {
            grid.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--text-dim);">No Scientific Products Found in this Category.</div>';
        } else {
            grid.innerHTML = `
                <div class="scientific-index" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    <div class="index-header" style="min-width: 600px;">
                        <span>Scientific Brand / Product</span>
                        <span>Category</span>
                        <span style="text-align: right;">Access</span>
                    </div>
                    ${products.map(p => `
                        <div class="index-row animate-fade" onclick="viewDetails('${p._id}')" style="min-width: 600px;">
                            <div class="product-name">
                                <i data-lucide="flask-conical" style="width: 16px; color: var(--primary);"></i>
                                <span class="hyperlink">${p.title}</span>
                            </div>
                            <div class="product-cat">
                                <span class="badge" style="font-size: 0.7rem; opacity: 0.8;">${p.category}</span>
                            </div>
                            <div style="text-align: right; color: var(--primary);">
                                <i data-lucide="chevron-right"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
        }
    }
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
    const res = await fetch(`${API_URL}/products/${id}`);
    const data = await res.json();
    const p = data.product;

    let videoHtml = '';
    if (p.videoUrl) {
        if (p.videoUrl.includes('youtube.com') || p.videoUrl.includes('youtu.be')) {
            const vidId = p.videoUrl.split('v=')[1]?.split('&')[0] || p.videoUrl.split('/').pop();
            videoHtml = `
                <div class="video-container" style="margin-top: 1rem;">
                    <iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen></iframe>
                </div>`;
        } else {
            videoHtml = `
                <div class="video-container" style="margin-top: 1rem;">
                    <video controls style="width: 100%; border-radius: 15px; border: 1px solid var(--glass-border);">
                        <source src="${p.videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>`;
        }
    }

    let packshotsHtml = '';
    if (p.packshots && p.packshots.length > 0) {
        packshotsHtml = `
            <div style="margin-top: 1.5rem;">
                <h4 style="color: var(--primary); text-transform: uppercase; font-size: 0.7rem; margin-bottom: 0.8rem;">Additional Packshots</h4>
                <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px;">
                    ${p.packshots.map(img => `<img src="${img}" style="height: 100px; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;" onclick="window.open('${img}')">`).join('')}
                </div>
            </div>
        `;
    }

    let detailButtonsHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-top: 1.5rem;">
            ${p.vaPage ? `<button class="btn btn-glass" onclick="window.open('${p.vaPage}')"><i data-lucide="eye"></i> View VA Page</button>` : ''}
            ${p.lblPage ? `<button class="btn btn-glass" onclick="window.open('${p.lblPage}')"><i data-lucide="download"></i> Download LBL</button>` : ''}
            ${p.comparisonChart ? `<button class="btn btn-glass" style="grid-column: span 2;" onclick="window.open('${p.comparisonChart}')"><i data-lucide="bar-chart-2"></i> Competitor Comparison</button>` : ''}
            ${p.videoDetailing ? `<button class="btn btn-primary" style="grid-column: span 2;" onclick="playDetailingVideo('${p.videoDetailing}')"><i data-lucide="play-circle"></i> Play Detailing Video</button>` : ''}
        </div>
    `;

    let pitchesHtml = '';
    if (p.pitch15s || p.pitch30s) {
        pitchesHtml = `
            <div style="margin-top: 2rem; background: rgba(255,255,255,0.02); padding: 1.5rem; border-radius: 15px; border: 1px solid var(--glass-border);">
                <h4 style="color: var(--primary); text-transform: uppercase; font-size: 0.8rem; margin-bottom: 1rem;">Quick Pitch Library</h4>
                <div style="display: flex; gap: 1rem;">
                    ${p.pitch15s ? `<button class="btn btn-glass" onclick="showPitch('15-Sec Pitch', \`${p.pitch15s}\`)">15-sec Pitch</button>` : ''}
                    ${p.pitch30s ? `<button class="btn btn-glass" onclick="showPitch('30-Sec Pitch', \`${p.pitch30s}\`)">30-sec Pitch</button>` : ''}
                </div>
            </div>
        `;
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
        <div style="position: relative; padding-top: 1rem;">
            <button class="btn btn-glass" style="position: absolute; right: -1rem; top: -1rem; border: none; z-index: 10;" onclick="closeModal('detailModal')">
                <i data-lucide="x"></i>
            </button>
            
            <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 2.5rem;" class="detail-mobile-stack">
                <div>
                    ${p.image ? `
                        <div style="background: rgba(0,0,0,0.3); border-radius: 16px; border: 1px solid var(--glass-border); height: 350px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 1.5rem;" class="detail-image-container">
                            <img src="${p.image}" style="max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3));">
                        </div>
                    ` : ''}
                    <div style="margin-top: 0;">
                        <span class="badge">${p.category}</span>
                        <h2 style="font-size: 2rem; margin-top: 0.5rem; line-height: 1.1;">${p.title}</h2>
                    </div>
                    ${packshotsHtml}
                    ${detailButtonsHtml}
                    ${videoHtml}
                    <button class="btn btn-primary" style="width: 100%; margin-top: 2rem; background: linear-gradient(45deg, #f59e0b, #d97706); border: none;" onclick="startAssessment('${p.title}')">
                        <i data-lucide="graduation-cap"></i> Take Assessment Test
                    </button>
                </div>
                <div>
                    <h4 style="color: var(--primary); text-transform: uppercase; font-size: 0.8rem; margin-bottom: 1rem;">Scientific Overview</h4>
                    <div class="ql-editor" style="color: var(--text-dim); padding: 0 !important; line-height: 1.8; font-size: 1.1rem; height: auto !important; overflow: visible !important; text-align: justify;">
                        ${p.scientificInfo.replace(/style="[^"]*?"/gi, m => m.replace(/(?:width|height|font-size|line-height):[^;]+;?/gi, ''))}
                    </div>
                    ${pitchesHtml}
                    ${docsHtml}
                </div>
            </div>

            <!-- Clearfix for FAQ spacing -->
            <div style="clear: both; height: 1px;"></div>

            ${p.faqs && p.faqs.length > 0 ? `
                <div style="margin-top: 3rem; border-top: 1px solid var(--glass-border); padding-top: 2rem;">
                    <h4 style="color: var(--primary); text-transform: uppercase; font-size: 0.8rem; margin-bottom: 1.2rem;">Clinical & Usage FAQs</h4>
                    <div class="faq-accordion">
                        ${p.faqs.map(faq => `
                            <div class="faq-item-ui">
                                <div class="faq-question-ui" onclick="toggleFaq(this)">
                                    <span>${faq.question}</span>
                                    <i data-lucide="chevron-down"></i>
                                </div>
                                <div class="faq-answer-ui">
                                    ${faq.answer}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Standard Company Branding Footer -->
            <div style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; gap: 2rem;">
                    <div style="color: var(--text-dim); font-size: 0.85rem;">
                        <i data-lucide="phone" style="width: 14px; color: var(--primary); vertical-align: middle; margin-right: 5px;"></i>
                        <span id="modal_phone">${document.getElementById('display_contact').innerText.replace('📞 Contact: ', '')}</span>
                    </div>
                    <div style="color: var(--text-dim); font-size: 0.85rem;">
                        <i data-lucide="globe" style="width: 14px; color: var(--primary); vertical-align: middle; margin-right: 5px;"></i>
                        <span id="modal_web">${document.getElementById('display_website').innerText}</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="closeModal('detailModal')">Finish Reading</button>
            </div>
        </div>
    `;
    openModal('detailModal');
    initIcons();
}

function playDetailingVideo(url) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="glass-panel animate-fade" style="max-width: 90%; width: 1000px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0;">Scientific Detailing Video</h3>
                <button class="btn btn-glass" onclick="this.parentElement.parentElement.parentElement.remove()"><i data-lucide="x"></i></button>
            </div>
            <video controls autoplay style="width: 100%; border-radius: 12px;">
                <source src="${url}" type="video/mp4">
            </video>
        </div>
    `;
    document.body.appendChild(modal);
    initIcons();
}

function showPitch(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="glass-panel animate-fade" style="max-width: 600px; padding: 2.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0;">${title}</h3>
                <button class="btn btn-glass" onclick="this.parentElement.parentElement.parentElement.remove()"><i data-lucide="x"></i></button>
            </div>
            <div style="font-size: 1.2rem; line-height: 1.6; color: var(--text-dim); white-space: pre-line;">${content}</div>
        </div>
    `;
    document.body.appendChild(modal);
    initIcons();
}

// --- ASSESSMENT FLOW ---
async function startAssessment(brand) {
    const res = await fetch(`${API_URL}/assessments/${brand}`);
    const data = await res.json();
    if (!data.assessment || data.assessment.questions.length === 0) {
        alert('No assessment available for this brand yet.');
        return;
    }

    const questions = data.assessment.questions;
    let currentQ = 0;
    let score = 0;

    const renderQuestion = () => {
        const q = questions[currentQ];
        const content = document.getElementById('assessContent');
        content.innerHTML = `
            <div class="animate-fade">
                <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--primary); font-weight: 700;">Question ${currentQ + 1} of ${questions.length}</span>
                    <span style="font-size: 0.8rem; opacity: 0.6;">Score: ${score}</span>
                </div>
                <h3 style="font-size: 1.5rem; margin-bottom: 2rem;">${q.question}</h3>
                <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                    ${q.options.map((opt, i) => `
                        <button class="btn btn-glass" style="text-align: left; padding: 1.2rem; font-size: 1.1rem;" onclick="submitAnswer(${i})">${opt}</button>
                    `).join('')}
                </div>
            </div>
        `;
        initIcons();
    };

    window.submitAnswer = async (index) => {
        if (index === questions[currentQ].correctAnswer) {
            score++;
            alert('✅ Correct!');
        } else {
            alert('❌ Incorrect.');
        }

        currentQ++;
        if (currentQ < questions.length) {
            renderQuestion();
        } else {
            finishAssessment(brand, score, questions.length);
        }
    };

    renderQuestion();
    openModal('assessmentModal');
}

async function finishAssessment(brand, score, total) {
    const res = await fetch(`${API_URL}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            empCode: loggedInUser.empCode || 'test', 
            empName: loggedInUser.name || 'Anonymous',
            brand, 
            score, 
            totalQuestions: total 
        })
    });
    const data = await res.json();
    
    const content = document.getElementById('assessContent');
    content.innerHTML = `
        <div style="text-align: center; padding: 2rem;" class="animate-fade">
            <i data-lucide="award" style="width: 80px; height: 80px; color: #f59e0b; margin-bottom: 1.5rem;"></i>
            <h2 style="font-size: 2.5rem; margin-bottom: 1rem;">Assessment Complete!</h2>
            <p style="font-size: 1.2rem; color: var(--text-dim); margin-bottom: 2rem;">You scored <strong>${score} out of ${total}</strong></p>
            <div style="background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 20px; border: 1px solid var(--glass-border);">
                <p style="text-transform: uppercase; letter-spacing: 2px; font-size: 0.8rem; margin-bottom: 0.5rem;">Badge Earned</p>
                <h3 style="font-size: 2rem; color: ${data.badge === 'Gold' ? '#fbbf24' : data.badge === 'Silver' ? '#94a3b8' : '#b45309'}">${data.badge} Badge</h3>
            </div>
            <button class="btn btn-primary" style="margin-top: 3rem; padding: 12px 40px;" onclick="closeModal('assessmentModal')">Close Assessment</button>
        </div>
    `;
    initIcons();
}

function toggleFaq(el) {
    const item = el.parentElement;
    const isActive = item.classList.contains('active');
    
    // Close other items
    document.querySelectorAll('.faq-item-ui').forEach(i => i.classList.remove('active'));
    
    // Toggle current
    if (!isActive) item.classList.add('active');
}

async function downloadDoc(name, data) {
    try {
        let finalData = data;
        let isCompressed = data.startsWith('gz:');

        if (isCompressed) {
            // Remove prefix and convert base64 to Blob manually (more robust than fetch for large data URLs)
            const base64Content = data.substring(3).split(',')[1];
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/gzip' });
            
            // Decompress
            const decompressedStream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
            const chunks = [];
            const reader = decompressedStream.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            const decompressedBlob = new Blob(chunks, { type: 'application/pdf' });
            finalData = window.URL.createObjectURL(decompressedBlob);
        }

        // Trigger Download
        const link = document.createElement('a');
        link.href = finalData.startsWith('gz:') ? finalData.substring(3) : finalData;
        link.download = name.endsWith('.pdf') ? name : name + '.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (finalData.startsWith('blob:')) setTimeout(() => window.URL.revokeObjectURL(finalData), 100);
    } catch (e) {
        console.error('Download failed', e);
        // Clean fallback
        const fallbackUrl = data.startsWith('gz:') ? data.substring(3) : data;
        window.open(fallbackUrl, '_blank');
    }
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
    
    // Display Machine ID on Auth Screen
    const display = document.getElementById('machineIdDisplay');
    if (display) {
        display.innerText = getMachineId();
    }
};
