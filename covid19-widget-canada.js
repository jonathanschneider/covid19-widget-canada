// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: user-md;

// Inspired by https://gist.github.com/kevinjalbert/275590b53f8d6b06c5703fad549099f9
// and https://github.com/rphl/corona-widget/

// Region can be set through widget parameter or through constants below
// Enter 4-digit health region code (e.g. 4601) or 2-letter province code (e.g. MB) to set your region
// Health region code can be found at https://opencovid.ca/api/#health-region-codes

// Default values if widget parameter isn't used; change here if required
let hrCode = "4601"; // Winnipeg
let province = "MB";

const bgColor = Color.dynamic(Color.white(), Color.black());
const stackColor = Color.dynamic(new Color("#E6E6E6"), Color.darkGray());
const textColor = Color.dynamic(Color.black(), Color.white());
const defaultSpace = 5;
const defaultPadding = 5;

let req = {};
let res;
let data = [];
let widget;

class Cases {
  constructor(area, dataObj) {
    this.area = area;
    this.areaLong = (dataObj.summary[0].health_region !== undefined) ? dataObj.summary[0].health_region : dataObj.summary[0].province;
    this.lastUpdated = dataObj.version;
    this.newCases = dataObj.summary[dataObj.summary.length - 1].cases;
    this.activeCases = dataObj.summary[dataObj.summary.length - 1].active_cases;
    this.totalCases = dataObj.summary[dataObj.summary.length - 1].cumulative_cases;
    this.trendIndicator = this.getTrend(dataObj.summary);
    this.timeseries = dataObj.summary;
  }
  getTrend(timeseries) {
    let sum = 0,
      avg = 0;
    for (let i = 0; i < timeseries.length - 1; i++) {
      sum += timeseries[i].cases;
    }
    avg = sum / (timeseries.length - 1);
    return timeseries[timeseries.length - 1].cases > avg ? {
      "symbol": "↗",
      "color": Color.red()
    } : {
      "symbol": "↘︎",
      "color": Color.green()
    };
  }
}


// Get data

// Evaluate widget parameter
if (args.widgetParameter !== null) { // Widget parameter provided
  if (!isNaN(args.widgetParameter) && args.widgetParameter.length >= 3) { // Health region provided
    hrCode = args.widgetParameter;
  } else if (args.widgetParameter.length == 2) { // Province provided
    hrCode = undefined;
    province = args.widgetParameter.toUpperCase();
  }
}

// Get date 7 days ago
const d = new Date();
d.setDate(d.getDate() - 7);
const lastWeek = d.toISOString().slice(0, 10);

// Get health region stats (if provided)
if (hrCode !== undefined) {
  req = new Request("https://api.opencovid.ca/summary?version=true&loc=" + hrCode + "&after=" + lastWeek);
  res = await req.loadJSON();
  data.push(new Cases(res.summary[0].health_region, res));

  // Get province
  req = new Request("https://api.covid19tracker.ca/regions/" + hrCode);
    res = await req.loadJSON();
    province = res.data.province;
}

// Get province stats
req = new Request("https://api.opencovid.ca/summary?version=true&loc=" + province + "&after=" + lastWeek);
res = await req.loadJSON();
data.push(new Cases(province, res));

// Get country stats
req = new Request("https://api.opencovid.ca/summary?version=true&loc=canada&after=" + lastWeek);
res = await req.loadJSON();
data.push(new Cases("CA", res));

console.log(data); // Log data for debugging


// Display data

if (config.runsInWidget) { // Widget
  if (config.widgetFamily === "small") { // Small widget
    if (data.length === 3) { // Health region known; create widget with health region, province and country cases
      widget = new ListWidget();
      widget.spacing = defaultSpace;
      widget.backgroundColor = bgColor;
      widget.setPadding(0, 0, 0, 0);

      // Top stack with one wide stack
      addWideStack(widget, data[0]);

      // Bottom stack with two small stacks
      let bottomStack = widget.addStack();
      bottomStack.setPadding(0, defaultPadding, 0, defaultPadding);
      addSmallStack(bottomStack, data[1]); // Bottom left
      bottomStack.addSpacer(defaultSpace);
      addSmallStack(bottomStack, data[2]); // Bottom right

    } else { // Health region unknown; create widget with province and country cases
      widget = new ListWidget();
      widget.spacing = defaultSpace;
      widget.backgroundColor = bgColor;
      widget.setPadding(0, 0, 0, 0);

      addWideStack(widget, data[0]); // Top
      addWideStack(widget, data[1]); // Bottom
    }

  } else { // Medium or large widget
    widget = new ListWidget();
    widget.spacing = defaultSpace;
    widget.backgroundColor = bgColor;
    widget.setPadding(0, 0, 0, 0);

    let stack = widget.addStack();

    data.forEach(region => {
      addThreeRowStack(stack, region);
    });
  }

  Script.setWidget(widget);
  Script.complete();

} else if (config.runsInApp) { // App
  let table = new UITable();
  let row = new UITableRow();

  // Fill data per region
  data.forEach(region => {
    row = new UITableRow();
    row.isHeader = true;
    row.addText(region.areaLong);
    table.addRow(row);
    table.addRow(createRow("New cases", formatNumber(region.newCases)));
    if (region.area.length == 2) table.addRow(createRow("Active cases", formatNumber(region.activeCases)));
    table.addRow(createRow("Total cases", formatNumber(region.totalCases)));
    if (region.area.length == 2) table.addRow(createRow("New tests", formatNumber(region.timeseries[region.timeseries.length - 1].testing)));
    if (region.area.length == 2) table.addRow(createRow("Total tests", formatNumber(region.timeseries[region.timeseries.length - 1].cumulative_testing)));
    table.addRow(createRow("Deaths", formatNumber(region.timeseries[region.timeseries.length - 1].cumulative_deaths)));
  });

  // Add last updated
  row = new UITableRow();
  row.addText(""); // Empty row
  table.addRow(row);
  table.addRow(createRow("Last Updated", data[0].lastUpdated));

  table.present();

} else if (config.runsWithSiri) { // Siri
  if (data.length === 3) {
    Speech.speak(`There are ${data[0].newCases} new cases in your health region ${data[0].area} and ${data[1].newCases} new cases in ${data[1].areaLong} today.`);
  } else {
    Speech.speak(`There are ${data[0].newCases} new cases in ${data[0].areaLong} today.`);
  }
}


// Functions

function addWideStack(parent, region) {
  let stack = parent.addStack();
  stack.layoutVertically();
  stack.setPadding(defaultPadding, 0, defaultPadding, 0);
  stack.spacing = defaultSpace;
  stack.cornerRadius = 10;

  addCenteredTextStack(stack, region.areaLong.toUpperCase(), 10);
  addTextWithTrendStack(stack, "+" + formatNumber(region.newCases), region.trendIndicator, 28);

  return stack;
}

function addSmallStack(parent, region) {
  let stack = parent.addStack();
  stack.layoutVertically();
  stack.size = new Size(0, 40); // Limit height so stack may only grow horizontally
  stack.setPadding(defaultPadding, defaultPadding, defaultPadding, defaultPadding);
  stack.spacing = defaultSpace;
  stack.backgroundColor = stackColor;
  stack.cornerRadius = 10;

  addTextWithTrendStack(stack, region.area, region.trendIndicator, 10, 'left');
  addCenteredTextStack(stack, "+" + formatNumber(region.newCases), 10);

  return stack;
}

function addThreeRowStack(parent, region) {
  let textSize = 14;
  let stack = parent.addStack();
  stack.layoutVertically();
  // stack.setPadding(0, 0, 0, 0);
  stack.spacing = defaultSpace;

  addCenteredTextStack(stack, region.areaLong.toUpperCase(), 10);
  stack.addSpacer(defaultSpace);
  addTextWithTrendStack(stack, "➕ " + formatNumber(region.newCases), region.trendIndicator, textSize);
  addCenteredTextStack(stack, (region.area.length == 2) ? "🤒 " + formatNumber(region.activeCases) : '--', textSize);
  addCenteredTextStack(stack, (region.area.length == 2) ? "🧪 " + formatNumber(region.timeseries[region.timeseries.length - 1].testing) : '--', textSize);
  // stack.addText((region.area.length == 2) ? "🤒 " + formatNumber(region.activeCases) : '--', textSize);
  // stack.addText((region.area.length == 2) ? "🧪 " + formatNumber(region.timeseries[region.timeseries.length - 1].testing) : '--', textSize);

  return stack;
}

function addCenteredTextStack(parent, text, size) {
  let stack = parent.addStack();

  stack.addSpacer();
  let title = stack.addText(text);
  title.centerAlignText();
  if (size !== undefined) title.font = Font.systemFont(size);
  stack.addSpacer();

  return stack;
}

function addTextWithTrendStack(parent, text, trend, size, alignment) {
  let stack = parent.addStack();
  stack.spacing = defaultSpace;

  if (alignment !== 'left') stack.addSpacer(); // Add spacer if not left-aligned
  let title = stack.addText(text);
  title.textColor = textColor;
  if (size !== undefined) title.font = Font.systemFont(size);

  let indicator = stack.addText(trend.symbol);
  indicator.textColor = trend.color;
  if (size !== undefined) indicator.font = Font.systemFont(size);
  if (alignment !== 'right') stack.addSpacer(); // Add spacer if not right-aligned

  return stack;
}

function addSymbolTextTrendStack(parent, symbol, text, trend, size, alignment) {
  let stack = parent.addStack();
  stack.spacing = defaultSpace;

  if (alignment !== 'left') stack.addSpacer(); // Add spacer if not left-aligned

  if (symbol !== undefined) addSFSymbolStack(stack, symbol, 10, textColor);

  let title = stack.addText(text);
  title.textColor = textColor;
  if (size !== undefined) title.font = Font.systemFont(size);

  if (trend !== undefined) {
    let indicator = stack.addText(trend.symbol);
    indicator.textColor = trend.color;
    if (size !== undefined) indicator.font = Font.systemFont(size);
  }

  if (alignment !== 'right') stack.addSpacer(); // Add spacer if not right-aligned

  return stack;
}

function addSFSymbolStack(parent, name, size, color) {
  let symbol = SFSymbol.named(name);
  symbol.applyFont(Font.systemFont(size));
  let image = parent.addImage(symbol.image);
  image.tintColor = color;
}

function createRow(title, number) {
  let row = new UITableRow();
  row.addText(title);
  row.addText((number || "null").toString()).rightAligned();
  return row;
}

function formatNumber(num) {
  if (num === null || isNaN(num)) {
    return "0";
  } else {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
  }
}
