import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, setDoc, serverTimestamp, runTransaction, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// 1. CONFIGURAÇÕES E ESTADO GLOBAL
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCyEZRT-PIwpLpvOAqffVKXp1fVaJfBMTs",
    authDomain: "sedentos.firebaseapp.com",
    projectId: "sedentos",
    storageBucket: "sedentos.firebasestorage.app",
    messagingSenderId: "52891411067",
    appId: "1:52891411067:web:bac8f01d8ffa103a9378de",
    measurementId: "G-L57HTLBGN2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const CLIENT_ID_GOOGLE = "52891411067-bac8f01d8ffa103a9378de.apps.googleusercontent.com";
const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.readonly";

let editandoLetraId = null;
let letrasGlobais = [];
let letraAtualArquivamento = null;
let lastFocusedElementLetraArchive = null;
let letraAtualRestauracao = null;
let lastFocusedElementLetraRestore = null;
let isSavingLetra = false;
let isArchivingLetra = false;
let isRestoringLetra = false;
let tamanhoFonteApresentacao = 18;
let temaApresentacaoEscuro = false;
let lastFocusedElementLetra = null;
let tokenClient;
let localGmailUserEmail = null;
let isSyncingGmail = false;
let isClearingGmailCache = false;
let lastFocusedElementGmailClear = null;
let listaDeFrasesNuvem = [];

function getScrollBehavior() {
    try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return 'auto';
        }
    } catch (e) {}
    return 'smooth';
}

function trapFocusInModal(e, modalElement) {
    if (!modalElement || e.key !== 'Tab') return;
    const focusables = modalElement.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    const focusableArray = Array.prototype.filter.call(focusables, el => {
        return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
    });
    if (focusableArray.length === 0) return;
    const firstFocusable = focusableArray[0];
    const lastFocusable = focusableArray[focusableArray.length - 1];

    if (e.shiftKey) {
        if (document.activeElement === firstFocusable || !modalElement.contains(document.activeElement)) {
            e.preventDefault();
            lastFocusable.focus();
        }
    } else {
        if (document.activeElement === lastFocusable || !modalElement.contains(document.activeElement)) {
            e.preventDefault();
            firstFocusable.focus();
        }
    }
}

let unsubscribeFunctions = [];

function cancelarListeners() {
    unsubscribeFunctions.forEach(unsub => { 
        if(typeof unsub === 'function') {
            try { unsub(); } catch(e) { console.error("Erro ao cancelar listener", e); }
        } 
    });
    unsubscribeFunctions = [];
}

// ==========================================
// 2. SISTEMA DE LOGIN E AUTENTICAÇÃO
// ==========================================
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const shell = document.getElementById('app-shell');
    const keyInput = document.getElementById('access-key');
    const btn = document.getElementById('login-btn');
    const spinner = document.getElementById('login-spinner');
    const text = document.getElementById('login-text');
    const error = document.getElementById('login-error');

    if (user) {
        if(loginScreen) loginScreen.style.display = 'none';
        if(shell) {
            shell.classList.add('is-authenticated');
            shell.style.display = '';
        }
        if(keyInput) {
            keyInput.disabled = false;
            keyInput.value = '';
        }
        if(btn) btn.disabled = false;
        if(spinner) spinner.classList.add('hidden');
        if(text) text.innerText = 'Entrar na Missão';
        iniciarSincronizacao();
    } else {
        cancelarListeners();
        if (window.gapi && gapi.client && typeof gapi.client.setToken === 'function') {
            try { gapi.client.setToken(null); } catch (e) {}
        }
        localGmailUserEmail = null;
        isSyncingGmail = false;
        isClearingGmailCache = false;
        atualizarUIContaGmailLocal();
        atualizarStatusBotaoGmail('idle');

        if(loginScreen) loginScreen.style.display = 'flex';
        if(shell) {
            shell.classList.remove('is-authenticated');
            shell.style.display = '';
        }
        if(keyInput) {
            keyInput.value = '';
            keyInput.disabled = false;
        }
        if(error) error.classList.add('hidden');
        if(btn) btn.disabled = false;
        if(spinner) spinner.classList.add('hidden');
        if(text) text.innerText = 'Entrar na Missão';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const keyInput = document.getElementById('access-key');
    if (keyInput) {
        keyInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') window.handleKeyLogin();
        });
    }
    const dataInput = document.getElementById('caixa-data');
    if (dataInput) {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
        dataInput.value = localISOTime;
    }
});

window.togglePassword = () => {
    const input = document.getElementById('access-key');
    const icon = document.getElementById('toggle-password-icon');
    const btn = document.getElementById('toggle-password');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
        if(btn) btn.setAttribute('aria-label', 'Ocultar senha');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
        if(btn) btn.setAttribute('aria-label', 'Mostrar senha');
    }
};

window.handleKeyLogin = () => {
    const keyInput = document.getElementById('access-key');
    const btn = document.getElementById('login-btn');
    const error = document.getElementById('login-error');
    const spinner = document.getElementById('login-spinner');
    const text = document.getElementById('login-text');
    
    if(!keyInput) return;
    const key = keyInput.value;
    if(!key) return;

    error.classList.add('hidden');
    keyInput.disabled = true;
    btn.disabled = true;
    spinner.classList.remove('hidden');
    text.innerText = 'Autenticando...';

    signInWithEmailAndPassword(auth, "missao@missaosedentos.com", key)
        .catch((err) => {
            console.error("Erro no login:", err);
            error.classList.remove('hidden');
            error.innerText = "Chave incorreta ou erro de acesso.";
            keyInput.disabled = false;
            btn.disabled = false;
            spinner.classList.add('hidden');
            text.innerText = 'Entrar na Missão';
            keyInput.focus();
        });
};

window.handleLogout = () => { 
    if(confirm("Deseja sair?")) signOut(auth); 
};

// ==========================================
// 3. NAVEGAÇÃO E UI GERAL
// ==========================================
window.router = (id) => {
    document.querySelectorAll('.view').forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('active');
    });
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(id + '-view');
    if(target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    
    const navBtn = document.getElementById('nav-' + id);
    if(navBtn) navBtn.classList.add('active');
    
    const bread = document.getElementById('breadcrumb');
    if(bread) bread.innerText = id.toUpperCase();
    
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        if(sidebar) sidebar.classList.remove('active');
    }
    
    if(id === 'dashboard') sortearFraseFirebase();
};

window.toggleMobileMenu = () => document.querySelector('.sidebar').classList.toggle('active');

// ==========================================
// 4. SINCRONIZAÇÃO DE DADOS (FIRESTORE)
// ==========================================
function iniciarSincronizacao() {
    cancelarListeners();

    unsubscribeFunctions.push(
        onSnapshot(query(collection(db, "agenda"), orderBy("data", "asc")), 
            (snap) => renderAgenda(snap.docs.map(d => ({id: d.id, ...d.data()}))),
            (error) => console.error("Erro sincronizando agenda:", error)
        )
    );
    unsubscribeFunctions.push(
        onSnapshot(collection(db, "caixa"), 
            (snap) => renderCaixa(snap.docs.map(d => ({id: d.id, ...d.data()}))),
            (error) => console.error("Erro sincronizando caixa:", error)
        )
    );
    unsubscribeFunctions.push(
        onSnapshot(collection(db, "letras"), 
            (snap) => renderLetras(snap.docs.map(d => ({id: d.id, ...d.data()}))),
            (error) => console.error("Erro sincronizando letras:", error)
        )
    );
    
    unsubscribeFunctions.push(
        onSnapshot(collection(db, "frases"), (snap) => {
            listaDeFrasesNuvem = snap.docs.map(d => d.data());
            sortearFraseFirebase();
        }, (error) => console.error("Erro sincronizando frases:", error))
    );

    fetchLiturgia();
    setTercoDoDia();

    unsubscribeFunctions.push(
        onSnapshot(doc(db, "config", "gmail_cache"), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                renderGmailStatusArea(data, false);
            } else {
                renderGmailStatusArea(null, false);
            }
        }, (error) => {
            console.error("Erro sincronizando gmail do Firestore:", error);
            renderGmailStatusArea(null, true, "Não foi possível carregar o cache agora.");
        })
    );

    unsubscribeFunctions.push(
        onSnapshot(doc(db, "config", "social"), (snapshot) => {
        if (snapshot.exists()) {
            const d = snapshot.data();
            const igEl = document.getElementById('count-instagram');
            const ytEl = document.getElementById('count-youtube');
            const spEl = document.getElementById('count-spotify');
            
            if(igEl) igEl.innerText = Number(d.ig || 0).toLocaleString();
            if(ytEl) ytEl.innerText = Number(d.yt || 0).toLocaleString();
            if(spEl) spEl.innerText = Number(d.sp || 0).toLocaleString();
        }
    }, (error) => console.error("Erro sincronizando social:", error))
    );
}

// ==========================================
// 5. GMAIL API INTEGRATION
// ==========================================
function initGapi() {
    if (window.gapi && window.gapi.load) {
        gapi.load('client', async () => await gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"] }));
    } else {
        setTimeout(initGapi, 100);
    }
}
initGapi();

function initGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID_GOOGLE, scope: GMAIL_SCOPES, callback: '' });
    } else {
        setTimeout(initGis, 100);
    }
}
initGis();

function atualizarStatusBotaoGmail(estado) {
    const btn = document.getElementById('btn-sync-gmail');
    if (!btn) return;
    const span = btn.querySelector('span');
    const icon = btn.querySelector('i');

    if (estado === 'conectando') {
        btn.disabled = true;
        if (span) span.textContent = 'Conectando...';
        if (icon) icon.className = 'fas fa-spinner fa-spin mr-1';
    } else if (estado === 'sincronizando') {
        btn.disabled = true;
        if (span) span.textContent = 'Sincronizando...';
        if (icon) icon.className = 'fas fa-spinner fa-spin mr-1';
    } else if (estado === 'sincronizado') {
        btn.disabled = false;
        if (span) span.textContent = 'Sincronizado';
        if (icon) icon.className = 'fas fa-check mr-1';
        setTimeout(() => {
            if (!isSyncingGmail) {
                if (span) span.textContent = 'Sincronizar';
                if (icon) icon.className = 'fas fa-sync-alt mr-1';
            }
        }, 3000);
    } else if (estado === 'erro') {
        btn.disabled = false;
        if (span) span.textContent = 'Tentar Novamente';
        if (icon) icon.className = 'fas fa-exclamation-triangle mr-1';
    } else {
        btn.disabled = false;
        if (span) span.textContent = 'Sincronizar';
        if (icon) icon.className = 'fas fa-sync-alt mr-1';
    }
}

function atualizarUIContaGmailLocal() {
    const accountInfoEl = document.getElementById('gmail-account-info');
    const disconnectBtn = document.getElementById('btn-disconnect-gmail');

    if (localGmailUserEmail) {
        if (accountInfoEl) {
            accountInfoEl.textContent = `Conectado: ${localGmailUserEmail}`;
            accountInfoEl.title = `Conectado como: ${localGmailUserEmail}`;
            accountInfoEl.classList.remove('hidden');
        }
        if (disconnectBtn) {
            disconnectBtn.classList.remove('hidden');
        }
    } else {
        const token = (window.gapi && gapi.client && typeof gapi.client.getToken === 'function') ? gapi.client.getToken() : null;
        if (token && token.access_token) {
            if (accountInfoEl) {
                accountInfoEl.textContent = 'Gmail Conectado';
                accountInfoEl.title = 'Sessão conectada neste navegador';
                accountInfoEl.classList.remove('hidden');
            }
            if (disconnectBtn) {
                disconnectBtn.classList.remove('hidden');
            }
        } else {
            if (accountInfoEl) {
                accountInfoEl.textContent = '';
                accountInfoEl.classList.add('hidden');
            }
            if (disconnectBtn) {
                disconnectBtn.classList.add('hidden');
            }
        }
    }
}

function renderAreaSincronizando() {
    const area = document.getElementById('gmail-status-area');
    if (!area) return;
    area.textContent = '';

    const container = document.createElement('div');
    container.className = 'py-8 text-center';

    const icon = document.createElement('i');
    icon.className = 'fas fa-spinner fa-spin text-red-500 text-2xl mb-4 inline-block';

    const p = document.createElement('p');
    p.className = 'text-[10px] uppercase font-bold tracking-widest text-slate-600 animate-pulse';
    p.textContent = 'Sincronizando MENSAGENS...';

    container.appendChild(icon);
    container.appendChild(p);
    area.appendChild(container);
}

function renderGmailStatusArea(data, isError = false, errorMessage = '') {
    const area = document.getElementById('gmail-status-area');
    if (!area) return;

    area.textContent = '';

    if (isError) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-exclamation-triangle text-amber-500 text-3xl mb-2 mt-4 inline-block';
        const msg = document.createElement('p');
        msg.className = 'text-[10px] text-red-500 font-bold mb-2';
        msg.textContent = errorMessage || 'Não foi possível carregar o cache agora.';
        area.appendChild(icon);
        area.appendChild(msg);
        return;
    }

    const emails = (data && Array.isArray(data.mensagens)) ? data.mensagens : [];

    if (emails.length > 0) {
        const card = document.getElementById('gmail-card');
        const isExpanded = card && card.classList.contains('col-span-full');
        const maxH = isExpanded ? 'max-h-[400px] overflow-y-auto' : 'max-h-[140px] overflow-hidden';

        const listContainer = document.createElement('div');
        listContainer.id = 'gmail-list-container';
        listContainer.className = `mt-2 text-left transition-all duration-500 ease-in-out pr-2 ${maxH}`;

        const spaceDiv = document.createElement('div');
        spaceDiv.className = 'space-y-2';

        emails.slice(0, 8).forEach(m => {
            if (!m || typeof m !== 'object') {
                console.warn("Item de cache de mensagem malformado ignorado");
                return;
            }
            const de = typeof m.de === 'string' && m.de.trim() ? m.de.trim() : 'Desconhecido';
            const assunto = typeof m.assunto === 'string' && m.assunto.trim() ? m.assunto.trim() : '(Sem Assunto)';
            const unread = Boolean(m.unread);

            const itemDiv = document.createElement('div');
            const bgClass = unread ? 'bg-white shadow-sm border border-red-50' : 'bg-slate-50/50 border border-transparent';
            itemDiv.className = `p-3 rounded-2xl flex flex-col justify-center transition-colors ${bgClass}`;

            const topRow = document.createElement('div');
            topRow.className = 'flex items-center';

            const dot = document.createElement('span');
            dot.className = unread 
                ? 'bg-red-500 w-2 h-2 rounded-full inline-block mr-2 shadow-[0_0_8px_rgba(239,68,68,0.6)] shrink-0' 
                : 'w-2 h-2 rounded-full inline-block mr-2 bg-transparent shrink-0';

            const senderSpan = document.createElement('span');
            const unreadNameClass = unread ? 'font-black text-slate-900' : 'font-bold text-slate-500';
            senderSpan.className = `text-[10px] ${unreadNameClass} uppercase tracking-wider truncate`;
            senderSpan.textContent = de;

            topRow.appendChild(dot);
            topRow.appendChild(senderSpan);

            const subjP = document.createElement('p');
            const unreadTitleClass = unread ? 'font-bold text-red-600' : 'font-medium text-slate-500';
            subjP.className = `text-[12px] ${unreadTitleClass} truncate ml-4 mt-1`;
            subjP.textContent = assunto;

            itemDiv.appendChild(topRow);
            itemDiv.appendChild(subjP);
            spaceDiv.appendChild(itemDiv);
        });

        listContainer.appendChild(spaceDiv);
        area.appendChild(listContainer);

        // Data de sincronização
        let dataTexto = 'Não disponível';
        if (data && data.ultimaSinc && typeof data.ultimaSinc === 'string') {
            const d = new Date(data.ultimaSinc);
            if (!isNaN(d.getTime())) {
                dataTexto = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }
        }

        const footerDiv = document.createElement('div');
        footerDiv.className = 'text-[9px] text-slate-400 uppercase font-bold mt-3 border-t border-slate-100 pt-3 text-center';
        footerDiv.textContent = `Última sinc: ${dataTexto} (Toque para expandir)`;
        area.appendChild(footerDiv);
    } else {
        if (data && data.clearedAt) {
            const icon = document.createElement('i');
            icon.className = 'fas fa-trash-alt text-slate-300 text-3xl mb-2 mt-4 inline-block';
            const p = document.createElement('p');
            p.className = 'text-[10px] text-slate-500 font-bold mb-1';
            p.textContent = 'O cache compartilhado foi limpo.';
            area.appendChild(icon);
            area.appendChild(p);

            if (data.clearedBy && typeof data.clearedBy === 'string') {
                const subP = document.createElement('p');
                subP.className = 'text-[9px] text-slate-400 mb-2';
                subP.textContent = `Responsável: ${data.clearedBy}`;
                area.appendChild(subP);
            }
        } else if (data && data.ultimaSinc) {
            const icon = document.createElement('i');
            icon.className = 'fas fa-inbox text-slate-300 text-3xl mb-2 mt-4 inline-block';
            const p = document.createElement('p');
            p.className = 'text-[10px] text-slate-500 font-bold mb-2';
            p.textContent = 'Nenhuma mensagem encontrada.';
            area.appendChild(icon);
            area.appendChild(p);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fas fa-envelope text-red-100 text-3xl mb-2 mt-4 inline-block';
            const p = document.createElement('p');
            p.className = 'text-[10px] text-slate-400 mb-2';
            p.textContent = 'Conecte o Gmail para sincronizar as últimas mensagens.';
            area.appendChild(icon);
            area.appendChild(p);
        }
    }
}

window.toggleGmailExpand = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const card = document.getElementById('gmail-card');
    const toggleBtn = document.getElementById('btn-toggle-gmail-expand');
    const expandIcon = document.getElementById('gmail-expand-icon');
    if (card) {
        card.classList.toggle('col-span-full');
        const isExpanded = card.classList.contains('col-span-full');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            toggleBtn.setAttribute('aria-label', isExpanded ? 'Recolher lista de e-mails' : 'Expandir lista de e-mails');
        }
        if (expandIcon) {
            expandIcon.className = isExpanded ? 'fas fa-compress-alt text-xs' : 'fas fa-expand-alt text-xs';
        }
        
        const listContainer = document.getElementById('gmail-list-container');
        if (listContainer) {
            listContainer.classList.toggle('max-h-[140px]', !isExpanded);
            listContainer.classList.toggle('max-h-[400px]', isExpanded);
            listContainer.classList.toggle('overflow-hidden', !isExpanded);
            listContainer.classList.toggle('overflow-y-auto', isExpanded);
        }
    }
};

window.handleGmailAuth = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isSyncingGmail) return;
    if (!tokenClient) {
        alert("Google Identity Services ainda está inicializando. Aguarde um instante.");
        return;
    }
    isSyncingGmail = true;
    atualizarStatusBotaoGmail('conectando');

    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.warn("Aviso de autorização Google:", resp.error);
            isSyncingGmail = false;
            atualizarStatusBotaoGmail('idle');
            if (resp.error === 'access_denied' || resp.error === 'popup_closed_by_user') {
                console.info("Autorização cancelada pelo usuário.");
            } else if (resp.error === 'token_expired' || resp.error === 'invalid_grant') {
                console.info("Autorização expirada.");
                renderGmailStatusArea(null, true, "Autorização expirada. Clique em Sincronizar para reconectar.");
            } else {
                renderGmailStatusArea(null, true, "Não foi possível autorizar o acesso ao Gmail.");
            }
            return;
        }

        atualizarStatusBotaoGmail('sincronizando');
        renderAreaSincronizando();
        await syncGmailToFirebase();
    };

    try {
        tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
        console.warn("Erro ao solicitar acesso OAuth:", err);
        isSyncingGmail = false;
        atualizarStatusBotaoGmail('idle');
    }
};

async function syncGmailToFirebase() {
    try {
        try {
            if (window.gapi && gapi.client && gapi.client.gmail) {
                const profile = await gapi.client.gmail.users.getProfile({ userId: 'me' });
                if (profile && profile.result && profile.result.emailAddress) {
                    localGmailUserEmail = String(profile.result.emailAddress);
                }
            }
        } catch (profErr) {
            console.warn("Não foi possível ler email de perfil localmente:", profErr.message || profErr);
        }
        atualizarUIContaGmailLocal();

        if (!window.gapi || !gapi.client || !gapi.client.gmail) {
            throw new Error("Cliente da Gmail API não inicializado.");
        }

        const response = await gapi.client.gmail.users.messages.list({ userId: 'me', maxResults: 8 });
        const messages = (response.result && Array.isArray(response.result.messages)) ? response.result.messages : [];
        let lista = [];

        for (const msg of messages.slice(0, 8)) {
            if (!msg || !msg.id) continue;
            try {
                const detail = await gapi.client.gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From']
                });
                const headers = (detail.result && detail.result.payload && Array.isArray(detail.result.payload.headers)) 
                    ? detail.result.payload.headers 
                    : [];
                
                const subjectHeader = headers.find(h => h && h.name === 'Subject');
                const rawSubject = subjectHeader ? subjectHeader.value : '(Sem Assunto)';
                const subject = String(rawSubject || '(Sem Assunto)').trim().slice(0, 250);

                const fromHeader = headers.find(h => h && h.name === 'From');
                let rawFrom = fromHeader ? fromHeader.value : 'Desconhecido';
                if (rawFrom.includes('<')) {
                    rawFrom = rawFrom.split('<')[0].replace(/['"]/g, '').trim();
                }
                const from = String(rawFrom || 'Desconhecido').trim().slice(0, 120);

                const isUnread = (detail.result && Array.isArray(detail.result.labelIds)) 
                    ? detail.result.labelIds.includes('UNREAD') 
                    : false;

                lista.push({ de: from, assunto: subject, unread: Boolean(isUnread) });
            } catch (msgErr) {
                console.warn("Erro ao ler cabeçalho de mensagem individual:", msgErr.message || msgErr);
            }
        }

        await setDoc(doc(db, "config", "gmail_cache"), {
            mensagens: lista.slice(0, 8),
            ultimaSinc: new Date().toISOString(),
            cacheVersion: 2,
            clearedAt: deleteField(),
            clearedBy: deleteField(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        atualizarStatusBotaoGmail('sincronizado');
    } catch (err) {
        console.error("Erro ao sincronizar Gmail com Firestore:", err.message || err);
        atualizarStatusBotaoGmail('erro');
        renderGmailStatusArea(null, true, "Erro na sincronização do Gmail com o Firestore.");
    } finally {
        isSyncingGmail = false;
    }
}

window.desconectarGmail = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
        const token = (window.gapi && gapi.client && typeof gapi.client.getToken === 'function') ? gapi.client.getToken() : null;
        if (token && token.access_token && window.google && google.accounts && google.accounts.oauth2) {
            try {
                google.accounts.oauth2.revoke(token.access_token, () => {
                    console.log("Token Google revogado com sucesso.");
                });
            } catch (revErr) {
                console.warn("Aviso na revogação remota do token:", revErr.message || revErr);
            }
        }
        if (window.gapi && gapi.client && typeof gapi.client.setToken === 'function') {
            gapi.client.setToken(null);
        }
    } catch (err) {
        console.warn("Erro durante processo de desconexão local:", err);
    }
    localGmailUserEmail = null;
    isSyncingGmail = false;
    atualizarUIContaGmailLocal();
    atualizarStatusBotaoGmail('idle');
    alert("A desconexão encerra o acesso neste navegador, mas mantém o último cache compartilhado.");
};

window.abrirModalLimparCacheGmail = (e) => {
    if (e && e.stopPropagation) {
        e.stopPropagation();
        lastFocusedElementGmailClear = e.currentTarget || document.activeElement;
    } else {
        lastFocusedElementGmailClear = document.activeElement;
    }
    const respInput = document.getElementById('gmail-limpar-cache-resp');
    if (respInput) respInput.value = '';
    const errEl = document.getElementById('gmail-limpar-cache-error');
    if (errEl) errEl.classList.add('hidden');
    const modal = document.getElementById('modal-gmail-limpar-cache');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.remove('hidden');
    }
    setTimeout(() => {
        if (respInput) respInput.focus();
    }, 50);
};

function modalGmailLimparTemDadosNaoSalvos() {
    const respInput = document.getElementById('gmail-limpar-cache-resp');
    return Boolean(respInput && respInput.value && respInput.value.trim().length > 0);
}

window.fecharModalLimparCacheGmail = (e, forcar = false) => {
    if (e && e.stopPropagation) e.stopPropagation();

    if (!forcar && modalGmailLimparTemDadosNaoSalvos()) {
        const confirmou = confirm("Existem informações preenchidas. Deseja descartar e fechar?");
        if (!confirmou) {
            const respInput = document.getElementById('gmail-limpar-cache-resp');
            if (respInput) {
                setTimeout(() => respInput.focus(), 50);
            }
            return false;
        }
    }

    const modal = document.getElementById('modal-gmail-limpar-cache');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
    const respInput = document.getElementById('gmail-limpar-cache-resp');
    if (respInput) respInput.value = '';
    const errEl = document.getElementById('gmail-limpar-cache-error');
    if (errEl) errEl.classList.add('hidden');
    if (lastFocusedElementGmailClear && typeof lastFocusedElementGmailClear.focus === 'function') {
        try { lastFocusedElementGmailClear.focus(); } catch (err) {}
        lastFocusedElementGmailClear = null;
    }
    return true;
};

window.confirmarLimpezaCacheGmail = async () => {
    const respInput = document.getElementById('gmail-limpar-cache-resp');
    const resp = (respInput?.value || '').trim();
    const errEl = document.getElementById('gmail-limpar-cache-error');
    const btn = document.getElementById('btn-confirmar-limpar-gmail');

    if (!resp) {
        if (errEl) {
            errEl.textContent = "Informe o responsável pela limpeza.";
            errEl.classList.remove('hidden');
        }
        respInput?.focus();
        return;
    }

    if (isClearingGmailCache) return;
    isClearingGmailCache = true;
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Limpando...";
    }

    try {
        await setDoc(doc(db, "config", "gmail_cache"), {
            mensagens: [],
            ultimaSinc: null,
            cacheVersion: 2,
            clearedAt: serverTimestamp(),
            clearedBy: resp,
            updatedAt: serverTimestamp()
        }, { merge: true });

        window.fecharModalLimparCacheGmail(null, true);
    } catch (err) {
        console.error("Erro ao limpar cache do Gmail:", err.message || err);
        if (errEl) {
            errEl.textContent = err.message || "Erro ao limpar cache do Gmail.";
            errEl.classList.remove('hidden');
        }
    } finally {
        isClearingGmailCache = false;
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Confirmar Limpeza";
        }
    }
};

// ==========================================
// 5B. TERÇO E LITURGIA DIÁRIA API
// ==========================================
function setTercoDoDia() {
    const mysteries = [
        "Gloriosos", // Domingo
        "Gozosos",   // Segunda
        "Dolorosos", // Terça
        "Gloriosos", // Quarta
        "Luminosos", // Quinta
        "Dolorosos", // Sexta
        "Gozosos"    // Sábado
    ];
    const today = new Date().getDay();
    const mystery = mysteries[today];
    
    const lgEl = document.getElementById('terco-dia-lg');
    const smEl = document.getElementById('terco-dia-sm');
    
    if (lgEl) lgEl.innerText = mystery;
    if (smEl) smEl.innerText = mystery;
}

async function fetchLiturgia() {
    try {
        const resp = await fetch('https://liturgia.up.railway.app/');
        const data = await resp.json();
        
        const titleEl = document.getElementById('liturgia-titulo');
        const previaEl = document.getElementById('liturgia-previa');
        
        if (titleEl && data.evangelho && data.evangelho.referencia) {
            titleEl.innerText = `Evangelho (${data.evangelho.referencia})`;
        }
        if (previaEl && data.evangelho && data.evangelho.texto) {
            let limit = data.evangelho.texto.substring(0, 110);
            previaEl.innerText = `"${limit}..."`;
        }
    } catch (e) {
        console.error("Erro ao buscar liturgia", e);
        const titleEl = document.getElementById('liturgia-titulo');
        const previaEl = document.getElementById('liturgia-previa');
        if (titleEl) titleEl.innerText = "Liturgia de Hoje";
        if (previaEl) previaEl.innerText = "Mergulhe na palavra do dia e assista à homilia.";
    }
}

// ==========================================
// 6. OPERAÇÕES CRUD GERAIS
// ==========================================




function isValidMapsUrl(url) {
    if (!url) return false;
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return false;
        if (!u.hostname) return false;
        if (u.username || u.password) return false;
        
        const h = u.hostname.toLowerCase();
        const exactHosts = [
            'maps.app.goo.gl',
            'goo.gl',
            'maps.google.com',
            'maps.google.com.br',
            'www.google.com',
            'google.com',
            'www.google.com.br',
            'google.com.br'
        ];
        if (exactHosts.includes(h)) return true;
        if (h.endsWith('.google.com') || h.endsWith('.google.com.br')) return true;
        if (/^maps\.google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h)) return true;
        if (/^www\.google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h)) return true;
        
        return false;
    } catch {
        return false;
    }
}

function isValidReceiptUrl(url) {
    if (!url) return false;
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return false;
        if (!u.hostname) return false;
        if (u.username || u.password) return false;
        return true;
    } catch {
        return false;
    }
}

window.addFinanceiro = async () => {
    const dataEl = document.getElementById('caixa-data');
    const descEl = document.getElementById('caixa-desc');
    const valorEl = document.getElementById('caixa-valor');
    const responsavelEl = document.getElementById('caixa-responsavel');
    const destinoEl = document.getElementById('caixa-destino');
    const tipoEl = document.getElementById('caixa-tipo');
    const categoriaEl = document.getElementById('caixa-categoria');
    const pagamentoEl = document.getElementById('caixa-pagamento');
    const comprovanteEl = document.getElementById('caixa-comprovante');
    const obsEl = document.getElementById('caixa-obs');
    const errorEl = document.getElementById('caixa-error');
    const successEl = document.getElementById('caixa-success');
    const btn = document.getElementById('btn-add-financeiro');

    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    const data = dataEl.value;
    const desc = descEl.value.trim();
    const valor = Number(valorEl.value);
    const responsavel = responsavelEl.value.trim();
    const destino = destinoEl.value;
    const tipo = tipoEl.value;
    const categoria = categoriaEl.value;
    const pagamento = pagamentoEl.value;
    const comprovanteUrl = comprovanteEl.value.trim();
    const observacao = obsEl.value.trim();

    if (!data || !desc || !valorEl.value || !responsavel || !destino || !tipo || !categoria || !pagamento) {
        errorEl.innerText = "Preencha todos os campos obrigatórios.";
        errorEl.classList.remove('hidden');
        return;
    }
    
    if (valor <= 0 || isNaN(valor) || !isFinite(valor)) {
        errorEl.innerText = "O valor deve ser numérico e maior que zero.";
        errorEl.classList.remove('hidden');
        return;
    }

    if (comprovanteUrl && !isValidReceiptUrl(comprovanteUrl)) {
        errorEl.innerText = "A URL do comprovante deve ser válida, usar https:// e não conter credenciais.";
        errorEl.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.innerText = "Salvando...";

    try {
        await addDoc(collection(db, "caixa"), {
            desc: desc,
            valor: valor, 
            destino: destino,
            tipo: tipo,
            dataMovimentacao: data,
            responsavel: responsavel,
            categoria: categoria,
            formaPagamento: pagamento,
            observacao: observacao,
            comprovanteUrl: comprovanteUrl,
            status: "active",
            recordKind: "transaction",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        descEl.value = "";
        valorEl.value = "";
        responsavelEl.value = "";
        comprovanteEl.value = "";
        obsEl.value = "";
        
        successEl.classList.remove('hidden');
        setTimeout(() => successEl.classList.add('hidden'), 3000);
    } catch (e) {
        console.error("Erro ao salvar:", e);
        errorEl.innerText = "Erro interno ao salvar. Tente novamente.";
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirmar Lançamento";
    }
};

let transacoesGlobais = [];

window.aplicarFiltrosCaixa = () => {
    if (!transacoesGlobais || transacoesGlobais.length === 0) {
        renderTransacoesFiltradas([]);
        return;
    }

    const busca = document.getElementById('filtro-busca').value.trim().toLowerCase();
    const dataInicio = document.getElementById('filtro-data-inicio').value;
    const dataFim = document.getElementById('filtro-data-fim').value;
    const destino = document.getElementById('filtro-destino').value;
    const tipo = document.getElementById('filtro-tipo').value;
    
    let categoria = '';
    const catEl = document.getElementById('filtro-categoria');
    if(catEl) categoria = catEl.value;

    const status = document.getElementById('filtro-status').value;
    const responsavel = document.getElementById('filtro-responsavel').value.trim().toLowerCase();

    const normalizar = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

    const filtradas = transacoesGlobais.filter(t => {
        const tData = t.dataMovimentacao || (t.data ? t.data.split('T')[0] : '');
        if (dataInicio && tData < dataInicio) return false;
        if (dataFim && tData > dataFim) return false;
        if (destino && t.destino !== destino) return false;
        if (tipo && t.tipo !== tipo) return false;
        
        if (categoria) {
            const tCat = t.categoria || "Sem categoria";
            if (tCat !== categoria) return false;
        }

        if (status) {
            if (status === 'reversed') {
                if (t.reversed !== true) return false;
            } else if (status === 'reversal') {
                if (t.recordKind !== 'reversal') return false;
            } else {
                const tStatus = t.status || "active";
                if (tStatus !== status) return false;
            }
        }
        
        if (responsavel) {
            const respNormal = normalizar((t.responsavel || "Não informado").toLowerCase());
            if (!respNormal.includes(normalizar(responsavel))) return false;
        }

        if (busca) {
            const descNormal = normalizar((t.desc || '').toLowerCase());
            if (!descNormal.includes(normalizar(busca))) return false;
        }

        return true;
    });

    renderTransacoesFiltradas(filtradas);
};

window.limparFiltrosCaixa = () => {
    document.getElementById('filtro-busca').value = "";
    document.getElementById('filtro-data-inicio').value = "";
    document.getElementById('filtro-data-fim').value = "";
    document.getElementById('filtro-destino').value = "";
    document.getElementById('filtro-tipo').value = "";
    const catEl = document.getElementById('filtro-categoria');
    if(catEl) catEl.value = "";
    document.getElementById('filtro-status').value = "";
    document.getElementById('filtro-responsavel').value = "";
    aplicarFiltrosCaixa();
};

window.exportarCSV = () => {
    const filtradas = document.caixaFiltradas || [];
    if (filtradas.length === 0) return alert("Nenhum dado para exportar.");

    let csv = "\uFEFFData;Descrição;Tipo;Valor;Destino;Responsável;Categoria;Forma de Pagamento;Status;Observação;Comprovante;ID do Documento;ID do Lançamento Original\n";
    
    filtradas.forEach(t => {
        const data = t.dataMovimentacao || (t.data ? t.data.split('T')[0] : '');
        const desc = t.desc;
        const tipo = t.tipo === 'in' ? 'Entrada' : 'Saída';
        const valor = Number(t.valor || 0).toFixed(2);
        const destino = t.destino || 'viagem';
        const responsavel = t.responsavel || 'Não informado';
        const categoria = t.categoria || 'Sem categoria';
        const pagamento = t.formaPagamento || 'Não informada';
        
        let status = 'Ativo';
        const tStatus = t.status || 'active';
        if (tStatus === 'cancelled') status = 'Cancelado';
        else if (t.reversed === true) status = 'Estornado';
        else if (t.recordKind === 'reversal') status = 'Estorno';
        
        const obs = t.observacao || '';
        const comp = t.comprovanteUrl || '';
        const idDoc = t.id || '';
        const origId = t.originalTransactionId || '';

        const sanitize = (str) => {
            if (typeof str !== 'string') return str;
            let s = str.replace(/"/g, '""').replace(/\n/g, ' ');
            if (s.trim().match(/^[=+\-@]/)) s = "'" + s;
            return '"' + s + '"';
        };

        csv += [data, desc, tipo, valor, destino, responsavel, categoria, pagamento, status, obs, comp, idDoc, origId].map(sanitize).join(';') + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `financeiro_missao_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


// ==========================================
// 6B. UTILITÁRIOS E SEGURANÇA DO REPERTÓRIO
// ==========================================
const CATEGORIAS_MUSICA = [
    "Autoral",
    "Animação",
    "Louvor",
    "Adoração",
    "Mariana",
    "Espírito Santo",
    "Comunhão",
    "Entrada",
    "Ofertório",
    "Final",
    "Outra"
];

function extrairTextoHtmlLegado(html) {
    if (!html || typeof html !== 'string') return '';
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const toRemove = doc.querySelectorAll('script, style, noscript, iframe, object, embed, svg');
        toRemove.forEach(el => el.remove());
        
        doc.querySelectorAll('br').forEach(br => {
            br.replaceWith(doc.createTextNode('\n'));
        });
        doc.querySelectorAll('p, div, tr, li, h1, h2, h3, h4, h5, h6').forEach(el => {
            el.appendChild(doc.createTextNode('\n'));
        });
        
        const rawText = doc.body ? (doc.body.textContent || '') : '';
        return rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
        console.warn("Erro ao extrair texto do HTML legado");
        return html.replace(/<[^>]*>/g, '').trim();
    }
}

function obterTextoLetra(l) {
    if (!l) return '';
    if (typeof l.corpoTexto === 'string' && l.corpoTexto.length > 0) {
        return l.corpoTexto;
    }
    if (typeof l.corpo === 'string' && l.corpo.length > 0) {
        return extrairTextoHtmlLegado(l.corpo);
    }
    return '';
}

function validarAudioUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return { valido: true, url: '' };
    const trimmed = urlStr.trim();
    if (!trimmed) return { valido: true, url: '' };
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:') {
            return { valido: false, erro: 'O link de áudio deve utilizar o protocolo seguro HTTPS.' };
        }
        if (parsed.username || parsed.password) {
            return { valido: false, erro: 'URLs com credenciais embutidas não são permitidas.' };
        }
        return { valido: true, url: parsed.href };
    } catch (e) {
        return { valido: false, erro: 'URL de áudio inválida. Certifique-se de incluir https://' };
    }
}

function validarBpm(bpmVal) {
    if (bpmVal === '' || bpmVal === null || bpmVal === undefined) return { valido: true, bpm: null };
    const num = Number(bpmVal);
    if (!Number.isInteger(num) || num < 20 || num > 300) {
        return { valido: false, erro: 'O BPM deve ser um número inteiro entre 20 e 300.' };
    }
    return { valido: true, bpm: num };
}

function mostrarErroLetra(msg) {
    const errorEl = document.getElementById('letra-error');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    } else {
        alert(msg);
    }
}

function limparFormularioLetra() {
    if (document.getElementById('letra-titulo')) document.getElementById('letra-titulo').value = "";
    if (document.getElementById('letra-tom')) document.getElementById('letra-tom').value = "";
    if (document.getElementById('letra-categoria')) document.getElementById('letra-categoria').value = "";
    if (document.getElementById('letra-interprete')) document.getElementById('letra-interprete').value = "";
    if (document.getElementById('letra-bpm')) document.getElementById('letra-bpm').value = "";
    if (document.getElementById('letra-audio')) document.getElementById('letra-audio').value = "";
    if (document.getElementById('letra-corpo-texto')) document.getElementById('letra-corpo-texto').value = "";
    if (document.getElementById('letra-obs')) document.getElementById('letra-obs').value = "";
    const errorEl = document.getElementById('letra-error');
    if (errorEl) errorEl.classList.add('hidden');
}

window.addLetra = async () => {
    const errorEl = document.getElementById('letra-error');
    const successEl = document.getElementById('letra-success');
    const btnSalvar = document.getElementById('btn-salvar-letra');
    
    if (errorEl) errorEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');

    const titulo = (document.getElementById('letra-titulo')?.value || '').trim();
    const tom = (document.getElementById('letra-tom')?.value || '').trim();
    const categoria = (document.getElementById('letra-categoria')?.value || '').trim();
    const interprete = (document.getElementById('letra-interprete')?.value || '').trim();
    const bpmInput = document.getElementById('letra-bpm')?.value;
    const audioInput = document.getElementById('letra-audio')?.value;
    const corpoTexto = document.getElementById('letra-corpo-texto')?.value || '';
    const observacoes = (document.getElementById('letra-obs')?.value || '').trim();

    if (!titulo) {
        mostrarErroLetra("Preencha o título da música!");
        document.getElementById('letra-titulo')?.focus();
        return;
    }

    if (!categoria) {
        mostrarErroLetra("Selecione uma categoria para a música!");
        document.getElementById('letra-categoria')?.focus();
        return;
    }

    if (!corpoTexto.trim()) {
        mostrarErroLetra("Preencha a letra/cifra da música!");
        document.getElementById('letra-corpo-texto')?.focus();
        return;
    }

    const valBpm = validarBpm(bpmInput);
    if (!valBpm.valido) {
        mostrarErroLetra(valBpm.erro);
        document.getElementById('letra-bpm')?.focus();
        return;
    }

    const valAudio = validarAudioUrl(audioInput);
    if (!valAudio.valido) {
        mostrarErroLetra(valAudio.erro);
        document.getElementById('letra-audio')?.focus();
        return;
    }

    if (isSavingLetra) return;
    isSavingLetra = true;
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.textContent = "Salvando Música...";
    }

    try {
        if (editandoLetraId) {
            const docRef = doc(db, "letras", editandoLetraId);
            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(docRef);
                if (!snap.exists()) throw new Error("Música não encontrada para edição.");
                const currentData = snap.data();
                if (currentData.status === 'archived') {
                    throw new Error("Músicas arquivadas não podem ser editadas.");
                }
                transaction.update(docRef, {
                    titulo,
                    tom,
                    corpoTexto,
                    categoria,
                    interprete,
                    bpm: valBpm.bpm,
                    observacoes,
                    audioUrl: valAudio.url,
                    formatVersion: 2,
                    updatedAt: serverTimestamp()
                });
            });
            cancelarEdicaoLetra();
        } else {
            await addDoc(collection(db, "letras"), {
                titulo,
                tom,
                corpoTexto,
                categoria,
                interprete,
                bpm: valBpm.bpm,
                observacoes,
                audioUrl: valAudio.url,
                pinned: false,
                status: "active",
                formatVersion: 2,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            limparFormularioLetra();
        }

        if (successEl) {
            successEl.classList.remove('hidden');
            setTimeout(() => { if (successEl) successEl.classList.add('hidden'); }, 4000);
        }
    } catch (err) {
        console.error("Erro ao salvar música:", err.message || err);
        mostrarErroLetra(err.message || "Erro ao salvar música. Tente novamente.");
    } finally {
        isSavingLetra = false;
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.textContent = editandoLetraId ? "Atualizar Música" : "Salvar Música";
        }
    }
};

window.prepararEdicaoLetra = (l, e) => {
    if (e) e.stopPropagation();
    if (!l || !l.id) return;
    if (l.status === 'archived') {
        alert("Músicas arquivadas não podem ser editadas. Restaure-a primeiro.");
        return;
    }
    editandoLetraId = l.id;
    if (document.getElementById('letra-titulo')) document.getElementById('letra-titulo').value = l.titulo || '';
    if (document.getElementById('letra-tom')) document.getElementById('letra-tom').value = l.tom || '';
    if (document.getElementById('letra-categoria')) document.getElementById('letra-categoria').value = l.categoria || '';
    if (document.getElementById('letra-interprete')) document.getElementById('letra-interprete').value = l.interprete || '';
    if (document.getElementById('letra-bpm')) document.getElementById('letra-bpm').value = (l.bpm !== undefined && l.bpm !== null) ? l.bpm : '';
    if (document.getElementById('letra-audio')) document.getElementById('letra-audio').value = l.audioUrl || '';
    if (document.getElementById('letra-corpo-texto')) document.getElementById('letra-corpo-texto').value = obterTextoLetra(l);
    if (document.getElementById('letra-obs')) document.getElementById('letra-obs').value = l.observacoes || '';

    const cancelBtn = document.getElementById('btn-letra-cancel');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    const formTitle = document.getElementById('letras-form-title');
    if (formTitle) formTitle.textContent = "Editar Música";

    const saveBtn = document.getElementById('btn-salvar-letra');
    if (saveBtn) saveBtn.textContent = "Atualizar Música";

    const formContainer = document.getElementById('form-letras-container');
    if (formContainer) formContainer.scrollIntoView({ behavior: getScrollBehavior() });
};

window.cancelarEdicaoLetra = () => {
    editandoLetraId = null;
    limparFormularioLetra();
    const cancelBtn = document.getElementById('btn-letra-cancel');
    if (cancelBtn) cancelBtn.classList.add('hidden');

    const formTitle = document.getElementById('letras-form-title');
    if (formTitle) formTitle.textContent = "Cadastrar Nova Música";

    const saveBtn = document.getElementById('btn-salvar-letra');
    if (saveBtn) saveBtn.textContent = "Salvar Música";
};

window.togglePinLetra = async (id, currentPinned, e) => {
    if (e) e.stopPropagation();
    try {
        const docRef = doc(db, "letras", id);
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(docRef);
            if (!snap.exists()) throw new Error("Música não encontrada.");
            const data = snap.data();
            if (data.status === 'archived') {
                throw new Error("Músicas arquivadas não podem ser fixadas.");
            }
            transaction.update(docRef, {
                pinned: !Boolean(data.pinned),
                updatedAt: serverTimestamp()
            });
        });
    } catch (err) {
        console.error("Erro ao fixar/desafixar música:", err.message || err);
        alert(err.message || "Erro ao fixar música.");
    }
};

window.abrirModalArquivarLetra = (id, e) => {
    if (e) {
        e.stopPropagation();
        lastFocusedElementLetraArchive = e.currentTarget || document.activeElement;
    } else {
        lastFocusedElementLetraArchive = document.activeElement;
    }
    letraAtualArquivamento = id;
    const respInput = document.getElementById('arquivar-letra-resp');
    if (respInput) respInput.value = '';
    const errEl = document.getElementById('arquivar-letra-error');
    if (errEl) errEl.classList.add('hidden');
    const modal = document.getElementById('modal-letra-arquivar');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.remove('hidden');
    }
    setTimeout(() => {
        if (respInput) respInput.focus();
    }, 50);
};

window.fecharModalArquivarLetra = (e, forcar = false) => {
    if (e) e.stopPropagation();

    // Se o fechamento foi pelo clique no fundo e há texto digitado, pedir confirmação
    if (!forcar && e && e.target && e.target.id === 'modal-letra-arquivar') {
        const respInput = document.getElementById('arquivar-letra-resp');
        if (respInput && respInput.value.trim() !== '') {
            if (!confirm("Existem informações preenchidas. Deseja descartar e fechar?")) {
                return;
            }
        }
    }

    const modal = document.getElementById('modal-letra-arquivar');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
    const respInput = document.getElementById('arquivar-letra-resp');
    if (respInput) respInput.value = '';
    const errEl = document.getElementById('arquivar-letra-error');
    if (errEl) errEl.classList.add('hidden');
    letraAtualArquivamento = null;

    if (lastFocusedElementLetraArchive && typeof lastFocusedElementLetraArchive.focus === 'function') {
        try { lastFocusedElementLetraArchive.focus(); } catch (err) {}
        lastFocusedElementLetraArchive = null;
    }
};

window.confirmarArquivamentoLetra = async () => {
    if (!letraAtualArquivamento) return;
    const resp = (document.getElementById('arquivar-letra-resp')?.value || '').trim();
    const errEl = document.getElementById('arquivar-letra-error');
    const btn = document.getElementById('btn-confirmar-arquivar-letra');

    if (!resp) {
        if (errEl) {
            errEl.textContent = "Informe o responsável pelo arquivamento.";
            errEl.classList.remove('hidden');
        }
        document.getElementById('arquivar-letra-resp')?.focus();
        return;
    }

    if (isArchivingLetra) return;
    isArchivingLetra = true;

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Arquivando...";
    }

    try {
        const docRef = doc(db, "letras", letraAtualArquivamento);
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(docRef);
            if (!snap.exists()) throw new Error("Música não encontrada.");
            const data = snap.data();
            if (data.status === 'archived') throw new Error("Esta música já está arquivada.");
            transaction.update(docRef, {
                status: "archived",
                pinned: false,
                archivedAt: serverTimestamp(),
                archivedBy: resp,
                updatedAt: serverTimestamp()
            });
        });
        fecharModalArquivarLetra(null, true);
    } catch (err) {
        console.error("Erro ao arquivar música:", err.message || err);
        if (errEl) {
            errEl.textContent = err.message || "Erro ao arquivar música.";
            errEl.classList.remove('hidden');
        }
    } finally {
        isArchivingLetra = false;
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Confirmar Arquivamento";
        }
    }
};

window.abrirModalRestaurarLetra = (id, e) => {
    if (e) {
        e.stopPropagation();
        lastFocusedElementLetraRestore = e.currentTarget || document.activeElement;
    } else {
        lastFocusedElementLetraRestore = document.activeElement;
    }
    letraAtualRestauracao = id;
    const respInput = document.getElementById('restaurar-letra-resp');
    if (respInput) respInput.value = '';
    const errEl = document.getElementById('restaurar-letra-error');
    if (errEl) errEl.classList.add('hidden');
    const modal = document.getElementById('modal-letra-restaurar');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.remove('hidden');
    }
    setTimeout(() => {
        if (respInput) respInput.focus();
    }, 50);
};

window.fecharModalRestaurarLetra = (e, forcar = false) => {
    if (e) e.stopPropagation();

    // Se o fechamento foi pelo clique no fundo e há texto digitado, pedir confirmação
    if (!forcar && e && e.target && e.target.id === 'modal-letra-restaurar') {
        const respInput = document.getElementById('restaurar-letra-resp');
        if (respInput && respInput.value.trim() !== '') {
            if (!confirm("Existem informações preenchidas. Deseja descartar e fechar?")) {
                return;
            }
        }
    }

    const modal = document.getElementById('modal-letra-restaurar');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
    const respInput = document.getElementById('restaurar-letra-resp');
    if (respInput) respInput.value = '';
    const errEl = document.getElementById('restaurar-letra-error');
    if (errEl) errEl.classList.add('hidden');
    letraAtualRestauracao = null;

    if (lastFocusedElementLetraRestore && typeof lastFocusedElementLetraRestore.focus === 'function') {
        try { lastFocusedElementLetraRestore.focus(); } catch (err) {}
        lastFocusedElementLetraRestore = null;
    }
};

window.confirmarRestauracaoLetra = async () => {
    if (!letraAtualRestauracao) return;
    const resp = (document.getElementById('restaurar-letra-resp')?.value || '').trim();
    const errEl = document.getElementById('restaurar-letra-error');
    const btn = document.getElementById('btn-confirmar-restaurar-letra');

    if (!resp) {
        if (errEl) {
            errEl.textContent = "Informe o responsável pela restauração.";
            errEl.classList.remove('hidden');
        }
        document.getElementById('restaurar-letra-resp')?.focus();
        return;
    }

    if (isRestoringLetra) return;
    isRestoringLetra = true;

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Restaurando...";
    }

    try {
        const docRef = doc(db, "letras", letraAtualRestauracao);
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(docRef);
            if (!snap.exists()) throw new Error("Música não encontrada.");
            const data = snap.data();
            if (data.status !== 'archived') throw new Error("Esta música já está ativa.");
            transaction.update(docRef, {
                status: "active",
                restoredAt: serverTimestamp(),
                restoredBy: resp,
                updatedAt: serverTimestamp()
            });
        });
        fecharModalRestaurarLetra(null, true);
    } catch (err) {
        console.error("Erro ao restaurar música:", err.message || err);
        if (errEl) {
            errEl.textContent = err.message || "Erro ao restaurar música.";
            errEl.classList.remove('hidden');
        }
    } finally {
        isRestoringLetra = false;
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Confirmar Restauração";
        }
    }
};

window.saveSocialStats = async () => {
    const ig = document.getElementById('input-ig').value;
    const yt = document.getElementById('input-yt').value;
    const sp = document.getElementById('input-sp').value;
    await setDoc(doc(db, "config", "social"), { ig: ig || 0, yt: yt || 0, sp: sp || 0 });
    document.getElementById('social-modal').style.display = 'none';
};

window.deleteItem = async (col, id, e) => {
    if (col === 'agenda' || col === 'caixa' || col === 'letras') {
        alert("A exclusão definitiva está desativada para esta seção. Use as opções de arquivamento/cancelamento/estorno.");
        return;
    }
    if(e) e.stopPropagation();
    if(confirm("Excluir permanentemente?")) await deleteDoc(doc(db, col, id));
};

window.prepararEdicaoSocial = () => {
    document.getElementById('input-ig').value = document.getElementById('count-instagram').innerText.replace(/\./g, '').replace(/,/g, '');
    document.getElementById('input-yt').value = document.getElementById('count-youtube').innerText.replace(/\./g, '').replace(/,/g, '');
    document.getElementById('input-sp').value = document.getElementById('count-spotify').innerText.replace(/\./g, '').replace(/,/g, '');
    document.getElementById('social-modal').style.display = 'block';
};

// ==========================================
// 7. RENDERIZADORES
// ==========================================

function renderAgenda(agenda) {
    agendaGlobais = agenda || [];
    aplicarFiltrosAgenda();
    atualizarDashboardAgenda();
}

function renderAgendaFiltrada(filtradas) {
    const list = document.getElementById('list-agenda');
    if (!list) return;

    list.innerHTML = '';
    
    if (filtradas.length === 0) {
        const p = document.createElement('p');
        p.className = "p-10 text-center text-slate-400 italic text-sm";
        p.textContent = "Nenhum compromisso correspondente aos filtros.";
        list.appendChild(p);
        return;
    }

    // Sort: Upcoming (nearest first), Concluded/Cancelled (most recent first)
    const eventosOrdenados = [...filtradas].sort((a,b) => {
        const dA = a.data + (a.horaInicio ? "T" + a.horaInicio : "T00:00");
        const dB = b.data + (b.horaInicio ? "T" + b.horaInicio : "T00:00");
        
        const aPassou = agendaValidador.eventoPassou(a);
        const bPassou = agendaValidador.eventoPassou(b);
        const aCancel = a.status === 'cancelled';
        const bCancel = b.status === 'cancelled';
        
        const aInativo = aPassou || aCancel;
        const bInativo = bPassou || bCancel;
        
        if (aInativo && !bInativo) return 1;
        if (!aInativo && bInativo) return -1;
        
        if (!aInativo && !bInativo) {
            return dA.localeCompare(dB); // nearest future
        } else {
            return dB.localeCompare(dA); // most recent past/cancelled
        }
    });

    const hojeISO = getHojeLocalISO();

    eventosOrdenados.forEach(evt => {
        const isCancelled = evt.status === 'cancelled';
        const isPast = agendaValidador.eventoPassou(evt);
        const isHoje = evt.data === hojeISO;
        
        const div = document.createElement('div');
        let cardClass = "mission-item p-5 bg-white rounded-2xl shadow-sm mb-2 border border-slate-100 transition-all";
        if (isCancelled) {
            cardClass += " opacity-60 border-red-100 bg-red-50/30";
        } else if (isPast) {
            cardClass += " opacity-70 bg-slate-50";
        }
        div.className = cardClass;
        
        const header = document.createElement('div');
        header.className = "flex justify-between items-start cursor-pointer";
        header.onclick = () => window.toggleEventoDetalhes(evt.id);
        
        const leftDiv = document.createElement('div');
        leftDiv.className = "flex-1 pr-4";
        
        const tagsDiv = document.createElement('div');
        tagsDiv.className = "flex items-center gap-2 mb-1 flex-wrap";
        
        const badgeTag = document.createElement('span');
        let badgeColor = "bg-blue-100 text-blue-700";
        let badgeText = "Próximo";
        let badgeIcon = "fa-calendar-day";
        
        if (isCancelled) {
            badgeColor = "bg-red-100 text-red-700";
            badgeText = "Cancelado";
            badgeIcon = "fa-ban";
        } else if (isPast) {
            badgeColor = "bg-slate-100 text-slate-600";
            badgeText = "Concluído";
            badgeIcon = "fa-check";
        } else if (isHoje) {
            badgeColor = "bg-green-100 text-green-700";
            badgeText = "Hoje";
            badgeIcon = "fa-clock";
        }
        
        badgeTag.className = `text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${badgeColor}`;
        badgeTag.innerHTML = `<i class="fas ${badgeIcon}"></i> ${badgeText}`;
        tagsDiv.appendChild(badgeTag);
        
        const tipoTag = document.createElement('span');
        tipoTag.className = "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-100 text-slate-500";
        tipoTag.textContent = evt.tipo || "Compromisso";
        tagsDiv.appendChild(tipoTag);

        const dataText = document.createElement('span');
        dataText.className = "text-xs font-bold text-gold ml-1";
        dataText.textContent = agendaValidador.formatarDataBR(evt.data);
        tagsDiv.appendChild(dataText);
        
        leftDiv.appendChild(tagsDiv);

        const title = document.createElement('h4');
        title.className = "font-black text-black text-lg mb-1 leading-tight";
        title.textContent = evt.desc;
        if (isCancelled) title.classList.add("line-through", "text-slate-500");
        leftDiv.appendChild(title);
        
        const sub = document.createElement('p');
        sub.className = "text-sm text-slate-500 font-medium flex items-center gap-2";
        const iconLoc = document.createElement('i'); iconLoc.className = "fas fa-location-dot";
        sub.appendChild(iconLoc);
        sub.appendChild(document.createTextNode(" " + (evt.local || "Não informado")));
        if (evt.horaInicio) {
            const spanTime = document.createElement('span');
            spanTime.className = "ml-2 text-slate-400";
            spanTime.innerHTML = `<i class="fas fa-clock"></i> ${evt.horaInicio}${evt.horaFim ? " às " + evt.horaFim : ""}`;
            sub.appendChild(spanTime);
        } else {
            const spanAllDay = document.createElement('span');
            spanAllDay.className = "ml-2 text-slate-400";
            spanAllDay.innerHTML = `<i class="fas fa-sun"></i> Dia Inteiro`;
            sub.appendChild(spanAllDay);
        }
        leftDiv.appendChild(sub);
        
        header.appendChild(leftDiv);

        // Actions
        const rightDiv = document.createElement('div');
        rightDiv.className = "flex flex-col gap-2 items-end";
        
        if (!isCancelled) {
            const btnEdit = document.createElement('button');
            btnEdit.className = "w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-gold hover:bg-gold/10 transition-colors flex items-center justify-center";
            btnEdit.innerHTML = '<i class="fas fa-pen text-xs"></i>';
            btnEdit.title = "Editar evento";
            btnEdit.onclick = (e) => { e.stopPropagation(); window.editarAgenda(evt.id); };
            rightDiv.appendChild(btnEdit);
        }

        if (!isCancelled && !isPast) {
            const btnCancel = document.createElement('button');
            btnCancel.className = "w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center";
            btnCancel.innerHTML = '<i class="fas fa-ban text-xs"></i>';
            btnCancel.title = "Cancelar evento";
            btnCancel.onclick = (e) => { e.stopPropagation(); window.abrirModalAgendaCancelar(evt.id); };
            rightDiv.appendChild(btnCancel);
        }
        
        header.appendChild(rightDiv);
        div.appendChild(header);
        
        // Detalhes Expansíveis
        const detailsDiv = document.createElement('div');
        detailsDiv.id = `evento-detalhes-${evt.id}`;
        detailsDiv.className = "hidden mt-4 pt-4 border-t border-slate-100 space-y-3";
        
        const addInfoLine = (icon, label, value) => {
            if (!value) return;
            const row = document.createElement('div');
            row.className = "flex gap-3 text-sm";
            const ic = document.createElement('div');
            ic.className = "w-5 text-slate-400 text-center";
            ic.innerHTML = `<i class="${icon}"></i>`;
            const vl = document.createElement('div');
            vl.className = "flex-1 text-slate-600";
            const lbl = document.createElement('strong');
            lbl.className = "text-slate-800 mr-1";
            lbl.textContent = label + ":";
            vl.appendChild(lbl);
            vl.appendChild(document.createTextNode(value));
            row.appendChild(ic);
            row.appendChild(vl);
            detailsDiv.appendChild(row);
        };

        if (isCancelled && evt.cancelReason) {
            const row = document.createElement('div');
            row.className = "p-3 bg-red-50 rounded-xl text-red-800 text-sm mb-2 border border-red-100";
            row.innerHTML = `<strong>Motivo do Cancelamento:</strong> `;
            row.appendChild(document.createTextNode(evt.cancelReason));
            if (evt.cancelledBy) {
                row.appendChild(document.createElement('br'));
                row.appendChild(document.createTextNode(`Por: ${evt.cancelledBy}`));
            }
            detailsDiv.appendChild(row);
        }
        
        addInfoLine("fas fa-user", "Responsável", evt.responsavel || "Não informado");
        addInfoLine("fas fa-users", "Participantes", evt.participantes);
        addInfoLine("fas fa-map", "Endereço", evt.endereco);
        addInfoLine("fas fa-align-left", "Observações", evt.observacao);

        if (evt.mapsUrl && isValidMapsUrl(evt.mapsUrl)) {
            const row = document.createElement('div');
            row.className = "flex gap-3 text-sm mt-2";
            const ic = document.createElement('div');
            ic.className = "w-5 text-slate-400 text-center";
            ic.innerHTML = '<i class="fas fa-map-marked-alt text-blue-500"></i>';
            const vl = document.createElement('div');
            const aLink = document.createElement('a');
            aLink.href = evt.mapsUrl;
            aLink.target = "_blank";
            aLink.rel = "noopener noreferrer";
            aLink.className = "text-blue-500 font-bold hover:underline";
            aLink.textContent = "Abrir no Google Maps";
            vl.appendChild(aLink);
            row.appendChild(ic);
            row.appendChild(vl);
            detailsDiv.appendChild(row);
        }

        if (!isCancelled) {
            const actionRow = document.createElement('div');
            actionRow.className = "flex justify-end mt-4";
            const btnIcs = document.createElement('button');
            btnIcs.className = "text-xs font-bold px-4 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-2";
            btnIcs.innerHTML = '<i class="far fa-calendar-plus"></i> Adicionar ao Calendário';
            btnIcs.onclick = () => window.exportarEventoICS(evt.id);
            actionRow.appendChild(btnIcs);
            detailsDiv.appendChild(actionRow);
        }

        div.appendChild(detailsDiv);
        list.appendChild(div);
    });
}

function atualizarDashboardAgenda() {
    const proximas = (agendaGlobais || []).filter(a => {
        if (!a || a.status === 'cancelled') return false;
        if (!agendaValidador.validarData(a.data)) return false;
        return !agendaValidador.eventoPassou(a);
    }).sort((a,b) => {
        const dA = a.data + (a.horaInicio ? "T" + a.horaInicio : "T00:00");
        const dB = b.data + (b.horaInicio ? "T" + b.horaInicio : "T00:00");
        return dA.localeCompare(dB);
    });

    const elNextDesc = document.getElementById('dash-next-desc');
    const elNextLocal = document.getElementById('dash-next-info-local');
    const elNextDate = document.getElementById('dash-next-info-date');
    const elNextMissao = document.getElementById('dash-next-missao');
    
    if (proximas.length > 0) {
        const ev = proximas[0];
        if (elNextDesc) elNextDesc.textContent = ev.desc || "Compromisso";
        if (elNextMissao && !elNextDesc) elNextMissao.textContent = ev.desc || "Compromisso";
        if (elNextLocal) elNextLocal.textContent = ev.local || "Não informado";
        if (elNextDate) {
            let str = agendaValidador.formatarDataBR(ev.data);
            if (ev.horaInicio) str += ` às ${ev.horaInicio}`;
            elNextDate.textContent = str;
        }
    } else {
        if (elNextDesc) elNextDesc.textContent = "Agenda Livre";
        if (elNextMissao && !elNextDesc) elNextMissao.textContent = "Agenda Livre";
        if (elNextLocal) elNextLocal.textContent = "-";
        if (elNextDate) elNextDate.textContent = "-";
    }
}


const formatarBRL = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

function renderCaixa(transacoes) {
    console.log("📊 Dados recebidos do Firestore (Caixa):", transacoes.length);
    transacoesGlobais = transacoes;
    
    let saldos = { viagem: 0, gravacao: 0, rifa: 0 };
    
    transacoes.forEach(t => {
        const tStatus = t.status || 'active';
        if (tStatus === 'cancelled') return;
        
        const isIn = t.tipo === 'in';
        const destinoFinal = t.destino || 'viagem'; 
        let valorNumerico = Number(t.valor);
        
        // Skip invalid numbers quietly
        if (isNaN(valorNumerico) || !isFinite(valorNumerico)) {
            console.warn("Valor inválido ignorado no documento", t.id);
            valorNumerico = 0;
        }
        
        if (saldos.hasOwnProperty(destinoFinal)) {
            saldos[destinoFinal] += isIn ? valorNumerico : -valorNumerico;
        } else {
            saldos.viagem += isIn ? valorNumerico : -valorNumerico;
        }
    });

    if(document.getElementById('saldo-viagem')) document.getElementById('saldo-viagem').innerText = formatarBRL(saldos.viagem);
    if(document.getElementById('saldo-gravacao')) document.getElementById('saldo-gravacao').innerText = formatarBRL(saldos.gravacao);
    if(document.getElementById('saldo-rifa')) document.getElementById('saldo-rifa').innerText = formatarBRL(saldos.rifa);
    
    if(document.getElementById('bar-viagem')) document.getElementById('bar-viagem').style.width = Math.min((saldos.viagem / 1000) * 100, 100) + "%";
    if(document.getElementById('bar-gravacao')) document.getElementById('bar-gravacao').style.width = Math.min((saldos.gravacao / 5000) * 100, 100) + "%";
    if(document.getElementById('bar-rifa')) document.getElementById('bar-rifa').style.width = Math.min((saldos.rifa / 2000) * 100, 100) + "%";

    const totalGeral = saldos.viagem + saldos.gravacao + saldos.rifa;
    const dashSaldo = document.getElementById('dash-saldo-total');
    if (dashSaldo) dashSaldo.innerText = formatarBRL(totalGeral);

    aplicarFiltrosCaixa();
}

function renderTransacoesFiltradas(filtradas) {
    document.caixaFiltradas = filtradas;
    const listExtrato = document.getElementById('list-caixa');
    const countEl = document.getElementById('caixa-filtered-count');
    if(!listExtrato) return;
    
    if(countEl) countEl.innerText = filtradas.length;

    listExtrato.innerHTML = '';

    if(filtradas.length === 0) {
        listExtrato.innerHTML = `<p class="p-10 text-center text-slate-400 italic text-sm">Nenhuma movimentação encontrada com estes filtros.</p>`;
        return;
    }

    const sortedTrans = filtradas.sort((a, b) => {
        const da = a.dataMovimentacao || (a.data ? a.data.split('T')[0] : '');
        const db = b.dataMovimentacao || (b.data ? b.data.split('T')[0] : '');
        if (da !== db) return new Date(db) - new Date(da);
        
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
    });

    sortedTrans.forEach(t => {
        const isIn = t.tipo === 'in';
        const tStatus = t.status || 'active';
        const isCancelled = tStatus === 'cancelled';
        const isEstornado = t.reversed === true;
        const isEstorno = t.recordKind === 'reversal';
        const destinoFinal = t.destino || 'viagem'; 
        const valorNumerico = Number(t.valor) || 0;
        const dataVis = t.dataMovimentacao || (t.data ? t.data.split('T')[0] : 'Não informada');
        const sinal = isIn ? '+' : '';

        const itemDiv = document.createElement('div');
        itemDiv.className = `transaction-item flex flex-col p-4 border-b border-slate-50 hover:bg-slate-50 transition-all ${isCancelled ? 'opacity-60 bg-slate-100' : ''}`;

        const topDiv = document.createElement('div');
        topDiv.className = 'flex justify-between items-start w-full';

        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex items-center gap-3';

        const iconContainer = document.createElement('div');
        iconContainer.className = `w-8 h-8 rounded-full flex items-center justify-center ${isIn ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`;
        
        const icon = document.createElement('i');
        if (isEstorno) {
            icon.className = 'fas fa-undo-alt text-[10px]';
        } else {
            icon.className = `fas ${isIn ? 'fa-arrow-up' : 'fa-arrow-down'} text-[10px]`;
        }
        iconContainer.appendChild(icon);
        leftDiv.appendChild(iconContainer);

        const textDiv = document.createElement('div');
        const h4 = document.createElement('h4');
        h4.className = `font-bold text-slate-800 text-sm ${isCancelled ? 'line-through' : ''}`;
        h4.textContent = t.desc;
        textDiv.appendChild(h4);

        const subP = document.createElement('p');
        subP.className = 'text-[9px] text-slate-400 font-bold uppercase';
        
        let dateArr = dataVis.split('-');
        let dataFmt = dateArr.length === 3 ? `${dateArr[2]}/${dateArr[1]}/${dateArr[0]}` : dataVis;
        subP.textContent = `${destinoFinal} • ${dataFmt} • ${t.categoria || 'Sem categoria'}`;
        textDiv.appendChild(subP);
        leftDiv.appendChild(textDiv);

        topDiv.appendChild(leftDiv);

        const rightDiv = document.createElement('div');
        rightDiv.className = 'flex flex-col items-end gap-1';

        const valorSpan = document.createElement('span');
        valorSpan.className = `font-black text-sm ${isCancelled ? 'text-slate-400 line-through' : (isIn ? 'text-emerald-600' : 'text-red-600')}`;
        valorSpan.textContent = `${sinal} ${formatarBRL(valorNumerico)}`;
        rightDiv.appendChild(valorSpan);

        if (isCancelled) {
            const badge = document.createElement('span');
            badge.className = 'text-[9px] font-black uppercase text-red-500 bg-red-100 px-2 py-0.5 rounded-full';
            badge.textContent = 'Cancelado';
            rightDiv.appendChild(badge);
        } else if (isEstornado) {
            const badge = document.createElement('span');
            badge.className = 'text-[9px] font-black uppercase text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full';
            badge.textContent = 'Estornado';
            rightDiv.appendChild(badge);
        } else if (isEstorno) {
            const badge = document.createElement('span');
            badge.className = 'text-[9px] font-black uppercase text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full';
            badge.textContent = 'Estorno';
            rightDiv.appendChild(badge);
        }

        topDiv.appendChild(rightDiv);
        itemDiv.appendChild(topDiv);

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'mt-3 pl-11 text-xs text-slate-500 hidden grid-cols-1 sm:grid-cols-2 gap-2 w-full';
        
        const rName = t.responsavel || 'Não informado';
        const fp = t.formaPagamento || 'Não informada';
        
        const col1 = document.createElement('div');
        col1.textContent = `Resp: ${rName} | Pgt: ${fp}`;
        detailsDiv.appendChild(col1);

        if (t.observacao || isCancelled || isEstorno) {
            const col2 = document.createElement('div');
            col2.className = 'italic opacity-80';
            if (isCancelled && t.cancelReason) col2.textContent = `Motivo cancelamento: ${t.cancelReason}`;
            else if (isEstorno && t.observacao) col2.textContent = `Motivo estorno: ${t.observacao}`;
            else col2.textContent = t.observacao;
            detailsDiv.appendChild(col2);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'mt-3 pl-11 flex gap-3 w-full border-t border-slate-100 pt-3';
        
        const btnToggle = document.createElement('button');
        btnToggle.className = 'text-xs text-slate-500 hover:text-gold font-bold';
        btnToggle.textContent = 'Ver detalhes';
        btnToggle.onclick = () => {
            if(detailsDiv.classList.contains('hidden')) {
                detailsDiv.classList.remove('hidden');
                detailsDiv.classList.add('grid');
                btnToggle.textContent = 'Ocultar detalhes';
            } else {
                detailsDiv.classList.add('hidden');
                detailsDiv.classList.remove('grid');
                btnToggle.textContent = 'Ver detalhes';
            }
        };
        actionsDiv.appendChild(btnToggle);

        if (isValidReceiptUrl(t.comprovanteUrl)) {
            const btnLink = document.createElement('a');
            btnLink.href = t.comprovanteUrl;
            btnLink.target = '_blank';
            btnLink.rel = 'noopener noreferrer';
            btnLink.className = 'text-xs text-emerald-600 hover:text-emerald-700 font-bold';
            btnLink.innerHTML = '<i class="fas fa-external-link-alt"></i> Comprovante';
            actionsDiv.appendChild(btnLink);
        }

        if (!isCancelled && !isEstorno && !isEstornado) {
            const btnEstornar = document.createElement('button');
            btnEstornar.className = 'text-xs text-amber-500 hover:text-amber-700 font-bold ml-auto';
            btnEstornar.textContent = 'Estornar';
            btnEstornar.onclick = () => abrirModalEstorno(t.id);
            actionsDiv.appendChild(btnEstornar);

            const btnCancelar = document.createElement('button');
            btnCancelar.className = 'text-xs text-red-400 hover:text-red-600 font-bold';
            btnCancelar.textContent = 'Cancelar';
            btnCancelar.onclick = () => abrirModalCancelar(t.id);
            actionsDiv.appendChild(btnCancelar);
        }

        itemDiv.appendChild(detailsDiv);
        itemDiv.appendChild(actionsDiv);
        
        listExtrato.appendChild(itemDiv);
    });
}

let lancamentoAtualAcao = null;

window.abrirModalCancelar = (id) => {
    lancamentoAtualAcao = id;
    document.getElementById('cancelar-resp').value = '';
    document.getElementById('cancelar-motivo').value = '';
    document.getElementById('cancelar-error').classList.add('hidden');
    document.getElementById('modal-cancelar').style.display = 'block';
    document.getElementById('cancelar-resp').focus();
};

window.fecharModalCancelar = (e, force = false) => {
    if(e) e.stopPropagation();
    
    if (!force) {
        const resp = document.getElementById('cancelar-resp').value.trim();
        const motivo = document.getElementById('cancelar-motivo').value.trim();
        if (resp || motivo) {
            if (!confirm('Deseja descartar o cancelamento? Os dados preenchidos serão perdidos.')) return;
        }
    }
    
    document.getElementById('modal-cancelar').style.display = 'none';
    lancamentoAtualAcao = null;
};

window.confirmarCancelamento = async () => {
    const resp = document.getElementById('cancelar-resp').value.trim();
    const motivo = document.getElementById('cancelar-motivo').value.trim();
    const errorEl = document.getElementById('cancelar-error');
    const btn = document.getElementById('btn-confirmar-cancelar');

    if (!resp || !motivo) {
        errorEl.innerText = 'Preencha o responsável e o motivo.';
        errorEl.classList.remove('hidden');
        return;
    }

    if (!lancamentoAtualAcao) return;

    btn.disabled = true;
    btn.innerText = 'Cancelando...';

    try {
        await runTransaction(db, async (transaction) => {
            const docRef = doc(db, "caixa", lancamentoAtualAcao);
            const docSnap = await transaction.get(docRef);
            
            if (!docSnap.exists()) {
                throw new Error("Lançamento não encontrado.");
            }
            
            const data = docSnap.data();
            if (data.status === 'cancelled') {
                throw new Error("Este lançamento já foi cancelado.");
            }
            if (data.reversed === true || data.reversalId) {
                throw new Error("Lançamento estornado não pode ser cancelado.");
            }
            if (data.recordKind === 'reversal') {
                throw new Error("Não é possível cancelar um registro de estorno.");
            }
            
            transaction.update(docRef, {
                status: "cancelled",
                cancelReason: motivo,
                cancelledBy: resp,
                cancelledAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        });
        
        fecharModalCancelar(null, true);
    } catch (e) {
        console.error("Erro ao cancelar:", e);
        errorEl.innerText = e.message || 'Erro ao processar cancelamento.';
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Confirmar Cancelamento';
    }
};

window.abrirModalEstorno = (id) => {
    lancamentoAtualAcao = id;
    
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    document.getElementById('estorno-data').value = localISOTime;
    
    document.getElementById('estorno-resp').value = '';
    document.getElementById('estorno-motivo').value = '';
    document.getElementById('estorno-error').classList.add('hidden');
    document.getElementById('modal-estorno').style.display = 'block';
    document.getElementById('estorno-resp').focus();
};

window.fecharModalEstorno = (e, force = false) => {
    if(e) e.stopPropagation();
    
    if (!force) {
        const resp = document.getElementById('estorno-resp').value.trim();
        const motivo = document.getElementById('estorno-motivo').value.trim();
        if (resp || motivo) {
            if (!confirm('Deseja descartar o estorno? Os dados preenchidos serão perdidos.')) return;
        }
    }
    
    document.getElementById('modal-estorno').style.display = 'none';
    lancamentoAtualAcao = null;
};

window.confirmarEstorno = async () => {
    const dataMov = document.getElementById('estorno-data').value;
    const resp = document.getElementById('estorno-resp').value.trim();
    const motivo = document.getElementById('estorno-motivo').value.trim();
    const errorEl = document.getElementById('estorno-error');
    const btn = document.getElementById('btn-confirmar-estorno');

    if (!dataMov || !resp || !motivo) {
        errorEl.innerText = 'Preencha a data, responsável e motivo.';
        errorEl.classList.remove('hidden');
        return;
    }

    if (!lancamentoAtualAcao) return;

    btn.disabled = true;
    btn.innerText = 'Estornando...';

    try {
        await runTransaction(db, async (transaction) => {
            const originalDocRef = doc(db, "caixa", lancamentoAtualAcao);
            const originalSnap = await transaction.get(originalDocRef);
            
            if (!originalSnap.exists()) {
                throw new Error("Lançamento não encontrado.");
            }
            
            const original = originalSnap.data();
            if (original.status === 'cancelled') {
                throw new Error("Lançamento cancelado não pode ser estornado.");
            }
            if (original.reversed === true || original.reversalId) {
                throw new Error("Este lançamento já foi estornado.");
            }
            if (original.recordKind === 'reversal') {
                throw new Error("Não é possível estornar um registro de estorno.");
            }
            
            const novoDocRef = doc(collection(db, "caixa"));
            
            transaction.set(novoDocRef, {
                desc: "ESTORNO: " + original.desc,
                valor: Number(original.valor || 0),
                destino: original.destino || "viagem",
                tipo: original.tipo === 'in' ? 'out' : 'in',
                dataMovimentacao: dataMov,
                responsavel: resp,
                categoria: original.categoria || "Estorno",
                formaPagamento: original.formaPagamento || "Não informada",
                observacao: motivo,
                comprovanteUrl: "",
                status: "active",
                recordKind: "reversal",
                originalTransactionId: lancamentoAtualAcao,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            transaction.update(originalDocRef, {
                reversed: true,
                reversalId: novoDocRef.id,
                reversedAt: serverTimestamp(),
                reversedBy: resp,
                updatedAt: serverTimestamp()
            });
        });

        fecharModalEstorno(null, true);
    } catch (e) {
        console.error("Erro ao estornar:", e);
        errorEl.innerText = e.message || 'Erro ao processar estorno. Tente novamente.';
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Confirmar Estorno';
    }
};

document.addEventListener('keydown', (e) => {
    // Focus trapping para modais de repertório abertos
    const modalLetras = document.getElementById('lyric-modal');
    const isModalLetrasOpen = modalLetras && (modalLetras.style.display === 'block' || !modalLetras.classList.contains('hidden'));

    const modalLetraArquivar = document.getElementById('modal-letra-arquivar');
    const isModalLetraArquivarOpen = modalLetraArquivar && (modalLetraArquivar.style.display === 'block' || !modalLetraArquivar.classList.contains('hidden'));

    const modalLetraRestaurar = document.getElementById('modal-letra-restaurar');
    const isModalLetraRestaurarOpen = modalLetraRestaurar && (modalLetraRestaurar.style.display === 'block' || !modalLetraRestaurar.classList.contains('hidden'));

    const modalGmailLimpar = document.getElementById('modal-gmail-limpar-cache');
    const isModalGmailLimparOpen = modalGmailLimpar && (modalGmailLimpar.style.display === 'block' || !modalGmailLimpar.classList.contains('hidden'));

    if (e.key === 'Tab') {
        if (isModalLetrasOpen) {
            trapFocusInModal(e, document.getElementById('presentation-window'));
        } else if (isModalLetraArquivarOpen) {
            trapFocusInModal(e, modalLetraArquivar.querySelector('.modal-window'));
        } else if (isModalLetraRestaurarOpen) {
            trapFocusInModal(e, modalLetraRestaurar.querySelector('.modal-window'));
        } else if (isModalGmailLimparOpen) {
            trapFocusInModal(e, modalGmailLimpar.querySelector('.modal-window'));
        }
    }

    if (e.key === 'Escape') {
        if (isModalGmailLimparOpen) {
            window.fecharModalLimparCacheGmail(null, false);
            return;
        }
        const modalCancelar = document.getElementById('modal-cancelar');
        if (modalCancelar && modalCancelar.style.display === 'block') {
            window.fecharModalCancelar();
            return;
        }
        const modalEstorno = document.getElementById('modal-estorno');
        if (modalEstorno && modalEstorno.style.display === 'block') {
            window.fecharModalEstorno();
            return;
        }
        const modalAgendaCancelar = document.getElementById('modal-agenda-cancelar');
        if (modalAgendaCancelar && !modalAgendaCancelar.classList.contains('hidden')) {
            window.fecharModalAgendaCancelar();
            return;
        }
        if (isModalLetraRestaurarOpen) {
            window.fecharModalRestaurarLetra(null, true);
            return;
        }
        if (isModalLetraArquivarOpen) {
            window.fecharModalArquivarLetra(null, true);
            return;
        }
        if (isModalLetrasOpen) {
            if (document.fullscreenElement) {
                // Sai de tela cheia sem fechar o modal
                document.exitFullscreen().catch(() => {});
            } else {
                window.closeModal();
            }
            return;
        }
        const modalSocial = document.getElementById('social-modal');
        if (modalSocial && modalSocial.style.display === 'block') {
            modalSocial.style.display = 'none';
        }
    }
});

document.addEventListener('fullscreenchange', () => {
    const fsBtn = document.getElementById('btn-fullscreen-presentation');
    if (fsBtn) {
        if (document.fullscreenElement) {
            fsBtn.innerHTML = `<i class="fas fa-compress"></i>`;
            fsBtn.title = "Sair da Tela Cheia";
            fsBtn.setAttribute('aria-label', "Sair da Tela Cheia");
        } else {
            fsBtn.innerHTML = `<i class="fas fa-expand"></i>`;
            fsBtn.title = "Tela Cheia";
            fsBtn.setAttribute('aria-label', "Tela Cheia");
        }
    }
});


function popularSelectTons(letras) {
    const selectTom = document.getElementById('filtro-letras-tom');
    if (!selectTom) return;
    const tomAtual = selectTom.value;
    const tons = new Set();
    letras.forEach(l => {
        if (l.tom && typeof l.tom === 'string' && l.tom.trim()) {
            tons.add(l.tom.trim());
        }
    });
    
    selectTom.innerHTML = '';
    const optTodos = document.createElement('option');
    optTodos.value = '';
    optTodos.textContent = 'Todos os Tons';
    selectTom.appendChild(optTodos);
    
    Array.from(tons).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(tom => {
        const opt = document.createElement('option');
        opt.value = tom;
        opt.textContent = tom;
        if (tom === tomAtual) opt.selected = true;
        selectTom.appendChild(opt);
    });
}

function atualizarDashboardLetras() {
    const ativas = letrasGlobais.filter(l => (l.status || 'active') !== 'archived');
    const fixadas = ativas.filter(l => Boolean(l.pinned));
    
    const countEl = document.getElementById('dash-count-letras');
    if (countEl) countEl.innerText = ativas.length;

    const statsHeader = document.getElementById('letras-header-stats');
    if (statsHeader) {
        statsHeader.textContent = `${ativas.length} música(s) ativa(s) • ${fixadas.length} fixada(s)`;
    }
}

window.limparFiltrosLetras = () => {
    if (document.getElementById('filtro-letras-busca')) document.getElementById('filtro-letras-busca').value = '';
    if (document.getElementById('filtro-letras-tom')) document.getElementById('filtro-letras-tom').value = '';
    if (document.getElementById('filtro-letras-categoria')) document.getElementById('filtro-letras-categoria').value = '';
    if (document.getElementById('filtro-letras-status')) document.getElementById('filtro-letras-status').value = 'ativas';
    aplicarFiltrosLetras();
};

window.aplicarFiltrosLetras = () => {
    const busca = normalizar((document.getElementById('filtro-letras-busca')?.value || '').trim());
    const tom = (document.getElementById('filtro-letras-tom')?.value || '').trim();
    const categoria = (document.getElementById('filtro-letras-categoria')?.value || '').trim();
    const status = document.getElementById('filtro-letras-status')?.value || 'ativas';

    const filtradas = letrasGlobais.filter(l => {
        const lStatus = l.status || 'active';
        
        if (status === 'ativas') {
            if (lStatus === 'archived') return false;
        } else if (status === 'fixadas') {
            if (lStatus === 'archived' || !l.pinned) return false;
        } else if (status === 'arquivadas') {
            if (lStatus !== 'archived') return false;
        }

        if (tom && (l.tom || '').trim() !== tom) return false;
        if (categoria && (l.categoria || '') !== categoria) return false;

        if (busca) {
            const tituloNorm = normalizar(l.titulo || '');
            const interpreteNorm = normalizar(l.interprete || '');
            if (!tituloNorm.includes(busca) && !interpreteNorm.includes(busca)) {
                return false;
            }
        }
        return true;
    });

    renderLetrasFiltradas(filtradas);
};

function renderLetras(letras) {
    letrasGlobais = letras || [];
    popularSelectTons(letrasGlobais);
    aplicarFiltrosLetras();
    atualizarDashboardLetras();
}

function renderLetrasFiltradas(letrasFiltradas) {
    const list = document.getElementById('list-letras');
    if (!list) return;
    list.innerHTML = '';

    const ativasTotal = letrasGlobais.filter(l => (l.status || 'active') !== 'archived').length;
    const fixadasTotal = letrasGlobais.filter(l => (l.status || 'active') !== 'archived' && Boolean(l.pinned)).length;

    const countFilterEl = document.getElementById('letras-filter-count');
    if (countFilterEl) {
        countFilterEl.textContent = `${letrasFiltradas.length} música(s) encontrada(s) • Total ativo: ${ativasTotal} (${fixadasTotal} fixadas)`;
    }

    if (letrasFiltradas.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.className = "col-span-full text-center py-20 text-slate-400 italic text-sm";
        emptyP.textContent = "Nenhuma música encontrada com os filtros selecionados.";
        list.appendChild(emptyP);
        return;
    }

    const fixadas = letrasFiltradas.filter(l => (l.status || 'active') !== 'archived' && Boolean(l.pinned))
        .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'));
    
    const outrasAtivas = letrasFiltradas.filter(l => (l.status || 'active') !== 'archived' && !l.pinned)
        .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'));
        
    const arquivadas = letrasFiltradas.filter(l => l.status === 'archived')
        .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'));

    const criarCard = (l) => {
        const isArchived = l.status === 'archived';
        const isPinned = Boolean(l.pinned) && !isArchived;

        const card = document.createElement('div');
        card.className = `letra-mini-card ${isPinned ? 'card-pinned shadow-gold/10' : 'bg-white shadow-sm'} flex flex-col justify-between p-6 gap-4`;
        card.dataset.id = l.id;

        const contentBox = document.createElement('div');
        contentBox.className = "flex-1 cursor-pointer";
        contentBox.addEventListener('click', (e) => window.abrirModoApresentacao(l, e));

        const headerBox = document.createElement('div');
        headerBox.className = "flex justify-between items-start gap-2 mb-2";

        const title = document.createElement('h4');
        title.className = "font-extrabold text-slate-900 text-lg leading-snug break-words";
        title.textContent = l.titulo || 'Música sem título';
        headerBox.appendChild(title);

        if (isPinned) {
            const badgePinned = document.createElement('span');
            badgePinned.className = "text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0";
            badgePinned.textContent = "📌 Fixada";
            headerBox.appendChild(badgePinned);
        } else if (isArchived) {
            const badgeArchived = document.createElement('span');
            badgeArchived.className = "text-xs font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full shrink-0";
            badgeArchived.textContent = "📦 Arquivada";
            headerBox.appendChild(badgeArchived);
        }
        contentBox.appendChild(headerBox);

        if (l.interprete && typeof l.interprete === 'string' && l.interprete.trim()) {
            const interpreteP = document.createElement('p');
            interpreteP.className = "text-xs text-slate-500 font-medium mb-3";
            interpreteP.textContent = `Por: ${l.interprete.trim()}`;
            contentBox.appendChild(interpreteP);
        }

        const tagsBox = document.createElement('div');
        tagsBox.className = "flex flex-wrap gap-2 items-center mt-2";

        const tomBadge = document.createElement('span');
        tomBadge.className = "tom-badge";
        tomBadge.textContent = l.tom ? l.tom : 'Tom não informado';
        tagsBox.appendChild(tomBadge);

        const catBadge = document.createElement('span');
        catBadge.className = "text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md";
        catBadge.textContent = l.categoria || 'Sem categoria';
        tagsBox.appendChild(catBadge);

        if (l.bpm) {
            const bpmBadge = document.createElement('span');
            bpmBadge.className = "text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md";
            bpmBadge.textContent = `${l.bpm} BPM`;
            tagsBox.appendChild(bpmBadge);
        }

        contentBox.appendChild(tagsBox);
        card.appendChild(contentBox);

        const actionsBox = document.createElement('div');
        actionsBox.className = "flex justify-between items-center pt-3 border-t border-slate-100 mt-2";

        const btnAbrir = document.createElement('button');
        btnAbrir.type = "button";
        btnAbrir.className = "text-xs font-bold text-slate-700 hover:text-black flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors";
        btnAbrir.setAttribute('aria-label', `Abrir ${l.titulo || 'música'}`);
        btnAbrir.innerHTML = `<i class="fas fa-expand-alt text-gold"></i> <span>Abrir</span>`;
        btnAbrir.addEventListener('click', (e) => window.abrirModoApresentacao(l, e));
        actionsBox.appendChild(btnAbrir);

        const rightBtns = document.createElement('div');
        rightBtns.className = "flex items-center gap-1";

        const valAudio = validarAudioUrl(l.audioUrl);
        if (valAudio.valido && valAudio.url) {
            const audioLink = document.createElement('a');
            audioLink.href = valAudio.url;
            audioLink.target = "_blank";
            audioLink.rel = "noopener noreferrer";
            audioLink.className = "p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors";
            audioLink.setAttribute('aria-label', `Ouvir áudio de ${l.titulo || 'música'}`);
            audioLink.title = "Ouvir áudio";
            audioLink.innerHTML = `<i class="fas fa-play text-xs"></i>`;
            audioLink.addEventListener('click', (e) => e.stopPropagation());
            rightBtns.appendChild(audioLink);
        }

        if (!isArchived) {
            const btnPin = document.createElement('button');
            btnPin.type = "button";
            btnPin.className = `p-2 rounded-lg transition-transform hover:scale-110 ${isPinned ? 'text-gold' : 'text-slate-300 hover:text-gold'}`;
            btnPin.setAttribute('aria-label', isPinned ? 'Desafixar música' : 'Fixar música da semana');
            btnPin.title = isPinned ? 'Desafixar música' : 'Fixar como Principal da Semana';
            btnPin.innerHTML = `<i class="fas fa-thumbtack"></i>`;
            btnPin.addEventListener('click', (e) => window.togglePinLetra(l.id, isPinned, e));
            rightBtns.appendChild(btnPin);

            const btnEdit = document.createElement('button');
            btnEdit.type = "button";
            btnEdit.className = "p-2 text-indigo-400 hover:text-indigo-600 rounded-lg transition-colors";
            btnEdit.setAttribute('aria-label', `Editar ${l.titulo || 'música'}`);
            btnEdit.title = "Editar Música";
            btnEdit.innerHTML = `<i class="fas fa-edit"></i>`;
            btnEdit.addEventListener('click', (e) => window.prepararEdicaoLetra(l, e));
            rightBtns.appendChild(btnEdit);

            const btnArchive = document.createElement('button');
            btnArchive.type = "button";
            btnArchive.className = "p-2 text-slate-300 hover:text-amber-600 rounded-lg transition-colors";
            btnArchive.setAttribute('aria-label', `Arquivar ${l.titulo || 'música'}`);
            btnArchive.title = "Arquivar Música";
            btnArchive.innerHTML = `<i class="fas fa-box-archive"></i>`;
            btnArchive.addEventListener('click', (e) => window.abrirModalArquivarLetra(l.id, e));
            rightBtns.appendChild(btnArchive);
        } else {
            const btnRestore = document.createElement('button');
            btnRestore.type = "button";
            btnRestore.className = "p-2 text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors";
            btnRestore.setAttribute('aria-label', `Restaurar ${l.titulo || 'música'}`);
            btnRestore.title = "Restaurar Música";
            btnRestore.innerHTML = `<i class="fas fa-rotate-left"></i> <span>Restaurar</span>`;
            btnRestore.addEventListener('click', (e) => window.abrirModalRestaurarLetra(l.id, e));
            rightBtns.appendChild(btnRestore);
        }

        actionsBox.appendChild(rightBtns);
        card.appendChild(actionsBox);
        return card;
    };

    if (fixadas.length > 0) {
        const labelP = document.createElement('p');
        labelP.className = "section-label-gold";
        labelP.textContent = `📌 Principais da Semana (${fixadas.length})`;
        list.appendChild(labelP);
        fixadas.forEach(l => list.appendChild(criarCard(l)));
    }

    if (outrasAtivas.length > 0) {
        const labelP = document.createElement('p');
        labelP.className = "section-label-slate";
        labelP.textContent = `📚 Repertório Completo (${outrasAtivas.length})`;
        list.appendChild(labelP);
        outrasAtivas.forEach(l => list.appendChild(criarCard(l)));
    }

    if (arquivadas.length > 0) {
        const labelP = document.createElement('p');
        labelP.className = "section-label-slate";
        labelP.textContent = `📦 Músicas Arquivadas (${arquivadas.length})`;
        list.appendChild(labelP);
        arquivadas.forEach(l => list.appendChild(criarCard(l)));
    }
}

// ==========================================
// 8. UTILITÁRIOS E MODAIS GERAIS
// ==========================================
window.abrirModoApresentacao = (l, e) => {
    if (e) {
        e.stopPropagation();
        lastFocusedElementLetra = e.currentTarget || document.activeElement;
    } else {
        lastFocusedElementLetra = document.activeElement;
    }
    if (!l) return;

    const modalTitulo = document.getElementById('modal-titulo');
    const modalTom = document.getElementById('modal-tom');
    const modalCategoria = document.getElementById('modal-categoria');
    const modalInterprete = document.getElementById('modal-interprete');
    const modalBpm = document.getElementById('modal-bpm');
    const modalPinnedBadge = document.getElementById('modal-pinned-badge');
    const modalArchivedBadge = document.getElementById('modal-archived-badge');
    const modalCorpo = document.getElementById('modal-corpo');
    const modalObsContainer = document.getElementById('modal-obs-container');
    const modalObs = document.getElementById('modal-obs');
    const modalAudioBtn = document.getElementById('modal-audio-btn');

    if (modalTitulo) modalTitulo.textContent = l.titulo || 'Música sem título';
    if (modalTom) modalTom.textContent = l.tom ? `Tom: ${l.tom}` : 'Tom não informado';
    if (modalCategoria) modalCategoria.textContent = l.categoria || 'Sem categoria';

    if (modalInterprete) {
        if (l.interprete && typeof l.interprete === 'string' && l.interprete.trim()) {
            modalInterprete.textContent = `Por: ${l.interprete.trim()}`;
            modalInterprete.classList.remove('hidden');
        } else {
            modalInterprete.classList.add('hidden');
        }
    }

    if (modalBpm) {
        if (l.bpm) {
            modalBpm.textContent = `${l.bpm} BPM`;
            modalBpm.classList.remove('hidden');
        } else {
            modalBpm.classList.add('hidden');
        }
    }

    const isArchived = l.status === 'archived';
    const isPinned = Boolean(l.pinned) && !isArchived;

    if (modalPinnedBadge) {
        if (isPinned) modalPinnedBadge.classList.remove('hidden');
        else modalPinnedBadge.classList.add('hidden');
    }

    if (modalArchivedBadge) {
        if (isArchived) modalArchivedBadge.classList.remove('hidden');
        else modalArchivedBadge.classList.add('hidden');
    }

    if (modalCorpo) {
        modalCorpo.textContent = obterTextoLetra(l);
    }

    if (modalObsContainer && modalObs) {
        if (l.observacoes && typeof l.observacoes === 'string' && l.observacoes.trim()) {
            modalObs.textContent = l.observacoes.trim();
            modalObsContainer.classList.remove('hidden');
        } else {
            modalObsContainer.classList.add('hidden');
        }
    }

    if (modalAudioBtn) {
        const valAudio = validarAudioUrl(l.audioUrl);
        if (valAudio.valido && valAudio.url) {
            modalAudioBtn.href = valAudio.url;
            modalAudioBtn.classList.remove('hidden');
        } else {
            modalAudioBtn.href = '#';
            modalAudioBtn.classList.add('hidden');
        }
    }

    aplicarEstilosApresentacao();

    const modalBody = document.getElementById('presentation-body');
    if (modalBody) modalBody.scrollTop = 0;

    const modal = document.getElementById('lyric-modal');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.remove('hidden');
    }
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        const closeBtn = document.getElementById('btn-close-presentation');
        if (closeBtn) closeBtn.focus();
    }, 50);
};

window.openModal = (titulo, tom, corpo) => {
    const pseudoLetra = {
        titulo: titulo || '',
        tom: tom || '',
        corpo: corpo || '',
        categoria: 'Repertório'
    };
    window.abrirModoApresentacao(pseudoLetra);
};

window.closeModal = () => {
    const modal = document.getElementById('lyric-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    document.body.style.overflow = '';
    if (lastFocusedElementLetra && typeof lastFocusedElementLetra.focus === 'function') {
        try { lastFocusedElementLetra.focus(); } catch (err) {}
        lastFocusedElementLetra = null;
    }
};

window.ajustarFonteApresentacao = (delta) => {
    tamanhoFonteApresentacao = Math.max(12, Math.min(42, tamanhoFonteApresentacao + delta));
    aplicarEstilosApresentacao();
};

window.resetarFonteApresentacao = () => {
    tamanhoFonteApresentacao = 18;
    aplicarEstilosApresentacao();
};

window.alternarTemaApresentacao = () => {
    temaApresentacaoEscuro = !temaApresentacaoEscuro;
    aplicarEstilosApresentacao();
};

window.alternarFullscreenApresentacao = () => {
    const modalWindow = document.getElementById('presentation-window');
    if (!document.fullscreenElement) {
        if (modalWindow && modalWindow.requestFullscreen) {
            modalWindow.requestFullscreen().catch(() => {});
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    }
};

window.rolarInicioApresentacao = () => {
    const modalBody = document.getElementById('presentation-body');
    if (modalBody) {
        modalBody.scrollTo({ top: 0, behavior: getScrollBehavior() });
    }
};

function aplicarEstilosApresentacao() {
    const modalCorpo = document.getElementById('modal-corpo');
    if (modalCorpo) {
        modalCorpo.style.fontSize = `${tamanhoFonteApresentacao}px`;
    }

    const modalOverlay = document.getElementById('lyric-modal');
    const themeBtn = document.getElementById('btn-theme-presentation');

    if (modalOverlay) {
        if (temaApresentacaoEscuro) {
            modalOverlay.classList.add('theme-dark-presentation');
            if (themeBtn) themeBtn.innerHTML = `<i class="fas fa-sun text-amber-400"></i>`;
        } else {
            modalOverlay.classList.remove('theme-dark-presentation');
            if (themeBtn) themeBtn.innerHTML = `<i class="fas fa-moon"></i>`;
        }
    }
}

window.sortearFraseFirebase = () => {
    const qEl = document.getElementById('saint-quote');
    const aEl = document.getElementById('autor-santo');
    if (listaDeFrasesNuvem.length > 0) {
        const sorteada = listaDeFrasesNuvem[Math.floor(Math.random() * listaDeFrasesNuvem.length)];
        if(qEl) qEl.innerText = `"${sorteada.texto}"`;
        if(aEl) aEl.innerText = `— ${sorteada.autor}`;
    }
};

setInterval(() => {
    const c = document.getElementById('live-clock');
    if(c) c.innerText = new Date().toLocaleTimeString('pt-BR');
}, 1000);



window.shareFinanceWhatsApp = () => {
    const t = document.getElementById('dash-saldo-total').innerText;
    const v = document.getElementById('saldo-viagem').innerText;
    const g = document.getElementById('saldo-gravacao').innerText;
    const r = document.getElementById('saldo-rifa').innerText;
    
    const texto = `*💰 FINANCEIRO - MISSÃO SEDENTOS*\n\nTemos em caixa:\n🚐 Viagens: ${v}\n🎙️ Produção da próxima música: ${g}\n🎟️ Rifas: ${r}\n\n*TOTAL:* ${t}`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`);
};


let agendaGlobais = [];
let eventoAtualEdicao = null;
let eventoAtualCancelamento = null;

const getHojeLocalISO = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const agendaValidador = {
    validarData: (d) => {
        if (!d || typeof d !== 'string') return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
        const [yStr, mStr, dStr] = d.split('-');
        const year = Number(yStr);
        const month = Number(mStr);
        const day = Number(dStr);
        
        if (year < 1900 || year > 2100) return false;
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        
        const dateObj = new Date(year, month - 1, day);
        return (
            dateObj.getFullYear() === year &&
            dateObj.getMonth() === (month - 1) &&
            dateObj.getDate() === day
        );
    },
    validarHora: (h) => {
        if (!h) return true;
        if (typeof h !== 'string') return false;
        if (!/^\d{2}:\d{2}$/.test(h)) return false;
        const [hStr, mStr] = h.split(':');
        const hour = Number(hStr);
        const min = Number(mStr);
        return hour >= 0 && hour <= 23 && min >= 0 && min <= 59;
    },
    formatarDataBR: (d) => {
        if (!d || typeof d !== 'string' || !d.includes('-')) return d || '';
        const parts = d.split('-');
        if (parts.length !== 3) return d;
        const [y, m, day] = parts;
        return `${day}/${m}/${y}`;
    },
    eventoPassou: (evento) => {
        if (!evento || !evento.data || !agendaValidador.validarData(evento.data)) {
            if (evento) console.warn("Compromisso com data inválida ignorado na verificação de expiração:", evento.id || "(sem id)");
            return true;
        }
        
        if (evento.horaInicio && !agendaValidador.validarHora(evento.horaInicio)) {
            console.warn("Compromisso com horário inicial inválido:", evento.id || "(sem id)");
            return true;
        }
        if (evento.horaFim && !agendaValidador.validarHora(evento.horaFim)) {
            console.warn("Compromisso com horário final inválido:", evento.id || "(sem id)");
            return true;
        }

        const hojeISO = getHojeLocalISO();
        
        // Se a data do evento for anterior a hoje, já passou.
        if (evento.data < hojeISO) return true;
        
        // Se a data do evento for posterior a hoje, não passou.
        if (evento.data > hojeISO) return false;
        
        // Se a data é exatamente HOJE:
        const agora = new Date();
        const minAtual = agora.getHours() * 60 + agora.getMinutes();
        
        if (evento.horaFim) {
            const [hf, mf] = evento.horaFim.split(':').map(Number);
            return minAtual >= (hf * 60 + mf);
        } else if (evento.horaInicio) {
            const [hi, mi] = evento.horaInicio.split(':').map(Number);
            return minAtual >= (hi * 60 + mi);
        } else {
            // Evento sem horário (dia inteiro): permanece ativo durante TODO o dia de hoje
            return false;
        }
    }
};

window.aplicarFiltrosAgenda = () => {
    if (!agendaGlobais || agendaGlobais.length === 0) {
        renderAgendaFiltrada([]);
        const countEl = document.getElementById('agenda-filter-count');
        if (countEl) countEl.innerText = "0 evento(s) encontrado(s)";
        return;
    }

    const busca = document.getElementById('filtro-agenda-busca').value.trim().toLowerCase();
    const dataInicio = document.getElementById('filtro-agenda-data-inicio').value;
    const dataFim = document.getElementById('filtro-agenda-data-fim').value;
    const tipo = document.getElementById('filtro-agenda-tipo').value;
    const responsavel = document.getElementById('filtro-agenda-responsavel').value.trim().toLowerCase();
    const status = document.getElementById('filtro-agenda-status').value;

    const normalizar = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    const hojeISO = getHojeLocalISO();

    const filtradas = agendaGlobais.filter(a => {
        if (!a) return false;
        if (dataInicio && a.data < dataInicio) return false;
        if (dataFim && a.data > dataFim) return false;
        
        const aTipo = a.tipo || "Compromisso";
        if (tipo && aTipo !== tipo) return false;
        
        const aResp = a.responsavel || "Não informado";
        if (responsavel) {
            const respNormal = normalizar(aResp.toLowerCase());
            if (!respNormal.includes(normalizar(responsavel))) return false;
        }

        if (busca) {
            const descNormal = normalizar((a.desc || '').toLowerCase());
            const localNormal = normalizar((a.local || '').toLowerCase());
            const b = normalizar(busca);
            if (!descNormal.includes(b) && !localNormal.includes(b)) return false;
        }

        const evtPassou = agendaValidador.eventoPassou(a);
        const aStatus = a.status || 'active';
        const isHoje = a.data === hojeISO;

        if (status) {
            if (status === 'cancelados') {
                if (aStatus !== 'cancelled') return false;
            } else {
                if (aStatus === 'cancelled') return false;
                if (status === 'concluidos') {
                    if (!evtPassou) return false;
                } else if (status === 'proximos') {
                    if (evtPassou) return false;
                } else if (status === 'hoje') {
                    if (!isHoje) return false;
                }
            }
        }

        return true;
    });
    
    const countEl = document.getElementById('agenda-filter-count');
    if (countEl) {
        countEl.innerText = filtradas.length > 0 ? `${filtradas.length} evento(s) encontrado(s)` : 'Nenhum evento encontrado.';
    }

    renderAgendaFiltrada(filtradas);
};

window.limparFiltrosAgenda = () => {
    document.getElementById('filtro-agenda-busca').value = "";
    document.getElementById('filtro-agenda-data-inicio').value = "";
    document.getElementById('filtro-agenda-data-fim').value = "";
    document.getElementById('filtro-agenda-tipo').value = "";
    document.getElementById('filtro-agenda-responsavel').value = "";
    document.getElementById('filtro-agenda-status').value = "";
    aplicarFiltrosAgenda();
};

window.addAgenda = async () => {
    const descEl = document.getElementById('agenda-desc');
    const tipoEl = document.getElementById('agenda-tipo');
    const dataEl = document.getElementById('agenda-data');
    const horaInicioEl = document.getElementById('agenda-hora-inicio');
    const horaFimEl = document.getElementById('agenda-hora-fim');
    const localEl = document.getElementById('agenda-local');
    const enderecoEl = document.getElementById('agenda-endereco');
    const mapsEl = document.getElementById('agenda-maps');
    const responsavelEl = document.getElementById('agenda-responsavel');
    const participantesEl = document.getElementById('agenda-participantes');
    const obsEl = document.getElementById('agenda-obs');
    
    const errorEl = document.getElementById('agenda-error');
    const successEl = document.getElementById('agenda-success');
    const btn = document.getElementById('btn-add-agenda');

    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    const desc = descEl.value.trim();
    const tipo = tipoEl.value;
    const data = dataEl.value;
    const horaInicio = horaInicioEl.value;
    const horaFim = horaFimEl.value;
    const local = localEl.value.trim();
    const endereco = enderecoEl.value.trim();
    const mapsUrl = mapsEl.value.trim();
    const responsavel = responsavelEl.value.trim();
    const participantes = participantesEl.value.trim();
    const observacao = obsEl.value.trim();

    if (!desc || !tipo || !data || !local || !responsavel) {
        errorEl.innerText = "Preencha título, tipo, data, local e responsável.";
        errorEl.classList.remove('hidden');
        return;
    }
    
    // Para novos eventos sem edição, horário inicial pode ser informado; se não informado na edição de legado, é mantido como dia inteiro
    if (!eventoAtualEdicao && !horaInicio) {
        errorEl.innerText = "O horário de início é obrigatório para novos compromissos.";
        errorEl.classList.remove('hidden');
        return;
    }

    if (!agendaValidador.validarData(data)) {
        errorEl.innerText = "Data inválida.";
        errorEl.classList.remove('hidden');
        return;
    }
    
    if (horaInicio && !agendaValidador.validarHora(horaInicio)) {
        errorEl.innerText = "Horário inicial inválido.";
        errorEl.classList.remove('hidden');
        return;
    }
    
    if (horaFim && !agendaValidador.validarHora(horaFim)) {
        errorEl.innerText = "Horário de término inválido.";
        errorEl.classList.remove('hidden');
        return;
    }

    if (horaInicio && horaFim && horaFim < horaInicio) {
        errorEl.innerText = "O horário de término não pode ser anterior ao início.";
        errorEl.classList.remove('hidden');
        return;
    }

    if (mapsUrl && !isValidMapsUrl(mapsUrl)) {
        errorEl.innerText = "Link do Google Maps inválido ou não seguro.";
        errorEl.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.innerText = "Salvando...";

    try {
        if (eventoAtualEdicao) {
            const idParaEditar = eventoAtualEdicao;
            await runTransaction(db, async (transaction) => {
                const docRef = doc(db, "agenda", idParaEditar);
                const docSnap = await transaction.get(docRef);
                
                if (!docSnap.exists()) {
                    throw new Error("EVENT_NOT_FOUND");
                }
                
                const existingData = docSnap.data();
                if (existingData.status === 'cancelled') {
                    throw new Error("EVENT_CANCELLED");
                }
                
                transaction.update(docRef, {
                    desc,
                    tipo,
                    data,
                    horaInicio: horaInicio || "",
                    horaFim: horaFim || "",
                    local,
                    endereco,
                    mapsUrl,
                    responsavel,
                    participantes,
                    observacao,
                    updatedAt: serverTimestamp()
                });
            });

            cancelarEdicaoAgenda();
            successEl.innerText = "Alterações salvas com sucesso!";
            successEl.classList.remove('hidden');
            setTimeout(() => successEl.classList.add('hidden'), 3000);
        } else {
            const payload = {
                desc,
                tipo,
                data,
                horaInicio: horaInicio || "",
                horaFim: horaFim || "",
                local,
                endereco,
                mapsUrl,
                responsavel,
                participantes,
                observacao,
                status: "active",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await addDoc(collection(db, "agenda"), payload);
            
            descEl.value = "";
            tipoEl.value = "";
            horaInicioEl.value = "";
            horaFimEl.value = "";
            localEl.value = "";
            enderecoEl.value = "";
            mapsEl.value = "";
            responsavelEl.value = "";
            participantesEl.value = "";
            obsEl.value = "";
            
            successEl.innerText = "Lançamento salvo com sucesso!";
            successEl.classList.remove('hidden');
            setTimeout(() => successEl.classList.add('hidden'), 3000);
        }
    } catch (e) {
        console.error("Erro ao salvar agenda:", e);
        if (e.message === "EVENT_CANCELLED") {
            errorEl.innerText = "Este compromisso foi cancelado por outro usuário e não pode mais ser editado.";
            cancelarEdicaoAgenda();
        } else if (e.message === "EVENT_NOT_FOUND") {
            errorEl.innerText = "Este compromisso não foi encontrado no banco de dados.";
            cancelarEdicaoAgenda();
        } else {
            errorEl.innerText = "Erro ao salvar. Tente novamente.";
        }
        errorEl.classList.remove('hidden');
    } finally {
        if (!eventoAtualEdicao) {
            btn.innerText = "Confirmar Evento";
        }
        btn.disabled = false;
    }
};

window.editarAgenda = (id) => {
    const evento = agendaGlobais.find(a => a.id === id);
    if (!evento) return;
    
    if (evento.status === 'cancelled') {
        alert("Eventos cancelados não podem ser editados.");
        return;
    }

    eventoAtualEdicao = id;
    document.getElementById('agenda-form-title').innerText = "Editando Compromisso";
    document.getElementById('btn-agenda-cancel').classList.remove('hidden');
    document.getElementById('btn-add-agenda').innerText = "Salvar Alterações";
    
    document.getElementById('agenda-desc').value = evento.desc || '';
    document.getElementById('agenda-tipo').value = evento.tipo || 'Compromisso';
    document.getElementById('agenda-data').value = evento.data || '';
    document.getElementById('agenda-hora-inicio').value = evento.horaInicio || '';
    document.getElementById('agenda-hora-fim').value = evento.horaFim || '';
    document.getElementById('agenda-local').value = evento.local || '';
    document.getElementById('agenda-endereco').value = evento.endereco || '';
    document.getElementById('agenda-maps').value = evento.mapsUrl || '';
    document.getElementById('agenda-responsavel').value = evento.responsavel || 'Não informado';
    document.getElementById('agenda-participantes').value = evento.participantes || '';
    document.getElementById('agenda-obs').value = evento.observacao || '';
    
    document.getElementById('agenda-form-container').scrollIntoView({ behavior: 'smooth' });
};

window.cancelarEdicaoAgenda = () => {
    eventoAtualEdicao = null;
    document.getElementById('agenda-form-title').innerText = "Agendar Novo Compromisso";
    document.getElementById('btn-agenda-cancel').classList.add('hidden');
    document.getElementById('btn-add-agenda').innerText = "Confirmar Evento";
    
    document.getElementById('agenda-desc').value = "";
    document.getElementById('agenda-tipo').value = "";
    document.getElementById('agenda-data').value = "";
    document.getElementById('agenda-hora-inicio').value = "";
    document.getElementById('agenda-hora-fim').value = "";
    document.getElementById('agenda-local').value = "";
    document.getElementById('agenda-endereco').value = "";
    document.getElementById('agenda-maps').value = "";
    document.getElementById('agenda-responsavel').value = "";
    document.getElementById('agenda-participantes').value = "";
    document.getElementById('agenda-obs').value = "";
    document.getElementById('agenda-error').classList.add('hidden');
};

window.abrirModalAgendaCancelar = (id) => {
    eventoAtualCancelamento = id;
    document.getElementById('agenda-cancelar-motivo').value = '';
    document.getElementById('agenda-cancelar-resp').value = '';
    document.getElementById('agenda-cancelar-error').classList.add('hidden');
    document.getElementById('modal-agenda-cancelar').classList.remove('hidden');
    document.getElementById('agenda-cancelar-motivo').focus();
};

window.fecharModalAgendaCancelar = () => {
    eventoAtualCancelamento = null;
    document.getElementById('modal-agenda-cancelar').classList.add('hidden');
};

window.confirmarCancelamentoAgenda = async () => {
    if (!eventoAtualCancelamento) return;
    
    const motivo = document.getElementById('agenda-cancelar-motivo').value.trim();
    const resp = document.getElementById('agenda-cancelar-resp').value.trim();
    const errorEl = document.getElementById('agenda-cancelar-error');
    const btn = document.getElementById('btn-agenda-confirmar-cancelar');

    if (!motivo || !resp) {
        errorEl.innerText = "Preencha o motivo e o responsável pelo cancelamento.";
        errorEl.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.innerText = 'Cancelando...';

    try {
        await runTransaction(db, async (transaction) => {
            const docRef = doc(db, "agenda", eventoAtualCancelamento);
            const docSnap = await transaction.get(docRef);
            
            if (!docSnap.exists()) {
                throw new Error("Compromisso não encontrado.");
            }
            
            const data = docSnap.data();
            if (data.status === 'cancelled') {
                throw new Error("Este compromisso já foi cancelado.");
            }
            
            transaction.update(docRef, {
                status: "cancelled",
                cancelReason: motivo,
                cancelledBy: resp,
                cancelledAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        });
        fecharModalAgendaCancelar();
    } catch (e) {
        console.error("Erro ao cancelar evento:", e);
        errorEl.innerText = e.message || "Erro interno ao cancelar.";
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Confirmar';
    }
};

window.toggleEventoDetalhes = (id) => {
    const el = document.getElementById(`evento-detalhes-${id}`);
    if (el) {
        if (el.classList.contains('hidden')) {
            el.classList.remove('hidden');
            el.classList.add('animate-fade-in-up');
        } else {
            el.classList.add('hidden');
            el.classList.remove('animate-fade-in-up');
        }
    }
};

function getNextDayDateStr(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return dateStr;
    const [y, m, d] = dateStr.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    const ny = next.getFullYear();
    const nm = String(next.getMonth() + 1).padStart(2, '0');
    const nd = String(next.getDate()).padStart(2, '0');
    return `${ny}${nm}${nd}`;
}

window.exportarEventoICS = (id) => {
    const evento = (agendaGlobais || []).find(a => a.id === id);
    if (!evento || evento.status === 'cancelled') return;
    
    if (!agendaValidador.validarData(evento.data)) {
        alert("Data do compromisso inválida.");
        return;
    }
    
    const dt = evento.data.replace(/-/g, '');
    const nowUTC = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid = `${evento.id || Date.now()}@sedentos.missao`;
    
    const escapeICS = (str) => {
        if (!str) return "";
        return String(str)
            .replace(/\\/g, "\\\\")
            .replace(/;/g, "\\;")
            .replace(/,/g, "\\,")
            .replace(/\r?\n/g, "\\n");
    };

    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SoliDeoGloria//Agenda//PT",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${nowUTC}`
    ];

    if (evento.horaInicio && agendaValidador.validarHora(evento.horaInicio)) {
        const hiStr = evento.horaInicio.replace(':', '') + '00';
        lines.push(`DTSTART:${dt}T${hiStr}`);
        
        if (evento.horaFim && agendaValidador.validarHora(evento.horaFim)) {
            const hfStr = evento.horaFim.replace(':', '') + '00';
            lines.push(`DTEND:${dt}T${hfStr}`);
        } else {
            const [hi, mi] = evento.horaInicio.split(':').map(Number);
            const totalMinutes = hi * 60 + mi + 60;
            const endHour = Math.floor((totalMinutes % 1440) / 60);
            const endMin = totalMinutes % 60;
            const endHourStr = String(endHour).padStart(2, '0') + String(endMin).padStart(2, '0') + '00';
            const targetDateStr = totalMinutes >= 1440 ? getNextDayDateStr(evento.data) : dt;
            lines.push(`DTEND:${targetDateStr}T${endHourStr}`);
        }
    } else {
        // Evento de dia inteiro: DTSTART;VALUE=DATE:YYYYMMDD, DTEND;VALUE=DATE:YYYYMMDD (dia seguinte exclusivo)
        const nextDt = getNextDayDateStr(evento.data);
        lines.push(`DTSTART;VALUE=DATE:${dt}`);
        lines.push(`DTEND;VALUE=DATE:${nextDt}`);
    }

    lines.push(`SUMMARY:${escapeICS(evento.desc || 'Compromisso')}`);

    let loc = evento.local || '';
    if (evento.endereco) {
        loc = loc ? `${loc}, ${evento.endereco}` : evento.endereco;
    }
    if (loc) {
        lines.push(`LOCATION:${escapeICS(loc)}`);
    }

    let descParts = [];
    if (evento.tipo) descParts.push(`Tipo: ${evento.tipo}`);
    if (evento.responsavel) descParts.push(`Responsável: ${evento.responsavel}`);
    if (evento.participantes) descParts.push(`Participantes: ${evento.participantes}`);
    if (evento.observacao) descParts.push(`Observações: ${evento.observacao}`);
    if (evento.mapsUrl && isValidMapsUrl(evento.mapsUrl)) {
        descParts.push(`Google Maps: ${evento.mapsUrl}`);
        lines.push(`URL:${evento.mapsUrl}`);
    }
    if (descParts.length > 0) {
        lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
    }

    lines.push("END:VEVENT");
    lines.push("END:VCALENDAR");

    const icsString = lines.join("\r\n");
    const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `evento_${dt}.ics`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        if (document.body.contains(link)) {
            document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
    }, 2000);
};

window.shareAgendaWhatsApp = () => {
    // Only future, active events, sorted
    const proximas = (agendaGlobais || []).filter(a => {
        if (!a || a.status === 'cancelled') return false;
        if (!agendaValidador.validarData(a.data)) return false;
        return !agendaValidador.eventoPassou(a);
    }).sort((a,b) => {
        const dA = a.data + (a.horaInicio ? "T" + a.horaInicio : "T00:00");
        const dB = b.data + (b.horaInicio ? "T" + b.horaInicio : "T00:00");
        return dA.localeCompare(dB);
    });
    
    if (proximas.length === 0) {
        alert("Não há eventos futuros para compartilhar.");
        return;
    }
    
    let txt = "📅 *Próximos Compromissos da Missão*\n\n";
    proximas.forEach(ev => {
        const dia = agendaValidador.formatarDataBR(ev.data);
        const hora = ev.horaInicio ? (ev.horaFim ? ` (${ev.horaInicio} às ${ev.horaFim})` : ` às ${ev.horaInicio}`) : " (Dia Inteiro / Horário a combinar)";
        
        txt += `*${ev.desc}* - ${dia}${hora}\n`;
        txt += `📍 ${ev.local}${ev.endereco ? ", " + ev.endereco : ""}\n`;
        if (ev.mapsUrl && isValidMapsUrl(ev.mapsUrl)) txt += `🗺️ Maps: ${ev.mapsUrl}\n`;
        txt += `👤 Responsável: ${ev.responsavel || 'Não informado'}\n`;
        if (ev.observacao) {
            const obs = ev.observacao.length > 100 ? ev.observacao.substring(0,97) + "..." : ev.observacao;
            txt += `ℹ️ ${obs}\n`;
        }
        txt += "\n";
    });
    
    window.open("https://wa.me/?text=" + encodeURIComponent(txt.trim()), '_blank', 'noopener,noreferrer');
};
