  // --- Configuração do Supabase ---
  const SUPABASE_URL = 'https://rggrnqjaltgrjserfvgd.supabase.co'; // Substitua pela sua URL
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZ3JucWphbHRncmpzZXJmdmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NDcwMDcsImV4cCI6MjA1OTUyMzAwN30.n9u6aCgl-Vznlr0RxJmv5V4GYZZ31yPQILvp4d8uo7g'; // Substitua pela sua Anon Key

  // Verifica credenciais Supabase
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
      const errorMsg = 'ERRO CRÍTICO: Configure suas credenciais do Supabase (URL e Anon Key) nas constantes SUPABASE_URL e SUPABASE_ANON_KEY no código JavaScript.';
      alert(errorMsg); console.error(errorMsg);
  }

  // Inicializa cliente Supabase
  let db;
  try {
      const { createClient } = supabase;
      db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
      console.error("Erro ao inicializar Supabase:", e);
      alert("Não foi possível conectar ao Supabase.");
  }

  // --- Constantes e Variáveis Globais ---
  const AI_CONFIG_KEY = 'aiRecruitProConfig'; // Chave para localStorage
  let vagas = [];
  let candidatos = [];
  let avaliacoes = [];
  let chartInst = null;
  let currentAIConfig = { provider: null, apiKey: null }; // Configuração de IA carregada
  // Estado para guardar detalhes da avaliação atual para agendamento
  let currentAvaliacaoContext = { candidatoId: null, vagaId: null, candidatoNome: null, candidatoTelefone: null };

  // --- Funções de UI (Loading, Erros) ---
  function showLoading(elementId) { document.getElementById(elementId)?.querySelector('.loading-overlay')?.classList.add('active'); }
  function hideLoading(elementId) { document.getElementById(elementId)?.querySelector('.loading-overlay')?.classList.remove('active'); }
  function disableButton(buttonId) { const btn = document.getElementById(buttonId); if (btn) btn.disabled = true; }
  function enableButton(buttonId) { const btn = document.getElementById(buttonId); if (btn) btn.disabled = false; }
  function displayError(sectionId, message) {
      const errorDiv = document.getElementById(`${sectionId}Error`);
      if (errorDiv) { errorDiv.textContent = `Erro: ${message}`; errorDiv.style.display = 'block'; }
      else { alert(`Erro em ${sectionId}: ${message}`); }
      console.error(`Erro em ${sectionId}:`, message);
  }
  function clearError(sectionId) {
       const errorDiv = document.getElementById(`${sectionId}Error`);
       if (errorDiv) { errorDiv.textContent = ''; errorDiv.style.display = 'none'; }
  }
  function showStatusMessage(elementId, message, isSuccess = true) {
      const statusEl = document.getElementById(elementId);
      if (statusEl) {
          statusEl.textContent = message;
          statusEl.className = `mt-3 text-sm font-medium ${isSuccess ? 'text-green-600' : 'text-red-600'}`;
          statusEl.style.display = 'block';
          setTimeout(() => { statusEl.style.display = 'none'; }, 4000); // Esconde após 4 segundos
      }
  }

  // --- Funções de Configuração da IA ---

  // Carrega configurações salvas do localStorage
  function loadAIConfig() {
      try {
          const savedConfig = localStorage.getItem(AI_CONFIG_KEY);
          if (savedConfig) {
              currentAIConfig = JSON.parse(savedConfig);
              document.getElementById('aiProviderSelect').value = currentAIConfig.provider || 'gemini';
              document.getElementById('apiKeyInput').value = currentAIConfig.apiKey || '';
              console.log("Configuração de IA carregada:", currentAIConfig.provider);
          } else {
              console.log("Nenhuma configuração de IA encontrada.");
              currentAIConfig = { provider: 'gemini', apiKey: '' };
              document.getElementById('aiProviderSelect').value = 'gemini';
          }
      } catch (e) {
          console.error("Erro ao carregar config IA:", e);
          currentAIConfig = { provider: 'gemini', apiKey: '' };
      }
      updateAnalisarButtonStatus();
  }

  // Salva configurações no localStorage
  function saveAIConfig(event) {
      event.preventDefault();
      const provider = document.getElementById('aiProviderSelect').value;
      const apiKey = document.getElementById('apiKeyInput').value.trim();
      if (!apiKey) { showStatusMessage('configStatus', 'Insira sua chave de API.', false); return; }
      currentAIConfig = { provider, apiKey };
      try {
          localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(currentAIConfig));
          showStatusMessage('configStatus', `Configurações salvas! Usando ${provider}.`, true);
          console.log("Configuração de IA salva:", currentAIConfig.provider);
          updateAnalisarButtonStatus();
      } catch (e) {
          console.error("Erro ao salvar config IA:", e);
          showStatusMessage('configStatus', 'Erro ao salvar.', false);
      }
  }

  // Atualiza botão "Analisar com IA"
  function updateAnalisarButtonStatus() {
      const providerNameMap = { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Claude', perplexity: 'Perplexity' };
      const providerText = providerNameMap[currentAIConfig.provider] || 'IA';
      const btn = document.getElementById('btnAnalisarCurriculo');
      const providerInfoSpan = document.getElementById('analiseProviderInfo');
      const configWarning = document.getElementById('analiseConfigWarning');
      if (providerInfoSpan) providerInfoSpan.textContent = `(usando ${providerText})`;
      if (currentAIConfig.apiKey && currentAIConfig.provider) { btn.disabled = false; configWarning.style.display = 'none'; }
      else { btn.disabled = true; configWarning.style.display = 'block'; }
  }

  // --- Funções CRUD (Vagas, Candidatos, Histórico) ---

  // Atualiza contadores no Dashboard
  async function updateCounts() {
    if (!db) return;
    showLoading('dashboard');
    clearError('dashboard');
    try {
      const [vagasResult, candidatosResult, avaliacoesResult] = await Promise.all([
          db.from('vagas').select('*', { count: 'exact', head: true }),
          db.from('candidatos').select('*', { count: 'exact', head: true }),
          db.from('avaliacoes').select('*', { count: 'exact', head: true })
      ]);
      if (vagasResult.error) throw vagasResult.error;
      if (candidatosResult.error) throw candidatosResult.error;
      if (avaliacoesResult.error) throw avaliacoesResult.error;
      document.getElementById('vagasCount').innerText = vagasResult.count ?? 0;
      document.getElementById('candidatosCount').innerText = candidatosResult.count ?? 0;
      document.getElementById('avaliacoesCount').innerText = avaliacoesResult.count ?? 0;
    } catch (error) { displayError('dashboard', `Contadores: ${error.message}`); }
    finally { hideLoading('dashboard'); }
  }

  // Modificar renderVagas para buscar 'departamento' e 'descricao' se quiser exibi-los ou usá-los na edição
  async function renderVagas() {
    if (!db) return;
    showLoading('cadastroVaga');
    clearError('cadastroVaga');
    const ul = document.getElementById('listaVagas');
    ul.innerHTML = '<li class="text-gray-500 p-3 text-center">Carregando vagas...</li>';
    try {
         // Adicionar 'departamento' e 'descricao' ao select
        const { data, error } = await db.from('vagas')
            .select('id, titulo, area, departamento, descricao, requisitos') // <-- Adicionado departamento e descricao
            .order('created_at', { ascending: false });
        if (error) throw error;
        vagas = data || []; // Atualiza o array global com os dados completos
        ul.innerHTML = '';
        if (vagas.length === 0) { /* ... */ }
        else {
            vagas.forEach(v => {
                const li = document.createElement('li');
                li.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-md transition duration-150';
                li.innerHTML = `
                  <div class="flex-grow mb-2 md:mb-0 md:mr-4">
                      <h4 class="font-semibold text-indigo-800 text-base">${v.titulo}</h4>
                      <p class="text-sm text-gray-600 mb-1">${v.departamento || v.area || 'Sem área/depto.'}</p> 
                      <p class="text-xs text-gray-500 break-words" title="${v.descricao}">Desc: ${v.descricao.substring(0, 50)}${v.descricao.length > 50 ? '...' : ''}</p> 
                      <p class="text-xs text-gray-500 break-words mt-1" title="${v.requisitos}">Req: ${v.requisitos?.substring(0, 100)}${v.requisitos && v.requisitos.length > 100 ? '...' : ''}</p>
                  </div>
                  <div class="flex-shrink-0 flex space-x-2 mt-2 md:mt-0 self-end md:self-center">
                      <button onclick="preencherFormularioVaga('${v.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-medium no-print px-2 py-1 rounded hover:bg-blue-50" title="Editar Vaga"><i class="fas fa-edit mr-1"></i>Editar</button>
                      <button onclick="confirmDeleteVaga('${v.id}', '${v.titulo}')" class="text-red-600 hover:text-red-800 text-xs font-medium no-print px-2 py-1 rounded hover:bg-red-50" title="Excluir Vaga"><i class="fas fa-trash-alt mr-1"></i>Excluir</button>
                  </div>`;
                ul.appendChild(li);
            });
        }
        updateSelectVaga();
    } catch (error) { displayError('cadastroVaga', `Vagas: ${error.message}`); ul.innerHTML = `<li class="text-red-600 p-3 text-center">Erro: ${error.message}</li>`; }
    finally { hideLoading('cadastroVaga'); }
}
   
     // --- ATUALIZAR FUNÇÃO preencherFormularioVaga ---
     // Ao editar, preencher também o campo descrição
     function preencherFormularioVaga(vagaId) {
        const vaga = vagas.find(v => v.id === vagaId); if (!vaga) return;
        document.getElementById('vagaEditingId').value = vaga.id;
        document.getElementById('tituloVaga').value = vaga.titulo;
        // Assumindo que o campo 'area' do JS/HTML corresponde a 'departamento' do DB na listagem
        document.getElementById('areaVaga').value = vaga.departamento || vaga.area || ''; // Tenta pegar departamento ou area
        document.getElementById('descricaoVaga').value = vaga.descricao || ''; // <-- Preenche descrição
        document.getElementById('requisitosVaga').value = vaga.requisitos || ''; // <-- Usa || '' para evitar 'null'
        const detailsElement = document.getElementById('formVaga').closest('details');
        if (detailsElement && !detailsElement.open) detailsElement.open = true;
        document.getElementById('tituloVaga').focus();
        document.getElementById('btnCadastrarVaga').innerHTML = '<i class="fas fa-save mr-1"></i>Atualizar Vaga';
    }
 

   // --- ATUALIZAR FUNÇÃO resetFormVaga ---
   function resetFormVaga() {
    document.getElementById('formVaga').reset(); // reset() deve limpar todos os campos do form
    document.getElementById('vagaEditingId').value = '';
    document.getElementById('btnCadastrarVaga').innerHTML = '<i class="fas fa-save mr-1"></i>Salvar Vaga';
    // Garante que o campo de descrição (se adicionado) seja limpo explicitamente se reset() falhar
    // const descInput = document.getElementById('descricaoVaga') as HTMLTextAreaElement;
    // if (descInput) descInput.value = '';
}


   // Confirma e deleta vaga
   async function confirmDeleteVaga(vagaId, vagaTitulo) {
       if (!db) return;
       if (confirm(`Tem certeza que deseja excluir a vaga "${vagaTitulo}"? Avaliações relacionadas também serão excluídas.`)) {
           showLoading('cadastroVaga'); clearError('cadastroVaga');
           try {
               const { error } = await db.from('vagas').delete().match({ id: vagaId });
               if (error) throw error;
               alert('Vaga excluída!');
               await renderVagas(); await updateCounts(); await renderHistorico();
           } catch (error) { displayError('cadastroVaga', `Excluir Vaga: ${error.message}`); }
           finally { hideLoading('cadastroVaga'); }
       }
   }

  // Carrega e renderiza a lista de Candidatos
  async function renderCandidatos() {
      if (!db) return;
      showLoading('cadastroCandidato');
      clearError('cadastroCandidato');
      const ul = document.getElementById('listaCandidatos');
      ul.innerHTML = '<li class="text-gray-500 p-3 text-center">Carregando candidatos...</li>';
    try {
      const { data, error } = await db.from('candidatos').select('id, nome, email, telefone, curriculo_url').order('created_at', { ascending: false });
      if (error) throw error;
      candidatos = data || [];
      ul.innerHTML = '';
      if (candidatos.length === 0) { ul.innerHTML = '<li class="text-gray-500 p-3 text-center italic">Nenhum candidato cadastrado.</li>'; }
      else {
          candidatos.forEach(c => {
            const li = document.createElement('li');
            li.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-md transition duration-150';
            li.innerHTML = `
              <div class="flex-grow mb-2 md:mb-0 md:mr-4">
                  <h4 class="font-semibold text-green-800 text-base">${c.nome}</h4>
                  <p class="text-sm text-gray-600">${c.email}</p>
                  <p class="text-xs text-gray-500 mt-1">Tel: ${c.telefone || '--'}
                      ${c.curriculo_url ? `| <a href="${c.curriculo_url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline" title="Ver Currículo"><i class="fas fa-paperclip"></i> Currículo</a>` : ''}
                  </p>
              </div>
              <div class="flex-shrink-0 flex space-x-2 mt-2 md:mt-0 self-end md:self-center">
                  <button onclick="preencherFormularioCandidato('${c.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-medium no-print px-2 py-1 rounded hover:bg-blue-50" title="Editar Candidato"><i class="fas fa-edit mr-1"></i>Editar</button>
                  <button onclick="confirmDeleteCandidato('${c.id}', '${c.nome}')" class="text-red-600 hover:text-red-800 text-xs font-medium no-print px-2 py-1 rounded hover:bg-red-50" title="Excluir Candidato"><i class="fas fa-trash-alt mr-1"></i>Excluir</button>
              </div>`;
            ul.appendChild(li);
          });
      }
      updateSelectCandidato();
    } catch (error) { displayError('cadastroCandidato', `Candidatos: ${error.message}`); ul.innerHTML = `<li class="text-red-600 p-3 text-center">Erro: ${error.message}</li>`; }
    finally { hideLoading('cadastroCandidato'); }
  }

  // Preenche o formulário de candidato para edição
  function preencherFormularioCandidato(candidatoId) {
       const candidato = candidatos.find(c => c.id === candidatoId); if (!candidato) return;
       document.getElementById('candidatoEditingId').value = candidato.id;
       document.getElementById('nomeCandidato').value = candidato.nome;
       document.getElementById('emailCandidato').value = candidato.email;
       document.getElementById('telefoneCandidato').value = candidato.telefone || '';
       document.getElementById('arquivoCurriculo').value = ''; // Limpa campo arquivo
       const detailsElement = document.getElementById('formCandidato').closest('details');
       if (detailsElement && !detailsElement.open) detailsElement.open = true;
       document.getElementById('nomeCandidato').focus();
       document.getElementById('btnCadastrarCandidato').innerHTML = '<i class="fas fa-user-check mr-1"></i>Atualizar Candidato';
   }

  // Limpa formulário de candidato e estado de edição
  function resetFormCandidato() {
      document.getElementById('formCandidato').reset();
      document.getElementById('candidatoEditingId').value = '';
      document.getElementById('btnCadastrarCandidato').innerHTML = '<i class="fas fa-user-check mr-1"></i>Salvar Candidato';
  }

  // Confirma e deleta candidato
  async function confirmDeleteCandidato(candidatoId, candidatoNome) {
      if (!db) return;
      const candidato = candidatos.find(c => c.id === candidatoId); if (!candidato) return;
      if (confirm(`Tem certeza que deseja excluir "${candidatoNome}"? Currículo e avaliações relacionadas serão perdidos.`)) {
          showLoading('cadastroCandidato'); clearError('cadastroCandidato');
          try {
              // Tenta excluir arquivo do storage
              if (candidato.curriculo_url) {
                  try {
                      const bucketName = 'curriculos'; // Nome do bucket
                      const url = new URL(candidato.curriculo_url);
                      const filePath = url.pathname.split(`/${bucketName}/`)[1]; // Extrai path após o nome do bucket
                      if (filePath) {
                          const decodedPath = decodeURIComponent(filePath);
                          console.log("Tentando excluir arquivo:", decodedPath);
                          const { error: storageError } = await db.storage.from(bucketName).remove([decodedPath]);
                          if (storageError && storageError.message !== 'The resource was not found') {
                              console.warn("Aviso: Falha ao excluir arquivo do storage:", storageError.message);
                          } else if (!storageError) { console.log("Arquivo currículo excluído."); }
                      }
                  } catch (e) { console.warn("Aviso: Erro ao processar URL do currículo:", e.message); }
              }
              // Exclui registro do banco
              const { error: dbError } = await db.from('candidatos').delete().match({ id: candidatoId });
              if (dbError) throw dbError;
              alert('Candidato excluído!');
              await renderCandidatos(); await updateCounts(); await renderHistorico();
          } catch (error) { displayError('cadastroCandidato', `Excluir Cand.: ${error.message}`); }
          finally { hideLoading('cadastroCandidato'); }
      }
  }

  // Atualiza os dropdowns (selects) na seção de Avaliação
  function updateSelectCandidato() {
    const select = document.getElementById('selectCandidato'); const currentVal = select.value;
    select.innerHTML = '<option value="" disabled selected>-- Selecione --</option>';
    if (candidatos.length > 0) {
        candidatos.forEach(c => {
          const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.nome;
          if (c.curriculo_url) { opt.dataset.curriculoUrl = c.curriculo_url; }
          if (c.telefone) { opt.dataset.telefone = c.telefone; } // Guarda telefone no dataset
          select.appendChild(opt);
        });
        select.value = currentVal; if (!select.value) select.selectedIndex = 0;
    } else { select.innerHTML = '<option value="" disabled selected>Nenhum candidato</option>'; }
    select.disabled = candidatos.length === 0;
  }
  function updateSelectVaga() {
    const select = document.getElementById('selectVaga'); const currentVal = select.value;
    select.innerHTML = '<option value="" disabled selected>-- Selecione --</option>';
     if (vagas.length > 0) {
         vagas.forEach(v => {
           const opt = document.createElement('option'); opt.value = v.id; opt.textContent = v.titulo;
           opt.dataset.requisitos = v.requisitos; select.appendChild(opt);
         });
          select.value = currentVal; if (!select.value) select.selectedIndex = 0;
     } else { select.innerHTML = '<option value="" disabled selected>Nenhuma vaga</option>'; }
     select.disabled = vagas.length === 0;
  }

  // Carrega e renderiza o Histórico de Avaliações
  async function renderHistorico() {
      if (!db) return;
      showLoading('historicoCandidatura');
      clearError('historicoCandidatura');
      const tb = document.getElementById('historicoTable');
      const emptyMsg = document.getElementById('historicoEmpty');
      tb.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Carregando histórico...</td></tr>';
      emptyMsg.style.display = 'none';
    try {
      // Busca também o telefone do candidato no join
      const { data, error } = await db.from('avaliacoes')
        .select(`id, pontuacao, status, data_avaliacao, candidatos ( id, nome, telefone ), vagas ( id, titulo )`)
        .order('data_avaliacao', { ascending: false });
      if (error) throw error;
      avaliacoes = data || [];
      tb.innerHTML = '';
      if (avaliacoes.length === 0) { emptyMsg.style.display = 'block'; }
      else {
          emptyMsg.style.display = 'none';
          avaliacoes.forEach(a => {
            const candNome = a.candidatos?.nome || 'Excluído'; const vagaTitulo = a.vagas?.titulo || 'Excluída';
            const statusClassMap = { 'Concluído': 'bg-green-100 text-green-800', 'Rejeitado': 'bg-red-100 text-red-800', 'Em Análise': 'bg-yellow-100 text-yellow-800', 'Pendente': 'bg-gray-100 text-gray-700', 'Triagem': 'bg-blue-100 text-blue-800', 'Entrevista Agendada': 'bg-purple-100 text-purple-800' }; // Novo status
            const statusText = a.status || 'Pendente'; const statusClass = statusClassMap[statusText] || statusClassMap['Pendente'];
            const dataFormatada = a.data_avaliacao ? new Date(a.data_avaliacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '--';
            const tr = document.createElement('tr'); tr.className = 'hover:bg-gray-50 transition duration-150';
            tr.innerHTML = `
              <td class="p-3 font-medium text-gray-900">${candNome}</td> <td class="p-3 text-gray-600">${vagaTitulo}</td>
              <td class="p-3 text-center"><span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusClass}">${statusText}</span></td>
              <td class="p-3 text-center font-medium text-blue-600">${a.pontuacao !== null ? a.pontuacao + '/100' : '--'}</td>
              <td class="p-3 text-gray-500">${dataFormatada}</td>`;
            tb.appendChild(tr);
          });
      }
      // Atualiza a métrica de entrevistas agendadas após carregar o histórico
      populateMetrica();
    } catch (error) { displayError('historicoCandidatura', `Histórico: ${error.message}`); tb.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-600">Erro: ${error.message}</td></tr>`; }
    finally { hideLoading('historicoCandidatura'); }
  }

  // Preenche métricas
  function populateMetrica() {
      // Placeholder para Tempo Médio e Taxa de Sucesso
      document.getElementById('tempoMedioVaga').innerText = "-- dias";
      document.getElementById('taxaSucesso').innerText = "--%";

      // Calcula Entrevistas Agendadas a partir do array 'avaliacoes'
      const entrevistasAgendadasCount = avaliacoes.filter(a => a.status === 'Entrevista Agendada').length;
      document.getElementById('entrevistasAgendadas').innerText = entrevistasAgendadasCount;
  }

  // --- Funções de Ação (Form Submits) ---

  // Salva ou Atualiza Vaga
  document.getElementById('formVaga').onsubmit = async function(e) {
    e.preventDefault(); if (!db) return;
    disableButton('btnCadastrarVaga'); showLoading('cadastroVaga'); clearError('cadastroVaga');

    const titulo = document.getElementById('tituloVaga').value.trim();
    const departamentoValor = document.getElementById('areaVaga').value.trim(); // Valor do campo "Área / Departamento"
    const descricao = document.getElementById('descricaoVaga').value.trim(); // <-- Pega a descrição
    const requisitos = document.getElementById('requisitosVaga').value.trim();
    const editingId = document.getElementById('vagaEditingId').value;

    // Validação - agora inclui a descrição
    if (!titulo || !departamentoValor || !descricao) { // Adicionado !descricao
       alert('Preencha todos os campos obrigatórios (Título, Área/Departamento, Descrição).');
       hideLoading('cadastroVaga'); enableButton('btnCadastrarVaga'); return;
    }

    // ***** CORREÇÃO AQUI (Incluir descrição) *****
    const vagaData = {
        titulo: titulo,
        departamento: departamentoValor,
        descricao: descricao, // <-- Inclui a descrição
        requisitos: requisitos // Requisitos podem ser null/vazio se a coluna permite
        // status: 'Aberta' // O status tem default no DB, não precisa enviar ao criar
    };
    // *****************************************

    try {
        let error;
        if (editingId) {
            // Atualiza incluindo a descrição
            ({ error } = await db.from('vagas').update({ titulo, departamento: departamentoValor, descricao, requisitos }).match({ id: editingId }));
        } else {
            ({ error } = await db.from('vagas').insert(vagaData));
        }
        if (error) throw error;
        resetFormVaga(); // Lembre-se de limpar o campo descrição no reset também
        const detailsElement = e.target.closest('details'); if (detailsElement) detailsElement.open = false;
        await renderVagas(); await updateCounts();
        alert(`Vaga ${editingId ? 'atualizada' : 'cadastrada'}!`);
    } catch (error) {
        // O erro agora pode ser sobre 'descricao' se o campo HTML não for adicionado/preenchido
        displayError('cadastroVaga', `Falha: ${error.message}`);
    } finally {
        hideLoading('cadastroVaga'); enableButton('btnCadastrarVaga');
    }
  };


  // Salva ou Atualiza Candidato
  document.getElementById('formCandidato').onsubmit = async function(e) {
      e.preventDefault(); if (!db) return;
      disableButton('btnCadastrarCandidato'); showLoading('cadastroCandidato'); clearError('cadastroCandidato');
      const nome = document.getElementById('nomeCandidato').value.trim();
      const email = document.getElementById('emailCandidato').value.trim();
      const telefone = document.getElementById('telefoneCandidato').value.trim();
      const fileInput = document.getElementById('arquivoCurriculo');
      const file = fileInput.files[0];
      const editingId = document.getElementById('candidatoEditingId').value;
      if (!nome || !email) { alert('Nome e Email obrigatórios.'); hideLoading('cadastroCandidato'); enableButton('btnCadastrarCandidato'); return; }
      let curriculoUrl = null; let filePath = null;
      const candidatoData = { nome, email, telefone };
      try {
          const candidatoExistente = editingId ? candidatos.find(c => c.id === editingId) : null;
          curriculoUrl = candidatoExistente?.curriculo_url || null; // Mantem URL antiga por padrão

          // Lida com upload de arquivo
          if (file) {
              const bucketName = 'curriculos';
              // Tenta excluir o arquivo antigo
              if (editingId && curriculoUrl) {
                   try {
                      const oldUrl = new URL(curriculoUrl);
                      const pathParts = oldUrl.pathname.split('/');
                      const storagePath = pathParts.slice(pathParts.indexOf(bucketName) + 1).join('/');
                      if (storagePath) {
                          await db.storage.from(bucketName).remove([decodeURIComponent(storagePath)]);
                          console.log("Arquivo antigo removido:", storagePath);
                      }
                   } catch(removeError) { console.warn("Não removeu currículo antigo:", removeError.message); }
              }
              // Upload do novo arquivo
              filePath = `${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${file.name.split('.').pop()}`;
              const { error: uploadError } = await db.storage.from(bucketName).upload(filePath, file, { cacheControl: '3600', upsert: true });
              if (uploadError) {
                  if (uploadError.message && uploadError.message.toLowerCase().includes('bucket not found')) {
                       throw new Error(`Upload falhou: Bucket '${bucketName}' não encontrado.`);
                  } else { throw new Error(`Upload falhou: ${uploadError.message}`); }
              }
              const { data: urlData } = db.storage.from(bucketName).getPublicUrl(filePath);
              curriculoUrl = urlData?.publicUrl;
              console.log('Novo currículo enviado:', curriculoUrl);
          }
          candidatoData.curriculo_url = curriculoUrl;

          // Insere ou atualiza no banco
          let error;
          if (editingId) { ({ error } = await db.from('candidatos').update(candidatoData).match({ id: editingId })); }
          else { ({ error } = await db.from('candidatos').insert(candidatoData)); }

          // Trata erro de email duplicado
          if (error && error.message.includes('candidatos_email_key')) {
               alert('Email já cadastrado.');
               if (filePath) { await db.storage.from('curriculos').remove([filePath]); console.log(`Arquivo ${filePath} removido.`); }
               hideLoading('cadastroCandidato'); enableButton('btnCadastrarCandidato'); return;
          } else if (error) { throw error; }

          resetFormCandidato();
          const detailsElement = e.target.closest('details'); if (detailsElement) detailsElement.open = false;
          await renderCandidatos(); await updateCounts();
          alert(`Candidato ${editingId ? 'atualizado' : 'cadastrado'}!`);
      } catch (error) {
          displayError('cadastroCandidato', `Falha: ${error.message}`);
          if (filePath && !error?.message.includes('candidatos_email_key') && !error?.message.includes('Bucket not found')) {
               try { await db.storage.from('curriculos').remove([filePath]); console.log(`Arquivo ${filePath} removido.`); }
               catch (removeError) { console.error(`Erro ao remover ${filePath}:`, removeError); }
           }
      } finally { hideLoading('cadastroCandidato'); enableButton('btnCadastrarCandidato'); }
  };


  // --- Lógica de Avaliação IA (Chamada Direta do Frontend) ---

  /**
   * Chama a API de IA configurada pelo usuário diretamente do frontend.
   * @param {string} prompt - O prompt para a IA.
   * @returns {Promise<object>} - O resultado JSON da análise da IA.
   */
  async function callConfiguredAI_API(prompt) {
      const { provider, apiKey } = currentAIConfig;
      if (!provider || !apiKey) throw new Error("Configuração da IA não encontrada.");
      console.log(`--- Chamando API ${provider} ---`);
      let endpoint = '', headers = { 'Content-Type': 'application/json' }, body = {}, model = '';

      switch (provider) {
          case 'gemini':
               endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
               headers['x-goog-api-key'] = apiKey;
               body = {
                contents: [{ parts: [{ "text": prompt }] }],
                generationConfig: {
                  temperature: 0.35, // <--- AJUSTE AQUI (ex: 0.4)
                  responseMimeType: "application/json",
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 8194,
                  stopSequences: ["\n\n"]
                },
              };
              break;
          case 'openai':
              endpoint = 'https://api.openai.com/v1/chat/completions';
              headers['Authorization'] = `Bearer ${apiKey}`;
              model = 'gpt-3.5-turbo';
              body = { model: model, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } };
              break;
          case 'anthropic':
              endpoint = 'https://api.anthropic.com/v1/messages';
              headers['x-api-key'] = apiKey;
              headers['anthropic-version'] = '2023-06-01';
              model = 'claude-3-haiku-20240307';
              body = { model: model, max_tokens: 1500, messages: [{ role: "user", content: prompt }] };
              break;
          case 'perplexity':
              endpoint = 'https://api.perplexity.ai/chat/completions';
              headers['Authorization'] = `Bearer ${apiKey}`;
              model = 'llama-3-sonar-small-32k-online';
              body = { model: model, messages: [{ role: "user", content: prompt }] };
              break;
          default: throw new Error(`Provedor '${provider}' não suportado.`);
      }

      try {
          console.log("Enviando para:", endpoint); console.log("Body:", JSON.stringify(body));
          const response = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body) });
          if (!response.ok) {
              const errorBody = await response.json().catch(() => response.text());
              console.error(`Erro API ${provider} (${response.status}):`, errorBody);
              const errorMsg = typeof errorBody === 'object' ? (errorBody.error?.message || JSON.stringify(errorBody)) : errorBody;
              throw new Error(`Erro ${response.status} API ${provider}: ${errorMsg}`);
          }
          const data = await response.json(); console.log(`Resposta API ${provider}:`, data);

          // Extração e Parsing
          let textContent = ''; let resultJson = null;
          if (provider === 'gemini') { textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text; if (!textContent && data?.promptFeedback?.blockReason) throw new Error(`Gemini bloqueou: ${data.promptFeedback.blockReason}`); if (!textContent && data?.candidates?.[0]?.finishReason !== 'STOP') throw new Error(`Gemini finalizou: ${data.candidates[0].finishReason}`); }
          else if (provider === 'openai') { textContent = data?.choices?.[0]?.message?.content; }
          else if (provider === 'anthropic') { textContent = data?.content?.[0]?.text; if (!textContent && data?.stop_reason) throw new Error(`Anthropic finalizou: ${data.stop_reason}`); }
          else if (provider === 'perplexity') { textContent = data?.choices?.[0]?.message?.content; }
          if (!textContent) { throw new Error(`Conteúdo não extraído da API ${provider}.`); }
          console.log("Texto bruto IA:", textContent);
          try { // Tenta parsear JSON
              const jsonStart = textContent.indexOf('{'); const jsonEnd = textContent.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                  const potentialJson = textContent.substring(jsonStart, jsonEnd + 1);
                  resultJson = JSON.parse(potentialJson);
              } else { const cleaned = textContent.replace(/^```json\s*|```$/g, '').trim(); resultJson = JSON.parse(cleaned); }
              if (typeof resultJson.pontuacao !== 'number' || !Array.isArray(resultJson.matches)) { throw new Error("JSON inválido."); }
              return resultJson;
          } catch (parseError) { console.error("Erro parse JSON:", parseError, "Texto:", textContent); throw new Error(`Resposta IA (${provider}) não é JSON válido.`); }
      } catch (error) { throw error; }
  }


  // Processa o formulário de Avaliação
  document.getElementById('formAvaliacao').onsubmit = async function(e) {
      e.preventDefault(); if (!db) return;
      if (!currentAIConfig.provider || !currentAIConfig.apiKey) { displayError('avaliacaoIA', 'Configure a IA antes.'); document.getElementById('configuracaoIA').scrollIntoView(); return; }

      disableButton('btnAnalisarCurriculo'); showLoading('avaliacaoIA'); clearError('avaliacaoIA');
      document.getElementById('avaliacaoResultado').style.display = 'none';

      const candidatoSelect = document.getElementById('selectCandidato');
      const vagaSelect = document.getElementById('selectVaga');
      const candidatoId = candidatoSelect.value;
      const vagaId = vagaSelect.value;
      if (!candidatoId || !vagaId) { alert('Selecione candidato e vaga.'); hideLoading('avaliacaoIA'); enableButton('btnAnalisarCurriculo'); return; }

      // Pega dados do candidato e vaga (incluindo telefone do dataset do select)
      const candidato = candidatos.find(c => c.id === candidatoId);
      const vaga = vagas.find(v => v.id === vagaId);
      const curriculoUrl = candidatoSelect.options[candidatoSelect.selectedIndex]?.dataset.curriculoUrl;
      const requisitosVaga = vagaSelect.options[vagaSelect.selectedIndex]?.dataset.requisitos;
      const candidatoTelefone = candidatoSelect.options[candidatoSelect.selectedIndex]?.dataset.telefone; // Pega telefone

      if (!candidato || !vaga || !requisitosVaga) { alert('Erro interno: dados incompletos.'); hideLoading('avaliacaoIA'); enableButton('btnAnalisarCurriculo'); return; }

      // Guarda contexto para agendamento posterior
      currentAvaliacaoContext = { candidatoId, vagaId, candidatoNome: candidato.nome, candidatoTelefone };
      // Esconde opções de contato anteriores
      document.getElementById('opcoesContato').style.display = 'none';

      try {
          // Monta o Prompt Detalhado
           let prompt = `**Análise de Candidato para Vaga de Emprego**\n\n`;
           prompt += `**VAGA:**\n- Título: ${vaga.titulo}\n- Área: ${vaga.area}\n- Requisitos:\n${requisitosVaga}\n\n`;
           prompt += `**CANDIDATO:**\n- Nome: ${candidato.nome}\n- Email: ${candidato.email}\n- Telefone: ${candidato.telefone || 'N/A'}\n`;
           if (curriculoUrl) { prompt += `- Currículo Anexado: Sim (Priorizar análise do conteúdo).\n\n`; }
           else { prompt += `- Currículo Anexado: Não.\n\n`; }
           prompt += `**TAREFA IA:**\nAvalie a compatibilidade (0-100). Liste pontos fortes (matches) e fracos (redflags). Gere relatório conciso e sugestão de ação. Gere perguntas para ser feita ao candidato na entrevista.\n`;
           prompt += `**FORMATO OBRIGATÓRIO (JSON):**\n{\n  "pontuacao": <int>, "matches": ["<string>", "<string>", ...], "redflags": ["<string>", "<string>", ...], "relatorio": "<string>", "sugestao": "<string>", "perguntas": "<string>"\n}\n`;
           prompt += `**IMPORTANTE:** Responda APENAS com o objeto JSON VÁLIDO, sem nenhum texto adicional, comentários ou formatação markdown (como \`\`\`json).`;

          // Chama a API configurada
          const aiResult = await callConfiguredAI_API(prompt);

          // Processa resultado
          const { pontuacao, matches, redflags, relatorio, sugestao, perguntas } = aiResult;
          const pontuacaoValidada = Math.max(0, Math.min(100, Math.round(pontuacao)));
          const matchesValidados = Array.isArray(matches) ? matches.map(String) : [];
          const redflagsValidados = Array.isArray(redflags) ? redflags.map(String) : [];
          const relatorioValidado = String(relatorio || '-'); const sugestaoAcaoValidada = String(sugestao || '-'); const perguntasValidada = String(perguntas || '-'); // Adiciona perguntas
          let status = 'Em Análise'; // Status inicial após análise
           if (sugestaoAcaoValidada.toLowerCase().includes('entrevista') || pontuacaoValidada > 65) status = 'Recomendado'; // Ex: Status pós-análise
           else if (sugestaoAcaoValidada.toLowerCase().includes('não recomendado') || pontuacaoValidada < 45) status = 'Não Recomendado';

          // Salva no Supabase (ainda sem o status de agendado)
          const { error: saveError } = await db.from('avaliacoes').upsert({
              candidato_id: candidatoId, vaga_id: vagaId, pontuacao: pontuacaoValidada, matches: matchesValidados,
              red_flags: redflagsValidados, relatorio_detalhado: relatorioValidado, sugestao_acao: sugestaoAcaoValidada,
              status: status, data_avaliacao: new Date().toISOString()
          }, { onConflict: 'candidato_id, vaga_id' });
          if (saveError) throw new Error(`Salvar avaliação: ${saveError.message}`);

          // Exibe resultado
          document.getElementById('resultadoProvider').textContent = currentAIConfig.provider;
          // Passa o contexto para a função de exibição
          exibeAvaliacaoIA({
              pontuacao: pontuacaoValidada, matches: matchesValidados, redflags: redflagsValidados,
              relatorio: relatorioValidado, sugestaoAcao: sugestaoAcaoValidada,perguntas: perguntasValidada, // Adiciona perguntas
              contexto: currentAvaliacaoContext // Passa o contexto atual
           });

          // Atualiza listas
          await renderHistorico(); await updateCounts();

      } catch (error) { displayError('avaliacaoIA', error.message); }
      finally { hideLoading('avaliacaoIA'); enableButton('btnAnalisarCurriculo'); }
  };

  // Exibe o resultado da Avaliação IA na interface
  function exibeAvaliacaoIA({ pontuacao, matches, redflags, relatorio, sugestaoAcao, perguntas, contexto }) {
      // Guarda o contexto atual nos campos hidden para uso no agendamento
      document.getElementById('currentAvaliacaoCandidatoId').value = contexto.candidatoId;
      document.getElementById('currentAvaliacaoVagaId').value = contexto.vagaId;

      document.getElementById('pontuacaoValor').innerText = pontuacao;
      const ulMatch = document.getElementById('combMatches'); ulMatch.innerHTML = '';
      if (matches.length > 0) { matches.forEach(m => { ulMatch.innerHTML += `<li class="truncate" title="${m}">${m}</li>`; }); }
      else { ulMatch.innerHTML = '<li class="text-gray-400 italic">Nenhum ponto forte.</li>'; }
      const ulRed = document.getElementById('redFlags'); ulRed.innerHTML = '';
      if (redflags.length > 0) { redflags.forEach(f => { ulRed.innerHTML += `<li class="truncate" title="${f}">${f}</li>`; }); }
      else { ulRed.innerHTML = '<li class="text-gray-400 italic">Nenhum ponto de atenção.</li>'; }
      document.getElementById('relatorioDetalhado').textContent = relatorio || '-';
      document.getElementById('sugestaoAcao').textContent = sugestaoAcao || '-';
      const perguntasEl = document.getElementById('perguntas');
if (perguntasEl) {
    perguntasEl.textContent = perguntas || 'Nenhuma pergunta sugerida.'; // Usa o valor recebido
}
      document.getElementById('avaliacaoResultado').style.display = 'block';
      document.getElementById('avaliacaoResultado').scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Habilita/desabilita botão de agendar baseado se há telefone
      const btnAgendar = document.getElementById('btnAgendarEntrevista');
      if (contexto.candidatoTelefone) {
          btnAgendar.disabled = false;
          btnAgendar.title = "Agendar entrevista e ver opções de contato";
      } else {
          btnAgendar.disabled = true;
          btnAgendar.title = "Não é possível agendar: Telefone do candidato não cadastrado.";
      }
      // Esconde opções de contato inicialmente
      document.getElementById('opcoesContato').style.display = 'none';

      setTimeout(() => { // Gráfico
          if (chartInst) chartInst.destroy();
          const ctx = document.getElementById('pontuacaoChart')?.getContext('2d'); if (!ctx) return;
          try {
              chartInst = new Chart(ctx, { type: 'doughnut', data: { datasets: [{ data: [pontuacao, 100 - pontuacao], backgroundColor: [ pontuacao >= 0 ? '#10B981' : (pontuacao >= 50 ? '#F59E0B' : '#EF4444'), '#E5E7EB' ], borderColor: '#ffffff', borderWidth: 3, circumference: 180, rotation: 270, }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: true, callbacks: { label: (c) => c.dataIndex === 0 ? ` Pontuação: ${c.raw}%` : ` Restante: ${c.raw}%` } } }, animation: { animateRotate: true, duration: 600 } } });
          } catch(chartError) { displayError('avaliacaoIA', `Gráfico: ${chartError.message}`); }
      }, 150);
  }

  // --- Função para Agendar Entrevista ---
  async function agendarEntrevista() {
      if (!db) return;
      const candidatoId = document.getElementById('currentAvaliacaoCandidatoId').value;
      const vagaId = document.getElementById('currentAvaliacaoVagaId').value;

      if (!candidatoId || !vagaId) {
          alert("Erro: Contexto da avaliação não encontrado.");
          return;
      }

      // Busca novamente os detalhes do candidato (incluindo telefone) para garantir
      const candidato = candidatos.find(c => c.id === candidatoId);
      const vaga = vagas.find(v => v.id === vagaId); // Para a mensagem do WhatsApp

      if (!candidato || !vaga) {
           alert("Erro: Não foi possível encontrar detalhes do candidato ou vaga.");
           return;
      }
      if (!candidato.telefone) {
           alert("Erro: Telefone do candidato não disponível para contato.");
           return;
      }

      const telefoneLimpo = candidato.telefone.replace(/\D/g, ''); // Remove não-dígitos
      const nomeCandidato = candidato.nome;
      const tituloVaga = vaga.titulo;

      // 1. Atualiza o status da avaliação no banco para "Entrevista Agendada"
      disableButton('btnAgendarEntrevista');
      showLoading('avaliacaoIA');
      clearError('avaliacaoIA');
      try {
          const { error } = await db.from('avaliacoes')
              .update({ status: 'Entrevista Agendada' })
              .match({ candidato_id: candidatoId, vaga_id: vagaId });
          if (error) throw error;

          // 2. Prepara e mostra os links de contato
          const mensagemWhatsapp = encodeURIComponent(`Olá ${nomeCandidato}, gostaríamos de agendar uma entrevista consigo para a vaga de ${tituloVaga}. Qual a sua disponibilidade?`);
          document.getElementById('linkWhatsapp').href = `https://wa.me/55${telefoneLimpo}?text=${mensagemWhatsapp}`; // Adiciona código do Brasil (55) - ajuste se necessário
          document.getElementById('linkChamada').href = `tel:+55${telefoneLimpo}`; // Adiciona código do Brasil (55)
          document.getElementById('contatoNomeCandidato').textContent = nomeCandidato;
          document.getElementById('opcoesContato').style.display = 'block';

          // 3. Atualiza visualização do histórico e métricas
          await renderHistorico();
          await populateMetrica(); // Recalcula métrica de entrevistas

          // Opcional: Desabilitar o botão após agendar para evitar cliques múltiplos
          // disableButton('btnAgendarEntrevista');

      } catch (error) {
          console.error("Erro ao agendar entrevista:", error);
          displayError('avaliacaoIA', `Falha ao atualizar status: ${error.message}`);
          // Reabilita o botão se deu erro
          enableButton('btnAgendarEntrevista');
      } finally {
          hideLoading('avaliacaoIA');
          // Não reabilitamos o botão aqui intencionalmente, a menos que queira permitir reagendamento fácil
      }
  }


  // --- Inicialização da Aplicação ---
  async function initApp() {
    if (!db || SUPABASE_URL === 'YOUR_SUPABASE_URL') { document.body.innerHTML = '<div class="p-8 text-center text-red-600 font-bold">Erro Crítico: Configuração do Supabase inválida.</div>'; return; }
    console.log("Iniciando AI Recruit Pro...");
    loadAIConfig(); // Carrega config IA
    showLoading('dashboard'); showLoading('cadastroVaga'); showLoading('cadastroCandidato'); showLoading('historicoCandidatura');
    try {
         await Promise.all([ updateCounts(), renderVagas(), renderCandidatos(), renderHistorico() ]);
         // populateMetrica já é chamado dentro de renderHistorico após carregar os dados
         document.getElementById('selectCandidato').querySelector('option[disabled]').textContent = '-- Selecione --';
         document.getElementById('selectVaga').querySelector('option[disabled]').textContent = '-- Selecione --';
    } catch (initError) { displayError('dashboard', `Erro inicial: ${initError.message}.`); }
    finally { hideLoading('dashboard'); hideLoading('cadastroVaga'); hideLoading('cadastroCandidato'); hideLoading('historicoCandidatura'); }
    resetFormVaga(); resetFormCandidato();
    document.getElementById('avaliacaoResultado').style.display = 'none'; clearError('avaliacaoIA');
    document.getElementById('formConfigIA').addEventListener('submit', saveAIConfig); // Listener para salvar config
    console.log("App AI Recruit Pro pronto.");
  }

  // Garante que o DOM esteja pronto
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); }
  else { initApp(); }
