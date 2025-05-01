/**
 * Utilitários para manipulação de dados e UI
 */

// Evita execuções repetidas em filtros rápidos (performance)
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Escape para segurança na inserção de HTML
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Exemplo de função: Atualiza contadores de resumo
function updateSummaryDisplay(counts) {
    document.getElementById('countPresente').textContent = counts['Presente'] || 0;
    document.getElementById('countFaltaJustificada').textContent = counts['Falta Justificada'] || 0;
    document.getElementById('countFaltaNaoJustificada').textContent = counts['Falta Não Justificada'] || 0;
    document.getElementById('countFerias').textContent = counts['Férias'] || 0;
    document.getElementById('countLicencaMedica').textContent = counts['Licença Médica'] || 0;
    document.getElementById('countHomeOffice').textContent = counts['Home Office'] || 0;
    document.getElementById('countOutro').textContent = counts['Outro'] || 0;
}

// Função principal refatorada para fetch dos dados (exemplo de modularização)
async function fetchAttendanceData(filters) {
    // lógica simplificada para ilustrar
    // Supondo 'supabaseClient' já configurado globalmente
    let query = supabaseClient.from('registros_presenca').select('*');
    // Adicionar filtros...

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

// Chamar funções com debounce para filtragem por nome/status
document.getElementById('filterName').addEventListener(
    'input',
    debounce(() => loadDataFromSupabase(), 350)
);

// Continuação: adicionar outras funções separadas...