// Contentful Autofill – content script (v0.7.3)
const SELECTORS = {
  // Peacock Path selectors
  id: '[data-field-id="id"] input[type="text"]',
  gameTitle: '[data-field-id="gameTitle"] input[type="text"]',
  dataJsonEditable: '[data-field-id="data"] [data-test-id="json-editor-code-mirror"] [contenteditable="true"]',
  
  // Lil Snack Day selectors
  lilSnackId: '[data-field-id="id"] input[type="text"]',
  dayNum: '[data-field-id="dayNum"] input[type="text"]',
  title: '[data-field-id="title"] input[type="text"]',
  winEmoji: '[data-field-id="winEmoji"] input[type="text"]',
  date: '[data-field-id="date"] input[type="text"]',
  dateInput: '[aria-label="Enter date"]',
  shareCoinType: '[data-field-id="shareCoinType"]',
  
  // Swap selectors
  swapId: '[data-field-id="id"] input[type="text"]',
  swapGameTitle: '#field-gameTitle-en-US, [data-field-id="gameTitle"] input[type="text"]',
  swapGameDescription: '[data-field-id="gameDescription"] textarea, [data-field-id="gameDescription"] input[type="text"]',
  swapJsonEditable: '[data-test-id="json-editor-code-mirror"] .cm-content[contenteditable="true"]',
  
  // Common selectors
  fieldById: fid => `[data-field-id="${fid}"]`,
  trgAddMedia: '[data-test-id="link-actions-menu-trigger"]',
  trgAddContent: '[data-test-id="create-entry-link-button"]',
  trgCardActions: '[data-test-id="cf-ui-card-actions"]',
  trgAnyMenu: '[aria-haspopup="menu"]',
  dropdownRoot: '[role="menu"], [data-test-id="dropdown"], [data-test-id="cf-ui-dropdown"]',
  dropdownAddNewMedia: '[data-test-id="linkEditor.createAndLink"]',
  modalRoot: '[role="dialog"]',
  modalOpenFileBtn: '[data-test-id="file-editor-select"]',
  modalFileInput: 'input[type="file"]',
  modalCloseBtn: 'button[aria-label="Close"], [data-test-id="dialog-close"], [aria-label="Close dialog"]',
  anyButton: 'button, [role="button"]',
  goBackBtn: 'button[aria-label="Go back"]',
};

(function init() {
  if (!/app\.contentful\.com\/.*\/entries\//.test(location.href)) return;
  if (top === window && document.getElementById('cf-autofill-launcher')) return;

  if (top === window) {
    const launcher = document.createElement('button');
    launcher.id = 'cf-autofill-launcher';
    launcher.title = 'Open Contentful Autofill';
    launcher.textContent = 'LS';
    document.body.appendChild(launcher);

    const panel = document.createElement('div');
    panel.id = 'cf-autofill-panel';
    panel.innerHTML = `
      <div class="cfaf-header" id="cfaf-drag">
        <span><strong>Contentful Autofill</strong></span>
        <div class="cfaf-header-actions">
          <button id="cfaf-minimize" title="Hide">×</button>
        </div>
      </div>
      <div class="cfaf-body">
        <div class="cfaf-row">
          <label style="font-size: 12px; display: flex; flex-direction: column; gap: 4px; flex: 1;">
            <span><strong>Workflow:</strong></span>
            <select id="cfaf-workflow" style="padding: 6px; border-radius: 6px; border: 1px solid #dadde2;">
              <option value="peacock-path">Peacock Path</option>
              <option value="lil-snack-day">Lil Snack Day</option>
              <option value="swap">Swap</option>
            </select>
          </label>
        </div>
        <div class="cfaf-row">
          <button id="cfaf-pick-folder">Pick Folder</button>
          <button id="cfaf-pick-batch">Pick Multiple Folders</button>
        </div>
        <div class="cfaf-row">
          <button id="cfaf-dry-run" disabled>Dry-run</button>
          <button id="cfaf-fill" disabled>Fill fields</button>
        </div>
        <div class="cfaf-row">
          <label class="cfaf-chk"><input type="checkbox" id="cfaf-set-json"> Also set JSON</label>
        </div>
        <div class="cfaf-row">
          <button id="cfaf-fill-upload" disabled>Fill + Upload</button>
          <button id="cfaf-batch-upload" disabled>Batch Upload All</button>
        </div>
        <div class="cfaf-row">
          <button id="cfaf-cancel" disabled>Cancel</button>
        </div>
        <div id="cfaf-status" class="cfaf-status">Ready.</div>
        <div id="cfaf-plan" class="cfaf-plan"></div>
      </div>
    `;
    document.body.appendChild(panel);

    const pos = JSON.parse(localStorage.getItem('cfaf_pos') || 'null');
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      panel.style.left = pos.x + 'px';
      panel.style.top = pos.y + 'px';
      panel.classList.add('cfaf-placed');
    }
    function showPanel() { panel.style.display = 'block'; launcher.style.display = 'none'; }
    function hidePanel() { panel.style.display = 'none'; launcher.style.display = 'block'; }
    launcher.addEventListener('click', showPanel);
    panel.querySelector('#cfaf-minimize').addEventListener('click', hidePanel);

    (function makeDraggable() {
      const drag = panel.querySelector('#cfaf-drag');
      let startX=0,startY=0,originLeft=0,originTop=0,dragging=false;
      drag.addEventListener('mousedown', (e) => {
        dragging=true; panel.classList.add('cfaf-placed');
        startX=e.clientX; startY=e.clientY; const r=panel.getBoundingClientRect();
        originLeft=r.left; originTop=r.top;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp, { once: true });
        e.preventDefault();
      });
      function onMove(e){ if(!dragging) return; panel.style.left=(originLeft+e.clientX-startX)+'px'; panel.style.top=(originTop+e.clientY-startY)+'px'; }
      function onUp(){ dragging=false; document.removeEventListener('mousemove', onMove);
        const r=panel.getBoundingClientRect(); localStorage.setItem('cfaf_pos', JSON.stringify({x:r.left,y:r.top})); }
    })();

    const state = { 
      dirHandle: null, 
      plan: null, 
      jsonData: null, 
      abortController: null, 
      workflow: 'peacock-path',
      batchFolders: [],
      batchPlans: [],
      batchErrors: []
    };
    const $ = sel => document.querySelector(sel);
    const statusEl = $('#cfaf-status');
    const planEl = $('#cfaf-plan');

    const workflowSelect = $('#cfaf-workflow');
    const btnPick = $('#cfaf-pick-folder');
    const btnPickBatch = $('#cfaf-pick-batch');
    const btnDry = $('#cfaf-dry-run');
    const btnFill = $('#cfaf-fill');
    const btnFillUpload = $('#cfaf-fill-upload');
    const btnBatchUpload = $('#cfaf-batch-upload');
    const btnCancel = $('#cfaf-cancel');
    const chkJson = $('#cfaf-set-json');

    workflowSelect.addEventListener('change', () => {
      state.workflow = workflowSelect.value;
      state.plan = null;
      state.jsonData = null;
      planEl.innerHTML = '';
      btnDry.disabled = true;
      btnFill.disabled = true;
      btnFillUpload.disabled = true;
      const workflowNames = {'peacock-path': 'Peacock Path', 'lil-snack-day': 'Lil Snack Day', 'swap': 'Swap'};
      status(`Workflow changed to: ${workflowNames[workflowSelect.value] || workflowSelect.value}`);
    });

    btnPick.addEventListener('click', pickFolder);
    btnPickBatch.addEventListener('click', pickBatchFolders);
    btnDry.addEventListener('click', dryRun);
    btnFill.addEventListener('click', () => fillFields(state.plan, { setJson: chkJson.checked }));
    btnFillUpload.addEventListener('click', async () => {
      try {
        state.abortController = new AbortController();
        btnFillUpload.disabled = true;
        btnCancel.disabled = false;
        await fillFields(state.plan, { setJson: chkJson.checked });
        await uploadAllAssets(state.plan);
      } catch (e) {
        if (e.name === 'AbortError') {
          status('Upload cancelled.');
        } else {
          status('Upload failed: ' + (e?.message || e));
          console.error(e);
        }
      } finally {
        btnFillUpload.disabled = false;
        btnCancel.disabled = true;
        state.abortController = null;
      }
    });
    btnBatchUpload.addEventListener('click', batchUploadAll);
    btnCancel.addEventListener('click', () => {
      if (state.abortController) {
        state.abortController.abort();
        status('Cancelling...');
      }
    });

    function status(msg){ statusEl.textContent = msg; }
    function h(html){ const d=document.createElement('div'); d.innerHTML=html; return d.firstElementChild; }
    function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    async function pickFolder() {
      try {
        status('Opening folder picker…');
        if (!window.showDirectoryPicker) throw new Error('showDirectoryPicker not supported.');
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        state.dirHandle = handle;
        window._cfaf_dirHandle = handle;
        const plan = state.workflow === 'lil-snack-day' 
          ? await buildLilSnackDayPlan(handle)
          : state.workflow === 'swap'
          ? await buildSwapPlan(handle)
          : await buildPlanFromFolder(handle);
        state.plan = plan; state.jsonData = plan.jsonParsed;
        renderPlan(plan);
        status('Folder parsed. Ready.');
        btnDry.disabled = false; btnFill.disabled = false; btnFillUpload.disabled = false;
      } catch (e) { status('Folder pick failed: ' + (e?.message || e)); console.error(e); }
    }

    async function pickBatchFolders() {
      try {
        status('Opening folder picker for parent directory…');
        if (!window.showDirectoryPicker) throw new Error('showDirectoryPicker not supported.');
        
        // Ask user to select parent folder containing all the subfolders
        const parentHandle = await window.showDirectoryPicker({ mode: 'read' });
        
        // Collect all subdirectories
        const folders = [];
        for await (const [name, handle] of parentHandle.entries()) {
          if (handle.kind === 'directory') {
            folders.push({ name, handle });
          }
        }
        
        if (folders.length === 0) {
          status('No subfolders found in selected directory.');
          return;
        }
        
        // Sort folders by name
        folders.sort((a, b) => a.name.localeCompare(b.name));

        const swapTitles = state.workflow === 'swap'
          ? await readSwapTitles(parentHandle)
          : [];
        
        status(`Found ${folders.length} folder(s). Building plans…`);
        
        // Build plans for all folders
        state.batchFolders = folders;
        state.batchPlans = [];
        state.batchErrors = [];
        
        for (let i = 0; i < folders.length; i++) {
          const folder = folders[i];
          try {
            const plan = state.workflow === 'lil-snack-day' 
              ? await buildLilSnackDayPlan(folder.handle)
              : state.workflow === 'swap'
              ? await buildSwapPlan(folder.handle)
              : await buildPlanFromFolder(folder.handle);

            if (plan.workflow === 'swap' && swapTitles.length > 0) {
              const titleFromList = swapTitles[i];
              if (titleFromList) {
                plan.gameTitle = titleFromList;
              }
            }
            plan.dirHandle = folder.handle; // Store handle with plan
            state.batchPlans.push(plan);
          } catch (e) {
            console.error(`Error building plan for ${folder.name}:`, e);
            state.batchErrors.push(`Plan error for ${folder.name}: ${e?.message || e}`);
          }
        }
        
        renderBatchPlan(state.batchPlans);
        status(`Batch ready: ${state.batchPlans.length} folder(s) queued.`);
        btnBatchUpload.disabled = false;
        
      } catch (e) { 
        status('Batch folder pick failed: ' + (e?.message || e)); 
        console.error(e); 
      }
    }

    function renderBatchPlan(plans) {
      planEl.innerHTML = '';
      const list = document.createElement('div');
      list.className = 'cfaf-list';
      
      list.appendChild(h(`<div><strong>Batch Upload Queue (${plans.length} folders):</strong></div>`));
      
      plans.forEach((plan, idx) => {
        const displayName = plan.workflow === 'swap' && plan.gameTitle
          ? plan.gameTitle
          : (plan.folderName || plan.entryId || `Folder ${idx + 1}`);
        list.appendChild(h(`<div>${idx + 1}. <code>${escapeHtml(displayName)}</code></div>`));
      });
      
      if (state.batchErrors.length > 0) {
        list.appendChild(h(`<div style="color: orange; margin-top: 10px;"><strong>Errors during plan building:</strong></div>`));
        state.batchErrors.forEach(err => {
          list.appendChild(h(`<div style="color: orange; font-size: 11px;">⚠ ${escapeHtml(err)}</div>`));
        });
      }
      
      planEl.appendChild(list);
    }

    async function readSwapTitles(parentHandle) {
      try {
        const fileHandle = await findSwapTitlesFile(parentHandle);
        if (!fileHandle) return [];
        const file = await fileHandle.getFile();
        const text = await file.text();
        return text
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 0);
      } catch (e) {
        console.warn('[Autofill] Failed to read Swap Titles file:', e);
        return [];
      }
    }

    async function findSwapTitlesFile(parentHandle) {
      for await (const [name, handle] of parentHandle.entries()) {
        if (handle.kind !== 'file') continue;
        if (/^Swap Titles(\.txt)?$/i.test(name)) {
          return handle;
        }
      }
      return null;
    }

    async function dryRun() {
      if (!state.plan) return;
      const checks = validateAgainstPage(state.plan);
      renderChecks(checks);
      status(checks.ok ? 'Dry-run OK.' : 'Dry-run found issues.');
    }

    function renderPlan(plan) {
      planEl.innerHTML='';
      const list=document.createElement('div'); list.className='cfaf-list';
      
      if (plan.workflow === 'lil-snack-day') {
        list.appendChild(h(`<div><b>Folder</b>: <code>${escapeHtml(plan.folderName || '(none)')}</code></div>`));
        list.appendChild(h(`<div><b>Field ID</b>: <code>${escapeHtml(plan.fieldId || '(missing)')}</code></div>`));
        list.appendChild(h(`<div><b>Title</b>: <code>${escapeHtml(plan.title || '(missing)')}</code></div>`));
        list.appendChild(h(`<div><b>Day Number</b>: <code>${escapeHtml(String(plan.dayNum))}</code></div>`));
        list.appendChild(h(`<div><b>Date</b>: <code>${escapeHtml(plan.dateStr || '(missing)')}</code></div>`));
        list.appendChild(h(`<div><b>Date Input</b>: <code>${escapeHtml(plan.dateInputStr || '(missing)')}</code></div>`));
        list.appendChild(h(`<div><b>Win Emoji</b>: ${escapeHtml(plan.winEmoji)}</div>`));
        list.appendChild(h(`<div><b>Puzzle</b>: <code>${escapeHtml(plan.puzzleFile || '(not found)')}</code></div>`));
        list.appendChild(h(`<div><b>Game Files</b>: ${plan.gameFiles.length ? plan.gameFiles.map(g=>`<code>${escapeHtml(g.name)}</code>`).join(', ') : '(none)'}</div>`));
        list.appendChild(h(`<div><b>Bonus Files</b>: ${plan.bonusFiles.length ? plan.bonusFiles.map(b=>`<code>${escapeHtml(b.name)}</code>`).join(', ') : '(none)'}</div>`));
      } else if (plan.workflow === 'swap') {
        list.appendChild(h(`<div><b>Swap ID</b>: <code>${escapeHtml(plan.swapId || '(none)')}</code></div>`));
        list.appendChild(h(`<div><b>Game Title</b>: <code>${escapeHtml(plan.gameTitle || '(missing)')}</code></div>`));
        list.appendChild(h(`<div><b>Game Description</b>: <code>${escapeHtml(plan.gameDescription)}</code></div>`));
        list.appendChild(h(`<div><b>Puzzle</b>: <code>${escapeHtml(plan.puzzleFile || '(not found)')}</code></div>`));
        list.appendChild(h(`<div><b>Emojis</b>: ${plan.emojis.length ? plan.emojis.map(e=>`<code>${escapeHtml(e.name)}</code>`).join(', ') : '(none)'}</div>`));
        list.appendChild(h(`<div><b>JSON Rebuses</b>: ${plan.jsonData.rebuses.length}</div>`));
      } else {
        list.appendChild(h(`<div><b>Entry ID</b>: <code>${escapeHtml(plan.entryId || '(none)')}</code></div>`));
        list.appendChild(h(`<div><b>JSON file</b>: <code>${escapeHtml(plan.jsonFile || '(not found)')}</code> (clue → <code>${escapeHtml(plan.gameTitle || '(missing)')}</code>)</div>`));
        list.appendChild(h(`<div><b>Puzzle</b>: <code>${escapeHtml(plan.puzzleFile || '(not found)')}</code></div>`));
        list.appendChild(h(`<div><b>Emojis</b>: ${plan.emojis.length ? plan.emojis.map(e=>`<code>${escapeHtml(e.name)}</code>`).join(', ') : '(none)'}</div>`));
      }
      
      planEl.appendChild(list);
    }

    function renderChecks(checks) {
      const notes=document.createElement('div'); notes.className='cfaf-notes';
      notes.innerHTML = checks.notes.length ? '<ul>'+checks.notes.map(n=>`<li>${escapeHtml(n)}</li>`).join('')+'</ul>' : 'No issues detected.';
      planEl.appendChild(notes);
    }

    async function buildPlanFromFolder(dirHandle){
      const entryId = dirHandle.name;
      const files = []
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind !== 'file') continue;
        files.push({ name, handle });
      }
      const json = files.find(f => /_json\.json$/i.test(f.name));
      const puzzle = files.find(f => /_puzzle\.tmj$/i.test(f.name));
      const emojis = files.filter(f => {
        const match = f.name.match(/_emoji(\d+)\.(png|jpg|jpeg|gif|webp)$/i);
        // Accept if filename matches pattern, don't require handle.type check
        return !!match;
      }).sort((a,b)=> (parseInt(a.name.match(/_emoji(\d+)/i)?.[1]||'0',10) - parseInt(b.name.match(/_emoji(\d+)/i)?.[1]||'0',10)));

      let jsonParsed=null, gameTitle=null;
      if (json) {
        try { const file=await json.handle.getFile(); const text=await file.text(); jsonParsed=JSON.parse(text); if (typeof jsonParsed.clue==='string') gameTitle=jsonParsed.clue; }
        catch(e){ console.warn('JSON parse failed', e); }
      }

      return { entryId, jsonFile: json?.name || null, puzzleFile: puzzle?.name || null, emojis: emojis.map(e=>({name:e.name, handle:e.handle})), jsonParsed, gameTitle };
    }

    async function buildLilSnackDayPlan(dirHandle){
      const folderName = dirHandle.name;
      
      // Parse date and title from folder name
      // Expected formats: 2025_12_12_TEST, 2025-12-12-TEST, Dec_12_2025_TEST, etc.
      let parsedDate = null;
      let title = '';
      
      // Try YYYY_MM_DD_TITLE format
      let match = folderName.match(/(\d{4})[_-](\d{1,2})[_-](\d{1,2})[_-](.+)/);
      if (match) {
        const [, year, month, day, rest] = match;
        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        title = rest;
      } else {
        // Try Mon_DD_YYYY_TITLE or similar
        match = folderName.match(/([A-Za-z]+)[_-](\d{1,2})[_-](\d{4})[_-](.+)/);
        if (match) {
          const [, monthStr, day, year, rest] = match;
          const monthMap = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
          const monthNum = monthMap[monthStr.toLowerCase().substring(0,3)];
          if (monthNum !== undefined) {
            parsedDate = new Date(parseInt(year), monthNum, parseInt(day));
            title = rest;
          }
        }
      }
      
      // If we couldn't parse date, try to extract just the last part as title
      if (!title) {
        const parts = folderName.split(/[_-]/);
        title = parts[parts.length - 1];
      }
      
      // Calculate day number (days since Feb 25, 2024)
      const baseDate = new Date(2024, 1, 25); // Feb 25, 2024
      const dayNum = parsedDate ? Math.floor((parsedDate - baseDate) / (1000 * 60 * 60 * 24)) : 0;
      
      // Format date string: "Dec 12"
      const dateStr = parsedDate ? parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      
      // Format date input: "12 Dec 2025"
      const dateInputStr = parsedDate ? `${parsedDate.getDate()} ${parsedDate.toLocaleDateString('en-US', { month: 'short' })} ${parsedDate.getFullYear()}` : '';
      
      // Field ID: home_day_[FOLDER_NAME]
      const fieldId = `home_day_${folderName}`;
      
      // Collect files
      const files = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind !== 'file') continue;
        files.push({ name, handle });
      }
      
      // Find puzzle file
      const puzzle = files.find(f => /_puzzle\.tmj$/i.test(f.name));
      
      // Find image files (we'll implement upload logic later)
      const bannerDay = files.find(f => /banner.*day|day.*banner/i.test(f.name) && /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name));
      const thumbnail = files.find(f => /thumbnail.*day|day.*thumbnail/i.test(f.name) && !/small/i.test(f.name) && /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name));
      const thumbnailSmall = files.find(f => /thumbnail_small.*day|day.*thumbnail_small/i.test(f.name) && /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name));
      
      // Find game files
      // Patterns: home_path_*_puzzle.tmj, home_swap_*_puzzle.cfp, home_prompt_*_image.jpg, home_stack_*_emoji_a.png, home_quote_*.png
      const gameFiles = files.filter(f => {
        const name = f.name;
        if (/bonus/i.test(name)) return false;
        return (/home_path_.*_puzzle\.tmj$/i.test(name) || 
                /home_swap_.*_puzzle\.cfp$/i.test(name) || 
                /home_prompt_.*_image\.(jpg|jpeg|png|webp)$/i.test(name) ||
                /home_stack_.*_emoji_a\.(png|webp)$/i.test(name) ||
                /home_quote_.*\.(png|jpg|jpeg|webp)$/i.test(name));
      });
      
      const bonusFiles = files.filter(f => {
        const name = f.name;
        if (!/bonus/i.test(name)) return false;
        // Match bonus files that contain a game type keyword
        return (/bonus.*path/i.test(name) && /\.tmj$/i.test(name)) ||
               (/bonus.*swap/i.test(name) && /\.cfp$/i.test(name)) ||
               (/bonus.*prompt/i.test(name) && /\.(puz|jpg|jpeg|png|webp)$/i.test(name)) ||
               (/bonus.*stack/i.test(name) && /\.(png|webp)$/i.test(name)) ||
               (/bonus.*quote/i.test(name) && /\.(png|jpg|jpeg|webp)$/i.test(name)) ||
               (/bonus.*litebrite/i.test(name) && /\.tmj$/i.test(name));
      });
      
      return {
        workflow: 'lil-snack-day',
        folderName,
        fieldId,
        dayNum,
        title,
        dateStr,
        dateInputStr,
        parsedDate,
        winEmoji: '🏆',
        puzzleFile: puzzle?.name || null,
        bannerDay: bannerDay?.name || null,
        thumbnail: thumbnail?.name || null,
        thumbnailSmall: thumbnailSmall?.name || null,
        gameFiles: gameFiles.map(f => ({ name: f.name, handle: f.handle })),
        bonusFiles: bonusFiles.map(f => ({ name: f.name, handle: f.handle }))
      };
    }

    async function buildSwapPlan(dirHandle){
      const swapId = dirHandle.name;
      console.log('[Autofill] buildSwapPlan - Folder name:', swapId);
      const files = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind !== 'file') continue;
        files.push({ name, handle });
      }
      
      console.log('[Autofill] buildSwapPlan - All files:', files.map(f => f.name));
      
      // Find .puz file
      const puzzle = files.find(f => /\.puz$/i.test(f.name));
      console.log('[Autofill] buildSwapPlan - Puzzle file:', puzzle?.name || 'NOT FOUND');
      
      // Find emojis (same pattern as peacock path)
      const emojis = files.filter(f => {
        const match = f.name.match(/_emoji(\d+)\.(png|jpg|jpeg|gif|webp)$/i);
        return !!match;
      }).sort((a,b)=> (parseInt(a.name.match(/_emoji(\d+)/i)?.[1]||'0',10) - parseInt(b.name.match(/_emoji(\d+)/i)?.[1]||'0',10)));
      
      console.log('[Autofill] buildSwapPlan - Emoji files:', emojis.map(e => e.name));
      
      // Extract game title from puzzle filename
      let gameTitle = '';
      if (puzzle) {
        console.log('[Autofill] buildSwapPlan - Attempting to parse title from:', puzzle.name);
        // Try multiple patterns
        // Pattern 1: home_swap_cool_guys_puzzle.puz
        let match = puzzle.name.match(/home_swap_(.+)_puzzle\.puz$/i);
        if (match) {
          console.log('[Autofill] buildSwapPlan - Matched pattern 1 (home_swap_X_puzzle.puz):', match[1]);
          gameTitle = match[1]
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        } else {
          // Pattern 2: try just getting everything before .puz and after last underscore
          match = puzzle.name.match(/_(\w+)\.puz$/i);
          if (match) {
            console.log('[Autofill] buildSwapPlan - Matched pattern 2 (last word before .puz):', match[1]);
            gameTitle = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
          } else {
            // Pattern 3: Just remove .puz and capitalize
            const baseName = puzzle.name.replace(/\.puz$/i, '');
            console.log('[Autofill] buildSwapPlan - No pattern matched, using base name:', baseName);
            gameTitle = baseName
              .split(/[_-]/)
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
          }
        }
      }
      
      console.log('[Autofill] buildSwapPlan - Extracted game title:', gameTitle);
      
      // Build JSON based on emoji count
      const jsonData = {
        "creator": "Lil Snack",
        "rebuses": [
          {
            "hintIndex": 1,
            "replaceLetter": "@"
          }
        ],
        "bonusSwapsAdd": 2,
        "countdownTime": 240,
        "randomizeSeed": 0,
        "autoCleanStart": true,
        "allowedSwapsAdd": 2
      };
      
      // Add second rebus if there are 2 emojis
      if (emojis.length >= 2) {
        jsonData.rebuses.push({
          "hintIndex": 2,
          "replaceLetter": "#"
        });
      }
      
      console.log('[Autofill] buildSwapPlan - Final plan:', { swapId, gameTitle, emojiCount: emojis.length, rebuseCount: jsonData.rebuses.length });
      
      return {
        workflow: 'swap',
        swapId,
        gameTitle,
        gameDescription: 'Drag the letters to solve each clue.',
        puzzleFile: puzzle?.name || null,
        emojis: emojis.map(e => ({ name: e.name, handle: e.handle })),
        jsonData
      };
    }

    function validateAgainstPage(plan){
      const notes=[];
      
      if (plan.workflow === 'lil-snack-day') {
        if (!document.querySelector(SELECTORS.lilSnackId)) notes.push('ID input not found.');
        if (!document.querySelector(SELECTORS.dayNum)) notes.push('Day Number input not found.');
        if (!document.querySelector(SELECTORS.title)) notes.push('Title input not found.');
        if (!document.querySelector(SELECTORS.winEmoji)) notes.push('Win Emoji input not found.');
        if (!document.querySelector(SELECTORS.date)) notes.push('Date input not found.');
        if (!plan.fieldId) notes.push('Field ID missing.');
        if (!plan.title) notes.push('Title could not be extracted from folder name.');
        if (!plan.parsedDate) notes.push('Date could not be parsed from folder name.');
      } else if (plan.workflow === 'swap') {
        if (!document.querySelector(SELECTORS.swapId)) notes.push('ID input not found.');
        if (!document.querySelector(SELECTORS.swapGameTitle)) notes.push('Game Title input not found.');
        if (!document.querySelector(SELECTORS.swapGameDescription)) notes.push('Game Description input not found.');
        if (!plan.swapId) notes.push('Swap ID missing.');
        if (!plan.gameTitle) notes.push('Game title could not be extracted from puzzle filename.');
        if (!plan.puzzleFile) notes.push('Puzzle (.puz) file not found.');
      } else {
        if (!document.querySelector(SELECTORS.id)) notes.push('ID input not found.');
        if (!document.querySelector(SELECTORS.gameTitle)) notes.push('gameTitle input not found.');
        if (!plan.entryId) notes.push('Entry ID missing.');
        if (!plan.gameTitle) notes.push('JSON did not include "clue".');
      }
      
      return { ok: notes.length===0, notes };
    }

    async function fillFields(plan, opts={}){
      if (!plan) { status('Pick a folder first.'); return; }
      try {
        if (plan.workflow === 'lil-snack-day') {
          // Fill Lil Snack Day fields
          setInputValue(SELECTORS.lilSnackId, plan.fieldId);
          setInputValue(SELECTORS.dayNum, String(plan.dayNum));
          setInputValue(SELECTORS.title, plan.title);
          setInputValue(SELECTORS.winEmoji, plan.winEmoji);
          setInputValue(SELECTORS.date, plan.dateStr);
          
          // Try to fill date input with aria-label
          const dateInput = document.querySelector(SELECTORS.dateInput);
          if (dateInput) {
            setInputValue(SELECTORS.dateInput, plan.dateInputStr);
          }
          
          // Set shareCoinType to winCoins
          const shareCoinTypeField = document.querySelector(SELECTORS.shareCoinType);
          if (shareCoinTypeField) {
            const select = shareCoinTypeField.querySelector('select');
            if (select) {
              select.value = 'winCoins';
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          
          status('Lil Snack Day fields filled.');
        } else if (plan.workflow === 'swap') {
          // Fill Swap fields with delays and verification
          console.log('[Autofill] Starting swap field filling');
          console.log('[Autofill] Plan data:', { swapId: plan.swapId, gameTitle: plan.gameTitle, gameDescription: plan.gameDescription });
          
          // Fill ID
          console.log('[Autofill] Step 1: Filling swap ID:', plan.swapId);
          setInputValue(SELECTORS.swapId, plan.swapId);
          await new Promise(r => setTimeout(r, 500));
          
          // Fill Game Title - try multiple approaches
          console.log('[Autofill] Step 2: Filling swap game title:', plan.gameTitle);
          let titleInput = document.querySelector('#field-gameTitle-en-US');
          if (!titleInput) titleInput = document.querySelector('[data-field-id="gameTitle"] input[type="text"]');
          if (!titleInput) titleInput = document.querySelector('input[id*="gameTitle"]');
          
          if (!titleInput) {
            console.error('[Autofill] Game title input not found. Available inputs:', 
              Array.from(document.querySelectorAll('input[type="text"]')).map(i => ({ id: i.id, dataFieldId: i.closest('[data-field-id]')?.getAttribute('data-field-id') })));
            throw new Error('Game title input not found on page');
          }
          
          console.log('[Autofill] Found title input:', titleInput);
          titleInput.scrollIntoView({ block: 'center' });
          await new Promise(r => setTimeout(r, 200));
          titleInput.focus();
          titleInput.value = plan.gameTitle;
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[Autofill] Title set to:', titleInput.value);
          await new Promise(r => setTimeout(r, 500));
          
          // Fill Game Description
          console.log('[Autofill] Step 3: Filling swap game description:', plan.gameDescription);
          const descInput = document.querySelector(SELECTORS.swapGameDescription);
          if (!descInput) {
            console.error('[Autofill] Game description input not found');
            throw new Error('Game description input not found on page');
          }
          descInput.scrollIntoView({ block: 'center' });
          await new Promise(r => setTimeout(r, 200));
          descInput.focus();
          descInput.value = plan.gameDescription;
          descInput.dispatchEvent(new Event('input', { bubbles: true }));
          descInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[Autofill] Description set to:', descInput.value);
          await new Promise(r => setTimeout(r, 500));
          
          // Fill JSON field
          console.log('[Autofill] Step 4: Filling JSON field');
          console.log('[Autofill] Searching for JSON editor with selector:', SELECTORS.swapJsonEditable);
          
          let jsonTarget = document.querySelector(SELECTORS.swapJsonEditable);
          
          if (!jsonTarget) {
            console.log('[Autofill] Primary selector failed, trying alternatives...');
            
            // Log what we can find
            const jsonFieldContainer = document.querySelector('[data-field-id="json"]');
            console.log('[Autofill] JSON field container found:', !!jsonFieldContainer);
            
            if (jsonFieldContainer) {
              console.log('[Autofill] JSON field container HTML:', jsonFieldContainer.innerHTML.substring(0, 500));
              
              // Try various selectors
              jsonTarget = jsonFieldContainer.querySelector('.cm-content[contenteditable="true"]');
              if (!jsonTarget) jsonTarget = jsonFieldContainer.querySelector('[contenteditable="true"]');
              if (!jsonTarget) jsonTarget = jsonFieldContainer.querySelector('.cm-editor .cm-content');
              if (!jsonTarget) jsonTarget = jsonFieldContainer.querySelector('[data-test-id="json-editor-code-mirror"] [contenteditable]');
              
              console.log('[Autofill] Found JSON target with fallback:', !!jsonTarget);
            }
            
            if (!jsonTarget) {
              // Last resort - show what contenteditable elements exist
              const allEditables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
              console.log('[Autofill] All contenteditable elements on page:', allEditables.length);
              allEditables.forEach((el, idx) => {
                const fieldId = el.closest('[data-field-id]')?.getAttribute('data-field-id');
                console.log(`[Autofill] Editable ${idx}: fieldId=${fieldId}, classes=${el.className}`);
              });
              
              throw new Error('JSON editor not found on page');
            }
          }
          
          const text = JSON.stringify(plan.jsonData, null, 2);
          console.log('[Autofill] JSON target found, scrolling into view');
          jsonTarget.scrollIntoView({ block: 'center' });
          await new Promise(r => setTimeout(r, 300));
          console.log('[Autofill] Setting JSON content');
          setCodeMirrorEditable(jsonTarget, text);
          console.log('[Autofill] JSON set successfully');
          await new Promise(r => setTimeout(r, 500));
          
          console.log('[Autofill] All swap fields filled successfully');
          status('Swap fields filled.');
        } else {
          // Fill Peacock Path fields
          setInputValue(SELECTORS.id, plan.entryId);
          if (plan.gameTitle) setInputValue(SELECTORS.gameTitle, plan.gameTitle);
          if (opts.setJson && plan.jsonParsed) {
            const jsonTarget=document.querySelector(SELECTORS.dataJsonEditable);
            if (jsonTarget) {
              const text=JSON.stringify(plan.jsonParsed, null, 2);
              setCodeMirrorEditable(jsonTarget, text);
            } else {
              console.warn('JSON editor not found on page');
            }
          }
          status('Peacock Path fields filled.');
        }
      } catch (e) {
        status('Failed to fill fields: ' + (e?.message || e));
        throw e;
      }
    }

    function setInputValue(selector, value){
      console.log('[Autofill] setInputValue - selector:', selector, 'value:', value);
      const el=document.querySelector(selector);
      if(!el) {
        console.error('[Autofill] Element not found with selector:', selector);
        throw new Error('Element not found: '+selector);
      }
      console.log('[Autofill] Found element:', el.tagName, el.id, el.className);
      el.focus(); 
      el.value=value;
      el.dispatchEvent(new Event('input', { bubbles:true }));
      el.dispatchEvent(new Event('change', { bubbles:true }));
      console.log('[Autofill] Value set to:', el.value);
    }
    function setCodeMirrorEditable(editableEl, text){
      editableEl.focus();
      const sel=window.getSelection(); sel.removeAllRanges();
      const range=document.createRange(); range.selectNodeContents(editableEl); sel.addRange(range);
      document.execCommand('insertText', false, text);
      editableEl.dispatchEvent(new InputEvent('input', { bubbles:true }));
    }

    async function uploadAllAssets(plan){
      if (!plan) { status('Pick a folder first.'); return; }
      if (!state.dirHandle) { status('Folder handle lost. Please re-pick folder.'); return; }

      if (plan.workflow === 'lil-snack-day') {
        await uploadLilSnackDayAssets(plan);
      } else if (plan.workflow === 'swap') {
        // Swap workflow
        console.log('[Autofill] Starting swap asset uploads');
        console.log('[Autofill] Puzzle file:', plan.puzzleFile);
        console.log('[Autofill] Emojis:', plan.emojis.map(e => e.name));
        
        if (plan.puzzleFile) {
          const puzzleField = document.querySelector(SELECTORS.fieldById('puzzle'));
          console.log('[Autofill] Puzzle field exists:', !!puzzleField);
          if (puzzleField) {
            if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            console.log('[Autofill] Uploading puzzle:', plan.puzzleFile);
            await addAssetViaModal('puzzle', plan.puzzleFile);
            console.log('[Autofill] Puzzle uploaded successfully');
          } else {
            console.warn('[Autofill] Puzzle field not found on page');
            status('Puzzle field not found on page.');
          }
        } else {
          console.log('[Autofill] No puzzle file in plan');
          status('No puzzle file found; skipping.');
        }

        console.log('[Autofill] Starting emoji uploads, count:', plan.emojis.length);
        for (let i=0; i<plan.emojis.length; i++) {
          if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const idx = i + 1;
          const fid = `hintImage${idx}`;
          const file = plan.emojis[i].name;
          console.log(`[Autofill] Uploading emoji ${idx}:`, file);
          const emojiField = document.querySelector(SELECTORS.fieldById(fid));
          console.log(`[Autofill] Emoji field ${fid} exists:`, !!emojiField);
          if (emojiField) {
            await addAssetViaModal(fid, file);
            console.log(`[Autofill] Emoji ${idx} uploaded successfully`);
          } else {
            console.warn(`[Autofill] Field ${fid} not found on page`);
            status(`Field ${fid} not on page; skipped ${file}.`);
          }
        }
        console.log('[Autofill] All swap assets uploaded');
      } else {
        // Peacock Path workflow
        if (plan.puzzleFile && document.querySelector(SELECTORS.fieldById('puzzle'))) {
          if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          await addAssetViaModal('puzzle', plan.puzzleFile);
        } else if (!plan.puzzleFile) {
          status('No puzzle file found; skipping.');
        }

        for (let i=0; i<plan.emojis.length; i++) {
          if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const idx=i+1, fid=`emoji${idx}`, file=plan.emojis[i].name;
          if (document.querySelector(SELECTORS.fieldById(fid))) {
            await addAssetViaModal(fid, file);
          } else {
            status(`Field ${fid} not on page; skipped ${file}.`);
          }
        }
      }
      
      status('All assets uploaded!');
    }

    async function uploadLilSnackDayAssets(plan) {
      const usedFiles = new Set(); // Track which files we've already used
      
      console.log('[Autofill] Starting uploadLilSnackDayAssets');
      console.log('[Autofill] Game files available:', plan.gameFiles);
      console.log('[Autofill] Bonus files available:', plan.bonusFiles);
      
      // Upload image fields
      if (plan.bannerDay && document.querySelector(SELECTORS.fieldById('image'))) {
        if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const fieldEl = getActiveFieldEl('image');
        if (isFieldPopulated(fieldEl)) {
          console.log('[Autofill] Skipping image - already populated');
          status('Skipping image - already filled');
        } else {
          await addAssetViaModal('image', plan.bannerDay);
        }
      }
      
      if (plan.thumbnail && document.querySelector(SELECTORS.fieldById('thumbnail'))) {
        if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const fieldEl = getActiveFieldEl('thumbnail');
        if (isFieldPopulated(fieldEl)) {
          console.log('[Autofill] Skipping thumbnail - already populated');
          status('Skipping thumbnail - already filled');
        } else {
          await addAssetViaModal('thumbnail', plan.thumbnail);
        }
      }
      
      if (plan.thumbnailSmall && document.querySelector(SELECTORS.fieldById('thumbnailSmall'))) {
        if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const fieldEl = getActiveFieldEl('thumbnailSmall');
        if (isFieldPopulated(fieldEl)) {
          console.log('[Autofill] Skipping thumbnailSmall - already populated');
          status('Skipping thumbnailSmall - already filled');
        } else {
          await addAssetViaModal('thumbnailSmall', plan.thumbnailSmall);
        }
      }
      
      // Upload game fields (game1-4)
      for (let i = 1; i <= 4; i++) {
        if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const fieldId = `game${i}`;
        
        console.log(`[Autofill] Checking for field: ${fieldId}`);
        const fieldExists = document.querySelector(SELECTORS.fieldById(fieldId));
        console.log(`[Autofill] Field ${fieldId} exists:`, !!fieldExists);
        
        if (!fieldExists) {
          console.log(`[Autofill] Skipping ${fieldId} - field not found on page`);
          continue;
        }
        
        // Check if field is already populated
        const fieldEl = getActiveFieldEl(fieldId);
        if (isFieldPopulated(fieldEl)) {
          console.log(`[Autofill] Skipping ${fieldId} - already populated`);
          status(`Skipping ${fieldId} - already filled`);
          continue;
        }
        
        // Find an unused game file
        const availableFile = plan.gameFiles.find(f => !usedFiles.has(f.name));
        if (!availableFile) {
          console.log(`[Autofill] No more game files available for ${fieldId}`);
          status(`No more game files available for ${fieldId}`);
          break;
        }
        
        console.log(`[Autofill] Available file for ${fieldId}:`, availableFile.name);
        const gameType = determineGameType(availableFile.name, false);
        console.log(`[Autofill] Determined game type:`, gameType);
        
        if (!gameType) {
          console.warn(`[Autofill] Could not determine game type for ${availableFile.name}`);
          status(`Could not determine game type for ${availableFile.name}`);
          continue;
        }
        
        try {
          await handleGameField(fieldId, gameType, availableFile.name);
          usedFiles.add(availableFile.name);
          console.log(`[Autofill] Successfully handled ${fieldId}`);
        } catch (e) {
          console.error(`[Autofill] Error handling ${fieldId}:`, e);
          status(`Error with ${fieldId}: ${e?.message || e}`);
          // Continue to next field instead of stopping
        }
      }
      
      // Upload bonus game fields (bonusGame1-2)
      for (let i = 1; i <= 2; i++) {
        if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const fieldId = `bonusGame${i}`;
        if (!document.querySelector(SELECTORS.fieldById(fieldId))) continue;
        
        // Check if field is already populated
        const fieldEl = getActiveFieldEl(fieldId);
        if (isFieldPopulated(fieldEl)) {
          console.log(`[Autofill] Skipping ${fieldId} - already populated`);
          status(`Skipping ${fieldId} - already filled`);
          continue;
        }
        
        // Find an unused bonus file
        const availableFile = plan.bonusFiles.find(f => !usedFiles.has(f.name));
        if (!availableFile) {
          status(`No more bonus files available for ${fieldId}`);
          break;
        }
        
        const gameType = determineGameType(availableFile.name, true);
        if (!gameType) {
          status(`Could not determine game type for ${availableFile.name}`);
          continue;
        }
        
        await handleGameField(fieldId, gameType, availableFile.name);
        usedFiles.add(availableFile.name);
      }
    }

    function getActiveFieldEl(fieldId){
      const nodes = Array.from(document.querySelectorAll(SELECTORS.fieldById(fieldId)));
      const visible = nodes.filter(n => n.offsetParent !== null);
      return visible[visible.length-1] || nodes[nodes.length-1] || null;
    }

    // Helper: Check if a field already has content/media
    function isFieldPopulated(fieldEl) {
      if (!fieldEl) return false;
      
      // Check for various indicators that field has content:
      // 1. Has a card with content (images, games, etc.)
      const hasCard = fieldEl.querySelector('[data-test-id="cf-ui-card"]');
      // 2. Has an asset or entry link
      const hasLink = fieldEl.querySelector('[data-test-id="cf-ui-entry-card"], [data-test-id="cf-ui-asset-card"]');
      // 3. Check if "Add media" or similar buttons exist (if they don't, field might be full)
      const hasAddButton = fieldEl.querySelector('[data-test-id="link-actions-menu-trigger"], [data-test-id="create-entry-link-button"]');
      
      // If there's a card/link and no add button, field is likely populated
      if ((hasCard || hasLink) && !hasAddButton) {
        return true;
      }
      
      // Additional check: if field has existing content preview
      const hasPreview = fieldEl.querySelector('[data-test-id="link-card"]');
      if (hasPreview) {
        return true;
      }
      
      return false;
    }

    // Helper: Determine game type from filename
    function determineGameType(filename, isBonus = false) {
      const lower = filename.toLowerCase();
      
      // Check for prompt (any prompt is "ritual prompt")
      if (lower.includes('prompt')) {
        return { type: 'ritual-prompt', label: 'ritual prompt' };
      }
      // Check for path
      if (lower.includes('path')) {
        return { type: 'path', label: 'path' };
      }
      // Check for swap
      if (lower.includes('swap')) {
        return { type: 'swap', label: 'swap' };
      }
      // Check for stack
      if (lower.includes('stack')) {
        return { type: 'stack', label: 'stack' };
      }
      // Check for quote
      if (lower.includes('quote')) {
        return { type: 'quote', label: 'quote' };
      }
      // Check for litebrite (last resort)
      if (lower.includes('litebrite') || lower.includes('lite-brite')) {
        return { type: 'litebrite', label: 'litebrite' };
      }
      
      return null;
    }

    async function handleGameField(fieldId, gameType, filename) {
      let modal = null;
      try {
        status(`Processing ${fieldId} → ${gameType.label} (${filename})…`);
        console.log(`[Autofill] Starting handleGameField for ${fieldId}, type: ${gameType.label}, file: ${filename}`);

        const fieldEl = await waitFor(() => getActiveFieldEl(fieldId), 10000);
        if (!fieldEl) throw new Error(`Field ${fieldId} not found/visible.`);
        console.log(`[Autofill] Field element found for ${fieldId}`);

        // Find the "Add media" trigger
        const trySelectors = [
          SELECTORS.trgAddMedia,
          SELECTORS.trgAddContent,
          SELECTORS.trgCardActions,
          SELECTORS.trgAnyMenu
        ];
        let triggerWrapper = null;
        for (const sel of trySelectors) {
          triggerWrapper = fieldEl.querySelector(sel);
          if (triggerWrapper) {
            console.log(`[Autofill] Found trigger wrapper with selector: ${sel}`);
            break;
          }
        }
        if (!triggerWrapper) {
          console.error(`[Autofill] No trigger found for ${fieldId}. Field HTML:`, fieldEl.outerHTML.substring(0, 500));
          throw new Error(`Add media trigger not found in ${fieldId}`);
        }

        // If it's a span wrapper, find the button inside
        let trigger = triggerWrapper;
        if (triggerWrapper.tagName === 'SPAN') {
          const button = triggerWrapper.querySelector('button[aria-haspopup="menu"]');
          if (button) {
            console.log('[Autofill] Found button inside span wrapper');
            trigger = button;
          }
        }

        console.log('[Autofill] Trigger element:', trigger.outerHTML.substring(0, 200));
        
        trigger.scrollIntoView({block:'center'});
        await new Promise(r => setTimeout(r, 300));
        console.log('[Autofill] Clicking trigger button...');
        
        trigger.click();
        await new Promise(r => setTimeout(r, 500));

        // Wait for dropdown and verify it's related to our field
        console.log('[Autofill] Waiting for dropdown menu...');
        const menu = await waitFor(() => {
          const dropdowns = Array.from(document.querySelectorAll(SELECTORS.dropdownRoot));
          console.log('[Autofill] Found dropdowns:', dropdowns.length);
          if (dropdowns.length > 0) {
            console.log('[Autofill] Dropdown HTML:', dropdowns[dropdowns.length - 1].outerHTML.substring(0, 300));
          }
          return dropdowns.find(dd => {
            return fieldEl.contains(dd) || 
                   dd.contains(fieldEl) || 
                   fieldEl.parentElement?.contains(dd) ||
                   (fieldEl.closest('[data-field-id]') === dd.closest('[data-field-id]'));
          }) || dropdowns[dropdowns.length - 1];
        }, 8000);
        console.log('[Autofill] Menu found:', !!menu);

        // Look for the game type button in the dropdown (using text matching)
        const gameTypeBtn = Array.from(menu.querySelectorAll(SELECTORS.anyButton))
          .find(b => {
            const text = (b.textContent || '').trim().toLowerCase();
            return text.includes(gameType.label.toLowerCase());
          });
        
        if (!gameTypeBtn) {
          console.log('[Autofill] Available options:', Array.from(menu.querySelectorAll(SELECTORS.anyButton)).map(b => b.textContent?.trim()));
          throw new Error(`Game type "${gameType.label}" not found in dropdown for ${fieldId}`);
        }
        
        console.log(`[Autofill] Clicking game type: ${gameType.label}`);
        gameTypeBtn.click();

        // Wait for modal to appear
        modal = await waitFor(() => activeModal(), 8000);
        if (!modal) throw new Error(`Modal did not appear for ${fieldId}`);
        
        status(`Game type selected for ${fieldId}. Closing modal…`);
        
        // Wait a moment for modal to settle
        await new Promise(r => setTimeout(r, 500));
        
        // Close the modal (for now, we're not filling game-specific fields)
        const closeBtn = modal.querySelector(SELECTORS.modalCloseBtn);
        if (closeBtn) {
          console.log(`[Autofill] Closing modal for ${fieldId}`);
          closeBtn.click();
        } else {
          console.warn(`[Autofill] Close button not found for ${fieldId} modal`);
        }
        
        // Wait for modal to close
        await waitFor(() => !activeModal(), 2000).catch(()=>{});
        
        console.log(`[Autofill] Modal closed for ${fieldId}`);
        status(`Game field ${fieldId} set to ${gameType.label}.`);
        await new Promise(r => setTimeout(r, 500));
        
      } catch (e) {
        // Cleanup: try to close any open modal on error
        if (modal) {
          const closeBtn = modal.querySelector(SELECTORS.modalCloseBtn);
          if (closeBtn) closeBtn.click();
        }
        // Close any open dropdowns
        document.querySelectorAll(SELECTORS.dropdownRoot).forEach(dd => {
          if (dd.parentElement) dd.parentElement.removeChild(dd);
        });
        status(`Error handling ${fieldId}: ${e?.message || e}`);
        throw e;
      }
    }

    async function addAssetViaModal(fieldId, filename){
      let modal = null;
      try {
        status(`Processing ${fieldId} → ${filename}…`);

        const fieldEl = await waitFor(() => getActiveFieldEl(fieldId), 10000);
        if (!fieldEl) throw new Error(`Field ${fieldId} not found/visible.`);

        const trySelectors = [
          SELECTORS.trgAddMedia,
          SELECTORS.trgAddContent,
          SELECTORS.trgCardActions,
          SELECTORS.trgAnyMenu
        ];
        let trigger = null;
        for (const sel of trySelectors) {
          trigger = fieldEl.querySelector(sel);
          if (trigger) break;
        }
        if (!trigger) throw new Error(`Open trigger not found in ${fieldId}`);

        trigger.scrollIntoView({block:'center'});
        ['mousedown','mouseup','click'].forEach(t => trigger.dispatchEvent(new MouseEvent(t, { bubbles: true })));

        // Wait for dropdown and verify it's related to our field
        const menu = await waitFor(() => {
          const dropdowns = Array.from(document.querySelectorAll(SELECTORS.dropdownRoot));
          // Find dropdown that is spatially near our field or is a descendant/sibling
          return dropdowns.find(dd => {
            // Check if dropdown is within or near the field element
            return fieldEl.contains(dd) || 
                   dd.contains(fieldEl) || 
                   fieldEl.parentElement?.contains(dd) ||
                   // Check if they share a common ancestor (same field container)
                   (fieldEl.closest('[data-field-id]') === dd.closest('[data-field-id]'));
          }) || dropdowns[dropdowns.length - 1]; // Fallback to newest
        }, 8000);

        let addNew = menu.querySelector(SELECTORS.dropdownAddNewMedia);
        if (!addNew) {
          addNew = Array.from(menu.querySelectorAll(SELECTORS.anyButton)).find(b => /add new media/i.test((b.textContent||'').trim()));
        }
        if (!addNew) throw new Error('Dropdown item "Add new media" not found.');
        addNew.click();

        // Wait for the file upload modal specifically (not cookie modals, etc.)
        modal = await waitFor(() => {
          const modals = Array.from(document.querySelectorAll(SELECTORS.modalRoot));
          // Find a modal that has file-related content
          return modals.find(m => 
            m.querySelector(SELECTORS.modalFileInput) || 
            m.querySelector(SELECTORS.modalOpenFileBtn) ||
            Array.from(m.querySelectorAll(SELECTORS.anyButton)).some(b => /open file selector/i.test(b.textContent))
          );
        }, 12000);
        
        if (!modal) throw new Error('File upload modal not found.');
        
        // Wait a moment for modal to fully render
        await new Promise(r => setTimeout(r, 300));

        let fileInput = modal.querySelector(SELECTORS.modalFileInput);
        console.log('[Autofill] File input found immediately:', !!fileInput);
        
        if (!fileInput) {
          // Look for the button to reveal the file input
          const openBtn = modal.querySelector(SELECTORS.modalOpenFileBtn) ||
                          Array.from(modal.querySelectorAll(SELECTORS.anyButton)).find(b => /open file selector/i.test((b.textContent||'').trim()));
          
          console.log('[Autofill] Open button found:', !!openBtn);
          if (!openBtn) {
            // Log what buttons we DO have
            const allButtons = Array.from(modal.querySelectorAll(SELECTORS.anyButton));
            console.log('[Autofill] Available buttons:', allButtons.map(b => b.textContent?.trim()));
            throw new Error('Open file selector button not found in modal.');
          }
          
          console.log('[Autofill] Clicking open button...');
          // Ensure button is visible and clickable
          openBtn.scrollIntoView({block:'center'});
          await new Promise(r => setTimeout(r, 300));
          
          // Direct click - this should work if the element is interactable
          openBtn.click();
          
          // Wait for file input to appear
          console.log('[Autofill] Waiting for file input to appear...');
          fileInput = await waitFor(() => modal.querySelector(SELECTORS.modalFileInput), 12000);
        }
        
        if (!fileInput) throw new Error('File input not found after clicking open button.');
        console.log('[Autofill] File input ready:', fileInput);

        const handle = await state.dirHandle.getFileHandle(filename);
        const file = await handle.getFile();
        
        // Determine correct MIME type based on file extension
        let fileType = file.type || 'application/octet-stream';
        if (filename.endsWith('.tmj') || filename.endsWith('.json')) {
          fileType = 'application/json';
        } else if (filename.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
          const ext = filename.split('.').pop().toLowerCase();
          fileType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        }
        
        status(`Uploading ${filename}…`);
        
        // Create new File with correct MIME type
        const dt = new DataTransfer();
        dt.items.add(new File([await file.arrayBuffer()], file.name, { type: fileType }));
        fileInput.files = dt.files;
        
        // Trigger all possible events to ensure the upload is recognized
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));
        fileInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
        
        // Wait for the upload to complete (asset appears in the modal)
        status(`Uploading ${filename}…`);
        console.log('[Autofill] Waiting for asset to finish uploading...');
        
        // Wait for upload completion indicators (max 10 seconds)
        // The modal typically shows a preview or confirmation when upload completes
        await new Promise(r => setTimeout(r, 2000));

        status(`Upload complete - closing modal...`);
        
        const closeBtn = modal.querySelector(SELECTORS.modalCloseBtn);
        if (closeBtn) {
          console.log('[Autofill] Closing modal for', fieldId);
          closeBtn.click();
        }
        await waitFor(() => !activeModal(), 1000).catch(()=>{});
        
        console.log('[Autofill] Modal closed for', fieldId);
        status(`Asset ${fieldId} uploaded.`);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        // Cleanup: try to close any open modal on error
        if (modal) {
          const closeBtn = modal.querySelector(SELECTORS.modalCloseBtn);
          if (closeBtn) closeBtn.click();
        }
        // Close any open dropdowns
        document.querySelectorAll(SELECTORS.dropdownRoot).forEach(dd => {
          if (dd.parentElement) dd.parentElement.removeChild(dd);
        });
        status(`Error uploading ${filename}: ${e?.message || e}`);
        throw e;
      }
    }

    function activeModal(){
      const all = Array.from(document.querySelectorAll(SELECTORS.modalRoot));
      return all[all.length - 1] || null;
    }

    async function duplicateEntry() {
      try {
        status('Duplicating entry...');
        console.log('[Autofill] Starting duplicate entry process');
        
        // Wait a moment for page to be ready
        await new Promise(r => setTimeout(r, 500));
        
        // Store current URL to detect navigation
        const originalUrl = window.location.href;
        console.log('[Autofill] Current URL:', originalUrl);
        
        // Find the entry actions button (the three-dot menu)
        const entryActionsBtn = await waitFor(() => {
          const buttons = Array.from(document.querySelectorAll('button[aria-label="Entry actions"][aria-haspopup="menu"]'));
          return buttons[0] || null;
        }, 8000);
        
        if (!entryActionsBtn) {
          throw new Error('Entry actions button not found');
        }
        
        console.log('[Autofill] Found entry actions button');
        entryActionsBtn.scrollIntoView({ block: 'center' });
        await new Promise(r => setTimeout(r, 300));
        entryActionsBtn.click();
        
        // Wait for the menu to appear
        await new Promise(r => setTimeout(r, 500));
        
        // Find the duplicate button in the menu
        const duplicateBtn = await waitFor(() => {
          const buttons = Array.from(document.querySelectorAll('button[data-test-id="cf-ui-button-action-duplicate"]'));
          return buttons.find(b => b.textContent.trim().toLowerCase().includes('duplicate')) || null;
        }, 5000);
        
        if (!duplicateBtn) {
          throw new Error('Duplicate button not found in menu');
        }
        
        console.log('[Autofill] Found duplicate button, clicking...');
        duplicateBtn.click();
        
        // Wait for URL to change (navigation to duplicated entry)
        console.log('[Autofill] Waiting for page navigation...');
        await waitFor(() => window.location.href !== originalUrl, 10000);
        console.log('[Autofill] URL changed to:', window.location.href);
        
        // Wait for the new page to fully load and be interactive
        await new Promise(r => setTimeout(r, 2000));
        
        // Wait for key UI elements to be present
        await waitFor(() => {
          const hasInputs = document.querySelectorAll('input[type="text"]').length > 0;
          const hasPanel = document.getElementById('cf-autofill-panel');
          return hasInputs && hasPanel;
        }, 10000);
        
        console.log('[Autofill] Entry duplicated and page loaded successfully');
        status('Entry duplicated. Ready for next upload.');
        
      } catch (e) {
        console.error('[Autofill] Error duplicating entry:', e);
        status(`Failed to duplicate entry: ${e?.message || e}`);
        throw e;
      }
    }

    async function clearAllFields() {
      try {
        status('Clearing all fields...');
        console.log('[Autofill] Starting to clear all fields');
        
        // Wait for page to be ready
        await new Promise(r => setTimeout(r, 1000));
        
        // Clear text input fields - but skip the autofill panel inputs
        const textInputs = document.querySelectorAll('input[type="text"], input[type="date"], textarea');
        console.log(`[Autofill] Found ${textInputs.length} text inputs to potentially clear`);
        
        let clearedCount = 0;
        textInputs.forEach(input => {
          // Skip inputs inside our autofill panel
          if (input.closest('#cf-autofill-panel')) return;
          
          if (input.value && input.value.trim()) {
            try {
              input.focus();
              input.value = '';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              clearedCount++;
            } catch (e) {
              console.warn('[Autofill] Error clearing input:', e);
            }
          }
        });
        
        console.log(`[Autofill] Cleared ${clearedCount} text fields`);
        
        // Clear any contenteditable fields (like JSON editor)
        const editableFields = document.querySelectorAll('[contenteditable="true"]');
        console.log(`[Autofill] Found ${editableFields.length} editable fields`);
        
        editableFields.forEach(field => {
          if (field.textContent && field.textContent.trim()) {
            try {
              field.focus();
              field.textContent = '';
              field.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (e) {
              console.warn('[Autofill] Error clearing editable field:', e);
            }
          }
        });
        
        console.log('[Autofill] Text fields cleared, now removing linked assets...');
        
        // Remove linked assets (puzzle, emojis, etc.) by clicking their action menu and remove button
        const cardActionButtons = document.querySelectorAll('button[data-test-id="cf-ui-card-actions"]');
        console.log(`[Autofill] Found ${cardActionButtons.length} asset cards to remove`);
        
        for (const actionBtn of cardActionButtons) {
          try {
            // Skip if it's inside our autofill panel
            if (actionBtn.closest('#cf-autofill-panel')) continue;
            
            console.log('[Autofill] Clicking card action button...');
            actionBtn.scrollIntoView({ block: 'center' });
            await new Promise(r => setTimeout(r, 200));
            actionBtn.click();
            
            // Wait for dropdown menu to appear
            await new Promise(r => setTimeout(r, 300));
            
            // Find and click the Remove button in the dropdown
            const removeBtn = await waitFor(() => {
              const buttons = Array.from(document.querySelectorAll('button[data-test-id="card-action-remove"]'));
              return buttons.find(b => b.textContent.trim().toLowerCase().includes('remove')) || null;
            }, 3000).catch(() => null);
            
            if (removeBtn) {
              console.log('[Autofill] Clicking remove button...');
              removeBtn.click();
              await new Promise(r => setTimeout(r, 300));
            } else {
              console.warn('[Autofill] Remove button not found for asset card');
            }
            
          } catch (e) {
            console.warn('[Autofill] Error removing asset card:', e);
            // Continue to next card even if this one fails
          }
        }
        
        console.log('[Autofill] Fields and assets cleared successfully');
        status('All fields cleared.');
        
      } catch (e) {
        console.error('[Autofill] Error clearing fields:', e);
        status(`Failed to clear fields: ${e?.message || e}`);
        throw e;
      }
    }

    async function batchUploadAll() {
      if (state.batchPlans.length === 0) {
        status('No folders in batch queue.');
        return;
      }
      
      try {
        state.abortController = new AbortController();
        btnBatchUpload.disabled = true;
        btnCancel.disabled = false;
        state.batchErrors = [];
        
        status(`Starting batch upload: ${state.batchPlans.length} folder(s)…`);
        
        for (let i = 0; i < state.batchPlans.length; i++) {
          if (state.abortController?.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          
          const plan = state.batchPlans[i];
          const folderName = plan.folderName || plan.entryId || `Folder ${i + 1}`;
          
          try {
            status(`[${i + 1}/${state.batchPlans.length}] Processing: ${folderName}…`);
            console.log(`[Autofill] Processing batch item ${i + 1}/${state.batchPlans.length}: ${folderName}`);
            
            // If this is NOT the first folder, duplicate the entry
            if (i > 0) {
              console.log(`[Autofill] Step 1: Duplicating entry for ${folderName}`);
              await duplicateEntry();
              
              console.log(`[Autofill] Step 2: Clearing fields for ${folderName}`);
              await clearAllFields();
            }
            
            // Set the dirHandle for this specific plan
            state.dirHandle = plan.dirHandle;
            console.log(`[Autofill] Step 3: Set dirHandle for ${folderName}`);
            
            // Fill fields and upload assets for this folder
            console.log(`[Autofill] Step 4: Filling fields for ${folderName}`);
            await fillFields(plan, { setJson: chkJson.checked });
            
            // Wait for fields to settle before starting uploads
            await new Promise(r => setTimeout(r, 1000));
            
            console.log(`[Autofill] Step 5: Uploading assets for ${folderName}`);
            await uploadAllAssets(plan);
            
            // Wait for uploads to complete and UI to settle
            await new Promise(r => setTimeout(r, 1500));
            
            status(`[${i + 1}/${state.batchPlans.length}] ✓ Completed: ${folderName}`);
            console.log(`[Autofill] Completed: ${folderName}`);
            
            // Wait a bit between uploads to let the UI settle
            if (i < state.batchPlans.length - 1) {
              await new Promise(r => setTimeout(r, 1000));
            }
            
          } catch (e) {
            const errorMsg = `Error on ${folderName}: ${e?.message || e}`;
            console.error(`[Autofill] ${errorMsg}`, e);
            state.batchErrors.push(errorMsg);
            
            // Continue with next folder instead of stopping
            status(`[${i + 1}/${state.batchPlans.length}] ✗ Error: ${folderName} - ${e?.message || e}`);
          }
        }
        
        // Show final summary
        const successCount = state.batchPlans.length - state.batchErrors.length;
        let summary = `Batch complete! ${successCount}/${state.batchPlans.length} succeeded.`;
        
        if (state.batchErrors.length > 0) {
          summary += '\\n\\nErrors encountered:';
          state.batchErrors.forEach((err, idx) => {
            summary += `\\n${idx + 1}. ${err}`;
          });
          console.error('[Autofill] Batch errors:', state.batchErrors);
        }
        
        status(summary);
        alert(summary);
        
      } catch (e) {
        if (e.name === 'AbortError') {
          status('Batch upload cancelled.');
        } else {
          status('Batch upload failed: ' + (e?.message || e));
          console.error(e);
        }
      } finally {
        btnBatchUpload.disabled = false;
        btnCancel.disabled = true;
        state.abortController = null;
      }
    }

    function waitFor(fn, timeoutMs=8000, interval=120){
      return new Promise((resolve, reject) => {
        const start = performance.now();
        let timeoutId;
        const tick = () => {
          if (state.abortController?.signal.aborted) {
            return reject(new DOMException('Aborted', 'AbortError'));
          }
          let val=null, err=null;
          try { val = (typeof fn === 'function') ? fn() : null; } catch(e){ err=e; }
          if (val) return resolve(val);
          if (err) return reject(err);
          if (performance.now()-start > timeoutMs) return reject(new Error('waitFor timeout'));
          timeoutId = setTimeout(tick, interval);
        };
        tick();
      });
    }
  }
})();
