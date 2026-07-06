let games = [];
let usuarios = [];
let activeUserId = null;
let sortState = { column: null, direction: 'asc' };

const getList = async () => {
  fetch('http://127.0.0.1:8000/jogos', { method: 'get' })
    .then(r => r.json())
    .then(data => {
      games = data.jogos.map(item => ({
        id: item.id,
        nome: item.nome,
        plataforma: item.plataforma
      }));
      updatePlatformOptions();
      renderTable();
    })
    .catch(err => console.error('Error:', err));
}

const postItem = async (inputJogo, inputPlataforma) => {
  const formData = new FormData();
  formData.append('nome', inputJogo);
  formData.append('plataforma', inputPlataforma);

  return fetch('http://127.0.0.1:8000/jogos', {
    method: 'post',
    body: formData
  })
    .then(r => r.json())
    .catch(err => console.error('Error:', err));
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
      const row = this.parentElement.parentElement;
      const idJogo = row.dataset.id;
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
  const inputNota = document.getElementById("newRating").value;
  const inputPlataforma = document.getElementById("newPlatform").value;
  const inputZerado = document.getElementById("newFinished").checked;
  if (!inputJogo) { alert("Escreva o nome de um jogo!"); return; }
  if (!activeUserId) { alert("Selecione um usuário na seção acima antes de adicionar um jogo!"); return; }

  let jogoId;
  const existing = games.find(g => g.nome.toLowerCase() === inputJogo.toLowerCase());
  if (existing) {
    jogoId = existing.id;
  } else {
    const response = await postItem(inputJogo, inputPlataforma);
    if (!response || !response.id) { alert("Erro ao salvar o jogo."); return; }
    jogoId = response.id;
    insertList(jogoId, inputJogo, inputPlataforma);
  }

  const result = await associarJogoUsuario(activeUserId, jogoId, inputZerado, inputNota);
  if (!result.ok) { alert(result.message || "Erro ao associar jogo ao usuário."); return; }

  document.getElementById("newInput").value = "";
  document.getElementById("newRating").value = "";
  document.getElementById("newPlatform").value = "";
  document.getElementById("newFinished").checked = false;
  renderTable();
  alert("Jogo adicionado!");
}

const insertList = (idJogo, nomeJogo, plataforma) => {
  games.push({ id: idJogo, nome: nomeJogo, plataforma });
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

const associarJogoUsuario = async (usuarioId, jogoId, zerado = false, nota = '') => {
  const formData = new FormData();
  formData.append('usuario_id', usuarioId);
  formData.append('jogo_id', jogoId);
  formData.append('zerado', zerado);
  if (nota !== '') formData.append('nota', nota);

  const response = await fetch('http://127.0.0.1:8000/usuario/jogo', { method: 'post', body: formData });
  const data = await response.json();
  if (!response.ok) return { ok: false, message: data.message };

  const usuario = usuarios.find(u => String(u.id) === String(usuarioId));
  if (usuario) usuario.jogos = data.jogos;
  return { ok: true };
}

const updatePlatformOptions = () => {
  const select = document.getElementById('filterPlatform');
  const current = select.value;
  const platforms = [...new Set(games.map(g => g.plataforma).filter(Boolean))].sort();
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
  const search = document.getElementById('searchInput').value.toLowerCase();
  const platform = document.getElementById('filterPlatform').value;
  const zeradoFilter = document.getElementById('filterZerado').value;

  let filtered = games.filter(g => {
    if (search && !String(g.nome).toLowerCase().includes(search)) return false;
    if (platform && g.plataforma !== platform) return false;

    if (activeUserId) {
      const usuario = usuarios.find(u => u.id === activeUserId);
      const assoc = usuario?.jogos.find(j => j.id === g.id);
      if (!assoc) return false;
      if (zeradoFilter !== '' && String(assoc.zerado) !== zeradoFilter) return false;
    }
    return true;
  });

  if (sortState.column) {
    filtered.sort((a, b) => {
      let va = a[sortState.column];
      let vb = b[sortState.column];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return sortState.direction === 'asc' ? -1 : 1;
      if (va > vb) return sortState.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const table = document.getElementById('myTable');
  while (table.rows.length > 1) table.deleteRow(1);

  filtered.forEach(game => {
    const row = table.insertRow();
    row.dataset.id = game.id;
    ['nome', 'plataforma'].forEach((key, i) => {
      row.insertCell(i).textContent = game[key];
    });
    row.addEventListener('click', () => openGameModal(game.id));
    insertButton(row.insertCell(-1));
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
  ['nome', 'plataforma'].forEach(col => {
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

  const body = document.getElementById('modalBody');

  if (activeUserId) {
    const usuario = usuarios.find(u => u.id === activeUserId);
    const assoc = usuario?.jogos.find(j => j.id === game.id);
    const nota = assoc?.nota;
    const zerado = !!assoc?.zerado;

    body.innerHTML = `
      <p><strong>Nota:</strong> ${nota ?? 'Sem nota'}</p>
      <p><strong>Zerado:</strong> ${zerado ? 'Sim ☑' : 'Não ☐'}</p>
    `;
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
  if (!matches.length) { dropdown.classList.remove('open'); return; }

  matches.forEach(g => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = g.nome;
    li.appendChild(nameSpan);
    li.onmousedown = () => {
      document.getElementById('newInput').value = g.nome;
      document.getElementById('newPlatform').value = g.plataforma ?? '';
      dropdown.classList.remove('open');
    };
    dropdown.appendChild(li);
  });
  dropdown.classList.add('open');
}

document.getElementById('newInput').addEventListener('focus', () => {
  buildGameDropdown(document.getElementById('newInput').value);
});

document.getElementById('newInput').addEventListener('input', e => {
  buildGameDropdown(e.target.value);
});

document.getElementById('newInput').addEventListener('blur', () => {
  document.getElementById('gameDropdown').classList.remove('open');
});

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