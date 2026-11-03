const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_DAYS_MON_FIRST = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
const $ = id => document.getElementById(id);

// Data model:
// weeklyLogs: { [mondayKey: 'YYYY-MM-DD']: { weekNo: number, days: ['YYYY-MM-DD', ...], task: string, note: string } }
let weeklyLogs = JSON.parse(localStorage.getItem('weeklyLogs') || '{}');
let profile = JSON.parse(localStorage.getItem('profile') || '{}');

// Migrate legacy daily 'entries' if weeklyLogs is empty and legacy entries exist
(function migrateLegacy() {
  const old = JSON.parse(localStorage.getItem('entries') || '{}');
  if (Object.keys(weeklyLogs).length === 0 && Object.keys(old).length > 0) {
    Object.keys(old).sort().forEach(k => {
      const e = old[k];
      if (!e || e.status === 'holiday' || e.status === 'leave') return;
      const dt = parseKey(k);
      const monKey = fmtKey(getMonday(dt));
      if (!weeklyLogs[monKey]) {
        weeklyLogs[monKey] = { weekNo: calcDefaultWeekNo(getMonday(dt)), days: [], task: '', note: '' };
      }
      if (!weeklyLogs[monKey].days.includes(k)) weeklyLogs[monKey].days.push(k);
      if (e.task) {
        weeklyLogs[monKey].task = weeklyLogs[monKey].task
          ? `${weeklyLogs[monKey].task}\n- ${e.task}`
          : e.task;
      }
      if (e.note && !weeklyLogs[monKey].note) weeklyLogs[monKey].note = e.note;
    });
    localStorage.setItem('weeklyLogs', JSON.stringify(weeklyLogs));
  }
})();

let cur = new Date();
cur.setDate(1);

// Interactive circle selection state on calendar
let selectedDays = new Set();

// Modal state
let activeMondayKey = null;
let modalSelectedDays = new Set();

function fmtKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function getMonday(d) {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay(); // 0=Sun, 1=Mon...
  const diff = (day + 6) % 7; // Mon=0 ... Sun=6
  dt.setDate(dt.getDate() - diff);
  return dt;
}
function addDays(d, n) {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  dt.setDate(dt.getDate() + n);
  return dt;
}
function thFullDate(d) {
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function thShortDate(d) {
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()].slice(0, 4)} ${(d.getFullYear() + 543).toString().slice(-2)}`;
}
function thDayName(d) {
  const idx = (d.getDay() + 6) % 7;
  return TH_DAYS_MON_FIRST[idx];
}
function esc(s) {
  return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function saveWeeks() {
  localStorage.setItem('weeklyLogs', JSON.stringify(weeklyLogs));
}
function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

// Compute week number automatically based on profile.start or order of weeks
function calcDefaultWeekNo(monDate) {
  if (profile.start) {
    const startMon = getMonday(parseKey(profile.start));
    const diffWeeks = Math.floor((monDate - startMon) / (86400000 * 7)) + 1;
    if (diffWeeks >= 1) return diffWeeks;
  }
  const existingKeys = Object.keys(weeklyLogs).sort();
  const monKey = fmtKey(monDate);
  const idx = existingKeys.indexOf(monKey);
  if (idx !== -1) return weeklyLogs[monKey].weekNo || (idx + 1);
  return existingKeys.length + 1;
}

// Get all Monday dates that overlap with the current viewing month
function getMonthMondays(y, m) {
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  let mon = getMonday(firstDay);
  const mondays = [];
  while (mon <= lastDay) {
    mondays.push(new Date(mon));
    mon = addDays(mon, 7);
  }
  return mondays;
}

// Format range label from selected day keys in a week
function getWeekRangeInfo(monKey, dayKeys) {
  const mon = parseKey(monKey);
  const sun = addDays(mon, 6);
  const sorted = [...(dayKeys || [])].sort();
  if (sorted.length === 0) {
    return {
      firstDate: mon,
      lastDate: sun,
      shortRange: `${thShortDate(mon)} - ${thShortDate(sun)}`,
      fullRange: `ระหว่างวันที่ ${thFullDate(mon)} ถึงวันที่ ${thFullDate(sun)}`,
      dayNamesLabel: 'ยังไม่ได้เลือกวัน'
    };
  }
  const firstDate = parseKey(sorted[0]);
  const lastDate = parseKey(sorted[sorted.length - 1]);

  // Check if selected days are contiguous
  const isContiguous = sorted.every((k, i) => {
    if (i === 0) return true;
    const prev = parseKey(sorted[i - 1]);
    return fmtKey(addDays(prev, 1)) === k;
  });

  const dayNamesLabel = isContiguous
    ? (sorted.length === 1 ? `วัน${thDayName(firstDate)}` : `${thDayName(firstDate)} - ${thDayName(lastDate)}`)
    : sorted.map(k => thDayName(parseKey(k))).join(', ');

  return {
    firstDate,
    lastDate,
    shortRange: sorted.length === 1
      ? thFullDate(firstDate)
      : `${firstDate.getDate()} - ${thFullDate(lastDate)}`,
    fullRange: `ระหว่างวันที่ ${thFullDate(firstDate)} ถึงวันที่ ${thFullDate(lastDate)}`,
    dayNamesLabel
  };
}

function updateSelectionBar() {
  const bar = $('select-bar');
  const count = selectedDays.size;
  $('sel-count').textContent = `${count} วัน`;
  if (count === 0) {
    bar.classList.remove('has-selection');
    $('sel-range-text').textContent = 'ยังไม่ได้เลือกวันบนปฏิทิน';
  } else {
    bar.classList.add('has-selection');
    const sorted = [...selectedDays].sort();
    const first = parseKey(sorted[0]);
    const last = parseKey(sorted[sorted.length - 1]);
    const monKey = fmtKey(getMonday(first));
    const info = getWeekRangeInfo(monKey, sorted);
    $('sel-range-text').textContent = `เลือกแล้ว: ${info.dayNamesLabel} (${thFullDate(first)} ถึง ${thFullDate(last)})`;
  }
}

function toggleDaySelectionOnCalendar(dayKey) {
  const clickedDate = parseKey(dayKey);
  const clickedMonKey = fmtKey(getMonday(clickedDate));

  // Ensure all selected days belong to the same week so weekly grouping is crystal clear
  if (selectedDays.size > 0) {
    const existingSample = [...selectedDays][0];
    const existingMonKey = fmtKey(getMonday(parseKey(existingSample)));
    if (existingMonKey !== clickedMonKey) {
      selectedDays.clear();
      toast('เปลี่ยนสัปดาห์ที่เลือกอัตโนมัติ (รวบทีละสัปดาห์)');
    }
  }

  if (selectedDays.has(dayKey)) {
    selectedDays.delete(dayKey);
  } else {
    selectedDays.add(dayKey);
  }
  render();
}

function render() {
  const y = cur.getFullYear(), m = cur.getMonth();
  $('month-label').textContent = `${TH_MONTHS[m]} ${y + 543}`;

  const grid = $('grid');
  grid.innerHTML = '';

  const mondays = getMonthMondays(y, m);
  const todayKey = fmtKey(new Date());

  mondays.forEach((mon) => {
    const monKey = fmtKey(mon);
    const rec = weeklyLogs[monKey];
    const activeSet = new Set(rec ? rec.days : []);

    const rowEl = document.createElement('div');
    rowEl.className = 'week-row' + (rec ? ' has-record' : '');

    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      const k = fmtKey(d);
      const inMonth = d.getMonth() === m;
      const isWeekend = i >= 5;
      const isSelected = selectedDays.has(k);
      const isActiveInRec = activeSet.has(k);
      const isSlashedInRec = rec && !isActiveInRec;

      const dayEl = document.createElement('div');
      dayEl.className = [
        'day',
        !inMonth ? 'outside-month' : '',
        isWeekend ? 'weekend' : '',
        k === todayKey ? 'today' : '',
        isActiveInRec ? 'in-week-active' : '',
        isSlashedInRec ? 'in-week-slashed' : '',
        isSelected ? 'is-selected' : ''
      ].filter(Boolean).join(' ');

      const monthSuffix = !inMonth ? `<small>${TH_MONTHS[d.getMonth()].slice(0, 3)}</small>` : '';
      const checkMark = (isSelected || isActiveInRec) ? '✓' : '';

      let bottomTag = '';
      if (isSelected) {
        bottomTag = `<span class="day-status-tag active">กำลังเลือก</span>`;
      } else if (isActiveInRec) {
        bottomTag = `<span class="day-status-tag active">สัปดาห์ที่ ${rec.weekNo || '-'}</span>`;
      } else if (isSlashedInRec) {
        bottomTag = `<span class="day-status-tag slashed">ไม่รวม / ขีดฆ่า</span>`;
      }

      dayEl.innerHTML = `
        <div class="day-top">
          <span class="num">${d.getDate()}${monthSuffix}</span>
          <span class="check-circle" title="คลิกเพื่อเลือก/ยกเลิกวัน">${checkMark}</span>
        </div>
        ${bottomTag}
      `;

      dayEl.onclick = () => toggleDaySelectionOnCalendar(k);
      rowEl.appendChild(dayEl);
    }

    // End of row: Week Management Cell
    const actionCell = document.createElement('div');
    actionCell.className = 'week-action-cell' + (rec ? ' recorded' : '');
    if (rec) {
      actionCell.innerHTML = `
        <span class="wk-badge">สัปดาห์ที่ ${rec.weekNo} (${rec.days.length} วัน)</span>
        <div class="wk-task-preview">${esc(rec.task)}</div>
        <button type="button" class="btn ghost sm" style="width:100%;justify-content:center">✏️ แก้ไขสัปดาห์</button>
      `;
      actionCell.querySelector('button').onclick = () => openWeekModal(monKey);
    } else {
      const defNo = calcDefaultWeekNo(mon);
      actionCell.innerHTML = `
        <span class="mute" style="font-size:0.75rem">ยังไม่ได้บันทึก</span>
        <button type="button" class="btn ghost sm" style="width:100%;justify-content:center">+ บันทึกสัปดาห์นี้</button>
      `;
      actionCell.querySelector('button').onclick = () => {
        const selInThisWeek = [...selectedDays].filter(k => fmtKey(getMonday(parseKey(k))) === monKey);
        openWeekModal(monKey, selInThisWeek.length ? selInThisWeek : null, defNo);
      };
    }

    rowEl.appendChild(actionCell);
    grid.appendChild(rowEl);
  });

  // Render Stats
  const monthMonKeys = mondays.map(fmtKey);
  const monthRecs = monthMonKeys.map(k => ({ monKey: k, rec: weeklyLogs[k] })).filter(x => x.rec);
  const monthDaysCount = monthRecs.reduce((sum, x) => sum + (x.rec.days ? x.rec.days.length : 0), 0);
  const allRecs = Object.values(weeklyLogs);
  const allDaysCount = allRecs.reduce((sum, r) => sum + (r.days ? r.days.length : 0), 0);

  $('stats').innerHTML = [
    [monthRecs.length, 'สัปดาห์ที่บันทึกในเดือนนี้'],
    [monthDaysCount, 'วันปฏิบัติงานที่รวมในเดือนนี้'],
    [allRecs.length, 'สัปดาห์สะสมทั้งหมด'],
    [allDaysCount, 'วันปฏิบัติงานสะสมทั้งหมด']
  ].map(([v, l], i) => `<div class="stat" style="animation-delay:${i * 70}ms"><b>${v}</b><span>${l}</span></div>`).join('');

  // Render Table List of Recorded Weeks in this Month
  const tbody = $('list').querySelector('tbody');
  if (monthRecs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--mute);padding:28px">ยังไม่มีการบันทึกสัปดาห์ในเดือนนี้ — ติ๊กวงกลมเลือกวันบนปฏิทิน หรือกดปุ่ม "+ บันทึกสัปดาห์นี้" ท้ายแถว</td></tr>`;
  } else {
    tbody.innerHTML = monthRecs.map(({ monKey, rec }) => {
      const info = getWeekRangeInfo(monKey, rec.days);
      return `
        <tr>
          <td><span class="pill-week">สัปดาห์ที่ ${rec.weekNo}</span></td>
          <td>
            <strong>${info.dayNamesLabel}</strong><br>
            <small class="mute">${thFullDate(info.firstDate)} - ${thFullDate(info.lastDate)} (${rec.days.length} วัน)</small>
          </td>
          <td class="pre-wrap">${esc(rec.task)}</td>
          <td>${esc(rec.note || '-')}</td>
          <td style="text-align:center">
            <button type="button" class="btn ghost sm" data-edit="${monKey}">แก้ไข</button>
          </td>
        </tr>
      `;
    }).join('');
    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => openWeekModal(btn.dataset.edit);
    });
  }

  updateSelectionBar();
}

// Modal logic
function renderModalPills() {
  const container = $('modal-day-pills');
  container.innerHTML = '';
  const mon = parseKey(activeMondayKey);

  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const k = fmtKey(d);
    const isActive = modalSelectedDays.has(k);

    const pill = document.createElement('div');
    pill.className = 'day-pill' + (isActive ? ' active' : '');
    pill.innerHTML = `
      <div class="pill-circle">${isActive ? '✓' : ''}</div>
      <div class="pill-wd">${TH_DAYS_MON_FIRST[i]}</div>
      <div class="pill-dt">${d.getDate()} ${TH_MONTHS[d.getMonth()].slice(0, 3)}</div>
    `;
    pill.onclick = () => {
      if (modalSelectedDays.has(k)) modalSelectedDays.delete(k);
      else modalSelectedDays.add(k);
      renderModalPills();
      updateModalHeaderPreview();
    };
    container.appendChild(pill);
  }
}

function updateModalHeaderPreview() {
  const wkNo = $('f-week-no').value || '...';
  const info = getWeekRangeInfo(activeMondayKey, [...modalSelectedDays]);
  $('f-header-preview').textContent = `สัปดาห์ที่ ${wkNo}   ${info.fullRange} (${modalSelectedDays.size} วัน)`;
}

function openWeekModal(monKey, customDays = null, defaultWeekNo = null) {
  activeMondayKey = monKey;
  const existing = weeklyLogs[monKey];
  const mon = parseKey(monKey);

  if (existing) {
    modalSelectedDays = new Set(existing.days || []);
    $('f-week-no').value = existing.weekNo || calcDefaultWeekNo(mon);
    $('f-task').value = existing.task || '';
    $('f-note').value = existing.note || '';
    $('btn-delete').style.visibility = 'visible';
  } else {
    if (customDays && customDays.length > 0) {
      modalSelectedDays = new Set(customDays);
    } else {
      const defDays = [];
      for (let i = 0; i < 5; i++) {
        const d = addDays(mon, i);
        if (d.getMonth() === cur.getMonth()) defDays.push(fmtKey(d));
      }
      if (defDays.length === 0) {
        for (let i = 0; i < 5; i++) defDays.push(fmtKey(addDays(mon, i)));
      }
      modalSelectedDays = new Set(defDays);
    }
    $('f-week-no').value = defaultWeekNo || calcDefaultWeekNo(mon);
    $('f-task').value = '';
    $('f-note').value = '-';
    $('btn-delete').style.visibility = 'hidden';
  }

  renderModalPills();
  updateModalHeaderPreview();
  $('week-modal').showModal();
}

$('f-week-no').oninput = updateModalHeaderPreview;

$('qp-monfri').onclick = () => {
  modalSelectedDays.clear();
  const mon = parseKey(activeMondayKey);
  for (let i = 0; i < 5; i++) modalSelectedDays.add(fmtKey(addDays(mon, i)));
  renderModalPills();
  updateModalHeaderPreview();
};
$('qp-all').onclick = () => {
  modalSelectedDays.clear();
  const mon = parseKey(activeMondayKey);
  for (let i = 0; i < 7; i++) modalSelectedDays.add(fmtKey(addDays(mon, i)));
  renderModalPills();
  updateModalHeaderPreview();
};
$('qp-clear').onclick = () => {
  modalSelectedDays.clear();
  renderModalPills();
  updateModalHeaderPreview();
};

$('week-form').onsubmit = (e) => {
  if (modalSelectedDays.size === 0) {
    e.preventDefault();
    toast('กรุณาติ๊กเลือกอย่างน้อย 1 วันในสัปดาห์นี้');
    return;
  }
  weeklyLogs[activeMondayKey] = {
    weekNo: +$('f-week-no').value || 1,
    days: [...modalSelectedDays].sort(),
    task: $('f-task').value.trim(),
    note: $('f-note').value.trim() || '-'
  };
  selectedDays.clear();
  saveWeeks();
  render();
  toast('บันทึกรายงานประจำสัปดาห์เรียบร้อย ✓');
};

$('btn-cancel').onclick = () => $('week-modal').close();
$('btn-close-x').onclick = () => $('week-modal').close();
$('btn-delete').onclick = () => {
  delete weeklyLogs[activeMondayKey];
  selectedDays.clear();
  saveWeeks();
  render();
  $('week-modal').close();
  toast('ลบข้อมูลสัปดาห์แล้ว');
};

// Selection bar buttons
$('btn-sel-clear').onclick = () => {
  selectedDays.clear();
  render();
};
$('btn-sel-monfri').onclick = () => {
  selectedDays.clear();
  const mondays = getMonthMondays(cur.getFullYear(), cur.getMonth());
  const targetMon = mondays.find(m => !weeklyLogs[fmtKey(m)]) || mondays[0];
  for (let i = 0; i < 5; i++) {
    const d = addDays(targetMon, i);
    if (d.getMonth() === cur.getMonth()) selectedDays.add(fmtKey(d));
  }
  render();
};
$('btn-sel-create').onclick = () => {
  if (selectedDays.size === 0) {
    toast('กรุณาคลิกวงกลมเลือกวันบนปฏิทินก่อนครับ');
    return;
  }
  const sorted = [...selectedDays].sort();
  const monKey = fmtKey(getMonday(parseKey(sorted[0])));
  openWeekModal(monKey, sorted);
};
$('btn-add-week').onclick = () => {
  const mondays = getMonthMondays(cur.getFullYear(), cur.getMonth());
  const targetMon = mondays.find(m => !weeklyLogs[fmtKey(m)]) || mondays[0];
  openWeekModal(fmtKey(targetMon));
};

// Navigation
$('prev').onclick = () => { cur.setMonth(cur.getMonth() - 1); selectedDays.clear(); render(); };
$('next').onclick = () => { cur.setMonth(cur.getMonth() + 1); selectedDays.clear(); render(); };
$('today').onclick = () => { cur = new Date(); cur.setDate(1); selectedDays.clear(); render(); };

// Profile
const P = ['name','id','major','uni','term','company','dept','start','end','mentor','advisor'];
$('btn-profile').onclick = () => {
  P.forEach(p => $('p-' + p).value = profile[p] || '');
  $('profile-modal').showModal();
};
$('btn-profile-cancel').onclick = () => $('profile-modal').close();
$('profile-form').onsubmit = () => {
  P.forEach(p => profile[p] = $('p-' + p).value.trim());
  localStorage.setItem('profile', JSON.stringify(profile));
  render();
  toast('บันทึกข้อมูลผู้ฝึกงานแล้ว ✓');
};

const F = 'TH Sarabun New';
const thin = { style: 'thin', color: { argb: 'FF000000' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const slashBorder = {
  top: thin, left: thin, bottom: thin, right: thin,
  diagonal: { up: true, down: false, style: 'medium', color: { argb: 'FFEF4444' } }
};

// ==========================================
// EXCEL EXPORT (Single Continuous Sheet - All Weeks)
// ==========================================
function appendWeekTableToSheet(ws, startRow, monKey, rec) {
  const mon = parseKey(monKey);
  const sun = addDays(mon, 6);

  // Title Row 1
  let r = startRow;
  ws.mergeCells(`A${r}:C${r}`);
  ws.getCell(`A${r}`).value = 'รายงานการบันทึกการปฏิบัติงาน';
  ws.getCell(`A${r}`).font = { name: F, size: 20, bold: true };
  ws.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 34;

  // Subtitle Row 2: Week No & Date Range
  r++;
  ws.mergeCells(`A${r}:C${r}`);
  ws.getCell(`A${r}`).value = `สัปดาห์ที่..........${rec.weekNo}..........ระหว่างวันที่......${thFullDate(mon)}......ถึงวันที่......${thFullDate(sun)}......`;
  ws.getCell(`A${r}`).font = { name: F, size: 16 };
  ws.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 28;

  // Table Header Row 4 (เว้น 1 แถว)
  r += 2;
  ws.getRow(r).values = ['วัน / วันที่ปฏิบัติงาน', 'บันทึกรายงานการปฏิบัติงาน', 'หมายเหตุ'];
  ws.getRow(r).height = 28;
  ws.getRow(r).eachCell(c => {
    c.font = { name: F, size: 16, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = border;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  });

  // แบ่ง 7 วันออกเป็นบล็อก วันทำงาน (Selected) กับ วันที่ไม่ทำงาน (Slashed)
  const activeSet = new Set(rec.days || []);
  const blocks = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const k = fmtKey(d);
    const isWork = activeSet.has(k);
    if (blocks.length === 0 || blocks[blocks.length - 1].isWork !== isWork) {
      blocks.push({ isWork, days: [d] });
    } else {
      blocks[blocks.length - 1].days.push(d);
    }
  }

  let workBlockRendered = false;
  blocks.forEach(b => {
    r++;
    const firstD = b.days[0];
    const lastD = b.days[b.days.length - 1];
    const dayLabel = b.days.length === 1
      ? `${thDayName(firstD)}\n(${firstD.getDate()} ${TH_MONTHS[firstD.getMonth()].slice(0, 4)})`
      : `${thDayName(firstD)} - ${thDayName(lastD)}\n(${firstD.getDate()} - ${lastD.getDate()} ${TH_MONTHS[lastD.getMonth()].slice(0, 4)})`;

    const row = ws.getRow(r);
    if (b.isWork) {
      const taskText = !workBlockRendered ? (rec.task || '-') : '(รวมในรายการปฏิบัติงานประจำสัปดาห์ด้านบน)';
      const noteText = !workBlockRendered ? (rec.note || '-') : '-';
      workBlockRendered = true;

      row.values = [dayLabel, taskText, noteText];
      const lineCount = Math.max(5, (taskText.split('\n').length + Math.ceil(taskText.length / 45)));
      row.height = Math.max(130, lineCount * 22);

      row.eachCell({ includeEmpty: true }, (c, col) => {
        c.font = { name: F, size: 16, bold: col === 1 };
        c.border = border;
        c.alignment = {
          vertical: col === 1 ? 'middle' : 'top',
          horizontal: col === 2 ? 'left' : 'center',
          wrapText: true
        };
      });
    } else {
      // วันที่ไม่ได้ปฏิบัติงาน -> ขีดฆ่าทะแยงมุม (Slashed)
      row.values = [dayLabel, '', ''];
      row.height = 46;
      row.getCell(1).font = { name: F, size: 15, color: { argb: 'FF6B7280' } };
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.getCell(1).border = border;

      row.getCell(2).border = slashBorder;
      row.getCell(3).border = slashBorder;
    }
  });

  // ลายเซ็นต์
  r += 2;
  [
    [r, 'ลงชื่อ ........................................ ผู้ควบคุมการฝึกงาน', profile.mentor],
    [r + 3, 'ลงชื่อ ........................................ อาจารย์นิเทศ', profile.advisor]
  ].forEach(([sigR, lineText, personName]) => {
    ws.mergeCells(`A${sigR}:C${sigR}`);
    ws.getCell(`A${sigR}`).value = lineText;
    ws.getCell(`A${sigR}`).font = { name: F, size: 16 };
    ws.getCell(`A${sigR}`).alignment = { horizontal: 'center' };

    if (personName) {
      ws.mergeCells(`A${sigR + 1}:C${sigR + 1}`);
      ws.getCell(`A${sigR + 1}`).value = `( ${personName} )`;
      ws.getCell(`A${sigR + 1}`).font = { name: F, size: 15 };
      ws.getCell(`A${sigR + 1}`).alignment = { horizontal: 'center' };
    }
  });

  // ทิ้งท้ายเว้นแถวว่างระหว่างสัปดาห์ (เว้นระยะ 5 แถว)
  return r + 5;
}

$('btn-export').onclick = async () => {
  // ดึงข้อมูลสัปดาห์ที่บันทึกไว้ทั้งหมด เรียงตามวันที่ (ครอบคลุมทุกเดือน)
  const allMonKeys = Object.keys(weeklyLogs).sort();
  const validWeeks = allMonKeys
    .map(monKey => ({ monKey, rec: weeklyLogs[monKey] }))
    .filter(x => x.rec && x.rec.days && x.rec.days.length > 0);

  if (validWeeks.length === 0) {
    toast('ยังไม่มีสัปดาห์ที่บันทึกไว้ในระบบให้ Export ครับ');
    return;
  }

  const wb = new ExcelJS.Workbook();

  // จัดกลุ่มตามเดือนของ "วันทำงานวันแรก" ในสัปดาห์นั้น -> 1 เดือน = 1 Sheet
  const byMonth = new Map();
  validWeeks.forEach(w => {
    const first = parseKey([...w.rec.days].sort()[0]);
    const key = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth.has(key)) byMonth.set(key, { date: first, weeks: [] });
    byMonth.get(key).weeks.push(w);
  });

  [...byMonth.keys()].sort().forEach(key => {
    const { date, weeks } = byMonth.get(key);
    const ws = wb.addWorksheet(`${TH_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`.slice(0, 31), {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true
      }
    });
    ws.columns = [{ width: 24 }, { width: 56 }, { width: 20 }];

    let nextRow = 1;
    weeks.forEach(({ monKey, rec }, i) => {
      nextRow = appendWeekTableToSheet(ws, nextRow, monKey, rec);
      // ขึ้นหน้าใหม่ทุกสัปดาห์ เพื่อให้ตรงกับหน้า PDF/พิมพ์
      if (i < weeks.length - 1) ws.getRow(nextRow - 1).addPageBreak();
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `รายงานการปฏิบัติงาน_แยกตามเดือน_${new Date().getFullYear() + 543}.xlsx`;
  a.click();
  toast(`Export Excel ครบทุกสัปดาห์สำเร็จ (${validWeeks.length} สัปดาห์ แยก ${byMonth.size} Sheet ตามเดือน) ✓`);
};

render();
