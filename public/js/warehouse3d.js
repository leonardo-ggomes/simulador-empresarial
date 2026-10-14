/**
 * Gêmeo Digital do Galpão — Renderizador 3D CAD / Wireframe (Blueprint)
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Three.js (ES Modules via import map). Lê os snapshots do galpão embutidos na página
 * (#warehouse-data) e desenha porta-paletes, posições ocupadas/vazias, doca de trânsito,
 * cotas técnicas e HUD sincronizado com a linha do tempo de rodadas.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------------------------------------------------------------------------
// Dados & constantes
// ---------------------------------------------------------------------------
const dataEl = document.getElementById('warehouse-data');
const DATA = dataEl ? JSON.parse(dataEl.textContent) : null;
const viewport = document.getElementById('warehouse-viewport');

const COLORS = {
  bg: 0x0B1120,
  gridMinor: 0x111C33,
  gridMajor: 0x1A2A4A,
  shell: 0x22D3EE,
  rack: 0x2B4A6B,
  cyan: 0x22D3EE,
  cyanEdge: 0x67E8F9,
  empty: 0x3B4A63,
  amber: 0xF59E0B,
  red: 0xF43F5E,
  heat: [0x22D3EE, 0x34D399, 0xF59E0B, 0xF43F5E]
};

// Geometria física (metros)
const SLOT_W = 2.7;   // largura do módulo (eixo X)
const SLOT_H = 2.2;   // altura do nível (eixo Y)
const RACK_D = 1.2;   // profundidade do rack (eixo Z)
const PALLET = { w: 2.35, h: 1.05, d: 1.0 };
const RACK_X0 = -21;
const RACK_PITCH_Z = 5.2;

const fmtInt = (v) => Number(v || 0).toLocaleString('pt-BR');
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDec = (v, d = 1) => Number(v || 0).toFixed(d).replace('.', ',');

if (!DATA || !viewport) {
  console.warn('[Galpão 3D] Dados ou viewport ausentes.');
} else {
  try {
    init();
  } catch (err) {
    console.error('[Galpão 3D] Falha ao iniciar WebGL:', err);
    document.getElementById('wh-fallback')?.classList.remove('hidden');
  }
}

function init() {
  const cfg = DATA.config;
  const dims = cfg.dimensoes;
  const state = {
    roundIndex: Math.max(0, DATA.snapshots.findIndex(s => s.rodada === DATA.rodadaSelecionada)),
    mode: 'wireframe',
    sectionLevel: cfg.niveis,
    playing: false,
    playTimer: null,
    cameraGoal: null,
    hovered: null
  };

  // -------------------------------------------------------------------------
  // Renderer, cena, câmera
  // -------------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(COLORS.bg, 1);
  viewport.prepend(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.inset = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  viewport.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COLORS.bg, 90, 160);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
  camera.position.set(38, 32, 42);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 140;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.addEventListener('start', () => { state.cameraGoal = null; });

  // -------------------------------------------------------------------------
  // Piso milimetrado + casco do galpão
  // -------------------------------------------------------------------------
  const gridMinor = new THREE.GridHelper(120, 240, COLORS.gridMinor, COLORS.gridMinor);
  gridMinor.material.transparent = true;
  gridMinor.material.opacity = 0.55;
  scene.add(gridMinor);

  const gridMajor = new THREE.GridHelper(120, 24, COLORS.gridMajor, COLORS.gridMajor);
  gridMajor.position.y = 0.002;
  gridMajor.material.transparent = true;
  gridMajor.material.opacity = 0.9;
  scene.add(gridMajor);

  const shellGeo = new THREE.BoxGeometry(dims.comprimento, dims.altura, dims.largura);
  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(shellGeo),
    new THREE.LineBasicMaterial({ color: COLORS.shell, transparent: true, opacity: 0.55 })
  );
  shell.position.y = dims.altura / 2;
  scene.add(shell);

  // Pilares estruturais no perímetro (detalhe técnico)
  const pillarPts = [];
  for (let x = -dims.comprimento / 2; x <= dims.comprimento / 2 + 0.01; x += 8) {
    for (const z of [-dims.largura / 2, dims.largura / 2]) {
      pillarPts.push(x, 0, z, x, dims.altura, z);
    }
  }
  scene.add(lineSegments(pillarPts, COLORS.shell, 0.18));

  // -------------------------------------------------------------------------
  // Porta-paletes (estrutura) — um único LineSegments por performance
  // -------------------------------------------------------------------------
  const rackZ = (ci) => (ci - (cfg.corredores.length - 1) / 2) * RACK_PITCH_Z;
  const rackLen = cfg.modulosPorCorredor * SLOT_W;
  const rackTop = cfg.niveis * SLOT_H + 0.3;
  const rackPts = [];

  cfg.corredores.forEach((_, ci) => {
    const zc = rackZ(ci);
    const zf = zc - RACK_D / 2;
    const zb = zc + RACK_D / 2;
    // Montantes verticais e travessas de profundidade
    for (let mi = 0; mi <= cfg.modulosPorCorredor; mi++) {
      const x = RACK_X0 + mi * SLOT_W;
      rackPts.push(x, 0, zf, x, rackTop, zf);
      rackPts.push(x, 0, zb, x, rackTop, zb);
      for (let n = 0; n <= cfg.niveis; n++) {
        const y = n * SLOT_H + 0.08;
        rackPts.push(x, y, zf, x, y, zb);
      }
      // Contraventamento diagonal lateral
      rackPts.push(x, 0.1, zf, x, SLOT_H, zb);
    }
    // Longarinas (vigas horizontais) em cada nível
    for (let n = 0; n <= cfg.niveis; n++) {
      const y = n * SLOT_H + 0.08;
      rackPts.push(RACK_X0, y, zf, RACK_X0 + rackLen, y, zf);
      rackPts.push(RACK_X0, y, zb, RACK_X0 + rackLen, y, zb);
    }
  });
  const rackLines = lineSegments(rackPts, COLORS.rack, 0.9);
  scene.add(rackLines);

  // Rótulos de corredor
  cfg.corredores.forEach((c, ci) => {
    addLabel(c, 'bp-label bp-label--big', RACK_X0 - 1.8, 0.2, rackZ(ci));
  });

  // -------------------------------------------------------------------------
  // Doca de recebimento (pedidos em trânsito)
  // -------------------------------------------------------------------------
  const DOCK = { x0: 11, z0: -8.5, cols: 4, rows: 6, dx: 3.0, dz: 3.4 };
  const dockW = DOCK.cols * DOCK.dx + 0.6;
  const dockD = DOCK.rows * DOCK.dz;
  const dockOutline = [];
  const dx0 = DOCK.x0 - 1.8, dz0 = DOCK.z0 - 1.9;
  rectXZ(dockOutline, dx0, dz0, dx0 + dockW, dz0 + dockD, 0.01);
  const dockLine = lineSegments(dockOutline, COLORS.amber, 0.55);
  scene.add(dockLine);
  // Hachura diagonal da doca
  const hatch = [];
  for (let t = 0; t < dockW + dockD; t += 1.6) {
    const ax = dx0 + Math.min(t, dockW), az = dz0 + Math.max(0, t - dockW);
    const bx = dx0 + Math.max(0, t - dockD), bz = dz0 + Math.min(t, dockD);
    hatch.push(ax, 0.01, az, bx, 0.01, bz);
  }
  scene.add(lineSegments(hatch, COLORS.amber, 0.08));
  addLabel('DOCA • EM TRÂNSITO', 'bp-label bp-label--amber bp-mono', dx0 + dockW / 2, 0.1, dz0 + dockD + 1.2);

  // Portão da doca na parede
  const gate = [];
  const gx = dims.comprimento / 2;
  gate.push(gx, 0, -4, gx, 4.5, -4, gx, 4.5, -4, gx, 4.5, 4, gx, 4.5, 4, gx, 0, 4);
  scene.add(lineSegments(gate, COLORS.amber, 0.5));

  // -------------------------------------------------------------------------
  // Cotas técnicas (dimension lines)
  // -------------------------------------------------------------------------
  const L = dims.comprimento / 2, W = dims.largura / 2;
  addDimension([-L, 0, W + 3], [L, 0, W + 3], `${fmtDec(dims.comprimento)} m`);
  addDimension([L + 3, 0, -W], [L + 3, 0, W], `${fmtDec(dims.largura)} m`);
  addDimension([-L - 2.5, 0, -W], [-L - 2.5, dims.altura, -W], `${fmtDec(dims.altura)} m`);

  // -------------------------------------------------------------------------
  // Posições de palete (slots) + doca
  // -------------------------------------------------------------------------
  const palletGeo = new THREE.BoxGeometry(PALLET.w, PALLET.h, PALLET.d);
  const palletEdges = new THREE.EdgesGeometry(palletGeo);
  const slotObjects = new Map(); // codigo -> objeto
  const pickables = [];

  const baseSlots = DATA.snapshots[0].slots;
  baseSlots.forEach((s) => {
    const x = RACK_X0 + (s.modulo - 0.5) * SLOT_W;
    const y = (s.nivel - 1) * SLOT_H + 0.08 + PALLET.h / 2 + 0.02;
    const z = rackZ(s.corredorIndex);
    slotObjects.set(s.codigo, createSlot(x, y, z, s));
  });

  const dockObjects = [];
  for (let i = 0; i < cfg.posicoesDoca; i++) {
    const col = i % DOCK.cols;
    const row = Math.floor(i / DOCK.cols);
    const x = DOCK.x0 + col * DOCK.dx;
    const z = DOCK.z0 + row * DOCK.dz;
    const obj = createSlot(x, PALLET.h / 2 + 0.02, z, { codigo: `DOCA-${String(i + 1).padStart(2, '0')}`, nivel: 1, doca: true });
    obj.dashed.visible = false;
    dockObjects.push(obj);
  }

  function createSlot(x, y, z, meta) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const fillMat = new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.18, depthWrite: false });
    const fill = new THREE.Mesh(palletGeo, fillMat);
    const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.cyanEdge, transparent: true, opacity: 0.95 });
    const edges = new THREE.LineSegments(palletEdges, edgeMat);
    const pallet = new THREE.Group();
    pallet.add(fill, edges);
    pallet.scale.setScalar(0.001);
    group.add(pallet);

    const dashed = new THREE.LineSegments(
      palletEdges,
      new THREE.LineDashedMaterial({ color: COLORS.empty, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.55 })
    );
    dashed.computeLineDistances();
    group.add(dashed);

    // Caixa invisível para picking (sempre do tamanho do slot)
    const hit = new THREE.Mesh(palletGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    hit.userData.codigo = meta.codigo;
    group.add(hit);
    pickables.push(hit);

    scene.add(group);
    const obj = { group, pallet, fill, edges, dashed, hit, meta, data: null, target: 0, current: 0.001, color: new THREE.Color(COLORS.cyan) };
    hit.userData.obj = obj;
    return obj;
  }

  // -------------------------------------------------------------------------
  // Aplicação de snapshot / modos / corte
  // -------------------------------------------------------------------------
  function heatColor(rodadaEntrada, rodadaAtual) {
    const idade = Math.max(0, rodadaAtual - (rodadaEntrada ?? rodadaAtual));
    return COLORS.heat[Math.min(idade, COLORS.heat.length - 1)];
  }

  function applySnapshot() {
    const snap = DATA.snapshots[state.roundIndex];
    const bySlot = new Map(snap.slots.map(s => [s.codigo, s]));

    slotObjects.forEach((obj, codigo) => {
      const s = bySlot.get(codigo);
      obj.data = s;
      styleSlot(obj, s ? s.status : 'vazio', s, snap.rodada);
    });

    dockObjects.forEach((obj, i) => {
      const d = snap.doca[i];
      obj.data = d ? { ...d, status: 'transito' } : null;
      styleSlot(obj, d ? 'transito' : 'oculto', obj.data, snap.rodada);
    });

    applySection();
    renderHUD(snap);
    document.querySelectorAll('#wh-timeline [data-round]').forEach(btn => {
      btn.classList.toggle('is-active', Number(btn.dataset.round) === snap.rodada);
    });
  }

  function styleSlot(obj, status, s, rodadaAtual) {
    const xray = state.mode === 'xray';
    const heat = state.mode === 'heat';
    let color = COLORS.cyan;
    let edge = COLORS.cyanEdge;
    let fillOpacity = xray ? 0.42 : 0.18;

    if (status === 'ocupado') {
      if (heat) { color = heatColor(s?.rodadaEntrada, rodadaAtual); edge = color; fillOpacity = 0.38; }
    } else if (status === 'perda') {
      color = COLORS.red; edge = COLORS.red; fillOpacity = 0.28;
    } else if (status === 'transito') {
      color = COLORS.amber; edge = COLORS.amber; fillOpacity = 0.2;
    }

    obj.status = status;
    obj.target = (status === 'ocupado' || status === 'perda' || status === 'transito') ? 1 : 0.001;
    obj.fill.material.color.setHex(color);
    obj.fill.material.opacity = fillOpacity;
    obj.edges.material.color.setHex(edge);
    obj.dashed.visible = !obj.meta.doca && status === 'vazio' && !xray;
    obj.hit.visible = status !== 'oculto';
  }

  function applySection() {
    slotObjects.forEach((obj) => {
      const visible = obj.meta.nivel <= state.sectionLevel;
      obj.group.visible = visible;
    });
    const label = document.getElementById('wh-section-label');
    if (label) label.textContent = `N1–N${state.sectionLevel}`;
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('#wh-modes [data-mode]').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
    document.getElementById('wh-heat-legend')?.classList.toggle('hidden', mode !== 'heat');
    document.getElementById('wh-heat-legend')?.classList.toggle('flex', mode === 'heat');
    rackLines.material.opacity = mode === 'xray' ? 0.25 : 0.9;
    applySnapshot();
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

  function renderHUD(snap) {
    const m = snap.metricas;
    setText('hud-round', `R${snap.rodada}`);
    setText('hud-ocupacao', `${fmtDec(m.ocupacao)}%`);
    setText('hud-pos-ocupadas', m.posicoesOcupadas);
    setText('hud-pos-livres', m.posicoesLivres);
    setText('hud-pos-total', m.capacidadePosicoes);
    setText('hud-estoque', fmtInt(m.estoqueUnidades));
    setText('hud-valor', fmtBRL(m.valorContabil));
    setText('hud-transito', fmtInt(m.emTransito));
    setText('hud-armazenagem', fmtBRL(m.custoArmazenagem));
    setText('hud-perdas', fmtInt(m.unidadesPerdidas));
    setText('hud-perdas-valor', fmtBRL(m.custoPerdas));
    setText('hud-atendimento', `${fmtDec(m.taxaAtendimento)}%`);
    setText('hud-ruptura', fmtInt(m.vendasPerdidas));
    setText('hud-giro', `${fmtDec(m.giro, 2)}x`);
    setText('hud-cobertura', m.coberturaDias);
    setText('hud-projecao', `${fmtDec(m.ocupacaoProjetada)}%`);

    const bar = document.querySelectorAll('#hud-ocupacao-bar span');
    const on = Math.round((m.ocupacao / 100) * bar.length);
    const proj = Math.min(bar.length, Math.round((m.ocupacaoProjetada / 100) * bar.length));
    bar.forEach((el, i) => {
      el.className = '';
      if (i < on) el.classList.add(m.ocupacao >= 100 ? 'crit' : 'on');
      else if (i < proj) el.classList.add('warn');
    });

    const alerta = document.getElementById('hud-alerta');
    if (alerta) {
      if (snap.alerta) {
        const crit = snap.alerta.nivel === 'critico';
        alerta.classList.remove('hidden');
        alerta.className = `rounded-lg px-3 py-2.5 text-[11px] leading-relaxed border ${crit ? 'border-rose-500/50 bg-rose-500/10 text-rose-200' : 'border-amber-500/50 bg-amber-500/10 text-amber-200'}`;
        setText('hud-alerta-titulo', crit ? 'Capacidade crítica' : 'Atenção operacional');
        setText('hud-alerta-texto', snap.alerta.mensagem);
      } else {
        alerta.classList.add('hidden');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Câmera: vistas técnicas animadas
  // -------------------------------------------------------------------------
  const VIEWS = {
    iso:   { pos: [38, 32, 42], target: [0, 2, 0] },
    top:   { pos: [0, 78, 0.01], target: [0, 0, 0] },
    front: { pos: [0, 9, 66], target: [0, 3, 0] },
    side:  { pos: [76, 9, 0], target: [0, 3, 0] }
  };

  function setView(name) {
    const v = VIEWS[name];
    if (!v) return;
    state.cameraGoal = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
    document.querySelectorAll('#wh-views [data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
  }

  // -------------------------------------------------------------------------
  // Interação: hover, clique, coordenadas
  // -------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const floorHit = new THREE.Vector3();
  const tooltip = document.getElementById('wh-tooltip');

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(floorPlane, floorHit)) {
      setText('wh-coord-x', floorHit.x.toFixed(2));
      setText('wh-coord-z', floorHit.z.toFixed(2));
    }
    const hits = raycaster.intersectObjects(pickables.filter(p => p.visible && p.parent.visible), false);
    return { hit: hits[0]?.object?.userData?.obj || null, rect };
  }

  function describe(obj) {
    const d = obj.data;
    const codigo = obj.meta.codigo;
    if (obj.status === 'ocupado') return `${codigo} · ${fmtInt(d.unidades)} un · ${fmtBRL(d.unidades * (currentSnap().metricas.custoMedioUnitario || 0))} · entrada R${d.rodadaEntrada || 0}`;
    if (obj.status === 'perda') return `${codigo} · baixa por perda · ${fmtInt(d.unidades)} un`;
    if (obj.status === 'transito') return `${codigo} · em trânsito · ${fmtInt(d.unidades)} un · chega R${currentSnap().rodada + 1}`;
    return `${codigo} · posição livre`;
  }

  function currentSnap() { return DATA.snapshots[state.roundIndex]; }

  renderer.domElement.addEventListener('pointermove', (e) => {
    const { hit, rect } = pick(e);
    if (state.hovered && state.hovered !== hit) {
      state.hovered.edges.material.opacity = 0.95;
      state.hovered.dashed.material.opacity = 0.55;
    }
    state.hovered = hit;
    if (hit) {
      hit.edges.material.opacity = 1;
      hit.dashed.material.opacity = 1;
      tooltip.textContent = describe(hit);
      tooltip.style.left = `${e.clientX - rect.left}px`;
      tooltip.style.top = `${e.clientY - rect.top}px`;
      tooltip.classList.add('is-visible');
      renderer.domElement.style.cursor = 'pointer';
    } else {
      tooltip.classList.remove('is-visible');
      renderer.domElement.style.cursor = 'grab';
    }
  });

  renderer.domElement.addEventListener('pointerleave', () => tooltip.classList.remove('is-visible'));

  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
    const { hit } = pick(e);
    if (hit && !hit.meta.doca) openCorridorSheet(hit.meta.corredor || hit.data?.corredor);
    else if (hit && hit.meta.doca) openDockSheet();
  });

  function openCorridorSheet(corredor) {
    if (!corredor || typeof window.abrirSideSheet !== 'function') return;
    const snap = currentSnap();
    const slots = snap.slots.filter(s => s.corredor === corredor);
    const ocupadas = slots.filter(s => s.status === 'ocupado');
    const unidades = ocupadas.reduce((a, s) => a + s.unidades, 0);
    const perdas = slots.filter(s => s.status === 'perda').length;
    const pct = slots.length ? (ocupadas.length / slots.length) * 100 : 0;

    let grid = '';
    for (let n = cfg.niveis; n >= 1; n--) {
      grid += `<div class="flex items-center gap-1"><span class="w-6 text-[10px] text-slate-400 font-mono">N${n}</span>`;
      for (let mi = 1; mi <= cfg.modulosPorCorredor; mi++) {
        const s = slots.find(x => x.modulo === mi && x.nivel === n);
        const cls = s?.status === 'ocupado' ? 'bg-cyan-400/40 border-cyan-500'
          : s?.status === 'perda' ? 'bg-rose-400/40 border-rose-500'
          : 'bg-white border-dashed border-slate-300';
        grid += `<span title="${s?.codigo} · ${s?.unidades || 0} un" class="flex-1 h-5 rounded-sm border ${cls}"></span>`;
      }
      grid += '</div>';
    }
    let modLabels = '<div class="flex items-center gap-1 mt-1"><span class="w-6"></span>';
    for (let mi = 1; mi <= cfg.modulosPorCorredor; mi++) modLabels += `<span class="flex-1 text-center text-[9px] text-slate-400 font-mono">${String(mi).padStart(2, '0')}</span>`;
    modLabels += '</div>';

    const html = `
      <div class="space-y-5">
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div class="text-[10px] uppercase text-slate-400">Ocupação</div>
            <div class="font-mono font-bold text-slate-900 mt-0.5">${fmtDec(pct)}%</div>
          </div>
          <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div class="text-[10px] uppercase text-slate-400">Unidades</div>
            <div class="font-mono font-bold text-slate-900 mt-0.5">${fmtInt(unidades)}</div>
          </div>
          <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div class="text-[10px] uppercase text-slate-400">Perdas</div>
            <div class="font-mono font-bold text-rose-600 mt-0.5">${perdas} pal.</div>
          </div>
        </div>
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Elevação frontal • Corredor ${corredor}</h4>
          <div class="space-y-1">${grid}</div>
          ${modLabels}
        </div>
        <p class="text-[11px] text-slate-500 leading-relaxed">
          Alocação FIFO: os lotes mais antigos ocupam as primeiras posições (corredor A, módulo 01, nível 1) e são consumidos primeiro.
          Cada palete comporta ${cfg.unidadesPorPalete} unidades.
        </p>
      </div>`;
    window.abrirSideSheet(`Corredor ${corredor} • R${snap.rodada}`, html);
  }

  function openDockSheet() {
    if (typeof window.abrirSideSheet !== 'function') return;
    const snap = currentSnap();
    const m = snap.metricas;
    window.abrirSideSheet('Doca de Recebimento', `
      <div class="space-y-4 text-xs text-slate-700">
        <div class="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div class="text-[10px] uppercase text-amber-700 font-semibold">Em trânsito</div>
          <div class="font-mono text-lg font-bold text-amber-800">${fmtInt(m.emTransito)} un · ${m.paletesTransito} paletes</div>
          <div class="text-[11px] text-amber-700 mt-0.5">Chegada prevista na Rodada ${snap.rodada + 1} (lead time de 1 trimestre).</div>
        </div>
        <p class="leading-relaxed">Projeção de ocupação após o recebimento: <strong class="font-mono">${fmtDec(m.ocupacaoProjetada)}%</strong> da capacidade (${fmtInt(m.capacidadeUnidades)} un).</p>
      </div>`);
  }

  // -------------------------------------------------------------------------
  // Controles da UI
  // -------------------------------------------------------------------------
  document.querySelectorAll('#wh-views [data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('#wh-modes [data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelectorAll('#wh-timeline [data-round]').forEach(b => b.addEventListener('click', () => {
    stopPlay();
    goToRound(Number(b.dataset.round));
  }));

  const section = document.getElementById('wh-section');
  section?.addEventListener('input', () => { state.sectionLevel = Number(section.value); applySection(); });

  const playBtn = document.getElementById('wh-play');
  playBtn?.addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));

  function goToRound(rodada) {
    const idx = DATA.snapshots.findIndex(s => s.rodada === rodada);
    if (idx < 0) return;
    state.roundIndex = idx;
    applySnapshot();
    const url = new URL(window.location.href);
    url.searchParams.set('rodada', rodada);
    window.history.replaceState({}, '', url);
  }

  function startPlay() {
    if (DATA.snapshots.length < 2) return;
    state.playing = true;
    if (playBtn) playBtn.textContent = '❚❚';
    state.roundIndex = 0;
    applySnapshot();
    state.playTimer = setInterval(() => {
      if (state.roundIndex >= DATA.snapshots.length - 1) { stopPlay(); return; }
      state.roundIndex++;
      applySnapshot();
    }, 1400);
  }

  function stopPlay() {
    state.playing = false;
    if (playBtn) playBtn.textContent = '▶';
    clearInterval(state.playTimer);
  }

  // -------------------------------------------------------------------------
  // Tela Cheia (Fullscreen API + Fallback CSS)
  // -------------------------------------------------------------------------
  const shellEl = document.getElementById('warehouse-shell');
  const fsBtn = document.getElementById('wh-btn-fullscreen');
  const iconExpand = document.getElementById('wh-icon-expand');
  const iconCompress = document.getElementById('wh-icon-compress');
  const fsText = document.getElementById('wh-fullscreen-text');

  function isFullscreen() {
    return Boolean(document.fullscreenElement || shellEl?.classList.contains('is-fullscreen'));
  }

  function updateFullscreenUI() {
    const active = isFullscreen();
    if (iconExpand) iconExpand.classList.toggle('hidden', active);
    if (iconCompress) iconCompress.classList.toggle('hidden', !active);
    if (fsText) fsText.textContent = active ? 'REDUZIR' : 'EXPANDIR';
    if (fsBtn) {
      fsBtn.title = active ? 'Sair da Tela Cheia (F / Esc)' : 'Alternar Tela Cheia (F)';
      fsBtn.classList.toggle('is-active', active);
    }
    setTimeout(resize, 80);
  }

  function toggleFullscreen() {
    if (!shellEl) return;
    if (!isFullscreen()) {
      if (shellEl.requestFullscreen) {
        shellEl.requestFullscreen().catch(() => {
          shellEl.classList.add('is-fullscreen');
          updateFullscreenUI();
        });
      } else {
        shellEl.classList.add('is-fullscreen');
        updateFullscreenUI();
      }
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        shellEl.classList.remove('is-fullscreen');
        updateFullscreenUI();
      }
    }
  }

  fsBtn?.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenUI);

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    const views = { '1': 'iso', '2': 'top', '3': 'front', '4': 'side' };
    const modes = { w: 'wireframe', x: 'xray', h: 'heat' };
    if (views[e.key]) setView(views[e.key]);
    else if (modes[e.key.toLowerCase()]) setMode(modes[e.key.toLowerCase()]);
    else if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); }
    else if (e.key === 'Escape' && shellEl?.classList.contains('is-fullscreen')) {
      shellEl.classList.remove('is-fullscreen');
      updateFullscreenUI();
    }
    else if (e.code === 'Space' && viewport.matches(':hover')) { e.preventDefault(); state.playing ? stopPlay() : startPlay(); }
  });

  // -------------------------------------------------------------------------
  // Gizmo de eixos (canvas 2D sincronizado com a câmera)
  // -------------------------------------------------------------------------
  const gizmo = document.getElementById('wh-gizmo');
  const gctx = gizmo?.getContext('2d');
  const AXES = [
    { v: new THREE.Vector3(1, 0, 0), c: '#F87171', l: 'X' },
    { v: new THREE.Vector3(0, 1, 0), c: '#60A5FA', l: 'Y' },
    { v: new THREE.Vector3(0, 0, 1), c: '#4ADE80', l: 'Z' }
  ];
  function drawGizmo() {
    if (!gctx) return;
    const s = gizmo.width, c = s / 2, r = s * 0.34;
    gctx.clearRect(0, 0, s, s);
    gctx.strokeStyle = 'rgba(100,116,139,.25)';
    gctx.beginPath(); gctx.arc(c, c, r + 8, 0, Math.PI * 2); gctx.stroke();
    const q = camera.quaternion.clone().invert();
    const proj = AXES.map(a => ({ ...a, p: a.v.clone().applyQuaternion(q) })).sort((a, b) => a.p.z - b.p.z);
    gctx.font = '600 10px ui-monospace, monospace';
    gctx.textAlign = 'center'; gctx.textBaseline = 'middle';
    proj.forEach(a => {
      const x = c + a.p.x * r, y = c - a.p.y * r;
      gctx.strokeStyle = a.c; gctx.lineWidth = 1.5;
      gctx.beginPath(); gctx.moveTo(c, c); gctx.lineTo(x, y); gctx.stroke();
      gctx.fillStyle = a.c; gctx.fillText(a.l, c + a.p.x * (r + 9), c - a.p.y * (r + 9));
    });
  }

  // -------------------------------------------------------------------------
  // Helpers de geometria / rótulos
  // -------------------------------------------------------------------------
  function lineSegments(points, color, opacity = 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }

  function rectXZ(arr, x1, z1, x2, z2, y) {
    arr.push(x1, y, z1, x2, y, z1, x2, y, z1, x2, y, z2, x2, y, z2, x1, y, z2, x1, y, z2, x1, y, z1);
  }

  function addLabel(text, className, x, y, z) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.set(x, y, z);
    scene.add(obj);
    return obj;
  }

  function addDimension(a, b, text) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A).normalize();
    // Vetor perpendicular para os "ticks" das extremidades
    const perp = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-dir.z, 0, dir.x);
    const t = 0.6;
    const pts = [
      A.x, A.y, A.z, B.x, B.y, B.z,
      A.x - perp.x * t, A.y, A.z - perp.z * t, A.x + perp.x * t, A.y, A.z + perp.z * t,
      B.x - perp.x * t, B.y, B.z - perp.z * t, B.x + perp.x * t, B.y, B.z + perp.z * t
    ];
    // Setas
    const ah = 0.9, aw = 0.35;
    [[A, dir], [B, dir.clone().negate()]].forEach(([P, d]) => {
      const base = P.clone().add(d.clone().multiplyScalar(ah));
      pts.push(P.x, P.y, P.z, base.x + perp.x * aw, base.y, base.z + perp.z * aw);
      pts.push(P.x, P.y, P.z, base.x - perp.x * aw, base.y, base.z - perp.z * aw);
    });
    scene.add(lineSegments(pts, COLORS.cyanEdge, 0.55));
    const mid = A.clone().add(B).multiplyScalar(0.5);
    addLabel(text, 'bp-label bp-mono', mid.x, mid.y + 0.4, mid.z);
  }

  // -------------------------------------------------------------------------
  // Resize & loop
  // -------------------------------------------------------------------------
  function resize() {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    labelRenderer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(viewport);
  resize();

  let last = performance.now(), frames = 0, fpsAcc = 0;
  const allObjects = [...slotObjects.values(), ...dockObjects];

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // FPS
    frames++; fpsAcc += dt;
    if (fpsAcc >= 1) { setText('wh-fps', `${Math.round(frames / fpsAcc)} fps`); frames = 0; fpsAcc = 0; }

    // Transição de câmera
    if (state.cameraGoal) {
      const k = 1 - Math.pow(0.001, dt);
      camera.position.lerp(state.cameraGoal.pos, k);
      controls.target.lerp(state.cameraGoal.target, k);
      if (camera.position.distanceTo(state.cameraGoal.pos) < 0.05) state.cameraGoal = null;
    }

    // Animação de entrada/saída de paletes
    const ks = 1 - Math.pow(0.0005, dt);
    const pulse = 0.55 + 0.4 * Math.sin(now / 320);
    for (const o of allObjects) {
      o.current += (o.target - o.current) * ks;
      o.pallet.scale.set(1, Math.max(0.001, o.current), 1);
      o.pallet.visible = o.current > 0.01;
      if (o.status === 'transito') o.edges.material.opacity = pulse;
    }

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    drawGizmo();
  }

  applySnapshot();
  renderer.domElement.style.cursor = 'grab';
  requestAnimationFrame(animate);
}
