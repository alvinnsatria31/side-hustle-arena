/**
 * Assemble dist/playbook.html from the content modules.
 *
 * Page numbers are never typed by hand: the page list is built first, so the
 * index, the footers and the reading-progress bar all read from the same
 * source. v1's index pointed at pages that had moved.
 *
 * Run: node docs/rewards/hr-interview-playbook/build.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stage2 } from "./content/stage2.mjs";
import { stage3 } from "./content/stage3.mjs";
import { stage4 } from "./content/stage4.mjs";
import {
  bossQuestions, closing, confidenceMatrix, howToUse, meta, onlineSetup, pauseRule, prep, presence, rescueLines,
  stages, storyBank,
} from "./content/extras.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const blueprints = [...stage2, ...stage3, ...stage4];

/* ------------------------------------------------------------------ parts */

const label = (text) => `<span class="label">${text}</span>`;

const meterHtml = (level) =>
  `<span class="meter" style="color:var(--stage)">${[1, 2, 3]
    .map((n) => `<i class="${n <= level ? "on" : ""}"></i>`)
    .join("")}</span>`;

/*
 * Icons are drawn, never typed. The latin subsets of the three fonts stop at
 * U+206F, so a literal check mark, cross or arrow would silently fall back to a
 * system font — which is how v1 ended up mixing Consolas into its diagrams.
 */
const ICONS = {
  bad: '<svg viewBox="0 0 12 12" class="li-ico" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
  good: '<svg viewBox="0 0 12 12" class="li-ico" aria-hidden="true"><path d="M2.2 6.4l2.6 2.6L9.9 3.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  dot: '<svg viewBox="0 0 12 12" class="li-ico" aria-hidden="true"><circle cx="6" cy="6" r="2.1" fill="currentColor"/></svg>',
};

const listHtml = (items, kind) =>
  `<ul class="list ${kind}">${items.map((item) => `<li>${ICONS[kind] ?? ICONS.dot}<span>${item}</span></li>`).join("")}</ul>`;

const cardHtml = ({ head, right = "", body }) => `
  <div class="card">
    <div class="card-head"><span class="h-section">${head}</span>${right}</div>
    <div class="card-body">${body}</div>
  </div>`;

const termHtml = ({ file, lines }) => `
  <div class="term">
    <div class="term-bar"><span class="dots"><i></i><i></i><i></i></span>${file}</div>
    <div class="term-body">
      ${lines.map((line) => `<p><span class="tag">[${line.tag}]</span> ${line.text}</p>`).join("")}
    </div>
  </div>`;

/* --------------------------------------------------------------- diagrams */

const arrow =
  '<span class="arrow"><svg viewBox="0 0 16 12" aria-hidden="true"><path d="M1 6h12M9.5 2.2L13.4 6l-3.9 3.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span>';

const flowHtml = (nodes) => `
  <div class="flow">
    ${nodes
      .map(
        (node) => `<div class="node">
          <span class="n-key">${node.key}</span>
          <span class="n-label">${node.label}</span>
          <span class="n-note">${node.note}</span>
        </div>`,
      )
      .join(arrow)}
  </div>`;

const tableHtml = ({ head, rows }) => `
  <table class="grid-table">
    <thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((row) => `<tr>${row.map((cell, i) => `<td>${i === 0 ? `<strong>${cell}</strong>` : cell}</td>`).join("")}</tr>`)
      .join("")}</tbody>
  </table>`;

const quadHtml = (nodes) => `
  <div class="two-col" style="gap:10px">
    ${nodes
      .map(
        (node) => `<div class="accent-card" style="padding:10px 12px">
          <span class="n-key" style="font-family:'JetBrains Mono',monospace;font-size:8.2px;letter-spacing:.14em;text-transform:uppercase;color:var(--stage);font-weight:700">${node.key}</span>
          <div style="font-size:10.6px;line-height:1.4;margin:4px 0 5px;color:var(--ink);font-weight:600">${node.label}</div>
          <div style="font-size:9.2px;color:var(--muted)">${node.note}</div>
        </div>`,
      )
      .join("")}
  </div>`;

/** Flow plus the loop that makes it a cycle. */
const cycleHtml = (nodes) => `
  ${flowHtml(nodes)}
  <svg viewBox="0 0 600 26" style="width:100%;height:20px;margin-top:5px" aria-hidden="true">
    <path d="M8 4 L8 15 Q8 20 14 20 L586 20 Q592 20 592 15 L592 6"
          fill="none" stroke="var(--line-2)" stroke-width="1.2" stroke-dasharray="4 4"/>
    <path d="M4 9 L8 3 L12 9 Z" fill="var(--line-2)"/>
    <rect x="252" y="12" width="96" height="14" fill="var(--paper)"/>
    <text x="300" y="23" text-anchor="middle" font-family="JetBrains Mono, monospace"
          font-size="8" letter-spacing="1.4" fill="#7b89a1">FEEDBACK LOOP</text>
  </svg>`;

const okrHtml = ({ nodes, levels }) => `
  <div class="flow">
    ${nodes
      .map(
        (node) => `<div class="node">
          <span class="n-key">${node.key}</span>
          <span class="n-label">${node.label}</span>
          <span class="n-note">${node.note}</span>
        </div>`,
      )
      .join(arrow)}
  </div>
  <div class="three-col" style="margin-top:10px">
    ${levels
      .map(
        (level) => `<div style="border-top:1px solid var(--line);padding-top:7px">
          <div class="label" style="color:var(--stage);margin-bottom:3px">${level.key}</div>
          <div style="font-size:9.4px;line-height:1.45;color:var(--body)">${level.note}</div>
        </div>`,
      )
      .join("")}
  </div>`;

const vennHtml = ({ nodes, result }) => `
  <div style="display:flex;gap:14px;align-items:center">
    <svg viewBox="0 0 210 130" style="width:196px;flex:none" aria-hidden="true">
      <circle cx="76" cy="52" r="44" fill="rgba(36,107,253,.12)" stroke="var(--stage)" stroke-width="1.2"/>
      <circle cx="134" cy="52" r="44" fill="rgba(15,168,146,.12)" stroke="var(--teal)" stroke-width="1.2"/>
      <circle cx="105" cy="90" r="44" fill="rgba(232,163,61,.12)" stroke="var(--amber)" stroke-width="1.2"/>
      <text x="60" y="34" font-family="JetBrains Mono, monospace" font-size="8" fill="#44546f">SKILL A</text>
      <text x="130" y="34" font-family="JetBrains Mono, monospace" font-size="8" fill="#44546f">SKILL B</text>
      <text x="84" y="122" font-family="JetBrains Mono, monospace" font-size="8" fill="#44546f">KONTEKS</text>
      <circle cx="105" cy="64" r="4" fill="var(--ink)"/>
      <text x="105" y="59" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7.5" fill="#0b1830">UVP</text>
    </svg>
    <div style="flex:1">
      ${nodes
        .map(
          (node) => `<div style="margin-bottom:8px">
            <div style="font-size:10.4px;font-weight:700;color:var(--ink)">${node.key} &middot; <span style="font-weight:500;color:var(--body)">${node.label}</span></div>
            <div style="font-size:9.4px;color:var(--muted);margin-top:1px">${node.note}</div>
          </div>`,
        )
        .join("")}
      <div class="accent-card" style="padding:8px 11px;margin-top:2px">
        <div class="label" style="color:var(--stage);margin-bottom:3px">Hasil irisan</div>
        <div style="font-size:10.4px;line-height:1.4;font-weight:600">&ldquo;${result}&rdquo;</div>
      </div>
    </div>
  </div>`;

/** Yerkes–Dodson inverted U. */
const curveHtml = (nodes) => `
  <svg viewBox="0 0 600 136" style="width:100%;height:118px" aria-hidden="true">
    <line x1="34" y1="8" x2="34" y2="110" stroke="var(--line-2)" stroke-width="1"/>
    <line x1="34" y1="110" x2="580" y2="110" stroke="var(--line-2)" stroke-width="1"/>
    <path d="M34 104 C 150 100, 210 26, 300 24 C 392 22, 450 98, 578 108"
          fill="none" stroke="var(--stage)" stroke-width="2"/>
    <rect x="228" y="16" width="146" height="76" fill="rgba(108,92,231,.07)"/>
    <circle cx="300" cy="24" r="3.4" fill="var(--stage)"/>
    <text x="300" y="12" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.4"
          letter-spacing="1.2" fill="#6c5ce7">ZONA OPTIMAL</text>
    <text x="16" y="60" font-family="JetBrains Mono, monospace" font-size="8" fill="#7b89a1"
          transform="rotate(-90 16 60)" text-anchor="middle">PERFORMA</text>
    <text x="70" y="124" font-family="JetBrains Mono, monospace" font-size="8" fill="#7b89a1">BOSAN</text>
    <text x="268" y="124" font-family="JetBrains Mono, monospace" font-size="8" fill="#7b89a1">TEKANAN SEHAT</text>
    <text x="520" y="124" font-family="JetBrains Mono, monospace" font-size="8" fill="#7b89a1">BURNOUT</text>
  </svg>
  <div class="three-col" style="margin-top:6px">
    ${nodes
      .map(
        (node) => `<div style="border-top:1px solid var(--line);padding-top:7px">
          <div class="label" style="color:var(--stage);margin-bottom:2px">${node.key} — ${node.label}</div>
          <div style="font-size:9.4px;line-height:1.45;color:var(--body)">${node.note}</div>
        </div>`,
      )
      .join("")}
  </div>`;

const decisionHtml = ({ rows, checks }) => `
  <table class="grid-table">
    <thead><tr><th style="width:24%">Gaya</th><th style="width:34%">Pakai saat</th><th>Contoh situasi</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (row) => `<tr>
            <td><strong>${row.style}</strong><div style="font-size:9px;color:var(--muted);margin-top:2px">${row.sub}</div></td>
            <td>${row.when}</td>
            <td>${row.example}</td>
          </tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <div style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px">
    <div class="label" style="margin-bottom:6px">Cek cepat sebelum memilih gaya</div>
    ${checks
      .map(
        ([q, a]) => `<div style="display:grid;grid-template-columns:1fr 300px;gap:12px;font-size:9.6px;line-height:1.6;color:var(--body)">
          <span>${q}</span>
          <span class="mono" style="color:var(--stage);font-size:9px">${a}</span>
        </div>`,
      )
      .join("")}
  </div>`;

const barsHtml = (bars) => `
  <div style="margin-top:10px">
    ${bars
      .map(
        (bar) => `<div style="display:flex;align-items:center;gap:9px;margin-bottom:5px">
          <span class="mono" style="width:74px;flex:none;font-size:8.6px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink)">${bar.key}</span>
          <span style="flex:1;height:8px;background:var(--paper-2);border-radius:4px;overflow:hidden;display:block">
            <span style="display:block;height:100%;width:${bar.pct}%;background:var(--stage);border-radius:4px"></span>
          </span>
          <span class="mono" style="width:26px;flex:none;font-size:9px;color:var(--ink)">${bar.pct}%</span>
          <span style="width:150px;flex:none;font-size:9px;color:var(--muted)">${bar.note}</span>
        </div>`,
      )
      .join("")}
  </div>`;

function cheatHtml(cheat) {
  const parts = [];
  if (cheat.kind === "flow") parts.push(flowHtml(cheat.nodes));
  if (cheat.kind === "quad") parts.push(quadHtml(cheat.nodes));
  if (cheat.kind === "cycle") parts.push(cycleHtml(cheat.nodes));
  if (cheat.kind === "okr") parts.push(okrHtml(cheat));
  if (cheat.kind === "venn") parts.push(vennHtml(cheat));
  if (cheat.kind === "curve") parts.push(curveHtml(cheat.nodes));
  if (cheat.kind === "decision") parts.push(decisionHtml(cheat));
  if (cheat.bars) parts.push(barsHtml(cheat.bars));
  if (cheat.table) parts.push(`<div style="margin-top:10px">${tableHtml(cheat.table)}</div>`);
  if (cheat.note) {
    parts.push(
      `<p style="margin:10px 0 0;font-size:9.6px;line-height:1.5;color:var(--muted)"><span class="mono" style="color:var(--stage);font-weight:700">&rsaquo;</span> ${cheat.note}</p>`,
    );
  }
  return parts.join("");
}

/* ------------------------------------------------------------------ pages */

const pages = [];
const addPage = (descriptor) => {
  pages.push(descriptor);
  return pages.length;
};

/** Wrap page content in the shared frame. Page numbers resolve after layout. */
function frame({ index, total, stage, dark = false, grid = true, topRight = "", body }) {
  const accent = stages[stage] ? stages[stage].accent : "var(--blue)";
  const stageName = stages[stage] ? stages[stage].name : "";
  const pct = Math.round((index / total) * 100);
  const classes = ["page", dark ? "dark" : "", !dark && grid ? "light-grid" : ""].filter(Boolean).join(" ");
  return `
  <section class="${classes}" style="--stage:${accent}">
    <div class="inner">
      <div class="topbar">
        <span class="stage-tag">${stage === 0 ? "" : stage > 4 ? stageName : `Stage ${stage} &middot; ${stageName}`}</span>
        <span class="label">${topRight}</span>
      </div>
      <div class="content">${body}</div>
      <div class="footer">
        <span>${meta.title} Cheat Code ${meta.version}</span>
        <span class="xp"><i style="width:${pct}%"></i></span>
        <span>${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>
      </div>
    </div>
  </section>`;
}

function coverPage() {
  return `
  <section class="page dark" style="--stage:var(--blue)">
    <span class="glow"></span><span class="glow b"></span>
    <div class="inner" style="padding:56px 54px 44px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="brand-lockup">
          <img src="../../notion-resume-kit/assets/sekolah-karir-mark.png" alt="">
          <span class="txt">SEKOLAH KARIR <span>&middot; DIGITAL PRODUCT</span></span>
        </div>
        <span class="label" style="color:#8296b5">FILE_01.PDF</span>
      </div>

      <div style="margin:auto 0">
        <div class="label" style="color:#7cc4ff;margin-bottom:20px">// LOADING INTERVIEW PROTOCOL</div>
        <h1 class="cover-title">${meta.title}<br><span class="outline">${meta.titleOutline}</span><br>${meta.titleTail}</h1>
        <div style="display:flex;align-items:center;gap:14px;margin:26px 0 20px">
          <span style="width:54px;height:3px;background:var(--mint);display:block;border-radius:2px"></span>
          <span class="mono" style="font-size:12px;color:var(--mint);letter-spacing:.18em">${meta.version.toUpperCase()}</span>
        </div>
        <p style="max-width:420px;margin:0;font-size:13px;line-height:1.65;color:#b9c7dd">${meta.subtitle}</p>

      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
        <div>
          <div style="display:flex;gap:30px;padding-bottom:24px">
            ${[
            ["12", "blueprint pertanyaan"],
            ["04", "boss question"],
            ["05", "cerita wajib"],
          ]
            .map(
              ([number, caption]) => `<div>
                <div style="font-family:Manrope,sans-serif;font-weight:800;font-size:27px;color:#fff;line-height:1">${number}</div>
                <div class="label" style="color:#8296b5;margin-top:5px">${caption}</div>
              </div>`,
            )
              .join("")}
          </div>
          <div class="chip dark-ghost" style="margin-bottom:14px">${meta.arena} &middot; 600 poin</div>
          <div class="label" style="color:#8296b5">${meta.author}</div>
        </div>
        <div class="term" style="width:250px;flex:none;box-shadow:none;border:1px solid rgba(255,255,255,.14)">
          <div class="term-bar"><span class="dots"><i></i><i></i><i></i></span>status</div>
          <div class="term-body" style="font-size:10px">
            <p><span style="color:#5ee3b0">&gt; PASSED_</span></p>
            <p style="color:#8296b5;margin:0">STATUS: OFFER_LETTER_RECEIVED<br>CANDIDATE: YOU</p>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function indexPage(index, total, stageIndex) {
  const group = (stageNo, items) => `
    <div class="stage-card" style="--stage:${stages[stageNo].accent}">
      <div class="sc-head">
        <span class="num">${stageNo > 4 ? (stageNo === 5 ? "Boss" : "Toolkit") : `Stage ${stageNo}`}</span>
        <span class="nm">${stages[stageNo].name}</span>
      </div>
      <ol>
        ${items
          .map(
            (item) => `<li>
              <span class="id">${item.id}</span>
              <span class="nm2">${item.title}</span>
              <span class="dots"></span>
              <span class="pg">${String(item.page).padStart(2, "0")}</span>
            </li>`,
          )
          .join("")}
      </ol>
    </div>`;

  const body = `
    <div style="margin-bottom:18px">
      <h2 style="font-size:30px">Isi Buku</h2>
      <p style="margin:7px 0 0;font-size:11.5px;color:var(--muted);max-width:460px">
        Enam bagian, enam belas blueprint. Boleh dilompat sesuai kebutuhan — tapi Stage 1 wajib dibaca sebelum interview pertama Anda.
      </p>
    </div>
    <div class="two-col" style="gap:13px">
      ${group(1, stageIndex[1])}
      ${group(2, stageIndex[2])}
      ${group(3, stageIndex[3])}
      ${group(4, stageIndex[4])}
      ${group(5, stageIndex[5])}
      ${group(6, stageIndex[6])}
    </div>
    <div class="two-col" style="gap:13px;margin-top:14px">
      <div class="card">
        <div class="card-head"><span class="h-section">Tiga lapis tiap blueprint</span></div>
        <div class="card-body" style="padding:11px 13px">
          ${howToUse.layers
            .map(
              (layer) => `<div style="display:flex;gap:9px;margin-bottom:7px">
                <span class="mono" style="color:var(--stage);font-size:9px;font-weight:700;flex:none;padding-top:1px">${layer.key}</span>
                <span style="font-size:10.2px;line-height:1.4"><b>${layer.label}</b><span style="color:var(--muted)"> — ${layer.note}</span></span>
              </div>`,
            )
            .join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><span class="h-section">Rute baca</span></div>
        <div class="card-body" style="padding:11px 13px">
          ${howToUse.routes
            .map(
              (route) => `<div style="display:flex;gap:9px;margin-bottom:7px">
                <span class="mono" style="color:var(--stage);font-size:9px;font-weight:700;flex:none;padding-top:1px">&rsaquo;</span>
                <span style="font-size:10.2px;line-height:1.4"><b>${route.key}</b><span style="color:var(--muted)"> — ${route.note}</span></span>
              </div>`,
            )
            .join("")}
        </div>
      </div>
    </div>
    <div class="accent-card" style="margin-top:14px;--stage:var(--amber)">
      ${howToUse.rules
        .map(
          (rule, i) =>
            `<div style="display:flex;gap:9px;${i === howToUse.rules.length - 1 ? "" : "margin-bottom:6px"}">
              <span class="mono" style="color:var(--amber);font-size:9.5px;flex:none">$</span>
              <span style="font-size:10.2px;line-height:1.5;color:var(--body)">${rule}</span>
            </div>`,
        )
        .join("")}
    </div>`;

  return frame({ index, total, stage: 0, topRight: "THE INDEX", body });
}

function blueprintPage(item, index, total) {
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px">
      <div style="flex:1;min-width:0">
        <div class="label" style="color:var(--stage);margin-bottom:8px">Question ${item.id.slice(1)} &middot; ${item.tag}</div>
        <h2 class="q-title">${item.title}</h2>
        <p class="mono" style="margin:9px 0 0;font-size:11px;color:var(--body)">&gt; &ldquo;${item.question}&rdquo;</p>
      </div>
      <div style="flex:none;text-align:right">
        <div class="label" style="margin-bottom:4px">Target</div>
        <div class="mono" style="font-size:13px;font-weight:700;color:var(--ink)">${item.target}</div>
        <div style="margin-top:9px" class="label">Level</div>
        <div style="margin-top:4px">${meterHtml(item.level)}</div>
      </div>
    </div>

    <div style="margin:18px 0 14px">
      <div class="label" style="margin-bottom:6px">Pertanyaan di balik pertanyaan</div>
      <p class="pull" style="margin:0">${item.hidden}</p>
      <p style="margin:9px 0 0;font-size:10.8px;line-height:1.55;color:var(--body)">${item.esensi}</p>
    </div>

    <div class="two-col" style="margin-bottom:14px">
      <div>
        <div class="mini-head bad">Jebakannya</div>
        ${listHtml(item.traps, "bad")}
      </div>
      <div>
        <div class="mini-head good">Yang dinilai</div>
        ${listHtml(item.judged, "good")}
      </div>
    </div>

    ${cardHtml({
      head: `Cheat code &mdash; ${item.cheat.name}`,
      right: `<span class="label">Framework</span>`,
      body: cheatHtml(item.cheat),
    })}

    <div style="margin-top:14px">${termHtml(item.answer)}</div>

    <div class="two-col" style="margin-top:14px;gap:14px">
      <div class="accent-card" style="padding:10px 12px">
        <div class="label" style="color:var(--stage);margin-bottom:4px">Pro move</div>
        <div style="font-size:10.2px;line-height:1.45;color:var(--body)">${item.pro}</div>
      </div>
      <div class="accent-card" style="padding:10px 12px;--stage:var(--mint)">
        <div class="label" style="color:var(--mint);margin-bottom:4px">Dari Side Hustle Arena</div>
        <div style="font-size:10.2px;line-height:1.45;color:var(--body)">${item.arena}</div>
      </div>
    </div>`;

  return frame({ index, total, stage: item.stage, topRight: `${item.id} / 12`, body });
}

function rulesPage(index, total) {
  const body = `
    <div style="margin-bottom:16px">
      <div class="label" style="color:var(--stage);margin-bottom:8px">Rules of engagement</div>
      <h2 class="q-title">Mindset &amp; Aturan Main</h2>
    </div>

    ${cardHtml({
      head: `Rule 01 &mdash; ${pauseRule.title}`,
      right: `<span class="label">Saat ditanya mendadak</span>`,
      body: `
        <p style="margin:0 0 11px;font-size:10.8px;line-height:1.55;color:var(--body)">${pauseRule.lead}</p>
        ${flowHtml(pauseRule.steps)}
        <p style="margin:10px 0 0;font-size:9.6px;line-height:1.5;color:var(--muted)"><span class="mono" style="color:var(--stage);font-weight:700">&rsaquo;</span> ${pauseRule.note}</p>`,
    })}

    <div style="margin-top:16px">
      ${cardHtml({
        head: `Rule 02 &mdash; ${confidenceMatrix.title}`,
        right: `<span class="label">Batas tipisnya</span>`,
        body: `
          <p style="margin:0 0 11px;font-size:10.8px;line-height:1.55;color:var(--body)">${confidenceMatrix.lead}</p>
          <div class="vs">
            <div class="col-head bad">Arogan &mdash; hindari</div>
            <div class="col-head good">Percaya diri &mdash; lakukan</div>
            ${confidenceMatrix.rows
              .map(
                ([bad, good], i) => {
                  const last = i === confidenceMatrix.rows.length - 1 ? " last" : "";
                  return `<div class="cell l${last}">${bad}</div><div class="cell${last}">${good}</div>`;
                },
              )
              .join("")}
          </div>`,
      })}
    </div>

    <div style="margin-top:16px">
      ${cardHtml({
        head: `Rule 03 &mdash; ${rescueLines.title}`,
        right: `<span class="label">Saat buntu</span>`,
        body: `
          <p style="margin:0 0 10px;font-size:10.8px;line-height:1.55;color:var(--body)">${rescueLines.lead}</p>
          ${tableHtml({ head: ["Momen", "Kalimatnya"], rows: rescueLines.rows })}
          <p style="margin:10px 0 0;font-size:9.6px;line-height:1.5;color:var(--muted)"><span class="mono" style="color:var(--stage);font-weight:700">&rsaquo;</span> ${rescueLines.note}</p>`,
      })}
    </div>`;

  return frame({ index, total, stage: 1, topRight: "R1 / R2 / R3", body });
}

function presencePage(index, total) {
  const body = `
    <div style="margin-bottom:16px">
      <div class="label" style="color:var(--stage);margin-bottom:8px">Rule 04 &amp; 05</div>
      <h2 class="q-title">${presence.title}</h2>
      <p style="margin:8px 0 0;font-size:11.5px;color:var(--muted)">${presence.lead}</p>
    </div>

    <div class="three-col">
      ${presence.columns
        .map(
          (column) => `<div class="card">
            <div class="card-head" style="padding:7px 12px"><span class="h-section">${column.key}</span></div>
            <div class="card-body" style="padding:11px 12px">
              ${listHtml(column.items, column.bad ? "bad" : "dot")}
            </div>
          </div>`,
        )
        .join("")}
    </div>

    <div style="margin-top:18px">
      ${cardHtml({
        head: prep.title,
        right: `<span class="label">H-1 &amp; H-0</span>`,
        body: `
          <div class="two-col">
            ${prep.groups
              .map(
                (group) => `<div>
                  <div class="mini-head" style="color:var(--stage)">${group.key}</div>
                  ${listHtml(group.items, "dot")}
                </div>`,
              )
              .join("")}
          </div>`,
      })}
    </div>

    <div style="margin-top:18px">
      ${cardHtml({
        head: onlineSetup.title,
        right: `<span class="label">Setup</span>`,
        body: `
          <p style="margin:0 0 11px;font-size:10.8px;line-height:1.55;color:var(--body)">${onlineSetup.lead}</p>
          <div class="two-col" style="gap:12px">
            ${onlineSetup.items
              .map(
                (row) => `<div style="border-top:1px solid var(--line);padding-top:8px">
                  <div class="label" style="color:var(--stage);margin-bottom:3px">${row.key}</div>
                  <div style="font-size:10px;line-height:1.45;color:var(--body)">${row.note}</div>
                </div>`,
              )
              .join("")}
          </div>
          <p style="margin:11px 0 0;font-size:9.6px;line-height:1.5;color:var(--muted)"><span class="mono" style="color:var(--stage);font-weight:700">&rsaquo;</span> ${onlineSetup.note}</p>`,
      })}
    </div>

    <div class="accent-card" style="margin-top:18px">
      <div class="label" style="color:var(--stage);margin-bottom:5px">Satu hal yang paling sering dilupakan</div>
      <p style="margin:0;font-size:11px;line-height:1.55;color:var(--body)">
        Latihan di depan kamera terasa canggung, dan itu justru gunanya. Semua yang membuat Anda malu saat menonton rekaman
        adalah hal yang dilihat interviewer — dan hampir semuanya bisa diperbaiki dalam satu kali pengulangan.
      </p>
    </div>`;

  return frame({ index, total, stage: 1, topRight: "R4 / R5", body });
}

function masterPage(item, index, total) {
  const body = `
    <div style="margin-bottom:16px">
      <div class="label" style="color:var(--stage);margin-bottom:8px">${item.id} &middot; ${item.tag}</div>
      <h2 class="q-title">${item.title}</h2>
      <p style="margin:8px 0 0;font-size:11.5px;color:var(--muted);max-width:520px">${item.question}</p>
    </div>

    ${cardHtml({
      head: "Kapan pakai yang mana",
      right: `<span class="label">Tiga format</span>`,
      body: `<p style="margin:0 0 11px;font-size:10.6px;line-height:1.55;color:var(--body)">${item.hidden}</p>` + tableHtml({
        head: ["Format", "Struktur", "Paling pas untuk"],
        rows: item.formats.map((format) => [format.name, format.struct, format.best]),
      }),
    })}

    <div class="two-col" style="margin-top:14px">
      ${cardHtml({
        head: "Anatomi jawaban",
        body: `
          ${item.anatomy
            .map(
              (row) => `<div style="display:flex;gap:9px;align-items:baseline;margin-bottom:6px">
                <span class="mono" style="width:64px;flex:none;font-size:9px;color:var(--stage);font-weight:700;text-transform:uppercase">${row.part}</span>
                <span style="flex:1;font-size:10.2px;line-height:1.4;color:var(--body)">${row.spec}</span>
                <span class="mono" style="flex:none;font-size:8.6px;color:var(--muted)">${row.len}</span>
              </div>`,
            )
            .join("")}
          <div style="border-top:1px solid var(--line);margin-top:9px;padding-top:9px;font-size:9.8px;line-height:1.5;color:var(--body)">
            <b style="color:var(--ink)">Kata kerja kuat:</b> ${item.verbs.strong}.<br>
            <b style="color:var(--ink)">Hindari:</b> ${item.verbs.weak}.
          </div>`,
      })}
      ${cardHtml({
        head: "Quality control",
        body: `
          <div class="mini-head bad">Jawaban kosong</div>
          ${listHtml(item.quality.bad, "bad")}
          <div class="mini-head good" style="margin-top:11px">Jawaban meaty</div>
          ${listHtml(item.quality.good, "good")}`,
      })}
    </div>

    <div class="two-col" style="margin-top:14px">
      ${item.templates.map((template) => termHtml({ file: template.file, lines: template.lines })).join("")}
    </div>`;

  return frame({ index, total, stage: item.stage, topRight: "MASTER TEMPLATE", body });
}

function bossPage(items, index, total, part) {
  const block = (item) => `
    <div style="margin-bottom:${part === 1 ? "18px" : "0"}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div class="label" style="color:var(--stage);margin-bottom:6px">${item.id} &middot; Boss question</div>
          <h3 style="font-size:21px">${item.title}</h3>
          <p class="mono" style="margin:7px 0 0;font-size:10.4px;color:var(--body)">&gt; &ldquo;${item.question}&rdquo;</p>
        </div>
        <div class="accent-card" style="width:250px;flex:none;padding:9px 11px">
          <div class="label" style="color:var(--stage);margin-bottom:3px">Yang sebenarnya ditanya</div>
          <div style="font-size:10px;line-height:1.45;color:var(--ink);font-weight:500">${item.hidden}</div>
        </div>
      </div>

      <p style="margin:0 0 11px;font-size:10.6px;line-height:1.55;color:var(--body)">${item.esensi}</p>

      ${flowHtml(item.steps)}

      <div class="two-col" style="margin-top:11px;gap:13px">
        <div>
          <div class="mini-head bad">Jebakannya</div>
          ${listHtml(item.traps, "bad")}
        </div>
        <div class="term">
          <div class="term-bar"><span class="dots"><i></i><i></i><i></i></span>contoh jawaban</div>
          <div class="term-body" style="font-size:9.4px">
            <p>${item.answer}</p>
            ${item.note ? `<p style="color:#8296b5;margin:7px 0 0;font-size:8.8px">// ${item.note}</p>` : ""}
          </div>
        </div>
      </div>

      ${item.askThese
        ? `<div class="two-col" style="margin-top:11px;gap:13px">
            <div class="accent-card" style="padding:10px 12px">
              <div class="label" style="color:var(--stage);margin-bottom:6px">Bank pertanyaan balik</div>
              ${listHtml(item.askThese, "dot")}
            </div>
            <div class="accent-card" style="padding:10px 12px;--stage:var(--muted)">
              <div class="label" style="margin-bottom:6px">Simpan untuk tahap penawaran</div>
              ${listHtml(item.saveForLater, "bad")}
            </div>
          </div>`
        : ""}
    </div>`;

  const body = `
    ${part === 1
      ? `<div style="margin-bottom:16px">
          <h2 class="q-title">Boss Stage</h2>
          <p style="margin:8px 0 0;font-size:11.5px;color:var(--muted);max-width:540px">
            Empat pertanyaan yang paling sering menjatuhkan kandidat bagus — dan tidak pernah masuk daftar latihan siapa pun.
          </p>
        </div>`
      : ""}
    ${items.map(block).join("")}`;

  return frame({ index, total, stage: 5, topRight: items.map((item) => item.id).join(" / "), body });
}

function storyBankPage(index, total) {
  const body = `
    <div style="margin-bottom:16px">
      <div class="label" style="color:var(--stage);margin-bottom:8px">Worksheet</div>
      <h2 class="q-title">${storyBank.title}</h2>
      <p style="margin:8px 0 0;font-size:11.5px;color:var(--muted);max-width:520px">${storyBank.lead}</p>
    </div>

    ${storyBank.stories
      .map(
        (story) => `<div class="ws-box" style="margin-bottom:11px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <span style="font-size:11.4px;font-weight:800;color:var(--ink)">
              <span class="mono" style="color:var(--stage);font-size:9px;margin-right:7px">${story.key}</span>${story.label}
            </span>
            <span class="mono" style="font-size:8.6px;color:var(--muted);letter-spacing:.1em">MENJAWAB ${story.covers}</span>
          </div>
          <div class="three-col" style="gap:11px">
            ${storyBank.fields
              .map(
                (field) => `<div>
                  <div class="label" style="font-size:8px;margin-bottom:3px">${field}</div>
                  <div class="rule-line" style="height:16px"></div>
                  <div class="rule-line" style="height:16px"></div>
                  <div class="rule-line" style="height:16px"></div>
                </div>`,
              )
              .join("")}
          </div>
        </div>`,
      )
      .join("")}

    <div class="accent-card" style="--stage:var(--amber)">
      <p style="margin:0;font-size:10.4px;line-height:1.5;color:var(--body)">${storyBank.note}</p>
    </div>`;

  return frame({ index, total, stage: 6, topRight: "STORY BANK", body });
}

function closingPage(index, total) {
  const body = `
    <div style="margin-bottom:18px">
      <div class="label" style="color:var(--stage);margin-bottom:8px">Final stage</div>
      <h2 class="q-title" style="max-width:420px">${closing.title}</h2>
    </div>

    ${cardHtml({
      head: closing.scorecard.title,
      right: `<span class="label">Enam centang</span>`,
      body: `
        <p style="margin:0 0 11px;font-size:10.6px;line-height:1.5;color:var(--body)">${closing.scorecard.lead}</p>
        <div class="two-col" style="gap:14px">
          ${[0, 1]
            .map(
              (half) => `<div>${closing.scorecard.items
                .slice(half * 3, half * 3 + 3)
                .map(
                  (checkItem) => `<div style="display:flex;gap:9px;align-items:flex-start;margin-bottom:8px">
                    <span style="width:13px;height:13px;border:1px solid var(--line-2);border-radius:3px;flex:none;display:block;margin-top:1px"></span>
                    <span style="font-size:10.4px;line-height:1.35;color:var(--body)">${checkItem}</span>
                  </div>`,
                )
                .join("")}</div>`,
            )
            .join("")}
        </div>`,
    })}

    <div style="margin-top:18px">
      ${closing.notes
        .map(
          (note) => `<div style="display:flex;gap:11px;padding:11px 0;border-top:1px solid var(--line)">
            <span class="mono" style="color:var(--stage);font-size:10px;flex:none">$</span>
            <span style="font-size:11px;line-height:1.6;color:var(--body)">${note}</span>
          </div>`,
        )
        .join("")}
    </div>

    <div style="margin-top:18px">
      ${cardHtml({
        head: closing.followUp.title,
        right: `<span class="label">Email follow-up</span>`,
        body: `
          <p style="margin:0 0 11px;font-size:10.6px;line-height:1.5;color:var(--body)">${closing.followUp.lead}</p>
          ${termHtml({ file: "follow_up_email.txt", lines: closing.followUp.lines })}
          <p style="margin:10px 0 0;font-size:9.6px;line-height:1.5;color:var(--muted)"><span class="mono" style="color:var(--stage);font-weight:700">&rsaquo;</span> ${closing.followUp.note}</p>`,
      })}
    </div>

    <div class="term" style="margin-top:18px">
      <div class="term-bar"><span class="dots"><i></i><i></i><i></i></span>final_check.sh</div>
      <div class="term-body">
        <p><span class="tag">[H-0]</span> Lima cerita di Story Bank sudah terisi.</p>
        <p><span class="tag">[H-0]</span> Dua pertanyaan balik sudah dipilih dari Boss Stage.</p>
        <p><span class="tag">[H-0]</span> Satu jawaban pembuka sudah direkam dan lolos enam centang.</p>
        <p style="color:#5ee3b0;margin-top:9px">&gt; READY_</p>
      </div>
    </div>`;

  return frame({ index, total, stage: 6, topRight: "CHECKLIST", body });
}

function backCover() {
  return `
  <section class="page dark" style="--stage:var(--mint)">
    <span class="glow b"></span>
    <div class="inner" style="padding:56px 54px 44px">
      <div class="brand-lockup">
        <img src="../../notion-resume-kit/assets/sekolah-karir-mark.png" alt="">
        <span class="txt">SEKOLAH KARIR</span>
      </div>

      <div style="margin-top:auto;margin-bottom:auto;max-width:460px">
        <h2 style="font-size:34px;line-height:1.08;color:#fff">Buku ini selesai.<br>Bukti Anda belum.</h2>
        <p style="margin:18px 0 0;font-size:12.5px;line-height:1.7;color:#b9c7dd">
          Framework di atas hanya berguna kalau ada cerita nyata yang mengisinya. Kalau stok cerita Anda masih tipis,
          ambil satu project nyata tiap minggu di Side Hustle Arena — kerjakan, dapat feedback terukur, dan bawa hasilnya
          ke ruang interview.
        </p>
        <div class="mono" style="margin-top:22px;font-size:12px;letter-spacing:.14em;color:var(--mint)">arena.sekolahkarir.id</div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid rgba(255,255,255,.14);padding-top:16px">
        <div class="label" style="color:#8296b5">
          ${meta.title} Cheat Code &amp; Frameworks ${meta.version}<br>
          &copy; ${meta.author}
        </div>
        <div class="label" style="color:#8296b5">${meta.site}</div>
      </div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------- assembly */

// Layout first, render second: every page number below is derived, never typed.
const layout = [
  { kind: "cover" },
  { kind: "index" },
  { kind: "rules", stage: 1, id: "R1", title: "Aturan jeda &amp; kalimat penyelamat" },
  { kind: "presence", stage: 1, id: "R2", title: "Presence &amp; interview online" },
  ...blueprints.map((item) => ({ kind: item.kind === "master" ? "master" : "blueprint", item, stage: item.stage, id: item.id, title: item.title })),
  { kind: "boss", part: 1, items: bossQuestions.slice(0, 2), stage: 5 },
  { kind: "boss", part: 2, items: bossQuestions.slice(2), stage: 5 },
  { kind: "storybank", stage: 6, id: "WS", title: storyBank.title },
  { kind: "closing", stage: 6, id: "FIN", title: closing.title },
  { kind: "back" },
];

const total = layout.length;
const stageIndex = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
layout.forEach((entry, i) => {
  const page = i + 1;
  if (entry.kind === "boss") {
    for (const item of entry.items) stageIndex[5].push({ id: item.id, title: item.title, page });
  } else if (entry.stage) {
    stageIndex[entry.stage].push({ id: entry.id, title: entry.title, page });
  }
});

const html = layout
  .map((entry, i) => {
    const page = i + 1;
    switch (entry.kind) {
      case "cover": return coverPage();
      case "index": return indexPage(page, total, stageIndex);
      case "rules": return rulesPage(page, total);
      case "presence": return presencePage(page, total);
      case "blueprint": return blueprintPage(entry.item, page, total);
      case "master": return masterPage(entry.item, page, total);
      case "boss": return bossPage(entry.items, page, total, entry.part);
      case "storybank": return storyBankPage(page, total);
      case "closing": return closingPage(page, total);
      case "back": return backCover();
      default: throw new Error(`unknown page kind: ${entry.kind}`);
    }
  })
  .join("\n");

const document = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${meta.title} Cheat Code ${meta.version} — Sekolah Karir</title>
<link rel="stylesheet" href="../assets/fonts.css">
<link rel="stylesheet" href="../styles.css">
</head>
<body>
${html}
</body>
</html>`;

await fs.mkdir(path.join(here, "dist"), { recursive: true });
await fs.writeFile(path.join(here, "dist", "playbook.html"), document, "utf8");
console.log(`wrote dist/playbook.html — ${total} pages`);
