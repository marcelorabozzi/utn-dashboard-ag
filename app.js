// ─────────────────────────────────────────────────────────────────
// State Management
// ─────────────────────────────────────────────────────────────────
let currentData      = null;
let loadedDatasets   = [];
let searchQuery      = "";
let filterRegProfesor = "all";

let sortColumn    = "legajo";
let sortDirection = "asc";

// Chart.js instances
let regProfesorChartInstance = null;
let gradesChartInstance      = null;
let grades2ndChartInstance   = null;
let recursantesChartInstance = null;

// Historia Académica state
let historiaAcademicaData = null;
let histFilterCondition = null;


// Configuración de jerarquía de condiciones académicas
const defaultConditionsConfig = {
  "conditions_hierarchy": [
    { "priority": 1, "name": "Promocion Vigente", "db_states": ["Promocion TP", "Ap. Directa"] },
    { "priority": 2, "name": "Promocion Vencida", "db_states": ["Promocion TP", "Ap. Directa"] },
    { "priority": 3, "name": "Regular", "db_states": ["Regular"] },
    { "priority": 4, "name": "Libre", "db_states": ["Libre"] },
    { "priority": 5, "name": "Abandono", "db_states": ["Abandonó"] },
    { "priority": 6, "name": "No cursó", "db_states": ["No Cursó"] },
    { "priority": 7, "name": "Inscripto", "db_states": ["Inscripto"] }
  ]
};
let conditionsConfig = defaultConditionsConfig;

function loadConditionsConfig() {
    fetch('conditions.json')
        .then(response => response.json())
        .then(config => {
            if (config && config.conditions_hierarchy) {
                conditionsConfig = config;
                console.log("Configuración de condiciones cargada:", conditionsConfig);
                if (historiaAcademicaData) {
                    renderHistoriaPanel(historiaAcademicaData);
                }
            }
        })
        .catch(err => {
            console.warn("No se pudo cargar conditions.json mediante fetch, usando predeterminadas.", err);
        });
}


// ─────────────────────────────────────────────────────────────────
// DOM Elements (Professor tab)
// ─────────────────────────────────────────────────────────────────
const metaMateria       = document.getElementById("meta-materia");
const metaComision      = document.getElementById("meta-comision");
const metaAnio          = document.getElementById("meta-anio");
const metaCurso         = document.getElementById("meta-curso");
const metaEspecialidad  = document.getElementById("meta-especialidad");

const valTotalStudents  = document.getElementById("val-total-students");
const valApDirecta      = document.getElementById("val-ap-directa");
const valApDirectaPct   = document.getElementById("val-ap-directa-pct");
const valPromocion      = document.getElementById("val-promocion");
const valPromocionPct   = document.getElementById("val-promocion-pct");
const valRegular        = document.getElementById("val-regular");
const valRegularPct     = document.getElementById("val-regular-pct");
const valLibre          = document.getElementById("val-libre");
const valLibrePct       = document.getElementById("val-libre-pct");
const valAbandono       = document.getElementById("val-abandono");
const valAbandonoPct    = document.getElementById("val-abandono-pct");
const valNoCurso        = document.getElementById("val-no-curso");
const valNoCursoPct     = document.getElementById("val-no-curso-pct");

const searchInput            = document.getElementById("search-input");
const filterRegProfesorSelect = document.getElementById("filter-reg-profesor");
const tableBody              = document.getElementById("table-body");
const tableEmptyState        = document.getElementById("table-empty-state");
const rowCounter             = document.getElementById("row-counter");
const tableHeaders           = document.querySelectorAll("#students-table th.sortable");

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function parseGrade(val) {
    if (val === null || val === undefined || val === '') return null;
    let clean = val.toString().trim().replace(',', '.');
    const num = parseFloat(clean);
    if (isNaN(num)) return null;
    return num > 10 ? num / 10 : num;
}

function formatGrade(val) {
    if (val === null || val === undefined || val === '') return '-';
    return val;
}

// ─────────────────────────────────────────────────────────────────
// Tab Management
// ─────────────────────────────────────────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    document.getElementById(tabId).style.display = 'block';
    const btn = document.querySelector(`[data-tab="${tabId}"]`);
    if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
    }
}

// ─────────────────────────────────────────────────────────────────
// Multi-dataset helpers (Professor tab)
// ─────────────────────────────────────────────────────────────────
function getCombinedDataset() {
    if (loadedDatasets.length === 0) return null;
    if (loadedDatasets.length === 1) return loadedDatasets[0].data;

    const combinedStudents = [];
    const materias   = new Set();
    const comisiones = new Set();
    const anios      = new Set();
    const cursos     = new Set();
    const especs     = new Set();

    loadedDatasets.forEach(item => {
        const d = item.data;
        if (d.materia)  materias.add(d.materia);
        if (d.comision) comisiones.add(d.comision);
        if (d.anio)     anios.add(d.anio);
        if (d.curso)    cursos.add(d.curso);
        if (d.espec)    especs.add(d.espec);

        d.students.forEach(s => {
            combinedStudents.push({ ...s, comisionOrigin: d.comision || "" });
        });
    });

    return {
        materia:  materias.size  === 1 ? [...materias][0]  : "Varias Materias",
        comision: comisiones.size === 1 ? [...comisiones][0] : [...comisiones].join(", "),
        anio:     anios.size     === 1 ? [...anios][0]     : [...anios].join(", "),
        curso:    cursos.size    === 1 ? [...cursos][0]    : [...cursos].join(", "),
        espec:    especs.size    === 1 ? [...especs][0]    : "Varias Especialidades",
        students: combinedStudents
    };
}

function updateSheetSelector() {
    const box    = document.getElementById("sheet-selector-box");
    const select = document.getElementById("sheet-selector");
    if (!select || !box) return;

    if (loadedDatasets.length <= 1) {
        box.style.display = "none";
        return;
    }

    box.style.display = "flex";
    box.style.alignItems = "center";

    const currentVal = select.value;
    select.innerHTML = "";

    const optCombined = document.createElement("option");
    optCombined.value = "combined";
    optCombined.textContent = `Consolidado (${loadedDatasets.length} planillas)`;
    select.appendChild(optCombined);

    loadedDatasets.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.name;
        select.appendChild(opt);
    });

    if ([...select.options].some(o => o.value === currentVal)) {
        select.value = currentVal;
    } else {
        select.value = "combined";
    }
}

// ─────────────────────────────────────────────────────────────────
// Initialize Application
// ─────────────────────────────────────────────────────────────────
function init() {
    loadConditionsConfig();
    // ── Tab switching ─────────────────────────────────────────────
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // ── Professor tab — landing drop zone ─────────────────────────
    const profLandingDrop  = document.getElementById('prof-landing-drop');
    const profFileInput    = document.getElementById('prof-file-input');

    profLandingDrop.addEventListener('click', () => profFileInput.click());
    profFileInput.addEventListener('change', e => {
        const files = Array.from(e.target.files);
        if (files.length > 0) handleProfesorFiles(files);
        e.target.value = '';
    });
    profLandingDrop.addEventListener('dragover', e => { e.preventDefault(); profLandingDrop.classList.add('dragover'); });
    profLandingDrop.addEventListener('dragleave', () => profLandingDrop.classList.remove('dragover'));
    profLandingDrop.addEventListener('drop', e => {
        e.preventDefault();
        profLandingDrop.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleProfesorFiles(files);
    });

    // ── Professor tab — compact drop zone (inside dashboard) ──────
    const dropZone  = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
        const files = Array.from(e.target.files);
        if (files.length > 0) handleProfesorFiles(files);
        e.target.value = '';
    });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleProfesorFiles(files);
    });

    // ── Historia tab — landing drop zone ──────────────────────────
    const histLandingDrop = document.getElementById('hist-landing-drop');
    const histFileInput   = document.getElementById('hist-file-input');

    histLandingDrop.addEventListener('click', () => histFileInput.click());
    histFileInput.addEventListener('change', e => {
        const files = Array.from(e.target.files);
        if (files.length > 0) handleHistoriaFiles(files);
        e.target.value = '';
    });
    histLandingDrop.addEventListener('dragover', e => { e.preventDefault(); histLandingDrop.classList.add('dragover'); });
    histLandingDrop.addEventListener('dragleave', () => histLandingDrop.classList.remove('dragover'));
    histLandingDrop.addEventListener('drop', e => {
        e.preventDefault();
        histLandingDrop.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleHistoriaFiles(files);
    });

    // ── Historia tab — compact drop zone (inside dashboard) ───────
    const histCompactDrop  = document.getElementById('hist-compact-drop');
    const histCompactInput = document.getElementById('hist-compact-input');

    histCompactDrop.addEventListener('click', () => histCompactInput.click());
    histCompactInput.addEventListener('change', e => {
        const files = Array.from(e.target.files);
        if (files.length > 0) handleHistoriaFiles(files);
        e.target.value = '';
    });

    // ── Sheet selector ────────────────────────────────────────────
    const select = document.getElementById("sheet-selector");
    if (select) {
        select.addEventListener("change", e => {
            const val = e.target.value;
            if (val === "combined") {
                loadDataset(getCombinedDataset(), false);
            } else {
                const found = loadedDatasets.find(item => item.id === val);
                if (found) loadDataset(found.data, false);
            }
        });
    }

    // ── Table sorting ─────────────────────────────────────────────
    tableHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn    = column;
                sortDirection = 'asc';
            }
            updateTableHeaderClasses();
            renderTable();
        });
    });

    // ── Search & filter ───────────────────────────────────────────
    searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderTable();
    });
    filterRegProfesorSelect.addEventListener('change', e => {
        filterRegProfesor = e.target.value;
        renderTable();
    });

    // ── Historia table controls ───────────────────────────────────
    initHistoriaTableControls();
}

// ─────────────────────────────────────────────────────────────────
// Professor Dashboard — Show / Load
// ─────────────────────────────────────────────────────────────────
function showProfDashboard() {
    document.getElementById('prof-landing').style.display    = 'none';
    document.getElementById('prof-dashboard').style.display = 'block';
}

function updateTableHeaderClasses() {
    tableHeaders.forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortColumn) {
            th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

function loadDataset(data, updateSelector = true) {
    if (!data) return;
    currentData = data;

    // Show the professor dashboard
    showProfDashboard();

    // Update metadata
    metaMateria.textContent      = `Materia: ${data.materia  || '-'}`;
    metaComision.textContent     = `Comisión: ${data.comision || '-'}`;
    metaAnio.textContent         = `Año: ${data.anio     || '-'}`;
    metaCurso.textContent        = `Curso: ${data.curso    || '-'}`;
    metaEspecialidad.textContent = `Especialidad: ${data.espec    || '-'}`;

    calculateMetrics();
    renderCharts();

    searchInput.value  = "";
    searchQuery        = "";
    filterRegProfesorSelect.value = "all";
    filterRegProfesor  = "all";

    updateTableHeaderClasses();
    renderTable();

    if (updateSelector) updateSheetSelector();
}

// ─────────────────────────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────────────────────────
function calculateMetrics() {
    const students = currentData.students;
    const total    = students.length;
    valTotalStudents.textContent = total;

    const apDirectaCount = students.filter(s => s.regProfesor && s.regProfesor.trim() === 'Ap. Directa').length;
    valApDirecta.textContent    = apDirectaCount;
    valApDirectaPct.textContent = `${total > 0 ? ((apDirectaCount / total) * 100).toFixed(1) : 0}% del total`;

    const promocionCount = students.filter(s => s.regProfesor && s.regProfesor.trim() === 'Promocion TP').length;
    valPromocion.textContent    = promocionCount;
    valPromocionPct.textContent = `${total > 0 ? ((promocionCount / total) * 100).toFixed(1) : 0}% del total`;

    const regularCount = students.filter(s => s.regProfesor && s.regProfesor.trim() === 'Regular').length;
    valRegular.textContent    = regularCount;
    valRegularPct.textContent = `${total > 0 ? ((regularCount / total) * 100).toFixed(1) : 0}% del total`;

    const libreCount = students.filter(s => s.regProfesor && s.regProfesor.trim() === 'Libre').length;
    valLibre.textContent    = libreCount;
    valLibrePct.textContent = `${total > 0 ? ((libreCount / total) * 100).toFixed(1) : 0}% del total`;

    const abandonoCount = students.filter(s => s.regProfesor && s.regProfesor.trim() === 'Abandonó').length;
    valAbandono.textContent    = abandonoCount;
    valAbandonoPct.textContent = `${total > 0 ? ((abandonoCount / total) * 100).toFixed(1) : 0}% del total`;

    const noCursoCount = students.filter(s => s.regProfesor && s.regProfesor.trim() === 'No Cursó').length;
    valNoCurso.textContent    = noCursoCount;
    valNoCursoPct.textContent = `${total > 0 ? ((noCursoCount / total) * 100).toFixed(1) : 0}% del total`;
}

// ─────────────────────────────────────────────────────────────────
// Student Table
// ─────────────────────────────────────────────────────────────────
function renderTable() {
    let filtered = [...currentData.students];

    if (searchQuery !== "") {
        filtered = filtered.filter(s =>
            s.legajo.toLowerCase().includes(searchQuery) ||
            s.nombre.toLowerCase().includes(searchQuery)
        );
    }

    if (filterRegProfesor !== "all") {
        if (filterRegProfesor === "vacío") {
            filtered = filtered.filter(s => !s.regProfesor || s.regProfesor.trim() === "");
        } else {
            filtered = filtered.filter(s => s.regProfesor && s.regProfesor.trim() === filterRegProfesor);
        }
    }

    filtered.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (["p1", "p2", "rec1", "int1", "int2"].includes(sortColumn)) {
            valA = parseGrade(valA);
            valB = parseGrade(valB);
        } else if (sortColumn === "legajo") {
            valA = parseInt(valA) || 0;
            valB = parseInt(valB) || 0;
        }

        if (valA === null || valA === undefined) return sortDirection === 'asc' ?  1 : -1;
        if (valB === null || valB === undefined) return sortDirection === 'asc' ? -1 :  1;

        if (typeof valA === 'string') {
            return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    tableBody.innerHTML = "";
    if (filtered.length === 0) {
        tableEmptyState.style.display = "block";
    } else {
        tableEmptyState.style.display = "none";
        filtered.forEach(s => {
            const tr = document.createElement("tr");

            const p1Class   = getGradeClass(s.p1);
            const p2Class   = getGradeClass(s.p2);
            const rec1Class = getGradeClass(s.rec1);
            const int1Class = getGradeClass(s.int1);
            const int2Class = getGradeClass(s.int2);

            let rpBadgeClass = "badge-vacío";
            let rpText = s.regProfesor ? s.regProfesor.trim() : "Sin registrar";
            if (s.regProfesor) {
                const rpClean = s.regProfesor.trim();
                if (rpClean === "Ap. Directa")   rpBadgeClass = "badge-ap-directa";
                else if (rpClean === "Promocion TP") rpBadgeClass = "badge-promocion";
                else if (rpClean === "Regular")   rpBadgeClass = "badge-regular";
                else if (rpClean === "Libre")     rpBadgeClass = "badge-libre";
                else if (rpClean === "Abandonó")  rpBadgeClass = "badge-abandono";
                else if (rpClean === "No Cursó")  rpBadgeClass = "badge-no-curso";
            }

            tr.innerHTML = `
                <td>${s.legajo}</td>
                <td style="font-weight:500">${s.nombre}</td>
                <td class="${p1Class}">${formatGrade(s.p1)}</td>
                <td class="${p2Class}">${formatGrade(s.p2)}</td>
                <td class="${rec1Class}">${formatGrade(s.rec1)}</td>
                <td class="${int1Class}">${formatGrade(s.int1)}</td>
                <td class="${int2Class}">${formatGrade(s.int2)}</td>
                <td><span class="badge ${rpBadgeClass}">${rpText}</span></td>
            `;
            tableBody.appendChild(tr);
        });
    }

    rowCounter.textContent = `Mostrando ${filtered.length} de ${currentData.students.length} alumnos`;
}

function getGradeClass(val) {
    const num = parseGrade(val);
    if (num === null) return "grade-val grade-empty";
    return num >= 6.0 ? "grade-val grade-pass" : "grade-val grade-fail";
}

// ─────────────────────────────────────────────────────────────────
// Charts (Professor tab)
// ─────────────────────────────────────────────────────────────────
function renderCharts() {
    const students = currentData.students;

    if (regProfesorChartInstance) regProfesorChartInstance.destroy();
    if (gradesChartInstance)      gradesChartInstance.destroy();
    if (grades2ndChartInstance)   grades2ndChartInstance.destroy();

    // ── Chart 1: Reg. Profesor donut ───────────────────────────────
    const counts = {
        'Abandonó': 0, 'Ap. Directa': 0, 'Libre': 0,
        'No Cursó': 0, 'Promocion TP': 0, 'Regular': 0, 'Sin registrar': 0
    };
    students.forEach(s => {
        const rp = s.regProfesor ? s.regProfesor.trim() : "";
        if (rp === "") counts['Sin registrar']++;
        else if (counts[rp] !== undefined) counts[rp]++;
        else counts[rp] = (counts[rp] || 0) + 1;
    });

    const colorMap = {
        'Ap. Directa':  '#10b981', 'Promocion TP': '#06b6d4',
        'Regular':      '#f59e0b', 'Libre':        '#ef4444',
        'Abandonó':     '#8b5cf6', 'No Cursó':     '#6b7280',
        'Sin registrar':'#4b5563'
    };

    const labels = [], chartData = [], colors = [];
    Object.keys(counts).forEach(key => {
        if (counts[key] > 0) {
            labels.push(key);
            chartData.push(counts[key]);
            colors.push(colorMap[key] || '#9ca3af');
        }
    });

    const regBody = document.getElementById('reg-profesor-table-body');
    if (regBody) {
        regBody.innerHTML = "";
        const displayOrder = ['Ap. Directa','Promocion TP','Regular','Libre','Abandonó','No Cursó','Sin registrar'];
        let totalCount = 0;
        displayOrder.forEach(key => {
            const count = counts[key] || 0;
            totalCount += count;
            const pct = students.length > 0 ? ((count / students.length) * 100).toFixed(1) : 0;
            const tr  = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="color-dot" style="background-color:${colorMap[key]||'#9ca3af'}"></span>${key}</td>
                <td style="text-align:right;font-weight:500">${count}</td>
                <td style="text-align:right;color:var(--text-secondary)">${pct}%</td>
            `;
            regBody.appendChild(tr);
        });
        const trTotal = document.createElement('tr');
        trTotal.style.cssText = 'border-top:1px solid var(--border-color);font-weight:600';
        trTotal.innerHTML = `<td>Total</td><td style="text-align:right">${totalCount}</td><td style="text-align:right">100%</td>`;
        regBody.appendChild(trTotal);
    }

    const ctx1 = document.getElementById('reg-profesor-chart').getContext('2d');
    regProfesorChartInstance = new Chart(ctx1, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: chartData, backgroundColor: colors, borderColor: '#111827', borderWidth: 2 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#f3f4f6', font: { family: 'Inter' } } } }
        }
    });

    // ── Chart 2 & 3: Grade distribution ───────────────────────────
    const makeGradeChart = (canvasId, gradeKey) => {
        const ranges = { '0-3.9': 0, '4-5.9': 0, '6-7.9': 0, '8-10': 0, 'No Rindió': 0 };
        students.forEach(s => {
            const num = parseGrade(s[gradeKey]);
            if      (num === null) ranges['No Rindió']++;
            else if (num < 4)     ranges['0-3.9']++;
            else if (num < 6)     ranges['4-5.9']++;
            else if (num < 8)     ranges['6-7.9']++;
            else                  ranges['8-10']++;
        });
        const ctx = document.getElementById(canvasId).getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0 - 3.9','4 - 5.9','6 - 7.9','8 - 10','No Rindió'],
                datasets: [{
                    label: 'Cantidad de Alumnos',
                    data: [ranges['0-3.9'], ranges['4-5.9'], ranges['6-7.9'], ranges['8-10'], ranges['No Rindió']],
                    backgroundColor: ['#ef4444','#f59e0b','#06b6d4','#10b981','#4b5563'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Inter' } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Inter' }, stepSize: 5 } }
                }
            }
        });
    };

    gradesChartInstance    = makeGradeChart('grades-chart',     'p1');
    grades2ndChartInstance = makeGradeChart('grades-2nd-chart', 'p2');
}

// ─────────────────────────────────────────────────────────────────
// File Handlers
// ─────────────────────────────────────────────────────────────────

/** Handle Planilla del Profesor files */
function handleProfesorFiles(files) {
    const promises = files.map(f => parseExcelFilePromise(f));
    Promise.all(promises)
        .then(results => {
            results.forEach(parsed => {
                if (parsed.type === 'historia') {
                    alert(`El archivo "${parsed.filename}" es una Historia Académica. Cargalo desde el tab "Historia Académica".`);
                    return;
                }
                const name = `${parsed.materia} - Com. ${parsed.comision} (${parsed.anio})`;
                const dupIdx = loadedDatasets.findIndex(i => i.filename === parsed.filename);
                if (dupIdx !== -1) {
                    loadedDatasets[dupIdx] = { id: loadedDatasets[dupIdx].id, filename: parsed.filename, name, data: parsed };
                } else {
                    loadedDatasets.push({
                        id: 'sheet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        filename: parsed.filename, name, data: parsed
                    });
                }
            });

            updateSheetSelector();
            const select = document.getElementById("sheet-selector");
            if (select && loadedDatasets.length > 1) select.value = "combined";

            const combined = getCombinedDataset();
            if (combined) loadDataset(combined, false);
        })
        .catch(err => {
            console.error(err);
            alert(`Error al procesar: ${err.message}`);
        });
}

/** Handle Historia Académica files */
function handleHistoriaFiles(files) {
    const promises = files.map(f => parseExcelFilePromise(f));
    Promise.all(promises)
        .then(results => {
            const historias = results.filter(r => r.type === 'historia');
            const otras     = results.filter(r => r.type !== 'historia');

            if (otras.length > 0) {
                alert(`${otras.length} archivo(s) no son Historia Académica. Cargalos desde el tab "Planilla del Profesor".`);
            }

            if (historias.length > 0) {
                historiaAcademicaData = historias[historias.length - 1];
                renderHistoriaPanel(historiaAcademicaData);
            }
        })
        .catch(err => {
            console.error(err);
            alert(`Error al procesar: ${err.message}`);
        });
}

// ─────────────────────────────────────────────────────────────────
// Excel Parsers
// ─────────────────────────────────────────────────────────────────

/** Detect Historia Académica header row */
function isHistoriaAcademicaHeader(row) {
    if (!Array.isArray(row)) return false;
    const cols = row.map(c => (c || '').toString().trim());
    return cols.includes('Esp.A') && cols.some(c => c.startsWith('Estado'));
}

/** Parse Historia Académica XLSX */
function parseHistoriaAcademica(file, rows) {
    const titleRow = rows[3] || [];
    const rawTitle = titleRow[0] ? titleRow[0].toString().trim() : 'Historia Académica';

    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
        if (isHistoriaAcademicaHeader(rows[i])) { headerIdx = i; break; }
    }
    if (headerIdx === -1) throw new Error(`No se encontró la cabecera en "${file.name}".`);

    const header   = rows[headerIdx].map(c => (c || '').toString().trim());
    const colIdx   = name => header.findIndex(h => h.startsWith(name));

    const iLegajo    = colIdx('Legajo');
    const iNombre    = colIdx('Apellido');
    const iEspML     = colIdx('Esp.ML');
    const iAnio      = colIdx('Año');
    const iComision  = colIdx('Comisión');
    const iCurso     = colIdx('Curso');
    const iDictado   = colIdx('Dictado');
    const iEstado    = colIdx('Estado');
    const iMatNombre = colIdx('Nombre de materia');
    const iNota1     = colIdx('Nota 1');

    const comisionMatch  = rawTitle.match(/\b(\d[A-Z]\d+[A-Z]?\d*)\b/);
    const currentComision = comisionMatch ? comisionMatch[1] : null;
    const anioMatch      = rawTitle.match(/(\d{4})/);
    const currentAnio    = anioMatch ? parseInt(anioMatch[1]) : null;

    let materiaName = 'Materia Desconocida';
    if (rows[headerIdx + 1] && rows[headerIdx + 1][iMatNombre]) {
        materiaName = rows[headerIdx + 1][iMatNombre].toString().trim();
    }

    const byLegajo = {};
    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[iLegajo] || !/^\d+$/.test(r[iLegajo].toString().trim())) continue;

        const legajo = r[iLegajo].toString().trim();
        if (!byLegajo[legajo]) {
            byLegajo[legajo] = {
                legajo,
                nombre: r[iNombre] ? r[iNombre].toString().trim() : '',
                espec:  r[iEspML]  ? r[iEspML].toString().trim()  : '',
                historia: []
            };
        }

        const notas = [];
        for (let n = iNota1; n < iNota1 + 9; n++) {
            if (r[n] !== undefined && r[n] !== null && r[n] !== 0 && r[n] !== '') {
                notas.push(parseFloat(r[n]) || 0);
            }
        }

        byLegajo[legajo].historia.push({
            anio:     r[iAnio]     ? parseInt(r[iAnio])             : null,
            comision: r[iComision] ? r[iComision].toString().trim() : '',
            curso:    r[iCurso]    ? r[iCurso].toString().trim()    : '',
            dictado:  r[iDictado]  ? r[iDictado].toString().trim()  : '',
            estado:   r[iEstado]   ? r[iEstado].toString().trim()   : '',
            notas
        });
    }

    const students = [];
    Object.values(byLegajo).forEach(alumno => {
        const inscripcion = alumno.historia.find(h =>
            h.estado === 'Inscripto' &&
            (currentComision ? h.curso.includes(currentComision) : true) &&
            (currentAnio     ? h.anio === currentAnio            : true)
        );
        if (!inscripcion) return;

        const intentosPrevios = alumno.historia.filter(h =>
            !(h.estado === 'Inscripto' &&
              h.anio === currentAnio &&
              h.curso.includes(currentComision || ''))
        );

        const intentosCount  = intentosPrevios.length;
        const estadosPrevios = intentosPrevios.map(h => h.estado);
        const anioIngreso    = alumno.historia.reduce(
            (min, h) => h.anio && h.anio < min ? h.anio : min,
            currentAnio || 9999
        );

        students.push({
            legajo: alumno.legajo, nombre: alumno.nombre, espec: alumno.espec,
            intentos: intentosCount, anioIngreso, estadosPrevios, historia: alumno.historia
        });
    });

    return { type: 'historia', filename: file.name, title: rawTitle, materia: materiaName,
             comision: currentComision || 'Desconocida', anio: currentAnio ? currentAnio.toString() : '', students };
}

/** Parse a single XLSX file — auto-detects type */
function parseExcelFilePromise(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data     = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet    = workbook.Sheets[workbook.SheetNames[0]];
                const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (rows.length < 5) {
                    reject(new Error(`"${file.name}" no contiene suficientes filas.`)); return;
                }

                // Auto-detect: Historia Académica
                let isHistoria = false;
                for (let i = 0; i < Math.min(10, rows.length); i++) {
                    if (isHistoriaAcademicaHeader(rows[i])) { isHistoria = true; break; }
                }

                if (isHistoria) {
                    try { resolve(parseHistoriaAcademica(file, rows)); }
                    catch(err) { reject(err); }
                    return;
                }

                // Planilla del Profesor
                let espec = "Especialidad Desconocida", materia = "Materia Desconocida";
                let comisionRaw = "", curso = "", edificio = "";

                rows.forEach(r => {
                    if (Array.isArray(r) && r[0]) {
                        const c0 = r[0].toString().trim();
                        if (c0.startsWith("Espec:"))    espec       = r[1] ? r[1].toString().trim() : espec;
                        if (c0.startsWith("Materia:"))  materia     = r[1] ? r[1].toString().trim() : materia;
                        if (c0.startsWith("Comision:")) comisionRaw = r[1] ? r[1].toString().trim() : comisionRaw;
                        if (c0.startsWith("Curso:"))    curso       = r[1] ? r[1].toString().trim() : curso;
                        if (c0.startsWith("Edificio:")) edificio    = r[1] ? r[1].toString().trim() : edificio;
                    }
                });

                let comision = "", anio = "";
                if (comisionRaw) {
                    const parts = comisionRaw.split("-");
                    comision = parts[0] ? parts[0].trim() : "";
                    if (parts[1]) { const m = parts[1].match(/\d+/); if (m) anio = m[0]; }
                }

                let headerIdx = -1;
                for (let i = 0; i < rows.length; i++) {
                    if (Array.isArray(rows[i]) && rows[i][0] && rows[i][0].toString().trim() === "Legajo") {
                        headerIdx = i; break;
                    }
                }
                if (headerIdx === -1) { reject(new Error(`No se encontró la cabecera 'Legajo' en "${file.name}".`)); return; }

                const students = [];
                for (let i = headerIdx + 1; i < rows.length; i++) {
                    const r = rows[i];
                    if (Array.isArray(r) && r[0] && /^\d+$/.test(r[0].toString().trim())) {
                        const legajo      = r[0].toString().trim();
                        const nombre      = r[1] ? r[1].toString().trim() : "";
                        const p1          = r[2]  !== undefined && r[2]  !== null ? r[2].toString().trim()  : null;
                        const p2          = r[3]  !== undefined && r[3]  !== null ? r[3].toString().trim()  : null;
                        const rec1        = r[4]  !== undefined && r[4]  !== null ? r[4].toString().trim()  : null;
                        const int1        = r[5]  !== undefined && r[5]  !== null ? r[5].toString().trim()  : null;
                        const int2        = r[6]  !== undefined && r[6]  !== null ? r[6].toString().trim()  : null;
                        const regProfesor = r[13] !== undefined && r[13] !== null ? r[13].toString().trim() : null;
                        const regAsistencia = r[14] !== undefined && r[14] !== null ? r[14].toString().trim() : "Regular";
                        students.push({ legajo, nombre, p1, p2, rec1, int1, int2, regProfesor, regAsistencia });
                    }
                }

                if (students.length === 0) { reject(new Error(`No se encontraron alumnos en "${file.name}".`)); return; }

                resolve({ type: 'profesor', filename: file.name, espec, materia, comision, anio, curso, edificio, students });
            } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error(`Error al leer "${file.name}".`));
        reader.readAsArrayBuffer(file);
    });
}

// ─────────────────────────────────────────────────────────────────
// Historia Académica — Panel Rendering
// ─────────────────────────────────────────────────────────────────

function getBestConditionForStudent(student) {
    const hierarchy = conditionsConfig.conditions_hierarchy;
    let bestCond = null;
    let minPriority = Infinity;

    const currentAnio = historiaAcademicaData && historiaAcademicaData.anio 
        ? parseInt(historiaAcademicaData.anio) 
        : new Date().getFullYear();

    student.historia.forEach(h => {
        const state = h.estado ? h.estado.trim() : "";
        if (!state) return;

        hierarchy.forEach(cond => {
            if (cond.db_states && cond.db_states.includes(state)) {
                if (cond.name === "Promocion Vigente") {
                    const age = currentAnio - (h.anio || currentAnio);
                    if (age > 1) return;
                }
                if (cond.name === "Promocion Vencida") {
                    const age = currentAnio - (h.anio || currentAnio);
                    if (age <= 1) return;
                }

                if (cond.priority < minPriority) {
                    minPriority = cond.priority;
                    bestCond = cond;
                }
            }
        });
    });

    if (!bestCond) {
        bestCond = hierarchy[hierarchy.length - 1];
    }
    return bestCond;
}

function getConditionClass(name) {
    const slug = name.toLowerCase();
    if (slug.includes('vigente')) return 'kpi-promocion';
    if (slug.includes('vencida')) return 'kpi-abandono';
    if (slug.includes('promo')) return 'kpi-promocion';
    if (slug.includes('regu')) return 'kpi-regular';
    if (slug.includes('libr')) return 'kpi-libre';
    if (slug.includes('aban')) return 'kpi-abandono';
    if (slug.includes('curs') || slug.includes('no')) return 'kpi-no-curso';
    if (slug.includes('insc')) return 'kpi-ap-directa';
    return '';
}

function getTableBadgeClass(name) {
    const slug = name.toLowerCase();
    if (slug.includes('vigente')) return 'badge-promocion';
    if (slug.includes('vencida')) return 'badge-abandono';
    if (slug.includes('promo')) return 'badge-promocion';
    if (slug.includes('regu')) return 'badge-regular';
    if (slug.includes('libr')) return 'badge-libre';
    if (slug.includes('aban')) return 'badge-abandono';
    if (slug.includes('curs') || slug.includes('no')) return 'badge-no-curso';
    if (slug.includes('insc')) return 'badge-ap-directa';
    return 'badge-vacío';
}


function renderHistoriaPanel(data) {
    // Show historia dashboard, hide landing
    document.getElementById('hist-landing').style.display   = 'none';
    document.getElementById('hist-dashboard').style.display = 'block';

    // Header info
    document.getElementById('hist-title').textContent    = data.title    || 'Historia Académica';
    document.getElementById('hist-materia').textContent  = `Materia: ${data.materia  || '-'}`;
    document.getElementById('hist-comision').textContent = `Comisión: ${data.comision || '-'}`;
    document.getElementById('hist-anio').textContent     = `Año: ${data.anio    || '-'}`;

    const students = data.students;
    const total    = students.length;

    // Calcular la cantidad de alumnos para cada mejor condición de la jerarquía
    const counts = {};
    conditionsConfig.conditions_hierarchy.forEach(cond => {
        counts[cond.name] = 0;
    });

    students.forEach(s => {
        const bestCond = getBestConditionForStudent(s);
        if (bestCond && counts[bestCond.name] !== undefined) {
            counts[bestCond.name]++;
        }
    });

    // Renderizar los KPIs dinámicamente en el contenedor
    const container = document.getElementById('hist-kpi-container');
    if (container) {
        container.innerHTML = '';

        // Card de Total Inscriptos
        const totalCard = document.createElement('div');
        totalCard.className = 'kpi-card';
        totalCard.innerHTML = `
            <div class="kpi-title">Total Inscriptos</div>
            <div class="kpi-value">${total}</div>
            <div class="kpi-desc">En la comisión actual</div>
        `;
        container.appendChild(totalCard);

        // Cards de cada condición de la jerarquía
        conditionsConfig.conditions_hierarchy.forEach(cond => {
            const count = counts[cond.name] || 0;
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
            const cardClass = getConditionClass(cond.name);

            const card = document.createElement('div');
            card.className = `kpi-card ${cardClass}`;
            card.style.cursor = 'pointer';
            card.title = `Filtrar por ${cond.name}`;
            card.addEventListener('click', () => {
                setHistConditionFilter(cond.name);
            });
            card.innerHTML = `
                <div class="kpi-title">${cond.name}</div>
                <div class="kpi-value">${count}</div>
                <div class="kpi-desc">${pct}% del total inscripto</div>
            `;
            container.appendChild(card);
        });
    }

    renderRecursantesChart(students);
    renderHistoriaTable(students);
}

function getConditionHexColor(name) {
    const slug = name.toLowerCase();
    if (slug.includes('vigente')) return '#06b6d4'; // Cyan
    if (slug.includes('vencida')) return '#a855f7'; // Purple/pink
    if (slug.includes('promo')) return '#06b6d4';   // Cyan fallback
    if (slug.includes('regu')) return '#f59e0b';    // Orange
    if (slug.includes('libr')) return '#ef4444';    // Red
    if (slug.includes('aban')) return '#ec4899';    // Pinkish/purple
    if (slug.includes('curs') || slug.includes('no')) return '#6b7280'; // Gray
    if (slug.includes('insc')) return '#10b981';    // Green
    return '#9ca3af';
}

function renderRecursantesChart(students) {
    if (recursantesChartInstance) recursantesChartInstance.destroy();

    const counts = {};
    conditionsConfig.conditions_hierarchy.forEach(cond => {
        counts[cond.name] = 0;
    });

    students.forEach(s => {
        const bestCond = getBestConditionForStudent(s);
        if (bestCond && counts[bestCond.name] !== undefined) {
            counts[bestCond.name]++;
        }
    });

    const labels = [];
    const values = [];
    const colors = [];

    conditionsConfig.conditions_hierarchy.forEach(cond => {
        labels.push(cond.name);
        values.push(counts[cond.name] || 0);
        colors.push(getConditionHexColor(cond.name));
    });

    const ctx = document.getElementById('recursantes-chart').getContext('2d');
    recursantesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Alumnos', data: values, backgroundColor: colors, borderRadius: 7, borderSkipped: false }] },
        options: {
            onClick: (event, elements) => {
                if (elements && elements.length > 0) {
                    const index = elements[0].index;
                    const conditionName = labels[index];
                    setHistConditionFilter(conditionName);
                }
            },
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { afterLabel: ctx => `${students.length > 0 ? ((ctx.parsed.y / students.length) * 100).toFixed(1) : 0}% del total` } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9ca3af', font: { family: 'Inter' } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9ca3af', font: { family: 'Inter' }, precision: 0 } }
            }
        }
    });
}

let histSortCol = 'intentos';
let histSortDir = 'desc';

function setHistConditionFilter(conditionName) {
    histFilterCondition = conditionName;
    
    const container = document.getElementById('hist-filter-badge-container');
    const text = document.getElementById('hist-filter-badge-text');
    if (container && text) {
        container.style.display = 'inline-flex';
        text.textContent = `Filtro: ${conditionName}`;
    }
    
    const searchVal = document.getElementById('hist-search')?.value || '';
    if (historiaAcademicaData) {
        renderHistoriaTable(historiaAcademicaData.students, searchVal);
    }
}

function clearHistConditionFilter() {
    histFilterCondition = null;
    
    const container = document.getElementById('hist-filter-badge-container');
    if (container) {
        container.style.display = 'none';
    }
    
    const searchVal = document.getElementById('hist-search')?.value || '';
    if (historiaAcademicaData) {
        renderHistoriaTable(historiaAcademicaData.students, searchVal);
    }
}

function renderHistoriaTable(students, searchVal = '') {
    const tbody = document.getElementById('hist-table-body');
    if (!tbody) return;

    let filtered = [...students];
    
    if (histFilterCondition) {
        filtered = filtered.filter(s => {
            const best = getBestConditionForStudent(s);
            return best && best.name === histFilterCondition;
        });
    }

    if (searchVal.trim()) {
        const q = searchVal.trim().toLowerCase();
        filtered = filtered.filter(s =>
            s.legajo.toString().includes(q) || s.nombre.toLowerCase().includes(q)
        );
    }

    filtered.sort((a, b) => {
        let va = a[histSortCol], vb = b[histSortCol];
        if (histSortCol === 'legajo') { 
            va = parseInt(va) || 0; 
            vb = parseInt(vb) || 0; 
        } else if (histSortCol === 'mejorCondicion') {
            const bestA = getBestConditionForStudent(a);
            const bestB = getBestConditionForStudent(b);
            va = bestA ? bestA.priority : Infinity;
            vb = bestB ? bestB.priority : Infinity;
        }
        if (typeof va === 'string') return histSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return histSortDir === 'asc' ? va - vb : vb - va;
    });

    tbody.innerHTML = '';
    filtered.forEach(s => {
        const tr = document.createElement('tr');

        let intentoClass = 'badge-hist-verde';
        if      (s.intentos === 1) intentoClass = 'badge-hist-amarillo';
        else if (s.intentos === 2) intentoClass = 'badge-hist-naranja';
        else if (s.intentos >= 3)  intentoClass = 'badge-hist-rojo';

        const lastStates = s.historia
            .filter(h => h.estado && h.estado !== 'Inscripto')
            .slice(-3)
            .map(h => `<span class="hist-estado-dot estado-${estadoSlug(h.estado)}" title="${h.estado} (${h.anio})">${h.anio}</span>`)
            .join('');

        const bestCond = getBestConditionForStudent(s);
        const bestCondName = bestCond ? bestCond.name : '-';
        const bestCondClass = bestCond ? getTableBadgeClass(bestCond.name) : 'badge-vacío';

        tr.innerHTML = `
            <td>${s.legajo}</td>
            <td style="font-weight:500">${s.nombre}</td>
            <td>${s.espec || '-'}</td>
            <td>${s.anioIngreso || '-'}</td>
            <td><span class="badge ${intentoClass}">${s.intentos === 0 ? '1ª vez' : s.intentos + ' prev.'}</span></td>
            <td>${lastStates || '<span style="color:var(--text-muted)">-</span>'}</td>
            <td><span class="badge ${bestCondClass}">${bestCondName}</span></td>
            <td>
                <button class="hist-detail-btn" onclick="openHistoriaModal('${s.legajo}')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.58-3.007-9.964-7.178z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Ver historial
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const counter = document.getElementById('hist-row-counter');
    if (counter) counter.textContent = `Mostrando ${filtered.length} de ${students.length} alumnos`;
}

function estadoSlug(estado) {
    return { 'Libre':'libre','Abandonó':'abandono','Regular':'regular','No Cursó':'no-curso',
             'Promocion TP':'promocion','Inscripto':'inscripto','Ap. Directa':'ap-directa' }[estado] || 'desconocido';
}

function openHistoriaModal(legajo) {
    if (!historiaAcademicaData) return;
    const alumno = historiaAcademicaData.students.find(s => s.legajo === legajo);
    if (!alumno) return;

    const modal   = document.getElementById('historia-modal');
    const content = document.getElementById('historia-modal-content');

    const rows = alumno.historia.map(h => {
        const estadoCls = `estado-${estadoSlug(h.estado)}`;
        const notasStr  = h.notas && h.notas.length > 0
            ? h.notas.map(n => `<span class="nota-chip">${n}</span>`).join('')
            : '<span style="color:var(--text-muted)">-</span>';
        return `<tr>
            <td>${h.anio || '-'}</td>
            <td>${h.curso || h.comision || '-'}</td>
            <td>${h.dictado || '-'}</td>
            <td><span class="badge estado-badge ${estadoCls}">${h.estado || '-'}</span></td>
            <td>${notasStr}</td>
        </tr>`;
    }).join('');

    const intentoBadgeClass = alumno.intentos === 0 ? 'badge-hist-verde' :
                              alumno.intentos === 1 ? 'badge-hist-amarillo' :
                              alumno.intentos === 2 ? 'badge-hist-naranja' : 'badge-hist-rojo';
    const intentoText = alumno.intentos === 0 ? 'Primera vez' :
        `${alumno.intentos} intento${alumno.intentos > 1 ? 's' : ''} previo${alumno.intentos > 1 ? 's' : ''}`;

    content.innerHTML = `
        <div class="modal-header-info">
            <div>
                <div class="modal-student-name">${alumno.nombre}</div>
                <div class="modal-student-sub">Legajo: <strong>${alumno.legajo}</strong> · Esp: <strong>${alumno.espec || '-'}</strong></div>
            </div>
            <div class="modal-stats">
                <span class="badge ${intentoBadgeClass}">${intentoText}</span>
            </div>
        </div>
        <div class="table-wrapper modal-table-wrapper">
            <table>
                <thead><tr><th>Año</th><th>Comisión / Curso</th><th>Dictado</th><th>Estado</th><th>Notas</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('modal-visible'), 10);
}

function closeHistoriaModal() {
    const modal = document.getElementById('historia-modal');
    modal.classList.remove('modal-visible');
    setTimeout(() => { modal.style.display = 'none'; }, 280);
}

function initHistoriaTableControls() {
    const search = document.getElementById('hist-search');
    if (search) {
        search.addEventListener('input', () => {
            if (historiaAcademicaData) renderHistoriaTable(historiaAcademicaData.students, search.value);
        });
    }

    document.querySelectorAll('#historia-table .sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (histSortCol === col) {
                histSortDir = histSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                histSortCol = col;
                histSortDir = col === 'intentos' ? 'desc' : 'asc';
            }
            document.querySelectorAll('#historia-table .sortable').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(histSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
            const searchVal = document.getElementById('hist-search')?.value || '';
            if (historiaAcademicaData) renderHistoriaTable(historiaAcademicaData.students, searchVal);
        });
    });
}

// ─────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
