let games = [];
let sortState = { column: null, direction: 'asc' };

/*
  --------------------------------------------------------------------------------------
  Função para obter a lista existente do servidor via requisição GET
  --------------------------------------------------------------------------------------
*/
const getList = async () => {
  fetch('http://127.0.0.1:8000/jogos', { method: 'get' })
    .then(r => r.json())
    .then(data => {
      games = data.jogos.map(item => ({
        id: item.id,
        nome: item.nome,
        plataforma: item.plataforma,
        nota: item.nota,
        zerado: item.zerado
      }));
      updatePlatformOptions();
      renderTable();
    })
    .catch(err => console.error('Error:', err));
}

getList();


/*
  --------------------------------------------------------------------------------------
  Função para colocar um item na lista do servidor via requisição POST
  --------------------------------------------------------------------------------------
*/
const postItem = async (inputJogo, inputNota, inputPlataforma, inputZerado) => {
  const formData = new FormData();
  formData.append('nome', inputJogo);
  formData.append('plataforma', inputPlataforma);
  formData.append('zerado', inputZerado);
  formData.append('nota', inputNota);

  return fetch('http://127.0.0.1:8000/jogos', {
    method: 'post',
    body: formData
  })
    .then(r => r.json())
    .catch(err => console.error('Error:', err));
}


/*
  --------------------------------------------------------------------------------------
  Função para criar um botão close para cada item da lista
  --------------------------------------------------------------------------------------
*/
const insertButton = (parent) => {
  let span = document.createElement("span");
  span.className = "close";
  span.appendChild(document.createTextNode("×"));
  parent.appendChild(span);
}


/*
  --------------------------------------------------------------------------------------
  Função para remover um item da lista de acordo com o click no botão close
  --------------------------------------------------------------------------------------
*/
const removeElement = () => {
  let close = document.getElementsByClassName("close");
  for (let i = 0; i < close.length; i++) {
    close[i].onclick = function () {
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


/*
  --------------------------------------------------------------------------------------
  Função para deletar um item da lista do servidor via requisição DELETE
  --------------------------------------------------------------------------------------
*/
const deleteItem = (item) => {
  fetch('http://127.0.0.1:8000/jogo?id=' + item, { method: 'delete' })
    .then(r => r.json())
    .catch(err => console.error('Error:', err));
}


/*
  --------------------------------------------------------------------------------------
  Função para adicionar um novo item com nome, nota, plataforma e zerado
  --------------------------------------------------------------------------------------
*/
const newItem = async () => {
  let inputJogo = document.getElementById("newInput").value;
  let inputNota = document.getElementById("newRating").value;
  let inputPlataforma = document.getElementById("newPlatform").value;
  let inputZerado = document.getElementById("newFinished").value;

  if (inputJogo === '') {
    alert("Escreva o nome de um jogo!");
  } else {
    const response = await postItem(inputJogo, inputNota, inputPlataforma, inputZerado);
    insertList(response.id, inputJogo, inputNota, inputPlataforma, inputZerado);
    alert("Jogo adicionado!");
  }
}


/*
  --------------------------------------------------------------------------------------
  Função para inserir um item na lista em memória e atualizar a tabela
  --------------------------------------------------------------------------------------
*/
const insertList = (idJogo, nomeJogo, nota, plataforma, zerado) => {
  games.push({ id: idJogo, nome: nomeJogo, nota, plataforma, zerado });
  document.getElementById("newInput").value = "";
  document.getElementById("newRating").value = "";
  document.getElementById("newPlatform").value = "";
  document.getElementById("newFinished").value = "";
  updatePlatformOptions();
  renderTable();
}


/*
  --------------------------------------------------------------------------------------
  Atualiza as opções do dropdown de plataformas com base nos dados atuais
  --------------------------------------------------------------------------------------
*/
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


/*
  --------------------------------------------------------------------------------------
  Renderiza a tabela aplicando os filtros e a ordenação atuais
  --------------------------------------------------------------------------------------
*/
const renderTable = () => {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const platform = document.getElementById('filterPlatform').value;
  const zeradoFilter = document.getElementById('filterZerado').value;

  let filtered = games.filter(g => {
    if (search && !String(g.nome).toLowerCase().includes(search)) return false;
    if (platform && g.plataforma !== platform) return false;
    if (zeradoFilter !== '' && String(g.zerado) !== zeradoFilter) return false;
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
    ['nome', 'nota', 'plataforma', 'zerado'].forEach((key, i) => {
      const cel = row.insertCell(i);
      cel.textContent = game[key];
    });
    insertButton(row.insertCell(-1));
  });

  removeElement();
}


/*
  --------------------------------------------------------------------------------------
  Ordena a tabela pela coluna clicada (toggle asc/desc)
  --------------------------------------------------------------------------------------
*/
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


/*
  --------------------------------------------------------------------------------------
  Atualiza os indicadores visuais de ordenação nos cabeçalhos
  --------------------------------------------------------------------------------------
*/
const updateSortArrows = () => {
  ['nome', 'nota', 'plataforma', 'zerado'].forEach(col => {
    const arrow = document.getElementById(`arrow-${col}`);
    if (!arrow) return;
    arrow.textContent = sortState.column === col
      ? (sortState.direction === 'asc' ? ' ↑' : ' ↓')
      : '';
  });
}

document.getElementById('searchInput').addEventListener('input', renderTable);
document.getElementById('filterPlatform').addEventListener('change', renderTable);
document.getElementById('filterZerado').addEventListener('change', renderTable);
