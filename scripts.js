let games = [];
let usuarios = [];
let activeUserId = null;
let sortState = { column: null, direction: 'asc' };
let pendingExternalMeta = null;
let externalSearchToken = 0;
let externalSearchTimer = null;

const getList = async () => {
  fetch('http://127.0.0.1:8000/jogos', { method: 'get' })
    .then(r => r.json())
    .then(data => {
      games = data.jogos.map(item => ({
        id: item.id,
        nome: item.nome,
        plataforma: item.plataforma,
        capa_url: item.capa_url,
        data_lancamento: item.data_lancamento,
        desenvolvedora: item.desenvolvedora,
        nota_critica: item.nota_critica
      }));
      updatePlatformOptions();
      renderTable();
    })
    .catch(err => console.error('Error:', err));
}

const postItem = async (inputJogo, inputPlataforma, meta = null) => {
  const formData = new FormData();
  formData.append('nome', inputJogo);
  formData.append('plataforma', inputPlataforma);
  if (meta) {
    if (meta.capa_url) formData.append('capa_url', meta.capa_url);
    if (meta.data_lancamento) formData.append('data_lancamento', meta.data_lancamento);
    if (meta.desenvolvedora) formData.append('desenvolvedora', meta.desenvolvedora);
    if (meta.nota_critica !== null && meta.nota_critica !== undefined) formData.append('nota_critica', meta.nota_critica);
  }

  return fetch('http://127.0.0.1:8000/jogos', {
    method: 'post',
    body: formData
  })
    .then(r => r.json())
    .catch(err => console.error('Error:', err));
}

const externalSearchCache = new Map();

const buscarJogoExterno = async (nome) => {
  const chave = nome.toLowerCase();
  if (externalSearchCache.has(chave)) return externalSearchCache.get(chave);
  try {
    const response = await fetch('http://127.0.0.1:8000/jogo/buscar-externo?nome=' + encodeURIComponent(nome));
    if (!response.ok) return [];
    const data = await response.json();
    const resultados = data.resultados || [];
    externalSearchCache.set(chave, resultados);
    return resultados;
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

const notaInvalida = (valor) => valor !== '' && !/^\d+$/.test(valor);

const mensagemDeErro = (data) => {
  if (Array.isArray(data) && data.length) {
    return data.map(e => `Campo '${(e.loc || []).join('.')}': ${e.msg}`).join(' — ');
  }
  return data?.message || "Erro inesperado ao falar com a API.";
}

const platformOptionsFrom = (str) => {
  return [...new Set((str || '').split(',').map(p => p.trim()).filter(Boolean))];
}

const updateAssociationPlatformOptions = () => {
  const select = document.getElementById('newPlataformaZerada');
  const options = platformOptionsFrom(document.getElementById('newPlatform').value);
  select.innerHTML = '<option value="">Em qual plataforma?</option>';
  options.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
}

const insertButton = (parent) => {
  let span = document.createElement("span");
  span.className = "close";
  span.appendChild(document.createTextNode("×"));
  parent.appendChild(span);
}

const removeElement = () => {
  let close = document.getElementsByClassName("close");
  for (let i = 0; i < close.length; i++) {
    close[i].onclick = function (e) {
      e.stopPropagation();
      const card = this.closest('[data-id]');
      const idJogo = card.dataset.id;
      if (confirm("Você tem certeza?")) {
        games = games.filter(g => String(g.id) !== String(idJogo));
        deleteItem(idJogo);
        updatePlatformOptions();
        renderTable();
        alert("Removido!");
      }
    }
  }
}

const deleteItem = (item) => {
  fetch('http://127.0.0.1:8000/jogo?id=' + item, { method: 'delete' })
    .then(r => r.json())
    .catch(err => console.error('Error:', err));
}

const newItem = async () => {
  const inputJogo = document.getElementById("newInput").value.trim();
  const inputNota = document.getElementById("newRating").value.trim();
  const inputPlataforma = document.getElementById("newPlatform").value;
  const inputPlataformaZerada = document.getElementById("newPlataformaZerada").value;
  const inputZerado = document.getElementById("newFinished").checked;
  if (!inputJogo) { alert("Escreva o nome de um jogo!"); return; }
  if (!activeUserId) { alert("Selecione um usuário na seção acima antes de adicionar um jogo!"); return; }
  if (notaInvalida(inputNota)) { alert("A nota deve ser um número inteiro, sem casas decimais (ex: 8, não 8.5)."); return; }

  let jogoId;
  const existing = games.find(g => g.nome.toLowerCase() === inputJogo.toLowerCase());
  if (existing) {
    jogoId = existing.id;
  } else {
    const response = await postItem(inputJogo, inputPlataforma, pendingExternalMeta);
    if (!response || !response.id) { alert("Erro ao salvar o jogo."); return; }
    jogoId = response.id;
    insertList(response);
  }

  const result = await associarJogoUsuario(activeUserId, jogoId, inputZerado, inputNota, inputPlataformaZerada);
  if (!result.ok) { alert(result.message || "Erro ao associar jogo ao usuário."); return; }

  document.getElementById("newInput").value = "";
  document.getElementById("newRating").value = "";
  document.getElementById("newPlatform").value = "";
  document.getElementById("newFinished").checked = false;
  pendingExternalMeta = null;
  updateAssociationPlatformOptions();
  renderTable();
  alert("Jogo adicionado!");
}

const insertList = (jogo) => {
  games.push({
    id: jogo.id,
    nome: jogo.nome,
    plataforma: jogo.plataforma,
    capa_url: jogo.capa_url,
    data_lancamento: jogo.data_lancamento,
    desenvolvedora: jogo.desenvolvedora,
    nota_critica: jogo.nota_critica
  });
  updatePlatformOptions();
}

const getUsuarios = async () => {
  fetch('http://127.0.0.1:8000/usuarios', { method: 'get' })
    .then(r => r.json())
    .then(data => {
      usuarios = data.usuarios;
      renderUsuarios();
    })
    .catch(err => console.error('Error:', err));
}

const addUsuario = async () => {
  const input = document.getElementById('newUsuario');
  const nome = input.value.trim();
  if (!nome) { alert("Escreva o nome do usuário!"); return; }

  const formData = new FormData();
  formData.append('nome', nome);

  fetch('http://127.0.0.1:8000/usuario', { method: 'post', body: formData })
    .then(r => r.json())
    .then(data => {
      usuarios.push({ id: data.id, nome: data.nome, jogos: data.jogos || [] });
      activeUserId = data.id;
      input.value = '';
      renderUsuarios();
      renderTable();
    })
    .catch(err => console.error('Error:', err));
}

const deleteUsuario = async (id) => {
  if (!confirm("Remover usuário?")) return;

  fetch('http://127.0.0.1:8000/usuario?id=' + id, { method: 'delete' })
    .then(r => r.json())
    .then(() => {
      if (activeUserId === id) activeUserId = null;
      usuarios = usuarios.filter(u => u.id !== id);
      renderUsuarios();
      renderTable();
    })
    .catch(err => console.error('Error:', err));
}

const updateAddGameState = () => {
  const btn = document.getElementById('addJogoBtn');
  const hint = document.getElementById('semUsuarioHint');
  const filterZeradoSelect = document.getElementById('filterZerado');
  const noActive = !activeUserId;
  btn.disabled = noActive;
  if (noActive) {
    hint.textContent = usuarios.length === 0
      ? 'Cadastre um usuário acima antes de adicionar jogos.'
      : 'Selecione um usuário acima para adicionar jogos.';
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
  filterZeradoSelect.disabled = noActive;
  if (noActive) filterZeradoSelect.value = '';
  document.getElementById('sortNotaBtn').disabled = noActive;
}

const clearActiveUser = () => {
  activeUserId = null;
  renderActiveUser();
  updateAddGameState();
  renderTable();
}

const renderActiveUser = () => {
  const container = document.getElementById('activeUser');
  container.innerHTML = '';
  if (!activeUserId) return;
  const u = usuarios.find(u => u.id === activeUserId);
  if (!u) return;
  const chip = document.createElement('div');
  chip.className = 'usuario-chip active';
  const nameSpan = document.createElement('span');
  nameSpan.textContent = u.nome;
  chip.appendChild(nameSpan);
  const clearBtn = document.createElement('button');
  clearBtn.className = 'usuario-chip-clear';
  clearBtn.textContent = '×';
  clearBtn.title = 'Limpar seleção';
  clearBtn.onclick = clearActiveUser;
  chip.appendChild(clearBtn);
  container.appendChild(chip);
}

const renderUsuarios = () => {
  renderActiveUser();
  const dropdown = document.getElementById('userDropdown');
  if (dropdown.classList.contains('open')) {
    buildDropdown(document.getElementById('newUsuario').value);
  }
  updateAddGameState();
}

const associarJogoUsuario = async (usuarioId, jogoId, zerado = false, nota = '', plataforma = '') => {
  const formData = new FormData();
  formData.append('usuario_id', usuarioId);
  formData.append('jogo_id', jogoId);
  formData.append('zerado', zerado);
  if (nota !== '') formData.append('nota', nota);
  if (plataforma !== '') formData.append('plataforma', plataforma);

  const response = await fetch('http://127.0.0.1:8000/usuario/jogo', { method: 'post', body: formData });
  const data = await response.json();
  if (!response.ok) return { ok: false, message: mensagemDeErro(data) };

  const usuario = usuarios.find(u => String(u.id) === String(usuarioId));
  if (usuario) usuario.jogos = data.jogos;
  return { ok: true };
}

const atualizarAssociacao = async (usuarioId, jogoId, zerado, nota, plataforma = '') => {
  const formData = new FormData();
  formData.append('usuario_id', usuarioId);
  formData.append('jogo_id', jogoId);
  formData.append('zerado', zerado);
  if (nota !== '') formData.append('nota', nota);
  if (plataforma !== '') formData.append('plataforma', plataforma);

  const response = await fetch('http://127.0.0.1:8000/usuario/jogo', { method: 'put', body: formData });
  const data = await response.json();
  if (!response.ok) return { ok: false, message: mensagemDeErro(data) };

  const usuario = usuarios.find(u => String(u.id) === String(usuarioId));
  if (usuario) usuario.jogos = data.jogos;
  return { ok: true };
}

const updatePlatformOptions = () => {
  const select = document.getElementById('filterPlatform');
  const current = select.value;
  let platforms;
  if (activeUserId) {
    const usuario = usuarios.find(u => u.id === activeUserId);
    platforms = [...new Set((usuario?.jogos || []).flatMap(j => platformOptionsFrom(j.plataforma)))].sort();
  } else {
    platforms = [...new Set(games.flatMap(g => platformOptionsFrom(g.plataforma)))].sort();
  }
  select.innerHTML = '<option value="">Todas as plataformas</option>';
  platforms.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
  if (platforms.includes(current)) select.value = current;
}

const renderTable = () => {
  updatePlatformOptions();
  const search = document.getElementById('searchInput').value.toLowerCase();
  const platform = document.getElementById('filterPlatform').value;
  const zeradoFilter = document.getElementById('filterZerado').value;

  const usuarioAtivo = activeUserId ? usuarios.find(u => u.id === activeUserId) : null;
  const assocPorJogo = new Map((usuarioAtivo?.jogos || []).map(j => [j.id, j]));

  let filtered = games.filter(g => {
    if (search && !String(g.nome).toLowerCase().includes(search)) return false;

    const assoc = assocPorJogo.get(g.id);
    if (activeUserId) {
      if (!assoc) return false;
      if (zeradoFilter !== '' && String(assoc.zerado) !== zeradoFilter) return false;
    }

    if (platform) {
      const plataformasDoJogo = platformOptionsFrom(activeUserId ? assoc?.plataforma : g.plataforma);
      if (!plataformasDoJogo.includes(platform)) return false;
    }

    return true;
  });

  if (sortState.column) {
    filtered.sort((a, b) => {
      let va, vb;
      if (sortState.column === 'nota') {
        va = assocPorJogo.get(a.id)?.nota;
        vb = assocPorJogo.get(b.id)?.nota;
      } else {
        va = a[sortState.column];
        vb = b[sortState.column];
      }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') { va = va.toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return sortState.direction === 'asc' ? -1 : 1;
      if (va > vb) return sortState.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const grid = document.getElementById('gameGrid');
  grid.innerHTML = '';

  filtered.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.id = game.id;

    const cover = document.createElement('div');
    cover.className = 'game-card-cover';
    if (game.capa_url) {
      const img = document.createElement('img');
      img.src = game.capa_url;
      img.alt = game.nome;
      cover.appendChild(img);
    } else {
      cover.classList.add('game-card-cover-placeholder');
      cover.textContent = game.nome.slice(0, 1).toUpperCase();
    }
    card.appendChild(cover);

    const assoc = assocPorJogo.get(game.id);

    if (!activeUserId) {
      const donos = usuarios.filter(u => u.jogos.some(j => j.id === game.id)).length;
      const badge = document.createElement('span');
      badge.className = 'owners-badge';
      const legenda = donos === 1 ? 'Adicionado por 1 usuário' : `Adicionado por ${donos} usuários`;
      badge.innerHTML = `<span aria-hidden="true">👥 ${donos}</span>`;
      badge.title = legenda;
      badge.setAttribute('aria-label', legenda);
      badge.setAttribute('role', 'img');
      card.appendChild(badge);
    } else {
      const zerado = !!assoc?.zerado;
      const badge = document.createElement('span');
      badge.className = `zerado-badge ${zerado ? 'zerado-sim' : 'zerado-nao'}`;
      const legenda = zerado ? 'Zerado' : 'Não zerado';
      badge.innerHTML = `<span aria-hidden="true">${zerado ? '✅' : '⏳'} ${legenda}</span>`;
      badge.title = legenda;
      badge.setAttribute('aria-label', legenda);
      badge.setAttribute('role', 'img');
      card.appendChild(badge);
    }

    if (activeUserId && assoc?.nota != null) {
      const gamelogBadge = document.createElement('span');
      gamelogBadge.className = 'gamelog-badge';
      const legendaGamelog = `Índice GameLog: ${assoc.nota}`;
      gamelogBadge.innerHTML = `<span aria-hidden="true">🎮 ${assoc.nota}</span>`;
      gamelogBadge.title = legendaGamelog;
      gamelogBadge.setAttribute('aria-label', legendaGamelog);
      gamelogBadge.setAttribute('role', 'img');
      cover.appendChild(gamelogBadge);
    }

    if (game.nota_critica != null) {
      const metascoreBadge = document.createElement('span');
      metascoreBadge.className = 'metascore-badge';
      const legendaMeta = `Metascore ${game.nota_critica}`;
      metascoreBadge.innerHTML = `<span aria-hidden="true">⭐ ${game.nota_critica}</span>`;
      metascoreBadge.title = legendaMeta;
      metascoreBadge.setAttribute('aria-label', legendaMeta);
      metascoreBadge.setAttribute('role', 'img');
      cover.appendChild(metascoreBadge);
    }

    insertButton(card);

    const info = document.createElement('div');
    info.className = 'game-card-info';
    const title = document.createElement('p');
    title.className = 'game-card-title';
    title.textContent = game.nome;
    const platformEl = document.createElement('p');
    platformEl.className = 'game-card-platform';
    const platformLabel = (activeUserId && assoc?.plataforma) ? assoc.plataforma : (game.plataforma || '');
    platformEl.textContent = platformLabel;
    info.appendChild(title);
    info.appendChild(platformEl);
    card.appendChild(info);

    card.addEventListener('click', () => openGameModal(game.id));
    grid.appendChild(card);
  });

  removeElement();
}

const sortTable = (column) => {
  if (sortState.column === column) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.column = column;
    sortState.direction = 'asc';
  }
  updateSortArrows();
  renderTable();
}

const updateSortArrows = () => {
  ['nome', 'plataforma', 'nota', 'nota_critica'].forEach(col => {
    const arrow = document.getElementById(`arrow-${col}`);
    if (!arrow) return;
    arrow.textContent = sortState.column === col
      ? (sortState.direction === 'asc' ? ' ↑' : ' ↓')
      : '';
  });
}

const openGameModal = (jogoId) => {
  const game = games.find(g => String(g.id) === String(jogoId));
  if (!game) return;

  document.getElementById('modalGameName').textContent = game.nome;
  document.getElementById('modalPlatform').textContent = game.plataforma || 'Plataforma não informada';

  const cover = document.getElementById('modalCover');
  if (game.capa_url) {
    cover.src = game.capa_url;
    cover.hidden = false;
  } else {
    cover.removeAttribute('src');
    cover.hidden = true;
  }

  const body = document.getElementById('modalBody');

  const metaParts = [];
  if (game.desenvolvedora) metaParts.push(game.desenvolvedora);
  if (game.data_lancamento) metaParts.push(game.data_lancamento);
  if (game.nota_critica != null) metaParts.push(`Metascore ${game.nota_critica}`);
  document.getElementById('modalMeta').textContent = metaParts.join(' · ');

  if (activeUserId) {
    const usuario = usuarios.find(u => u.id === activeUserId);
    const assoc = usuario?.jogos.find(j => j.id === game.id);
    const nota = assoc?.nota ?? '';
    const zerado = !!assoc?.zerado;
    const plataformaAtual = assoc?.plataforma ?? '';
    const opcoesPlataforma = platformOptionsFrom(game.plataforma);
    const selectPlataformaHtml = '<option value="">Em qual plataforma?</option>' +
      opcoesPlataforma.map(p => `<option value="${p}" ${p === plataformaAtual ? 'selected' : ''}>${p}</option>`).join('');

    body.innerHTML = `
      <label class="modal-field-label" for="modalNota">Sua nota</label>
      <input type="text" id="modalNota" class="modal-input" value="${nota}" placeholder="Sem nota">
      <label class="modal-field-label" for="modalPlataformaZerada">Sua plataforma</label>
      <select id="modalPlataformaZerada" class="modal-input">${selectPlataformaHtml}</select>
      <label class="checkbox-label">
        <input type="checkbox" id="modalZerado" ${zerado ? 'checked' : ''}> Zerado
      </label>
      <button type="button" id="modalSalvarBtn" class="addBtn">Salvar</button>
    `;

    document.getElementById('modalSalvarBtn').onclick = async () => {
      const novaNota = document.getElementById('modalNota').value.trim();
      if (notaInvalida(novaNota)) { alert("A nota deve ser um número inteiro, sem casas decimais (ex: 8, não 8.5)."); return; }
      const novoZerado = document.getElementById('modalZerado').checked;
      const novaPlataforma = document.getElementById('modalPlataformaZerada').value;
      const result = await atualizarAssociacao(activeUserId, game.id, novoZerado, novaNota, novaPlataforma);
      if (!result.ok) { alert(result.message || "Erro ao atualizar."); return; }
      closeGameModal();
      renderTable();
    };
  } else {
    const donos = usuarios.filter(u => u.jogos.some(j => j.id === game.id));
    const zeraram = donos.filter(u => u.jogos.some(j => j.id === game.id && j.zerado));

    body.innerHTML = `
      <p><strong>${donos.length}</strong> pessoa(s) possuem este jogo</p>
      <p><strong>${zeraram.length}</strong> zeraram este jogo</p>
    `;
  }

  document.getElementById('gameModalOverlay').classList.add('open');
}

const closeGameModal = () => {
  document.getElementById('gameModalOverlay').classList.remove('open');
}

const buildDropdown = (filter = '') => {
  const dropdown = document.getElementById('userDropdown');
  const matches = (filter
    ? usuarios.filter(u => u.nome.toLowerCase().includes(filter.toLowerCase()))
    : [...usuarios]
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  dropdown.innerHTML = '';

  if (!matches.length) {
    const li = document.createElement('li');
    li.className = 'user-dropdown-empty';
    li.textContent = 'Nenhum usuário encontrado';
    dropdown.appendChild(li);
    return;
  }

  matches.forEach(u => {
    const li = document.createElement('li');
    if (u.id === activeUserId) li.classList.add('dropdown-active');

    const nameSpan = document.createElement('span');
    nameSpan.textContent = u.nome;

    const delBtn = document.createElement('button');
    delBtn.className = 'dropdown-del';
    delBtn.textContent = '×';
    delBtn.title = 'Remover usuário';
    delBtn.onmousedown = e => {
      e.stopPropagation();
      deleteUsuario(u.id);
    };

    li.onmousedown = () => {
      activeUserId = u.id;
      document.getElementById('newUsuario').value = '';
      document.getElementById('userDropdown').classList.remove('open');
      renderActiveUser();
      updateAddGameState();
      renderTable();
    };

    li.appendChild(nameSpan);
    li.appendChild(delBtn);
    dropdown.appendChild(li);
  });
}

document.getElementById('newUsuario').addEventListener('focus', () => {
  buildDropdown(document.getElementById('newUsuario').value);
  document.getElementById('userDropdown').classList.add('open');
});

document.getElementById('newUsuario').addEventListener('input', e => {
  buildDropdown(e.target.value);
  document.getElementById('userDropdown').classList.add('open');
});

document.getElementById('newUsuario').addEventListener('blur', () => {
  document.getElementById('userDropdown').classList.remove('open');
});

const buildGameDropdown = (filter = '') => {
  const dropdown = document.getElementById('gameDropdown');
  const seen = new Set();
  const unique = games.filter(g => {
    const key = g.nome.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const matches = (filter
    ? unique.filter(g => g.nome.toLowerCase().includes(filter.toLowerCase()))
    : [...unique]
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  dropdown.innerHTML = '';

  matches.forEach(g => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = g.nome;
    li.appendChild(nameSpan);
    li.onmousedown = () => {
      pendingExternalMeta = null;
      document.getElementById('newInput').value = g.nome;
      document.getElementById('newPlatform').value = g.plataforma ?? '';
      updateAssociationPlatformOptions();
      dropdown.classList.remove('open');
    };
    dropdown.appendChild(li);
  });

  if (matches.length) dropdown.classList.add('open');
  else dropdown.classList.remove('open');

  if (externalSearchTimer) clearTimeout(externalSearchTimer);
  if (!filter || filter.length < 2) return;

  externalSearchTimer = setTimeout(() => {
  const token = ++externalSearchToken;
  buscarJogoExterno(filter).then(resultados => {
    if (token !== externalSearchToken) return;
    const nomesLocais = new Set(matches.map(m => m.nome.toLowerCase()));

    resultados
      .filter(r => r.nome && !nomesLocais.has(r.nome.toLowerCase()))
      .forEach(r => {
        const li = document.createElement('li');
        li.className = 'game-dropdown-external';

        if (r.capa_url) {
          const img = document.createElement('img');
          img.src = r.capa_url;
          img.alt = '';
          img.className = 'game-dropdown-cover';
          li.appendChild(img);
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = r.nome;
        li.appendChild(nameSpan);

        const tag = document.createElement('span');
        tag.className = 'game-dropdown-tag';
        tag.textContent = 'RAWG';
        li.appendChild(tag);

        li.onmousedown = () => {
          pendingExternalMeta = {
            capa_url: r.capa_url,
            data_lancamento: r.data_lancamento,
            desenvolvedora: r.desenvolvedora,
            nota_critica: r.nota_critica
          };
          document.getElementById('newInput').value = r.nome;
          document.getElementById('newPlatform').value = r.plataformas ?? '';
          updateAssociationPlatformOptions();
          dropdown.classList.remove('open');
        };
        dropdown.appendChild(li);
      });

    if (dropdown.children.length) dropdown.classList.add('open');
  });
  }, 350);
}

document.getElementById('newInput').addEventListener('focus', () => {
  buildGameDropdown(document.getElementById('newInput').value);
});

document.getElementById('newInput').addEventListener('input', e => {
  pendingExternalMeta = null;
  buildGameDropdown(e.target.value);
});

document.getElementById('newInput').addEventListener('blur', () => {
  document.getElementById('gameDropdown').classList.remove('open');
});

document.getElementById('newPlatform').addEventListener('input', updateAssociationPlatformOptions);

document.getElementById('searchInput').addEventListener('input', renderTable);
document.getElementById('filterPlatform').addEventListener('change', renderTable);
document.getElementById('filterZerado').addEventListener('change', renderTable);

document.getElementById('modalCloseBtn').addEventListener('click', closeGameModal);
document.getElementById('gameModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'gameModalOverlay') closeGameModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeGameModal();
});

getList();
getUsuarios();