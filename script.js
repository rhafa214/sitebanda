import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCyEZRT-PIwpLpvOAqffVKXp1fVaJfBMTs",
    authDomain: "sedentos.firebaseapp.com",
    projectId: "sedentos",
    storageBucket: "sedentos.firebasestorage.app",
    messagingSenderId: "52891411067",
    appId: "1:52891411067:web:bac8f01d8ffa103a9378de",
    measurementId: "G-L57HTLBGN2"
};

const CLIENT_ID_GOOGLE = "52891411067-bac8f01d8ffa103a9378de.apps.googleusercontent.com";
const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.readonly";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let editandoLetraId = null;
let tokenClient;
let gapiInited = false;
let gsisInited = false;

// --- LOGIN ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const appShell = document.querySelector('.app-shell');
    if (user) {
        if(loginScreen) loginScreen.style.display = 'none';
        if(appShell) appShell.style.display = 'flex';
        iniciarSincronizacao();
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(appShell) appShell.style.display = 'none';
    }
});

window.handleKeyLogin = () => {
    const key = document.getElementById('access-key').value;
    if(!key) return;
    signInWithEmailAndPassword(auth, "missao@missaosedentos.com", key)
        .catch(() => document.getElementById('login-error').classList.remove('hidden'));
};

window.handleLogout = () => { if(confirm("Sair?")) signOut(auth); };

// --- GMAIL ---
window.gapiLoaded = () => {
    gapi.load('client', async () => {
        await gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"] });
        gapiInited = true;
    });
};

window.gisLoaded = () => {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID_GOOGLE,
        scope: GMAIL_SCOPES,
        callback: '', 
    });
    gsisInited = true;
};

window.handleGmailAuth = () => {
    if (!tokenClient) return alert("Google carregando...");
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) throw (resp);
        document.getElementById('gmail-status-area').innerHTML = "<p class='text-[10px] animate-pulse'>Sincronizando...</p>";
        await syncGmailToFirebase();
    };
    tokenClient.requestAccessToken({prompt: 'consent'});
};

async function syncGmailToFirebase() {
    try {
        const response = await gapi.client.gmail.users.messages.list({ 'userId': 'me', 'maxResults': 3 });
        const messages = response.result.messages || [];
        let lista = [];
        for (const msg of messages) {
            const detail = await gapi.client.gmail.users.messages.get({ 'userId': 'me', 'id': msg.id });
            const subject = detail.result.payload.headers.find(h => h.name === 'Subject').value;
            const from = detail.result.payload.headers.find(h => h.name === 'From').value;
            lista.push({ de: from.split('<')[0].trim(), assunto: subject });
        }
        await setDoc(doc(db, "config", "gmail_cache"), { mensagens: lista, ultimaSinc: new Date().toISOString() });
    } catch (err) { console.error(err); }
}

// --- FIRESTORE SYNC ---
function iniciarSincronizacao() {
    onSnapshot(query(collection(db, "agenda"), orderBy("data", "asc")), (snap) => renderAgenda(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(collection(db, "caixa"), (snap) => renderCaixa(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(collection(db, "letras"), (snap) => renderLetras(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(collection(db, "senhas"), (snap) => renderSenhas(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    onSnapshot(doc(db, "config", "gmail_cache"), (snapshot) => {
        if (snapshot.exists()) {
            const emails = snapshot.data().mensagens || [];
            let html = '<div class="space-y-2 mt-2">';
            emails.forEach(m => {
                html += `<div class="border-b pb-1 text-left"><p class="text-[9px] font-black text-gold uppercase">${m.de}</p><p class="text-[11px] font-bold text-slate-700 truncate">${m.assunto}</p></div>`;
            });
            document.getElementById('gmail-status-area').innerHTML = html + '</div>';
        }
    });

    onSnapshot(doc(db, "config", "social"), (snapshot) => {
        if (snapshot.exists()) {
            const d = snapshot.data();
            document.getElementById('count-instagram').innerText = Number(d.ig || 0).toLocaleString();
            document.getElementById('count-youtube').innerText = Number(d.yt || 0).toLocaleString();
            document.getElementById('count-spotify').innerText = Number(d.sp || 0).toLocaleString();
        }
    });
}

// --- INTERFACE ---
window.router = (id) => {
    document.querySelectorAll('.view').forEach(v => { v.classList.add('hidden'); v.classList.remove('active'); });
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById(id + '-view');
    if(target) { target.classList.remove('hidden'); target.classList.add('active'); }
    const navBtn = document.getElementById('nav-' + id);
    if(navBtn) navBtn.classList.add('active');
    const breadEl = document.getElementById('breadcrumb');
    if(breadEl) breadEl.innerText = id.toUpperCase();
    if (window.innerWidth <= 768) document.querySelector('.sidebar').classList.remove('active');
};

window.toggleMobileMenu = () => document.querySelector('.sidebar').classList.toggle('active');
window.execEditorCommand = (cmd, val = null) => document.execCommand(cmd, false, val);

// --- OPERAÇÕES ---
window.addAgenda = async () => {
    const desc = document.getElementById('agenda-desc').value;
    const local = document.getElementById('agenda-local').value;
    const data = document.getElementById('agenda-data').value;
    if(desc && data) await addDoc(collection(db, "agenda"), { desc, local, data });
};

window.addFinanceiro = async () => {
    const desc = document.getElementById('caixa-desc').value;
    const valor = parseFloat(document.getElementById('caixa-valor').value);
    const destino = document.getElementById('caixa-destino').value;
    const tipo = document.getElementById('caixa-tipo').value;
    if(desc && !isNaN(valor)) await addDoc(collection(db, "caixa"), { desc, valor, destino, tipo, data: new Date().toISOString() });
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
        document.getElementById('letra-titulo').value = ""; document.getElementById('letra-editor').innerHTML = "";
    }
};

window.saveSocialStats = async () => {
    const ig = document.getElementById('input-ig').value;
    const yt = document.getElementById('input-yt').value;
    const sp = document.getElementById('input-sp').value;
    await setDoc(doc(db, "config", "social"), { ig, yt, sp });
    document.getElementById('social-modal').style.display = 'none';
};

window.deleteItem = async (col, id, e) => {
    if(e) e.stopPropagation();
    if(confirm("Excluir?")) await deleteDoc(doc(db, col, id));
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
    document.getElementById('form-letras-container').scrollIntoView({ behavior: 'smooth' });
};

window.cancelarEdicaoLetra = () => {
    editandoLetraId = null;
    document.getElementById('letra-titulo').value = ""; document.getElementById('letra-tom').value = "";
    document.getElementById('letra-editor').innerHTML = "";
    document.getElementById('btn-letra-cancel').classList.add('hidden');
};

window.prepararEdicaoSocial = () => document.getElementById('social-modal').style.display = 'block';

window.addSenha = async () => {
    const s = document.getElementById('senha-site').value, u = document.getElementById('senha-user').value, p = document.getElementById('senha-pass').value;
    if(s && p) await addDoc(collection(db, "senhas"), { s, u, p });
};

// --- RENDERIZADORES ---
function renderAgenda(agenda) {
    const list = document.getElementById('list-agenda');
    const hoje = new Date().setHours(0,0,0,0);
    if(!list) return;
    list.innerHTML = agenda.map(a => {
        const isOld = new Date(a.data + "T00:00:00").getTime() < hoje;
        return `<div class="mission-item ${isOld ? 'mission-concluded' : ''}"><div><span class="text-xs font-bold text-gold uppercase">${new Date(a.data + "T00:00:00").toLocaleDateString('pt-BR')}</span><h4 class="font-bold text-black">${a.desc}</h4><p class="text-xs text-slate-400">${a.local}</p></div><button onclick="deleteItem('agenda', '${a.id}', event)">×</button></div>`;
    }).join('');
    const proxima = agenda.filter(a => new Date(a.data + "T00:00:00").getTime() >= hoje)[0];
    if(proxima) {
        document.getElementById('dash-next-desc').innerText = proxima.desc;
        document.getElementById('dash-next-info-local').innerText = proxima.local;
        document.getElementById('dash-next-info-date').innerText = new Date(proxima.data + "T00:00:00").toLocaleDateString('pt-BR');
    }
}

function renderCaixa(transacoes) {
    let saldos = { viagem: 0, gravacao: 0, rifa: 0 };
    transacoes.forEach(t => saldos[t.destino] += (t.tipo === 'in' ? t.valor : -t.valor));
    document.getElementById('dash-saldo-total').innerText = `R$ ${(saldos.viagem+saldos.gravacao+saldos.rifa).toFixed(2)}`;
    if(document.getElementById('saldo-viagem')) {
        document.getElementById('saldo-viagem').innerText = `R$ ${saldos.viagem.toFixed(2)}`;
        document.getElementById('saldo-gravacao').innerText = `R$ ${saldos.gravacao.toFixed(2)}`;
        document.getElementById('saldo-rifa').innerText = `R$ ${saldos.rifa.toFixed(2)}`;
        document.getElementById('bar-viagem').style.width = Math.min((saldos.viagem/1000)*100, 100) + "%";
        document.getElementById('bar-gravacao').style.width = Math.min((saldos.gravacao/5000)*100, 100) + "%";
        document.getElementById('bar-rifa').style.width = Math.min((saldos.rifa/2000)*100, 100) + "%";
    }
}

function renderLetras(letras) {
    const list = document.getElementById('list-letras');
    if(!list) return;
    document.getElementById('dash-count-letras').innerText = letras.length;
    const fixadas = letras.filter(l => l.pinned);
    const outras = letras.filter(l => !l.pinned).sort((a,b) => a.titulo.localeCompare(b.titulo));
    const gerarCard = (l) => {
        const corpoEsc = l.corpo.replace(/`/g, '\\`').replace(/'/g, "\\'");
        return `<div class="letra-mini-card ${l.pinned ? 'card-pinned' : ''}" onclick="openModal('${l.titulo}', '${l.tom}', \`${corpoEsc}\`)"><div class="flex-1 text-left"><h4 class="font-bold text-black">${l.titulo}</h4><span class="tom-badge">${l.tom || 'N/A'}</span></div><div class="flex gap-2"><button onclick="togglePin('${l.id}', ${l.pinned}, event)" class="pin-btn ${l.pinned?'active':''}"><i class="fas fa-thumbtack"></i></button><button onclick="prepararEdicaoLetra('${l.id}', '${l.titulo}', '${l.tom}', \`${corpoEsc}\`, event)" class="text-indigo-400"><i class="fas fa-edit"></i></button><button onclick="deleteItem('letras', '${l.id}', event)">×</button></div></div>`;
    };
    list.innerHTML = (fixadas.length ? '<div class="col-span-full font-bold text-gold uppercase text-[10px] tracking-widest mt-4 mb-2">📌 Fixadas</div>' + fixadas.map(gerarCard).join('') : '') +
                     (outras.length ? '<div class="col-span-full font-bold text-slate-400 uppercase text-[10px] tracking-widest mt-8 mb-2 border-t pt-6">📚 Todas</div>' + outras.map(gerarCard).join('') : '');
}

function renderSenhas(senhas) {
    const list = document.getElementById('list-senhas');
    if(list) list.innerHTML = senhas.map(s => `<div class="glass flex justify-between p-4 mb-2"><div><p class="font-bold text-gold text-[10px] uppercase">${s.s}</p><p class="text-xs text-slate-500 font-bold">${s.u} | ${s.p}</p></div><button onclick="deleteItem('senhas', '${s.id}', event)">×</button></div>`).join('');
}

window.openModal = (titulo, tom, corpo) => {
    document.getElementById('modal-titulo').innerText = titulo;
    document.getElementById('modal-tom').innerText = "Tom: " + tom;
    document.getElementById('modal-corpo').innerHTML = corpo;
    document.getElementById('lyric-modal').style.display = 'block';
};
window.closeModal = () => document.getElementById('lyric-modal').style.display = 'none';

setInterval(() => {
    const c = document.getElementById('live-clock');
    if(c) c.innerText = new Date().toLocaleTimeString('pt-BR');
}, 1000);

const frasesSantos = [{texto:"Cantar é rezar duas vezes.", autor:"Santo Agostinho"}, {texto:"Onde não há amor, coloque amor.", autor:"São João da Cruz"}, {texto:"Nada te perturbe.", autor:"Santa Teresa"}];
const fs = frasesSantos[Math.floor(Math.random() * frasesSantos.length)];
document.getElementById('saint-quote').innerText = `"${fs.texto}"`;
document.getElementById('autor-santo').innerText = `— ${fs.autor}`;

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