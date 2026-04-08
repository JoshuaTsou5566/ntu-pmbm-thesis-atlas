const DATA_URL = "../data/theses.json";

const elements = {
  statAdvisors: document.querySelector("#stat-advisors"),
  statTotal: document.querySelector("#stat-total"),
  statThemes: document.querySelector("#stat-themes"),
  statYears: document.querySelector("#stat-years"),
  advisorChart: document.querySelector("#advisor-chart"),
  themeDonut: document.querySelector("#theme-donut"),
  themeDonutLegend: document.querySelector("#theme-donut-legend"),
  advisorDirectory: document.querySelector("#advisor-directory"),
};

const safeText = (value) => (value || "").trim();
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

const renderBarChart = (container, entries) => {
  container.replaceChildren();
  const max = Math.max(...entries.map(([, value]) => value), 1);
  entries.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <div class="chart-label">${label}</div>
      <div class="chart-track"><div class="chart-bar" style="width:${(value / max) * 100}%"></div></div>
      <div class="chart-value">${value}</div>
    `;
    container.appendChild(row);
  });
};

const renderDonutChart = (container, legendNode, entries) => {
  container.replaceChildren();
  legendNode.replaceChildren();
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  const palette = ["#174c4f", "#b26139", "#7fa38f", "#db8d5a", "#437975", "#cc6f5b", "#9ebea8", "#8d5b4c", "#5f7f96"];
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 240 240");
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("cx", "120");
  bg.setAttribute("cy", "120");
  bg.setAttribute("r", String(radius));
  bg.setAttribute("fill", "none");
  bg.setAttribute("stroke", "rgba(23, 76, 79, 0.08)");
  bg.setAttribute("stroke-width", "26");
  svg.appendChild(bg);

  entries.forEach(([label, value], index) => {
    const color = palette[index % palette.length];
    const length = (value / total) * circumference;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "120");
    circle.setAttribute("cy", "120");
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", color);
    circle.setAttribute("stroke-width", "26");
    circle.setAttribute("stroke-dasharray", `${length} ${circumference - length}`);
    circle.setAttribute("stroke-dashoffset", String(-offset));
    svg.appendChild(circle);
    offset += length;

    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-swatch" style="background:${color}"></span>
      <span class="legend-label">${label}</span>
      <span class="legend-value">${value}</span>
    `;
    legendNode.appendChild(row);
  });

  const hole = document.createElement("div");
  hole.className = "donut-hole";
  hole.innerHTML = `<div><strong>${total}</strong><span>篇論文</span></div>`;
  container.appendChild(svg);
  container.appendChild(hole);
};

const init = async () => {
  const response = await fetch(DATA_URL);
  const rows = (await response.json()).map((item) => {
    const advisor = extractAdvisor(item);
    return { ...item, advisor_name: advisor.name, advisor_english: advisor.english, advisor_slug: advisor.slug };
  });

  const years = uniqueSorted(rows.map((item) => item.year)).sort();
  elements.statAdvisors.textContent = String(uniqueSorted(rows.map((item) => item.advisor_slug)).length);
  elements.statTotal.textContent = String(rows.length);
  elements.statThemes.textContent = String(uniqueSorted(rows.map((item) => item.theme_primary)).length);
  elements.statYears.textContent = `${years[0]} - ${years[years.length - 1]}`;

  const advisorCounts = Object.entries(
    rows.reduce((acc, item) => {
      acc[item.advisor_name] = (acc[item.advisor_name] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  renderBarChart(elements.advisorChart, advisorCounts.slice(0, 12));

  const themeCounts = Object.entries(
    rows.reduce((acc, item) => {
      acc[item.theme_primary] = (acc[item.theme_primary] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  renderDonutChart(elements.themeDonut, elements.themeDonutLegend, themeCounts);

  const grouped = rows.reduce((acc, item) => {
    if (!acc[item.advisor_slug]) {
      acc[item.advisor_slug] = {
        slug: item.advisor_slug,
        name: item.advisor_name,
        english: item.advisor_english,
        count: 0,
        themes: new Set(),
      };
    }
    acc[item.advisor_slug].count += 1;
    acc[item.advisor_slug].themes.add(item.theme_primary);
    return acc;
  }, {});

  Object.values(grouped)
    .sort((a, b) => b.count - a.count)
    .forEach((advisor) => {
      const anchor = document.createElement("a");
      anchor.className = "advisor-card";
      anchor.href = `./${advisor.slug}.html`;
      anchor.innerHTML = `
        <div>
          <strong>${advisor.name}</strong>
          <p>${advisor.english || " "}</p>
        </div>
        <div class="advisor-card-meta">
          <span>${advisor.count} 篇</span>
          <small>${[...advisor.themes].slice(0, 2).join("、")}</small>
        </div>
      `;
      elements.advisorDirectory.appendChild(anchor);
    });
};

init();
