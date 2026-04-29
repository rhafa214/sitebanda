import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
let tokenClient;
let listaDeFrasesNuvem = [];

// ==========================================
// 2. SISTEMA DE LOGIN E AUTENTICAÇÃO
// ==========================================
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const shell = document.getElementById('app-shell');
    if (user) {
        if(loginScreen) loginScreen.style.display = 'none';
        if(shell) shell.style.display = 'flex';
        iniciarSincronizacao();
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(shell) shell.style.display = 'none';
    }
});

window.handleKeyLogin = () => {
    const key = document.getElementById('access-key').value;
    if(!key) return;
    signInWithEmailAndPassword(auth, "missao@missaosedentos.com", key)
        .catch(() => document.getElementById('login-error').classList.remove('hidden'));
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
window.execEditorCommand = (cmd, val = null) => document.execCommand(cmd, false, val);

// ==========================================
// 4. SINCRONIZAÇÃO DE DADOS (FIRESTORE)
// ==========================================
function iniciarSincronizacao() {
    onSnapshot(query(collection(db, "agenda"), orderBy("data", "asc")), (snap) => renderAgenda(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(collection(db, "caixa"), (snap) => renderCaixa(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(collection(db, "letras"), (snap) => renderLetras(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(collection(db, "senhas"), (snap) => renderSenhas(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    onSnapshot(collection(db, "frases"), (snap) => {
        listaDeFrasesNuvem = snap.docs.map(d => d.data());
        sortearFraseFirebase();
    });

    fetchLiturgia();

    onSnapshot(doc(db, "config", "gmail_cache"), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            const emails = data.mensagens || [];
            const area = document.getElementById('gmail-status-area');
            
            if (!area) return;

            if (emails.length > 0) {
                const isExpanded = document.getElementById('gmail-card')?.classList.contains('col-span-full');
                const maxH = isExpanded ? 'max-h-[400px] overflow-y-auto' : 'max-h-[140px] overflow-hidden';

                let html = `<div id="gmail-list-container" class="mt-2 text-left transition-all duration-500 ease-in-out pr-2 ${maxH}">`;
                html += `<div class="space-y-2">`;
                emails.forEach(m => {
                    const unreadName = m.unread ? "font-black text-slate-900" : "font-bold text-slate-500";
                    const unreadTitle = m.unread ? "font-bold text-red-600" : "font-medium text-slate-500";
                    const unreadDot = m.unread ? `<span class="bg-red-500 w-2 h-2 rounded-full inline-block mr-2 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>` : `<span class="w-2 h-2 rounded-full inline-block mr-2 bg-transparent"></span>`;
                    const bgHov = m.unread ? "bg-white shadow-sm border border-red-50" : "bg-slate-50/50 border border-transparent";
                    
                    html += `
                        <div class="p-3 rounded-2xl flex flex-col justify-center transition-colors ${bgHov}">
                            <div class="flex items-center">
                                ${unreadDot}
                                <span class="text-[10px] ${unreadName} uppercase tracking-wider truncate">${m.de}</span>
                            </div>
                            <p class="text-[12px] ${unreadTitle} truncate ml-4 mt-1">${m.assunto}</p>
                        </div>`;
                });
                html += `</div></div>`;
                html += `<div class="text-[9px] text-slate-400 uppercase font-bold mt-3 border-t border-slate-100 pt-3 text-center">Última sinc: ${new Date(data.ultimaSinc).toLocaleTimeString('pt-BR')} (Toque para expandir)</div>`;
                area.innerHTML = html;
            }
        }
    });

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
    });
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

window.toggleGmailExpand = () => {
    const card = document.getElementById('gmail-card');
    if (card) {
        card.classList.toggle('col-span-full');
        const listContainer = document.getElementById('gmail-list-container');
        if (listContainer) {
            listContainer.classList.toggle('max-h-[140px]');
            listContainer.classList.toggle('max-h-[400px]');
            listContainer.classList.toggle('overflow-hidden');
            listContainer.classList.toggle('overflow-y-auto');
        }
    }
};

window.handleGmailAuth = (e) => {
    if(e) e.stopPropagation();
    if (!tokenClient) return alert("Google carregando...");
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) throw (resp);
        document.getElementById('gmail-status-area').innerHTML = "<div class='py-8 text-center'><i class='fas fa-spinner fa-spin text-red-500 text-2xl mb-4 inline-block'></i><p class='text-[10px] uppercase font-bold tracking-widest animate-pulse'>Sincronizando MENSAGENS...</p></div>";
        await syncGmailToFirebase();
    };
    tokenClient.requestAccessToken({prompt: 'consent'});
};

async function syncGmailToFirebase() {
    try {
        const response = await gapi.client.gmail.users.messages.list({ 'userId': 'me', 'maxResults': 8 });
        const messages = response.result.messages || [];
        let lista = [];
        for (const msg of messages) {
            const detail = await gapi.client.gmail.users.messages.get({ 'userId': 'me', 'id': msg.id });
            const subjectHeader = detail.result.payload.headers.find(h => h.name === 'Subject');
            const subject = subjectHeader ? subjectHeader.value : '(Sem Assunto)';
            const fromHeader = detail.result.payload.headers.find(h => h.name === 'From');
            const from = fromHeader ? fromHeader.value.split('<')[0].trim() : 'Desconhecido';
            const isUnread = detail.result.labelIds ? detail.result.labelIds.includes('UNREAD') : false;
            lista.push({ de: from, assunto: subject, unread: isUnread });
        }
        await setDoc(doc(db, "config", "gmail_cache"), { mensagens: lista, ultimaSinc: new Date().toISOString() });
    } catch (err) { console.error(err); }
}

// ==========================================
// 5B. LITURGIA DIÁRIA API
// ==========================================
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
window.addAgenda = async () => {
    const desc = document.getElementById('agenda-desc').value;
    const local = document.getElementById('agenda-local').value;
    const data = document.getElementById('agenda-data').value;
    if(desc && data) await addDoc(collection(db, "agenda"), { desc, local, data });
};

window.addFinanceiro = async () => {
    const desc = document.getElementById('caixa-desc').value;
    const valorInput = document.getElementById('caixa-valor').value;
    const destino = document.getElementById('caixa-destino').value;
    const tipo = document.getElementById('caixa-tipo').value;

    if (!desc || !valorInput) return alert("Preencha descrição e valor!");

    try {
        await addDoc(collection(db, "caixa"), {
            desc: desc,
            valor: Number(valorInput), 
            destino: destino,
            tipo: tipo,
            data: new Date().toISOString()
        });
        
        document.getElementById('caixa-desc').value = "";
        document.getElementById('caixa-valor').value = "";
        console.log("✅ Lançamento salvo com sucesso!");
    } catch (e) {
        console.error("❌ Erro ao salvar:", e);
        alert("Erro ao salvar: " + e.message);
    }
};

window.addLetra = async () => {
    const t = document.getElementById('letra-titulo').value;
    const tom = document.getElementById('letra-tom').value;
    const c = document.getElementById('letra-editor').innerHTML;
    if(!t || c === "") return alert("Preencha título e letra!");
    
    if (editandoLetraId) {
        await updateDoc(doc(db, "letras", editandoLetraId), { titulo: t, tom, corpo: c });
        cancelarEdicaoLetra();
    } else {
        await addDoc(collection(db, "letras"), { titulo: t, tom, corpo: c, pinned: false });
    }
    document.getElementById('letra-titulo').value = ""; 
    document.getElementById('letra-editor').innerHTML = "";
};

window.saveSocialStats = async () => {
    const ig = document.getElementById('input-ig').value;
    const yt = document.getElementById('input-yt').value;
    const sp = document.getElementById('input-sp').value;
    await setDoc(doc(db, "config", "social"), { ig: ig||0, yt: yt||0, sp: sp||0 });
    document.getElementById('social-modal').style.display = 'none';
};

window.deleteItem = async (col, id, e) => {
    if(e) e.stopPropagation();
    if(confirm("Excluir permanentemente?")) await deleteDoc(doc(db, col, id));
};

window.togglePin = async (id, currentStatus, e) => {
    if(e) e.stopPropagation();
    await updateDoc(doc(db, "letras", id), { pinned: !currentStatus });
};

window.prepararEdicaoLetra = (id, titulo, tom, corpo, e) => {
    if(e) e.stopPropagation();
    editandoLetraId = id;
    document.getElementById('letra-titulo').value = titulo;
    document.getElementById('letra-tom').value = tom;
    document.getElementById('letra-editor').innerHTML = corpo;
    document.getElementById('btn-letra-cancel').classList.remove('hidden');
};

window.cancelarEdicaoLetra = () => {
    editandoLetraId = null;
    document.getElementById('letra-titulo').value = ""; 
    document.getElementById('letra-tom').value = "";
    document.getElementById('letra-editor').innerHTML = "";
    document.getElementById('btn-letra-cancel').classList.add('hidden');
};

window.prepararEdicaoSocial = () => document.getElementById('social-modal').style.display = 'block';

window.addSenha = async () => {
    const s = document.getElementById('senha-site').value;
    const u = document.getElementById('senha-user').value;
    const p = document.getElementById('senha-pass').value;
    if(s && p) await addDoc(collection(db, "senhas"), { s, u, p });
};

// ==========================================
// 7. RENDERIZADORES
// ==========================================
function renderAgenda(agenda) {
    const list = document.getElementById('list-agenda');
    if(!list) return;
    const hoje = new Date().setHours(0,0,0,0);
    
    const futuras = agenda.filter(a => new Date(a.data + "T00:00:00").getTime() >= hoje);
    const passadas = agenda.filter(a => new Date(a.data + "T00:00:00").getTime() < hoje).sort((a,b) => new Date(b.data) - new Date(a.data));

    const gerarItem = (a, isOld) => `
        <div class="mission-item ${isOld ? 'mission-concluded opacity-50' : ''} p-4 bg-white rounded-2xl flex justify-between items-center shadow-sm mb-2 border">
            <div>
                <span class="text-[10px] font-bold text-gold uppercase">${new Date(a.data + "T00:00:00").toLocaleDateString('pt-BR')}</span>
                <h4 class="font-bold text-black">${a.desc} ${isOld ? '✓' : ''}</h4>
                <p class="text-xs text-slate-400"><i class="fas fa-location-dot"></i> ${a.local}</p>
            </div>
            <button onclick="deleteItem('agenda', '${a.id}', event)" class="text-red-300">×</button>
        </div>`;

    list.innerHTML = 
        (futuras.length ? '<p class="text-xs font-bold text-gold mb-3 uppercase tracking-widest">🚀 Próximas Missões</p>' + futuras.map(a => gerarItem(a, false)).join('') : '') +
        (passadas.length ? '<p class="text-xs font-bold text-slate-400 mt-8 mb-3 uppercase tracking-widest">📅 Concluídas</p>' + passadas.map(a => gerarItem(a, true)).join('') : '');

    if(futuras.length > 0) {
        document.getElementById('dash-next-desc').innerText = futuras[0].desc;
        document.getElementById('dash-next-info-local').innerText = futuras[0].local;
        document.getElementById('dash-next-info-date').innerText = new Date(futuras[0].data + "T00:00:00").toLocaleDateString('pt-BR');
    }
}

function renderCaixa(transacoes) {
    console.log("📊 Dados recebidos do Firestore (Caixa):", transacoes);
    let saldos = { viagem: 0, gravacao: 0, rifa: 0 };
    const listExtrato = document.getElementById('list-caixa');
    
    if(!listExtrato) return;

    if(transacoes.length === 0) {
        listExtrato.innerHTML = `<p class="p-10 text-center text-slate-400 italic text-sm">Nenhuma movimentação encontrada na nuvem.</p>`;
        document.getElementById('dash-saldo-total').innerText = "R$ 0,00";
        return;
    }

    const sortedTrans = transacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

    listExtrato.innerHTML = sortedTrans.map(t => {
        const isIn = t.tipo === 'in';
        const destinoFinal = t.destino || 'viagem'; 
        const valorNumerico = Number(t.valor) || 0;
        
        if (saldos.hasOwnProperty(destinoFinal)) {
            saldos[destinoFinal] += isIn ? valorNumerico : -valorNumerico;
        } else {
            saldos.viagem += isIn ? valorNumerico : -valorNumerico;
        }

        return `
        <div class="transaction-item flex justify-between items-center p-4 border-b border-slate-50 hover:bg-slate-50 transition-all">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center ${isIn ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}">
                    <i class="fas ${isIn ? 'fa-arrow-up' : 'fa-arrow-down'} text-[10px]"></i>
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 text-sm">${t.desc}</h4>
                    <p class="text-[9px] text-slate-400 font-bold uppercase">${destinoFinal} • ${new Date(t.data).toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <span class="font-black ${isIn ? 'text-emerald-600' : 'text-red-600'} text-sm">
                    ${isIn ? '+' : '-'} R$ ${valorNumerico.toFixed(2)}
                </span>
                <button onclick="deleteItem('caixa', '${t.id}', event)" class="text-slate-300 hover:text-red-500">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    if(document.getElementById('saldo-viagem')) document.getElementById('saldo-viagem').innerText = `R$ ${saldos.viagem.toFixed(2)}`;
    if(document.getElementById('saldo-gravacao')) document.getElementById('saldo-gravacao').innerText = `R$ ${saldos.gravacao.toFixed(2)}`;
    if(document.getElementById('saldo-rifa')) document.getElementById('saldo-rifa').innerText = `R$ ${saldos.rifa.toFixed(2)}`;
    
    if(document.getElementById('bar-viagem')) document.getElementById('bar-viagem').style.width = Math.min((saldos.viagem / 1000) * 100, 100) + "%";
    if(document.getElementById('bar-gravacao')) document.getElementById('bar-gravacao').style.width = Math.min((saldos.gravacao / 5000) * 100, 100) + "%";
    if(document.getElementById('bar-rifa')) document.getElementById('bar-rifa').style.width = Math.min((saldos.rifa / 2000) * 100, 100) + "%";

    const totalGeral = saldos.viagem + saldos.gravacao + saldos.rifa;
    const dashSaldo = document.getElementById('dash-saldo-total');
    if (dashSaldo) dashSaldo.innerText = `R$ ${totalGeral.toFixed(2)}`;
}

function renderLetras(letras) {
    const list = document.getElementById('list-letras');
    if (!list) return;

    const countEl = document.getElementById('dash-count-letras');
    if (countEl) countEl.innerText = letras.length;

    const fixadas = letras.filter(l => l.pinned);
    const outras = letras.filter(l => !l.pinned).sort((a, b) => a.titulo.localeCompare(b.titulo));

    const gerarCardHTML = (l) => {
        const corpoEscapado = l.corpo.replace(/`/g, '\\`').replace(/'/g, "\\'");
        return `
        <div class="letra-mini-card ${l.pinned ? 'card-pinned shadow-gold/10' : 'bg-white shadow-sm'} flex justify-between items-center" onclick="openModal('${l.titulo}', '${l.tom}', \`${corpoEscapado}\`)">
            <div class="flex-1">
                <h4 class="font-extrabold text-slate-900 truncate pr-2">${l.titulo}</h4>
                <span class="tom-badge mt-2 inline-block">${l.tom || 'N/A'}</span>
            </div>
            <div class="flex gap-1">
                <button onclick="togglePin('${l.id}', ${l.pinned}, event)" class="p-2 ${l.pinned ? 'text-gold' : 'text-slate-200'} hover:scale-110 transition-transform">
                    <i class="fas fa-thumbtack"></i>
                </button>
                <button onclick="prepararEdicaoLetra('${l.id}', '${l.titulo}', '${l.tom}', \`${corpoEscapado}\`, event)" class="text-indigo-400 p-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItem('letras', '${l.id}', event)" class="text-red-200 hover:text-red-500 p-2">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`;
    };

    let html = "";
    if (fixadas.length > 0) {
        html += `<p class="section-label-gold">📌 Principais da Semana (${fixadas.length})</p>`;
        html += fixadas.map(gerarCardHTML).join('');
    }
    if (outras.length > 0) {
        html += `<p class="section-label-slate">📚 Repertório Completo (${outras.length})</p>`;
        html += outras.map(gerarCardHTML).join('');
    }

    list.innerHTML = html || `<p class="col-span-full text-center py-20 text-slate-400 italic">O hinário está vazio...</p>`;
}

function renderSenhas(senhas) {
    const list = document.getElementById('list-senhas');
    if(list) list.innerHTML = senhas.map(s => `<div class="glass flex justify-between p-4 mb-2 shadow-sm border bg-white rounded-xl"><div><p class="font-bold text-gold uppercase text-[10px]">${s.s}</p><p class="text-xs text-slate-500 font-bold">${s.u} | ${s.p}</p></div><button onclick="deleteItem('senhas', '${s.id}', event)" class="text-red-300">×</button></div>`).join('');
}

// ==========================================
// 8. UTILITÁRIOS E MODAIS GERAIS
// ==========================================
window.openModal = (titulo, tom, corpo) => {
    document.getElementById('modal-titulo').innerText = titulo;
    document.getElementById('modal-tom').innerText = "Tom: " + tom;
    document.getElementById('modal-corpo').innerHTML = corpo;
    
    const modalBody = document.querySelector('.modal-lyrics-body');
    if(modalBody) modalBody.scrollTop = 0;

    document.getElementById('lyric-modal').style.display = 'block';
};
window.closeModal = () => document.getElementById('lyric-modal').style.display = 'none';

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

window.shareAgendaWhatsApp = () => {
    let t = "*🎸 AGENDA - MISSÃO SEDENTOS*\n\n";
    document.querySelectorAll('#list-agenda .mission-item:not(.mission-concluded)').forEach(i => {
        t += `📅 *${i.querySelector('span').innerText}* - ${i.querySelector('h4').innerText}\n📍 ${i.querySelector('p').innerText}\n\n`;
    });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(t + "_Salve Maria!_")}`);
};

window.shareFinanceWhatsApp = () => {
    const t = document.getElementById('dash-saldo-total').innerText;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`*💰 FINANCEIRO - MISSÃO SEDENTOS*\n\nTOTAL: ${t}`)}`);
};
