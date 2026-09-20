// 数据集自检 · 零依赖
//
// 这个仓库的产物是数据本身，所以 CI 唯一该做的事就是「验数据」，不是「抓数据」。
// 采集仍是人工在本地完成（见 README「采集与准确性」），这里只拦录入错误：
// 少一条、类别拼错、日期格式歪掉、index.json 与实际文件对不上。
//
// 用法：node .github/scripts/validate.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const INDEX_FILE = path.join(ROOT, 'index.json');
const SCHEMA_FILE = path.join(ROOT, 'schema', 'visa-bulletin.schema.json');

// 枚举值从 schema 读，不在这里另立一份。
// 踩过的坑：早先这里硬编码了 4 个类别，源数据补齐 EB-4 / EW-3 / SR 与 EB-5 三个
// 预留类别后，校验器把 60 条合法数据全判成了非法。schema 才是单一事实来源。
const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
const rowProps = schema.properties.rows.items.properties;
const CATEGORIES = rowProps.category.enum;
const CHARTS = rowProps.chart.enum;
const CHARGEABILITY = rowProps.chargeability.enum;
const EXPECTED_ROWS = CATEGORIES.length * CHARTS.length * CHARGEABILITY.length;

const SITE = 'https://yiminshuju.com';

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const isIsoDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// ── 1. 逐月校验 ──────────────────────────────────────────────
const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).sort();
if (files.length === 0) {
  console.error('✖ data/ 下没有任何 JSON 文件');
  process.exit(1);
}

const seenMonths = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));

  // 文件名与 month 字段必须一致，否则 index 的 file 映射会错位
  const expectedMonth = file.replace(/\.json$/, '');
  if (data.month !== expectedMonth) {
    fail(file, `month 字段（${data.month}）与文件名（${expectedMonth}）不一致`);
  }
  if (!isMonth(data.month)) fail(file, `month 格式应为 YYYY-MM，实为 ${data.month}`);
  seenMonths.push(expectedMonth);

  for (const key of ['source_agency', 'source_url', 'site', 'detail_url', 'license', 'rows']) {
    if (data[key] === undefined || data[key] === null) fail(file, `缺少必填字段 ${key}`);
  }

  if (!String(data.source_url).startsWith('https://travel.state.gov/')) {
    fail(file, `source_url 应指向 travel.state.gov，实为 ${data.source_url}`);
  }
  if (data.site !== SITE) fail(file, `site 应为 ${SITE}，实为 ${data.site}`);
  if (data.detail_url !== `${SITE}/paiqi/${expectedMonth}/`) {
    fail(file, `detail_url 应为 ${SITE}/paiqi/${expectedMonth}/，实为 ${data.detail_url}`);
  }
  if (data.collected_at && !isIsoDate(data.collected_at)) {
    fail(file, `collected_at 不是合法日期：${data.collected_at}`);
  }

  if (!Array.isArray(data.rows)) {
    fail(file, 'rows 不是数组');
    continue;
  }
  if (data.rows.length !== EXPECTED_ROWS) {
    fail(file, `rows 应为 ${EXPECTED_ROWS} 条，实为 ${data.rows.length}`);
  }

  // 用组合键查重与查漏：比只数条数更能定位问题
  const seen = new Set();
  for (const [i, r] of data.rows.entries()) {
    const at = `rows[${i}]`;
    if (!CATEGORIES.includes(r.category)) fail(file, `${at}.category 非法：${r.category}`);
    if (!CHARTS.includes(r.chart)) fail(file, `${at}.chart 非法：${r.chart}`);
    if (!CHARGEABILITY.includes(r.chargeability)) fail(file, `${at}.chargeability 非法：${r.chargeability}`);

    const d = r.cutoff_date;
    if (d !== 'C' && d !== 'U' && !isIsoDate(d)) {
      fail(file, `${at}.cutoff_date 非法（应为 ISO 日期或 C/U）：${d}`);
    }

    const combo = `${r.category}|${r.chart}|${r.chargeability}`;
    if (seen.has(combo)) fail(file, `${at} 组合重复：${combo}`);
    seen.add(combo);
  }

  for (const c of CATEGORIES) {
    for (const ch of CHARTS) {
      for (const g of CHARGEABILITY) {
        if (!seen.has(`${c}|${ch}|${g}`)) fail(file, `缺少组合：${c} / 表${ch} / ${g}`);
      }
    }
  }
}

// ── 2. 索引与实际文件一致性 ──────────────────────────────────
if (!fs.existsSync(INDEX_FILE)) {
  fail('index.json', '文件不存在');
} else {
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const expected = [...seenMonths].sort().reverse(); // 最新在前
  const listed = (index.months ?? []).map(m => m.month);

  if (listed.length !== expected.length) {
    fail('index.json', `months 条目数（${listed.length}）与 data/ 实际文件数（${expected.length}）不符`);
  }
  for (const m of expected) {
    if (!listed.includes(m)) fail('index.json', `缺少月份 ${m}`);
  }
  if (index.months?.[0]?.month !== expected[0]) {
    fail('index.json', `months 未按最新在前排序，首项应为 ${expected[0]}`);
  }
  if (index.latest !== expected[0]) {
    fail('index.json', `latest 应为 ${expected[0]}，实为 ${index.latest}`);
  }
  if (index.latest_file !== `data/${expected[0]}.json`) {
    fail('index.json', `latest_file 应为 data/${expected[0]}.json，实为 ${index.latest_file}`);
  }
  if (index.month_count !== expected.length) {
    fail('index.json', `month_count 应为 ${expected.length}，实为 ${index.month_count}`);
  }

  for (const m of index.months ?? []) {
    const target = path.join(ROOT, m.file);
    if (!fs.existsSync(target)) {
      fail('index.json', `months[].file 指向不存在的文件：${m.file}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (m.row_count !== data.rows.length) {
      fail('index.json', `${m.month} 的 row_count（${m.row_count}）与文件实际（${data.rows.length}）不符`);
    }
    if (m.source_url !== data.source_url) {
      fail('index.json', `${m.month} 的 source_url 与文件内不一致`);
    }
  }
}

// ── 3. 结果 ──────────────────────────────────────────────────
if (errors.length > 0) {
  console.error(`✖ 校验未通过，共 ${errors.length} 处问题：\n`);
  for (const e of errors) console.error(`  · ${e}`);
  process.exit(1);
}

console.log(`✅ 校验通过：${seenMonths.length} 个月份，每月 ${EXPECTED_ROWS} 条，索引与文件一致。`);
