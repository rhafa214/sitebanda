:root {
    --gold: #D4AF37;
    --gold-light: #F1D592;
    --sidebar-bg: #000000;
    --main-bg: #F8FAFC;
    --sidebar-w: 280px;
}

* { 
    margin: 0; 
    padding: 0; 
    box-sizing: border-box; 
    font-family: 'Plus Jakarta Sans', sans-serif; 
}

/* FIXO DESKTOP / ROLÁVEL MOBILE */
body { 
    background-color: var(--main-bg); 
    color: #0F172A; 
    height: 100vh; 
    overflow: hidden; 
}

/* UTILITÁRIOS BASE */
.text-center { text-align: center; }
.mx-auto { margin-left: auto; margin-right: auto; }
.justify-center { justify-content: center; }

/* SHELL & SIDEBAR */
.app-shell { 
    display: flex; 
    height: 100vh; 
    width: 100%; 
}

.sidebar { 
    width: var(--sidebar-w); 
    background: #000; 
    color: white; 
    display: flex; 
    flex-direction: column; 
    padding: 40px 20px; 
    flex-shrink: 0; 
    border-right: 1px solid rgba(212, 175, 55, 0.15); 
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
}
/* Scrollbar styling for sidebar */
.sidebar::-webkit-scrollbar { width: 6px; }
.sidebar::-webkit-scrollbar-thumb { background-color: rgba(212, 175, 55, 0.3); border-radius: 10px; }
.sidebar-header { margin-bottom: 50px; }
.brand-logo-box { 
    width: 64px; 
    height: 64px; 
    border-radius: 18px; 
    background: #111; 
    border: 1px solid rgba(212, 175, 55, 0.4); 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    box-shadow: 0 10px 20px rgba(0,0,0,0.5);
}
.brand-name { display: block; font-size: 1.6rem; font-weight: 800; letter-spacing: -1px; }
.brand-tagline { display: block; font-size: 0.65rem; font-weight: 700; color: var(--gold); letter-spacing: 3px; margin-top: 2px; }

.nav-section-title { font-size: 0.65rem; text-transform: uppercase; color: #444; margin: 30px 0 12px 12px; font-weight: 800; letter-spacing: 2px; }

.nav-link { 
    width: 100%; border: none; background: none; color: #71717a; padding: 14px 18px; 
    text-align: left; cursor: pointer; border-radius: 16px; display: flex; 
    align-items: center; gap: 15px; margin-bottom: 5px; transition: 0.3s; font-size: 0.9rem; font-weight: 600; 
}
.nav-link.active { background: var(--gold); color: #000; box-shadow: 0 8px 20px rgba(212, 175, 55, 0.3); }

/* MAIN AREA */
.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.main-header { height: 80px; padding: 0 40px; display: flex; align-items: center; justify-content: space-between; background: white; border-bottom: 1px solid #e2e8f0; }
.digital-clock { font-weight: 800; color: var(--gold); font-size: 1.1rem; }

.view-wrapper { flex: 1; padding: 40px; overflow-y: auto; }
.view { display: none; animation: slideUp 0.4s ease forwards; }
.view.active { display: block; }
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* DASHBOARD COMPONENTS */
.bento-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.bento-card { background: white; padding: 32px; border-radius: 32px; border: 1px solid rgba(0,0,0,0.04); box-shadow: 0 10px 30px rgba(0,0,0,0.03); }
.col-span-2 { grid-column: span 2; }
.highlight-card { background: #000; color: white; border: 1px solid var(--gold); }
.mission-status-tag { background: var(--gold); color: black; padding: 4px 12px; border-radius: 20px; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; }

/* NUBANK STYLE */
.caixinha-card { 
    background: white; 
    padding: 14px 16px; 
    border-radius: 16px; 
    border: 1px solid #e2e8f0; 
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.caixinha-card h2 { font-size: 1.5rem !important; }
.caixinha-card .w-10 { width: 32px !important; height: 32px !important; font-size: 0.8rem; }

/* FINANCEIRO PRO */
.cx-progress-bg { width: 100%; height: 6px; border-radius: 10px; overflow: hidden; }
.cx-progress-bg div { height: 100%; background: var(--gold); border-radius: 10px; transition: 1.5s cubic-bezier(0.17, 0.67, 0.83, 0.67); }

.transaction-item { display: flex; justify-content: space-between; align-items: center; padding: 20px; transition: 0.2s; }
.transaction-item:hover { background-color: #F8FAFC; }
.t-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
.t-in { background-color: #dcfce7; color: #15803d; }
.t-out { background-color: #fee2e2; color: #b91c1c; }

/* CARDS REPERTÓRIO */
.letra-mini-card { background: white; padding: 24px; border-radius: 20px; border: 1px solid #e2e8f0; cursor: pointer; transition: 0.3s; }
.card-pinned { border: 2px solid var(--gold); background: #FFFDF5; }
.tom-badge { background: #000; color: var(--gold); padding: 4px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 800; }
.section-label-gold { grid-column: 1 / -1; font-size: 0.7rem; font-weight: 800; color: var(--gold); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px; padding-left: 5px; }
.section-label-slate { grid-column: 1 / -1; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin: 30px 0 10px 5px; border-top: 1px solid #f1f5f9; padding-top: 20px; }

/* PLATAFORMAS DIGITAIS SEC. */
.shortcut-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 15px;
    background: white;
    border: 1px solid #eef2f6;
    border-radius: 24px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
}
.shortcut-btn:hover { border-color: var(--gold); transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.05); }
.shortcut-btn i { font-size: 1.8rem; }
.shortcut-btn span { font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }

/* SOCIAL STATS */
.social-stat-item { display: flex; align-items: center; gap: 20px; padding: 25px; background: #ffffff; border-radius: 28px; border: 1px solid #f1f5f9; }
.social-icon-box { width: 54px; height: 54px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
.social-info p { font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }

/* LEVITAÇÃO PREMIUM & EFEITOS */
.dashboard-clickable { cursor: pointer; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important; }
.dashboard-clickable:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 25px 50px -12px rgba(212, 175, 55, 0.2); border-color: var(--gold) !important; z-index: 10; }
.dashboard-clickable:active { transform: translateY(-2px) scale(0.98); }

.btn-whatsapp-premium { background: #25D366; color: white; padding: 12px 24px; border-radius: 16px; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; box-shadow: 0 10px 20px rgba(37, 211, 102, 0.2); transition: 0.3s; }
.btn-whatsapp-premium:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(37, 211, 102, 0.3); filter: brightness(1.1); }

/* ALINHAMENTOS PADRÃO FORM */
.glass-form {
    background: #ffffff;
    border-radius: 32px;
    border: 1px solid #f1f5f9;
    box-shadow: 0 20px 40px -15px rgba(0,0,0,0.05);
    padding: 32px;
    transition: all 0.3s ease;
}
.glass-form:hover {
    box-shadow: 0 25px 50px -12px rgba(212, 175, 55, 0.1);
    border-color: rgba(212, 175, 55, 0.2);
}

.btn-gold-full { background: var(--gold); color: white; padding: 14px; border-radius: 14px; font-weight: 800; width: 100%; transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem;}
.btn-gold-full:hover { background: #b8972e; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(212, 175, 55, 0.3); }

input, select {
    width: 100%; 
    padding: 14px 18px; 
    border-radius: 14px; 
    border: 2px solid #f1f5f9; 
    background: #f8fafc;
    outline: none; 
    margin-bottom: 2px; 
    font-size: 0.95rem;
    font-weight: 500;
    transition: all 0.3s ease;
}
input:focus, select:focus { 
    border-color: var(--gold); 
    background: white;
    box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.1); 
}
input::placeholder { color: #94a3b8; font-weight: 400; }

/* EDITOR AREA */
.rich-editor-area { min-height: 200px; padding: 20px; background: #F8FAFC; border: 1px solid #e2e8f0; border-radius: 16px; outline: none; color: #000; font-size: 1.1rem; }

/* MODAL */
.modal-overlay { display: none; position: fixed; z-index: 10000; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); }
.modal-window { background: white; margin: 40px auto; width: 90%; max-width: 800px; border-radius: 40px; overflow: hidden; }

/* RESPONSIVIDADE CELULAR UNIFICADA */
@media (max-width: 768px) {
    body { overflow-y: auto !important; height: auto !important; }
    .app-shell { display: block !important; }
    
    .sidebar { position: fixed; left: -100%; z-index: 10001; width: 85%; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 20px 0 50px rgba(0,0,0,0.5); padding-top: 60px; }
    .sidebar.active { left: 0; }
    
    .main-header { position: sticky; top: 0; z-index: 999; padding: 0 20px; }
    .mobile-menu-btn { display: block !important; background: #000; color: var(--gold); padding: 10px; border-radius: 12px; margin-right: 15px; }
    
    .bento-grid, .caixinhas-grid, .grid, .grid-cols-2 { grid-template-columns: 1fr !important; }
    .col-span-2, .col-span-full { grid-column: span 1 !important; }
    .view-wrapper { padding: 20px; }
    .digital-clock { display: none; }
    
    /* MODAL CELULAR */
    .modal-overlay { overflow: hidden; display: none; align-items: flex-start; }
    .modal-window { width: 100% !important; height: 100% !important; margin: 0 !important; border-radius: 0 !important; display: flex; flex-direction: column; }
    .modal-header-pro { padding: 15px 20px; flex-shrink: 0; position: sticky; top: 0; z-index: 100; background: #000; }
    .modal-lyrics-body { flex: 1; overflow-y: auto !important; -webkit-overflow-scrolling: touch; padding: 30px 20px 150px 20px !important; background: #fff; }
    .modal-lyrics-body div, .modal-lyrics-body p, .modal-lyrics-body pre { font-size: 1.4rem !important; line-height: 1.8; white-space: pre-wrap; word-break: break-word; }

    /* OUTROS AJUSTES */
    .balance-text { font-size: 2.2rem !important; }
}
