'use strict';

// Shared launcher UI; each release keeps its own HTML and game scripts.
(() => {
  const script = document.currentScript;
  const root = new URL('.', script.src);
  const id = script.dataset.version;
  const preference = 'vek-pokroku-selected-version';
  const releases = (window.VEK_RELEASES || []).slice().sort((a, b) => {
    const x = a.id.split('.').map(Number), y = b.id.split('.').map(Number);
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
  });
  const releaseURL = version => new URL('versions/' + version + '/index.html', root).href;
  if (!id) {
    let saved;
    try { saved = localStorage.getItem(preference); } catch (_) { }
    const chosen = releases.find(r => r.id === saved) || releases[0];
    if (chosen) location.replace(releaseURL(chosen.id));
    else document.querySelector('p').textContent = 'Zatím není dostupná žádná verze hry.';
    return;
  }

  // Keep the pre-versioning save and lobby bindings for 1.0.1.
  const legacy = id === '1.0.1';
  window.VEK_RELEASE = Object.freeze({
    id,
    saveKey: legacy ? 'vek-pokroku-save-1' : 'vek-pokroku-save-' + id,
    cloudDoc: legacy ? 'save' : 'save-' + id,
    lobbyKey: legacy ? 'vek-net' : 'vek-net-' + id,
    channel: legacy ? 'vek-pokroku-net' : 'vek-pokroku-net-' + id,
  });
  const registered = releases.some(r => r.id === id);
  if (registered) try { localStorage.setItem(preference, id); } catch (_) { }
  const name = id === 'development' ? 'Vývojová verze' : 'Verze ' + id;
  document.title = 'Věk pokroku · ' + name.toLowerCase();
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('version-picker.css', root).href;
  document.head.appendChild(css);

  function picker(selectId) {
    const section = document.createElement('section'); section.className = 'version-picker';
    const label = document.createElement('label'); label.htmlFor = selectId; label.textContent = 'Verze hry';
    const select = document.createElement('select'); select.id = selectId;
    select.setAttribute('aria-describedby', selectId + '-note');
    if (!registered) select.add(new Option(name, id));
    for (const [i, release] of releases.entries()) {
      select.add(new Option(release.id + (i === 0 ? ' · nejnovější' : ''), release.id));
    }
    select.value = id;
    const note = document.createElement('p'); note.className = 'hint'; note.id = selectId + '-note';
    const describe = () => {
      const release = releases.find(r => r.id === select.value);
      note.textContent = release ? release.description : 'Zde se zkouší změny pro příští vydání.';
    };
    select.addEventListener('change', describe); describe();
    section.append(label, select, note);
    return { section, select };
  }

  const menu = picker('game-version');
  const explanation = document.createElement('p'); explanation.className = 'hint';
  explanation.textContent = 'Vyber si vydání, které chceš hrát. Každá verze má vlastní uloženou hru; starší vydání zůstávají dostupná.';
  menu.section.appendChild(explanation);
  document.querySelector('#start .lead').after(menu.section);
  menu.select.addEventListener('change', () => {
    if (releases.some(r => r.id === menu.select.value)) location.assign(releaseURL(menu.select.value));
  });

  const button = document.createElement('button'); button.type = 'button'; button.className = 'tbtn';
  button.id = 'b-version'; button.textContent = name; button.title = 'Vybrat jinou verzi hry';
  document.getElementById('tools').appendChild(button);

  const dialog = document.createElement('dialog'); dialog.className = 'version-dialog';
  dialog.id = 'version-dialog'; dialog.setAttribute('aria-labelledby', 'version-dialog-title');
  const heading = document.createElement('h2'); heading.id = 'version-dialog-title'; heading.textContent = 'Změnit verzi';
  const choice = picker('switch-version');
  const warning = document.createElement('p'); warning.className = 'hint'; warning.setAttribute('role', 'status');
  const actions = document.createElement('div'); actions.className = 'row';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'pick'; cancel.textContent = 'Zpět do hry';
  const change = document.createElement('button'); change.type = 'button'; change.className = 'pick on'; change.textContent = 'Přepnout verzi'; change.disabled = true;
  actions.append(cancel, change); dialog.append(heading, choice.section, warning, actions); document.body.appendChild(dialog);
  let pausedBefore = false, active = false, allowUnsaved = false;
  button.onclick = () => {
    const game = window.GAME && window.GAME.G;
    active = !!(game && document.getElementById('start').hidden && !game.over);
    pausedBefore = game ? game.paused : false;
    if (active && game.mode === 'ai') game.paused = true;
    warning.textContent = active && game.mode !== 'ai'
      ? 'Přepnutí tě odpojí od soupeře. Hru po síti nelze uložit. Oba hráči musí mít stejnou verzi.'
      : 'Před přepnutím uložíme rozehranou hru pro jednoho hráče. V jiné verzi pokračuješ v jejím vlastním uložení.';
    choice.select.value = id; choice.select.dispatchEvent(new Event('change'));
    dialog.showModal(); choice.select.focus();
  };
  choice.select.addEventListener('change', () => {
    allowUnsaved = false; change.textContent = 'Přepnout verzi';
    change.disabled = choice.select.value === id;
  });
  cancel.onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    const game = window.GAME && window.GAME.G;
    if (active && game && game.mode === 'ai') game.paused = pausedBefore;
    button.focus();
  });
  change.onclick = () => {
    const target = choice.select.value;
    if (target === id || !releases.some(r => r.id === target)) return;
    const game = window.GAME && window.GAME.G;
    if (active && game.mode === 'ai' && !allowUnsaved) {
      const since = Date.now();
      window.doSave(true);
      // A queued cloud write alone may not finish before navigation.
      let savedLocally = false;
      try {
        const saved = JSON.parse(localStorage.getItem(VEK_RELEASE.saveKey));
        savedLocally = saved && saved.gameVersion === id && saved.saved >= since;
      } catch (_) { }
      if (!savedLocally) {
        warning.textContent = 'Hru se nepodařilo uložit do tohoto prohlížeče. Vrať se do hry a stáhni ji tlačítkem Soubor, nebo přepni bez uložení.';
        change.textContent = 'Přepnout bez uložení'; allowUnsaved = true; return;
      }
    }
    location.assign(releaseURL(target));
  };
})();
