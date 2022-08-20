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
const appearance = 0; // 0: automatic, 1: light, 2: dark

const defaultSpace = 5;
const defaultPadding = 5;
const trendUp = "↗";
const trendDown = "↘︎";
const fileManager = FileManager.local();
const pathCached = fileManager.joinPath(fileManager.cacheDirectory(), "covid19-widget-canada-cache.json");
const timezones = {
  "EST": "-05:00",
  "EDT": "-04:00"
};
const locale = "en-CA";
const dateOptions = {"dateStyle": "short", "timeStyle": "short", "hour12": false};

let req = {};
let url;
let res;
let data = [];
let widget;
let bgColor, textColor, stackColor;

// Apply appearance
if (appearance === 1) {
  bgColor = Color.white();
  textColor = Color.black();
  stackColor = new Color("#E6E6E6");
} else if (appearance === 2) {
  bgColor = Color.black();
  textColor = Color.white();
  stackColor = Color.darkGray();
} else {
  bgColor = Color.dynamic(Color.white(), Color.black());
  textColor = Color.dynamic(Color.black(), Color.white());
  stackColor = Color.dynamic(new Color("#E6E6E6"), Color.darkGray());
}

class Cases {
  constructor(regionShort, regionLong, dataObj) {
    this.regionShort = regionShort;
    this.regionLong = regionLong;
    this.lastUpdated = new Date(dataObj.version.replace(" ", "T").replace(dataObj.version.slice(-4), ":00.000" + timezones[dataObj.version.slice(-3)]));
    this.newCases = this.getNewCases(dataObj.data[dataObj.data.length - 1].cases_daily, dataObj.data[dataObj.data.length - 2].cases_daily);
    this.activeCases = dataObj.data[dataObj.data.length - 1].cases_daily;
    this.totalCases = dataObj.data[dataObj.data.length - 1].cases;
    this.trendIndicator = this.getTrend(dataObj.data);
    this.timeseries = dataObj.data;
  }

  getTrend(timeseries) {
    let sum = 0,
      avg = 0;
    for (let i = 0; i < timeseries.length - 1; i++) {
      sum += timeseries[i].cases_daily;
    }
    avg = sum / (timeseries.length - 1);
    return timeseries[timeseries.length - 1].cases_daily > avg ? trendUp : trendDown;
  }

  getNewCases(casesToday, casesYesterday) {
    if (casesToday > casesYesterday) {
      return casesToday - casesYesterday;
    } else {
      return 0;
    }
  }
}

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


// Get data

try {
  // Get health region stats (if provided)
  if (hrCode !== undefined) {
    console.log("Getting data for health region");
    url = "https://api.opencovid.ca/summary?version=true&geo=hr&loc=" + hrCode + "&hr_names=short&pt_names=short&after=" + lastWeek;
    console.log("Requesting " + url);
    req = new Request(url);
    res = await req.loadJSON();
    data.push(new Cases(res.data[0].sub_region_1, res.data[0].sub_region_1, res));
    province = res.data[0].region;

    // // Get province
    // req = new Request("https://api.covid19tracker.ca/regions/" + hrCode);
    // res = await req.loadJSON();
    // province = res.data.province;
  }

  // Get province stats
  console.log("Getting data for province/territory");
  url = "https://api.opencovid.ca/summary?version=true&geo=pt&loc=" + province + "&pt_names=canonical&after=" + lastWeek;
  console.log("Requesting " + url);
  req = new Request(url);
  res = await req.loadJSON();
  data.push(new Cases(province, res.data[0].region, res));

  // Get country stats
  console.log("Getting data for Canada");
  url = "https://api.opencovid.ca/summary?version=true&geo=can&after=" + lastWeek;
  console.log("Requesting " + url);
  req = new Request(url);
  res = await req.loadJSON();
  data.push(new Cases("CA", "Canada", res));

  // Cache data
  console.log("Caching data");
  fileManager.writeString(pathCached, JSON.stringify(data));

} catch (error) { // Could not load data
  console.log(error);
  console.log("Reading data from cache");

  data = JSON.parse(fileManager.readString(pathCached));
  // Convert lastUpdated string to Date object
  data.forEach(region => {
    region.lastUpdated = new Date(region.lastUpdated);
  });
}

// console.log(data); // Log data for debugging


// Display data

if (config.runsInWidget) { // Widget
  let widget = new ListWidget();
  widget.backgroundColor = bgColor;
  widget.setPadding(defaultPadding, defaultPadding, defaultPadding, defaultPadding);
  widget.addSpacer();

  if (config.widgetFamily === "small") { // Small widget
    if (data.length === 3) { // Health region known; create widget with health region, province and country cases
      // Top stack with one wide stack
      addWideStack(widget, data[0]);
      widget.addSpacer();

      // Bottom stack with two small stacks
      let bottomStack = widget.addStack();
      bottomStack.spacing = defaultSpace;
      addSmallStack(bottomStack, data[1]); // Bottom left
      addSmallStack(bottomStack, data[2]); // Bottom right

    } else { // Health region unknown; create widget with province and country cases
      addWideStack(widget, data[0]); // Top
      widget.addSpacer();
      addWideStack(widget, data[1]); // Bottom
    }

  } else { // Medium or large widget
    let stack = widget.addStack();

    data.forEach(region => {
      addThreeRowStack(stack, region);
    });
  }

  // Last updated
  widget.addSpacer();
  addCenteredTextStack(widget, data[0].lastUpdated.toLocaleString(locale, dateOptions).replace(",", ""), 7);

  Script.setWidget(widget);
  Script.complete();

} else if (config.runsInApp) { // App
  let table = new UITable();
  let row = new UITableRow();

  // Fill data per region
  data.forEach(region => {
    row = new UITableRow();
    row.isHeader = true;
    row.addText(region.regionLong);
    table.addRow(row);
    table.addRow(createRow("New cases", formatNumber(region.newCases)));
    table.addRow(createRow("Active cases", formatNumber(region.activeCases)));
    table.addRow(createRow("Total cases", formatNumber(region.totalCases)));
    if (region.regionShort.length == 2) table.addRow(createRow("New tests", formatNumber(region.timeseries[region.timeseries.length - 1].tests_completed_daily)));
    if (region.regionShort.length == 2) table.addRow(createRow("Total tests", formatNumber(region.timeseries[region.timeseries.length - 1].tests_completed)));
    table.addRow(createRow("Deaths", formatNumber(region.timeseries[region.timeseries.length - 1].deaths)));
  });

  // Add last updated
  row = new UITableRow();
  row.addText(""); // Empty row
  table.addRow(row);
  table.addRow(createRow("Last Updated", data[0].lastUpdated.toLocaleString(locale, dateOptions).replace(",", "")));

  table.present();

} else if (config.runsWithSiri) { // Siri
  if (data.length === 3) {
    Speech.speak(`There are ${data[0].newCases} new cases in ${data[0].regionLong} and ${data[1].newCases} new cases in ${data[1].regionLong} today.`);
  } else {
    Speech.speak(`There are ${data[0].newCases} new cases in ${data[0].regionLong} today.`);
  }
}


// Functions

function addWideStack(parent, region) {
  let stack = parent.addStack();
  stack.layoutVertically();
  stack.spacing = defaultSpace;

  addCenteredTextStack(stack, region.regionLong.toUpperCase(), 10);
  addTextWithTrendStack(stack, "+" + formatNumber(region.newCases), region.trendIndicator, 26);

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

  addTextWithTrendStack(stack, region.regionShort, region.trendIndicator, 10, "left");
  addCenteredTextStack(stack, "+" + formatNumber(region.newCases), 10);

  return stack;
}

function addThreeRowStack(parent, region) {
  let textSize = 14;
  let stack = parent.addStack();
  stack.layoutVertically();
  stack.spacing = defaultSpace;

  addCenteredTextStack(stack, region.regionLong.toUpperCase(), 10);
  stack.addSpacer(defaultSpace);
  addTextWithTrendStack(stack, "+" + formatNumber(region.newCases), region.trendIndicator, textSize);
  addCenteredTextStack(stack, (region.regionShort.length == 2) ? formatNumber(region.activeCases) + " 🤒" : "--", textSize);
  addCenteredTextStack(stack, (region.regionShort.length == 2) ? formatNumber(region.timeseries[region.timeseries.length - 1].tests_completed_daily) + " 🧪" : "--", textSize);

  return stack;
}

function addCenteredTextStack(parent, text, size) {
  let stack = parent.addStack();

  stack.addSpacer();
  let title = stack.addText(text);
  title.textColor = textColor;
  title.centerAlignText();
  if (size !== undefined) title.font = Font.systemFont(size);
  stack.addSpacer();

  return stack;
}

function addTextWithTrendStack(parent, text, trend, size, alignment) {
  let stack = parent.addStack();
  stack.spacing = defaultSpace;

  if (alignment !== "left") stack.addSpacer(); // Add spacer if not left-aligned
  let title = stack.addText(text);
  title.textColor = textColor;
  if (size !== undefined) title.font = Font.systemFont(size);

  let indicator = stack.addText(trend);
  indicator.textColor = (trend === trendUp) ? Color.red() : Color.green();
  if (size !== undefined) indicator.font = Font.systemFont(size);
  if (alignment !== "right") stack.addSpacer(); // Add spacer if not right-aligned

  return stack;
}

function addSymbolTextTrendStack(parent, symbol, text, trend, size, alignment) {
  let stack = parent.addStack();
  stack.spacing = defaultSpace;

  if (alignment !== "left") stack.addSpacer(); // Add spacer if not left-aligned

  if (symbol !== undefined) addSFSymbolStack(stack, symbol, 10, textColor);

  let title = stack.addText(text);
  title.textColor = textColor;
  if (size !== undefined) title.font = Font.systemFont(size);

  if (trend !== undefined) {
    let indicator = stack.addText(trend.symbol);
    indicator.textColor = trend.color;
    if (size !== undefined) indicator.font = Font.systemFont(size);
  }

  if (alignment !== "right") stack.addSpacer(); // Add spacer if not right-aligned

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
