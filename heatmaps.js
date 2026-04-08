const DATA_URL = "./data/theses.json";

const state = {
  theses: [],
  filtered: [],
  abstractLanguage: "zh",
};

const elements = {
  statTotal: document.querySelector("#stat-total"),
  statThemes: document.querySelector("#stat-themes"),
  statAdvisors: document.querySelector("#stat-advisors"),
  statYears: document.querySelector("#stat-years"),
  activeFilters: document.querySelector("#active-filters"),
  themeYearHeatmap: document.querySelector("#theme-year-heatmap"),
  advisorThemeHeatmap: document.querySelector("#advisor-theme-heatmap"),
  themeFilter: document.querySelector("#theme-filter"),
  yearFilter: document.querySelector("#year-filter"),
  advisorFilter: document.querySelector("#advisor-filter"),
  searchInput: document.querySelector("#search-input"),
  keywordVisualization: document.querySelector("#keyword-visualization"),
  resultCount: document.querySelector("#result-count"),
  resultsList: document.querySelector("#results-list"),
  clearFilters: document.querySelector("#clear-filters"),
  cardTemplate: document.querySelector("#thesis-card-template"),
};

const safeText = (value) => (value || "").trim();
const shortText = (value, limit = 320) => {
  const text = safeText(value).replace(/\s+/g, " ");
  return text.length <= limit ? text : `${text.slice(0, limit).trim()}...`;
};
const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "zh-Hant")
  );
const slugify = (value) =>
  safeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const extractAdvisor = (item) => {
  const rawZh = safeText(item.advisor_zh);
  const rawEn = safeText(item.advisor_en);
  const zh =
    rawZh
      .split(/\n+/)
      .map((part) => part.trim())
      .find((part) => /[\u4e00-\u9fff]/.test(part)) || rawZh || "未載明";
  const en =
    rawEn ||
    rawZh
      .split(/\n+/)
      .map((part) => part.trim())
      .find((part) => part && !/[\u4e00-\u9fff]/.test(part)) ||
    "";
  return { name: zh, english: en, slug: slugify(zh) };
};

const createOption = (label, value = "") => {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
};

const setFilters = ({ theme, year, advisor, query } = {}) => {
  if (theme !== undefined) {
    elements.themeFilter.value = theme;
  }
  if (year !== undefined) {
    elements.yearFilter.value = year;
  }
  if (advisor !== undefined) {
    elements.advisorFilter.value = advisor;
  }
  if (query !== undefined) {
    elements.searchInput.value = query;
  }
};

const toggleFilterValue = (current, next) => (current === next ? "" : next);

const renderHeatmap = (container, columns, rows, getValue, onCellClick, isSelected) => {
  container.replaceChildren();
  const values = [];
  rows.forEach((row) =>
    columns.forEach((col) => {
      const cellData = getValue(row, col);
      values.push(typeof cellData === "number" ? cellData : cellData.value);
    })
  );
  const max = Math.max(...values, 1);

  const header = document.createElement("div");
  header.className = "heatmap-header";
  header.appendChild(Object.assign(document.createElement("div"), { className: "heatmap-corner" }));
  columns.forEach((col) => {
    const div = document.createElement("div");
    div.className = "heatmap-col";
    div.textContent = col;
    header.appendChild(div);
  });
  container.appendChild(header);

  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "heatmap-row";
    const label = document.createElement("div");
    label.className = "heatmap-label";
    label.textContent = row;
    rowEl.appendChild(label);
    columns.forEach((col) => {
      const cellData = getValue(row, col);
      const value = typeof cellData === "number" ? cellData : cellData.value;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `heatmap-cell ${isSelected(row, col) ? "is-selected" : ""}`;
      cell.style.background = `rgba(23, 76, 79, ${0.08 + (value / max) * 0.72})`;
      cell.style.color = value / max > 0.52 ? "#fffaf3" : "var(--deep)";
      cell.textContent = value ? String(value) : "-";
      if (cellData && typeof cellData === "object" && cellData.tooltip) {
        cell.dataset.tooltip = cellData.tooltip;
      }
      cell.addEventListener("click", () => onCellClick(row, col));
      rowEl.appendChild(cell);
    });
    container.appendChild(rowEl);
  });
};

const renderActiveFilters = () => {
  elements.activeFilters.replaceChildren();
  const items = [
    ["主題", elements.themeFilter.value, () => setFilters({ theme: "" })],
    ["年份", elements.yearFilter.value, () => setFilters({ year: "" })],
    ["指導教授", elements.advisorFilter.value, () => setFilters({ advisor: "" })],
    ["搜尋", safeText(elements.searchInput.value), () => setFilters({ query: "" })],
  ].filter((item) => item[1]);

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "目前未套用篩選條件。";
    elements.activeFilters.appendChild(empty);
    return;
  }

  items.forEach(([label, value, clear]) => {
    const pill = document.createElement("div");
    pill.className = "filter-pill";
    pill.innerHTML = `<span><strong>${label}</strong> ${value}</span>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "×";
    button.addEventListener("click", () => {
      clear();
      applyFilters();
    });
    pill.appendChild(button);
    elements.activeFilters.appendChild(pill);
  });
};

const renderKeywords = () => {
  const source = state.filtered.length ? state.filtered : state.theses;
  const keywordCounts = source.reduce((acc, item) => {
    safeText(item.keywords_zh)
      .split("；")
      .map((keyword) => keyword.trim())
      .filter(Boolean)
      .forEach((keyword) => {
        acc[keyword] = (acc[keyword] || 0) + 1;
      });
    return acc;
  }, {});

  const entries = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24);
  const max = Math.max(...entries.map(([, count]) => count), 1);
  elements.keywordVisualization.replaceChildren();

  entries.forEach(([keyword, count]) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `keyword-chip ${elements.searchInput.value === keyword ? "is-selected" : ""}`;
    chip.style.setProperty("--keyword-scale", String(count / max));
    chip.innerHTML = `<strong>${keyword}</strong><span>${count}</span>`;
    chip.addEventListener("click", () => {
      setFilters({ query: toggleFilterValue(elements.searchInput.value, keyword) });
      applyFilters();
    });
    elements.keywordVisualization.appendChild(chip);
  });
};

const renderResults = () => {
  elements.resultsList.replaceChildren();
  elements.resultCount.textContent = `目前顯示 ${state.filtered.length} / ${state.theses.length} 篇`;
  if (state.filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "目前沒有符合條件的論文。";
    elements.resultsList.appendChild(empty);
    return;
  }
  state.filtered.forEach((item) => {
    const node = elements.cardTemplate.content.cloneNode(true);
    node.querySelector(".year-chip").textContent = item.year;
    node.querySelector(".theme-chip").textContent = item.theme_primary || "未分類";
    node.querySelector(".thesis-title").textContent = item.title_zh || "未命名論文";
    node.querySelector(".thesis-title-en").textContent = item.title_en || "";
    node.querySelector(".author").textContent = item.author_zh || item.author_en || "未載明";
    node.querySelector(".advisor").textContent = item.advisor_name || "未載明";
    node.querySelector(".secondary-theme").textContent = item.theme_secondary || "無";
    node.querySelector(".basis").textContent = item.theme_basis || "無";
    node.querySelector(".keywords").innerHTML = `<strong>關鍵字</strong> ${item.keywords_zh || "無"}`;
    node.querySelector(".abstract-heading").textContent = "中文摘要";
    node.querySelector(".abstract").textContent = shortText(item.abstract_zh || item.abstract_en, 420);
    node.querySelector(".detail-link").href = item.url;
    node.querySelector(".detail-link-inline").href = item.url;
    node.querySelector(".advisor-page-link").href = `./advisors/${item.advisor_slug}.html`;
    elements.resultsList.appendChild(node);
  });
};

const renderHeatmaps = () => {
  const allYears = uniqueSorted(state.theses.map((item) => item.year)).sort();
  const themes = uniqueSorted(state.theses.map((item) => item.theme_primary));
  const topAdvisors = Object.entries(
    state.theses.reduce((acc, item) => {
      acc[item.advisor_name] = (acc[item.advisor_name] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  renderHeatmap(
    elements.themeYearHeatmap,
    allYears,
    themes,
    (theme, year) => {
      const matches = state.theses.filter(
        (item) => item.theme_primary === theme && item.year === year
      );
      return {
        value: matches.length,
        tooltip:
          matches.length > 0
            ? `${theme}｜${year}\n${matches.length} 篇\n例如：${matches[0].title_zh}`
            : `${theme}｜${year}\n0 篇`,
      };
    },
    (theme, year) => {
      setFilters({
        theme: toggleFilterValue(elements.themeFilter.value, theme),
        year: toggleFilterValue(elements.yearFilter.value, year),
      });
      applyFilters();
      document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
    },
    (theme, year) => elements.themeFilter.value === theme && elements.yearFilter.value === year
  );

  renderHeatmap(
    elements.advisorThemeHeatmap,
    themes,
    topAdvisors,
    (advisor, theme) => {
      const matches = state.theses.filter(
        (item) => item.advisor_name === advisor && item.theme_primary === theme
      );
      return {
        value: matches.length,
        tooltip:
          matches.length > 0
            ? `${advisor}｜${theme}\n${matches.length} 篇\n例如：${matches[0].title_zh}`
            : `${advisor}｜${theme}\n0 篇`,
      };
    },
    (advisor, theme) => {
      setFilters({
        advisor: toggleFilterValue(elements.advisorFilter.value, advisor),
        theme: toggleFilterValue(elements.themeFilter.value, theme),
      });
      applyFilters();
      document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
    },
    (advisor, theme) =>
      elements.advisorFilter.value === advisor && elements.themeFilter.value === theme
  );
};

const applyFilters = () => {
  const searchTerm = safeText(elements.searchInput.value).toLowerCase();
  const theme = elements.themeFilter.value;
  const year = elements.yearFilter.value;
  const advisor = elements.advisorFilter.value;

  state.filtered = state.theses.filter((item) => {
    const haystack = [
      item.title_zh,
      item.title_en,
      item.author_zh,
      item.author_en,
      item.advisor_name,
      item.keywords_zh,
      item.abstract_zh,
      item.abstract_en,
      item.theme_primary,
      item.theme_secondary,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!theme || item.theme_primary === theme) &&
      (!year || item.year === year) &&
      (!advisor || item.advisor_name === advisor) &&
      (!searchTerm || haystack.includes(searchTerm))
    );
  });

  renderActiveFilters();
  renderKeywords();
  renderHeatmaps();
  renderResults();
};

const init = async () => {
  const response = await fetch(DATA_URL);
  const rows = (await response.json()).map((item) => {
    const advisor = extractAdvisor(item);
    return {
      ...item,
      advisor_name: advisor.name,
      advisor_english: advisor.english,
      advisor_slug: advisor.slug,
    };
  });
  state.theses = rows;
  state.filtered = [...rows];

  const years = uniqueSorted(rows.map((item) => item.year)).sort();
  elements.statTotal.textContent = String(rows.length);
  elements.statThemes.textContent = String(uniqueSorted(rows.map((item) => item.theme_primary)).length);
  elements.statAdvisors.textContent = String(uniqueSorted(rows.map((item) => item.advisor_slug)).length);
  elements.statYears.textContent = `${years[0]} - ${years[years.length - 1]}`;

  elements.themeFilter.replaceChildren(createOption("全部主題", ""));
  elements.yearFilter.replaceChildren(createOption("全部年份", ""));
  elements.advisorFilter.replaceChildren(createOption("全部指導教授", ""));
  uniqueSorted(rows.map((item) => item.theme_primary)).forEach((value) =>
    elements.themeFilter.appendChild(createOption(value, value))
  );
  years.forEach((value) => elements.yearFilter.appendChild(createOption(value, value)));
  uniqueSorted(rows.map((item) => item.advisor_name)).forEach((value) =>
    elements.advisorFilter.appendChild(createOption(value, value))
  );

  [elements.themeFilter, elements.yearFilter, elements.advisorFilter].forEach((el) =>
    el.addEventListener("change", applyFilters)
  );
  elements.searchInput.addEventListener("input", applyFilters);
  elements.clearFilters.addEventListener("click", () => {
    setFilters({ theme: "", year: "", advisor: "", query: "" });
    applyFilters();
  });

  applyFilters();
};

init().catch((error) => {
  elements.resultsList.innerHTML = `<div class="empty-state">${error.message}</div>`;
});
