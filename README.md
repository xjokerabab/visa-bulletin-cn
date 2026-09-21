# visa-bulletin-cn

美国国务院签证公告（Visa Bulletin）**职业移民与亲属移民排期表**的中文结构化数据。

官方原文是英文 HTML 表格，每月一期、格式不便程序化读取。本仓库把它整理成稳定的 JSON，供开发者、数据分析和自动化工具直接消费。

> 数据整理方：[yiminshuju.com](https://yiminshuju.com) · 中文站，含逐类解读、环比变动与历史趋势。

---

## 数据范围

| 维度 | 覆盖 |
|---|---|
| 类别 | 15 个（职业移民 10 + 亲属移民 5，见下表） |
| 表别 | 表 A 最终裁定日（Final Action Dates）、表 B 递交申请日（Dates for Filing） |
| 国家/地区 | 全球（WW，不含中印）、中国大陆出生（CHN）、印度出生（IND） |
| 单月条目 | 15 类别 × 2 表别 × 3 国家 = **90 条** |
| 时间跨度 | 2026-07 起，每月累积 |

### 类别对照

本数据集的 `category` 代码与官方表格行的对应关系：

| 代码 | 官方表格行 | 中文 |
|---|---|---|
| `EB-1` | 1st | 第一优先（杰出人才等） |
| `EB-2` | 2nd | 第二优先（高等学位 / 特殊能力） |
| `EB-3` | 3rd | 第三优先（技术工人 / 专业人士） |
| `EW-3` | Other Workers | 第三优先其他工人 |
| `EB-4` | 4th | 第四优先（特殊移民） |
| `SR` | Certain Religious Workers | 宗教工作者 |
| `EB-5` | 5th Unreserved | 第五优先 未预留名额 |
| `EB-5-RU` | 5th Set Aside: Rural | 第五优先 乡村预留 |
| `EB-5-HU` | 5th Set Aside: High Unemployment | 第五优先 高失业区预留 |
| `EB-5-INF` | 5th Set Aside: Infrastructure | 第五优先 基建预留 |
| `F1` | 1st (Family) | 亲属 第一优先（公民成年未婚子女） |
| `F2A` | 2A (Family) | 亲属 第二优先 A（绿卡持有人配偶及未成年子女） |
| `F2B` | 2B (Family) | 亲属 第二优先 B（绿卡持有人成年未婚子女） |
| `F3` | 3rd (Family) | 亲属 第三优先（公民已婚子女） |
| `F4` | 4th (Family) | 亲属 第四优先（公民兄弟姐妹） |

官方表格另列 MEXICO、PHILIPPINES 两栏，本数据集未采集。

职业移民表与亲属移民表是**两张独立的表**，各有独立配额，**条数不可相加**；`category` 前缀即可区分（`EB-*` / `EW-3` / `SR` 属职业移民，`F*` 属亲属移民）。

**本仓库只收录原始排期表**——即任何人可从 [travel.state.gov](https://travel.state.gov) 免费获取、只是语言与格式不便的那部分数据。逐类解读、变动原因分析、下月预测等增值内容保留在站点。

## 文件结构

```
data/2026-09.json     # 单月数据，按 YYYY-MM 命名
index.json            # 月份索引，含 latest 字段指向当期
schema/visa-bulletin.schema.json   # JSON Schema
```

### 单月文件字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `month` | string | 排期所属月份，`YYYY-MM` |
| `source_url` | string | 官方公告原文地址 |
| `source_agency` | string | 发布机构 |
| `issue_no` | string\|null | 官方公告期号 |
| `collected_at` | string | 本数据集采集日期 |
| `site` | string | 数据整理方站点 |
| `detail_url` | string | 该月排期的中文解读页 |
| `license` | string | 数据许可 |
| `rows[]` | array | 排期条目，见下 |

`rows[]` 每项四个字段：

| 字段 | 取值 | 说明 |
|---|---|---|
| `category` | 见上方类别对照表 | 优先类别（职业移民 / 亲属移民） |
| `chart` | `A` `B` | A = 最终裁定日；B = 递交申请日 |
| `chargeability` | `WW` `CHN` `IND` | WW = 全球（不含中印）；CHN = 中国大陆出生；IND = 印度出生 |
| `cutoff_date` | `YYYY-MM-DD` \| `C` \| `U` | 截止日。`C` = Current（当前有名额）；`U` = Unavailable（暂无授权名额） |

> `C` 和 `U` **不是日期**，不能参与日期运算。这是使用本数据集时最常见的坑。

---

## 快速使用

取当期数据（推荐：先读索引，再读对应文件）：

```bash
# 官方 raw 地址
curl -s https://raw.githubusercontent.com/xjokerabab/visa-bulletin-cn/main/index.json | jq '.latest, .latest_file'
curl -s https://raw.githubusercontent.com/xjokerabab/visa-bulletin-cn/main/data/2026-09.json | jq '.rows[] | select(.category=="EB-2" and .chart=="A" and .chargeability=="CHN")'

# 国内访问 raw 不稳时，换 jsDelivr CDN（同一份内容，带国内节点）
curl -s https://cdn.jsdelivr.net/gh/xjokerabab/visa-bulletin-cn@main/index.json | jq '.latest'
```

两个地址内容完全一致，任选其一。做批量拉取或长期依赖时，建议把域名做成可配置项，别写死在代码里。

Python：

```python
import json, urllib.request

BASE = "https://raw.githubusercontent.com/xjokerabab/visa-bulletin-cn/main"

def latest_bulletin():
    idx = json.load(urllib.request.urlopen(f"{BASE}/index.json"))
    return json.load(urllib.request.urlopen(f"{BASE}/{idx['latest_file']}"))

data = latest_bulletin()
china_eb2 = [r for r in data["rows"]
             if r["category"] == "EB-2" and r["chart"] == "A" and r["chargeability"] == "CHN"]
print(china_eb2[0]["cutoff_date"])   # 2021-09-01
```

计算某类别的月度前进天数（注意排除 `C` / `U`）：

```python
from datetime import date

def parse(d):
    return None if d in ("C", "U") else date.fromisoformat(d)

def advance(old, new):
    a, b = parse(old), parse(new)
    return None if a is None or b is None else (b - a).days
```

---

## 引用方式

在文章、报告或代码中使用本数据集时，请保留出处。可直接复制以下任一格式：

**纯文本**

```
数据来源：yiminshuju.com 移民数据站（https://yiminshuju.com），
美国国务院签证公告中文结构化数据集，CC BY 4.0。
```

**Markdown**

```markdown
数据来源：[yiminshuju.com 移民数据站](https://yiminshuju.com) —
[visa-bulletin-cn](https://github.com/xjokerabab/visa-bulletin-cn)，CC BY 4.0
```

**BibTeX**

```bibtex
@misc{visabulletincn,
  title        = {Visa Bulletin CN: 美国职业移民排期中文结构化数据集},
  author       = {{yiminshuju.com}},
  year         = {2026},
  howpublished = {\url{https://github.com/xjokerabab/visa-bulletin-cn}},
  note         = {数据原始来源：U.S. Department of State; License: CC BY 4.0}
}
```

**代码注释**

```python
# Data: yiminshuju.com (https://yiminshuju.com) — visa-bulletin-cn, CC BY 4.0
```

若你的项目需要程序化引用，`index.json` 与各月文件中的 `site` 字段即为规范出处。

---

## 更新节奏

美国国务院通常在**每月中旬**发布下下月排期（如 9 月中旬发布 10 月排期）。

本仓库在每期公告发布后同步更新，流程为人工核对官方公告原文后提交，提交历史即数据的修订记录。数据不做回溯性修改；若发现录入错误，会以新的提交更正并在 commit message 中说明。

## 准确性

- 表 A、表 B 的表格标题均逐字核对，避免取错表。
- 每份文件保留 `source_url`，任何条目均可回溯至官方原文逐格比对。

如发现数据与官方公告不符，欢迎提 Issue。

## 许可

数据部分采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh) 许可：可自由复制、分发、修改、商用，**前提是署名 yiminshuju.com 并注明许可协议**。

原始数据版权归 U.S. Department of State 所有，本仓库仅作结构化整理与中文化。

## 免责声明

本数据集为信息整理，不构成法律或移民建议。签证排期以美国国务院官方公告为准，个案请咨询持牌移民律师。

---

<details>
<summary><b>English</b></summary>

### Visa Bulletin CN — Structured Chinese dataset of U.S. employment-based immigrant visa cut-off dates

The U.S. Department of State publishes the Visa Bulletin monthly as English HTML tables. This repository provides the employment-based preference cut-off dates as stable JSON: 10 categories (EB-1/2/3, Other Workers, EB-4, Certain Religious Workers, EB-5 Unreserved and its three Set-Aside categories), both Final Action Dates and Dates for Filing, for All Chargeability Areas / China-mainland-born / India-born.

60 rows per month. `cutoff_date` is either an ISO date, `C` (Current) or `U` (Unavailable) — note that `C` and `U` are **not** dates.

Read `index.json` for the latest month, then fetch `data/YYYY-MM.json`.

Maintained by [yiminshuju.com](https://yiminshuju.com). Licensed CC BY 4.0 — attribution required. Original data © U.S. Department of State.

</details>
