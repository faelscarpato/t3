/**
 * JS Modular para Análise de Currículo
 * Estruturado em funções para upload, integração IA, cadastros e relatórios
 */

// Mock para análise IA (substitua depois pela chamada real da API)
async function analisarComIA(curriculoTexto, vaga, requisitos, apiKey, modeloIA) {
    // Aqui você trocaria por uma chamada real da API via fetch
    return {
        pontosFortes: ["Experiência em liderança", "Certificação relevante"],
        redFlags: ["Faltou experiência com tecnologia X", "Gaps no histórico"],
        perguntas: ["Por que saiu do último emprego?", "Como lida com mudanças?"],
        sugestaoEntrevista: true // ou false
    };
}

// Função principal do fluxo de análise
async function handleAnalise() {
    const ia = document.getElementById('iaSelect').value;
    const apiKey = document.getElementById('apiKey').value;
    const fileInput = document.getElementById('cvFile');
    const vaga = document.getElementById('vagaTitulo').value;
    const obrig = document.getElementById('vagaObrigatorios').value.split('\n');
    const opcionais = document.getElementById('vagaOpcionais').value.split('\n');
    // ler arquivo:
    if (!fileInput.files[0]) {
        alert("Selecione um currículo para análise!"); return;
    }

    const textoCurriculo = await readFileAsText(fileInput.files[0]);
    // Aqui pode rodar processamento de texto, PDF.js, docx parser, etc

    // Chamada da IA/mocking
    const relatorio = await analisarComIA(textoCurriculo, vaga, obrig, apiKey, ia);
    renderRelatorio(relatorio);
    salvarRelatorioHistorico({
        data: new Date(),
        candidato: document.getElementById('candNome').value,
        vaga,
        status: relatorio.sugestaoEntrevista ? "Sugestão: Agendar" : "Sugestão: Não Agendar"
    });
}

// Lê arquivo texto generico (ajuste para PDF/DOCX se quiser)
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Renderiza relatório visual no HTML
function renderRelatorio(relatorio) {
    document.getElementById("relatorioVisual").classList.remove("hidden");
    let ulFortes = document.getElementById('pontosFortes');
    ulFortes.innerHTML = '';
    relatorio.pontosFortes.forEach(pt => {
        let li = document.createElement('li');
        li.textContent = pt; ulFortes.appendChild(li)
    });

    let ulRed = document.getElementById('redFlags');
    ulRed.innerHTML = '';
    relatorio.redFlags.forEach(red => {
        let li = document.createElement('li');
        li.textContent = red; ulRed.appendChild(li)
    });

    let ulPer = document.getElementById('perguntasEntrevista');
    ulPer.innerHTML = '';
    relatorio.perguntas.forEach(p => { let li = document.createElement('li'); li.textContent = p; ulPer.appendChild(li) });

    let sug = document.getElementById('sugestaoEntrevista');
    sug.textContent = relatorio.sugestaoEntrevista ?
        "Recomendamos realizar uma entrevista!" : "Não recomendamos entrevista.";
    let btnWA = document.getElementById('agendarWhatsapp');
    btnWA.classList.toggle('hidden', !relatorio.sugestaoEntrevista);
}

// Salva relatório no histórico (simples, localStorage - para backend troque a lógica)
function salvarRelatorioHistorico(rel) {
    let arr = JSON.parse(localStorage.getItem('relHistorico') || "[]");
    arr.unshift(rel);
    localStorage.setItem('relHistorico', JSON.stringify(arr));
    renderTabelaHistorico();
}

// Renderiza tabela do histórico
function renderTabelaHistorico() {
    let arr = JSON.parse(localStorage.getItem('relHistorico') || "[]");
    let tb = document.getElementById('tabelaRelatorios');
    tb.innerHTML = '';
    arr.forEach(r => {
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="border-b px-2">${new Date(r.data).toLocaleString()}</td>
            <td class="border-b px-2">${r.candidato}</td>
            <td class="border-b px-2">${r.vaga}</td>
            <td class="border-b px-2">${r.status}</td>
            <td class="border-b px-2"><button onclick="alert('Funcionalidade: download/abrir')" class="text-blue-600 hover:underline">Ver</button></td>
        `;
        tb.appendChild(tr);
    });
}

// Interação botão principal
document.getElementById('botaoAnalisar').addEventListener('click', handleAnalise);

// Renderiza histórico ao iniciar página
window.addEventListener('DOMContentLoaded', renderTabelaHistorico);