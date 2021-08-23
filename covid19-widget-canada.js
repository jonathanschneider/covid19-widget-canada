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

const bgColour = Color.dynamic(Color.white(), Color.black());
const stackColour = Color.dynamic(new Color("#E6E6E6"), Color.darkGray());
const textColour = Color.dynamic(Color.black(), Color.white());
const defaultSpace = 5;
const defaultPadding = 5;

const provinces = {
  "AB": "Alberta",
  "BC": "BC",
  "MB": "Manitoba",
  "NB": "New Brunswick",
  "NL": "NL",
  "NT": "NWT",
  "NS": "Nova Scotia",
  "NU": "Nunavut",
  "ON": "Ontario",
  "PE": "PEI",
  "QC": "Quebec",
  "SK": "Saskatchewan",
  "YT": "Yukon"
};

let req = {};
let hrName;
let res;
let data = [];
let widget;

class Cases {
  constructor(area, areaLong, dataObj) {
    this.area = area;
    this.areaLong = areaLong;
    this.lastUpdated = dataObj.last_updated;
    this.newCases = dataObj.data[dataObj.data.length - 1].change_cases;
    this.totalCases = dataObj.data[dataObj.data.length - 1].total_cases;
    this.trendIndicator = this.getTrend(dataObj.data);
    this.timeseries = dataObj.data;
  }
  getTrend(timeseries) {
    let sum = 0,
      avg = 0;
    for (let i = 0; i < timeseries.length - 1; i++) {
      sum += timeseries[i].change_cases;
    }
    avg = sum / (timeseries.length - 1);
    return timeseries[timeseries.length - 1].change_cases > avg ? {
      "symbol": "↗",
      "colour": Color.red()
    } : {
      "symbol": "↘︎",
      "colour": Color.green()
    };
  }
}


// Evaluate widget parameter
if (args.widgetParameter !== null) { // Widget parameter provided
  if (!isNaN(args.widgetParameter) && args.widgetParameter.length == 4) { // Health region provided
    hrCode = args.widgetParameter;
  } else if (args.widgetParameter.length == 2) { // Province provided
    hrCode = undefined;
    province = args.widgetParameter.toUpperCase();
  }
}

// Get health region information
if (hrCode !== undefined) {
  req = new Request("https://api.covid19tracker.ca/regions/" + hrCode);
  res = await req.loadJSON();
  hrName = res.data.engname;
  province = res.data.province;
}

// Get date 7 days ago
const d = new Date();
d.setDate(d.getDate() - 7);
const lastWeek = d.toISOString().slice(0, 10);

// Get health region stats (if provided)
if (hrCode !== undefined) {
  req = new Request("https://api.covid19tracker.ca/reports/regions/" + hrCode + "?after=" + lastWeek);
  res = await req.loadJSON();
  data.push(new Cases(hrName, hrName, res));
}

// Get province stats
req = new Request("https://api.covid19tracker.ca/reports/province/" + province + "?after=" + lastWeek);
res = await req.loadJSON();
// casesProvince = new Cases(province, provinces[province], res);
data.push(new Cases(province, provinces[province], res));

// Get country stats
req = new Request("https://api.covid19tracker.ca/reports?after=" + lastWeek);
res = await req.loadJSON();
data.push(new Cases("CA", "Canada", res));

console.log(data); // Log data for debugging


// Display data
if (config.runsInWidget) { // Widget
  if (data.length === 3) { // Health region data available
    widget = createTripleWidget(data); // Widget with health region, province and country cases
  } else {
    widget = createDoubleWidget(data); // Widget with province and country cases
  }

  Script.setWidget(widget);
  Script.complete();

} else if (config.runsInApp) { // App
  // Present widget in app for testing
  // widget = createTripleWidget(data);
  // widget = createDoubleWidget(data);
  // widget.presentSmall();

  // make table
  let table = new UITable();
  let row = new UITableRow();

  // Display data per region
  data.forEach(region => {
    row = new UITableRow();
    row.isHeader = true;
    row.addText(region.areaLong);
    table.addRow(row);
    table.addRow(createRow("New cases", formatNumber(region.newCases)));
    table.addRow(createRow("Total cases", formatNumber(region.totalCases)));
    table.addRow(createRow("New tests", formatNumber(region.timeseries[region.timeseries.length - 1].change_tests)));
    table.addRow(createRow("Total tests", formatNumber(region.timeseries[region.timeseries.length - 1].total_tests)));
    table.addRow(createRow("Deaths", formatNumber(region.timeseries[region.timeseries.length - 1].total_fatalities)));
    table.addRow(createRow("Recovered", formatNumber(region.timeseries[region.timeseries.length - 1].total_recoveries)));
    // table.addRow(createRow("Critical", formatNumber(region.timeseries[region.timeseries.length - 1].total_criticals)));
  });

  // Last updated
  row = new UITableRow();
  row.addText(""); // Empty row
  table.addRow(row);
  table.addRow(createRow("Last Updated", data[0].lastUpdated));

  // present table
  table.present();

} else if (config.runsWithSiri) { // Siri
  if (data.length === 3) {
    Speech.speak(`There are ${data[0].newCases} new cases in your health region ${hrName} and ${data[1].newCases} new cases in ${provinces[province]} today.`);
  } else {
    Speech.speak(`There are ${data[0].newCases} new cases in ${provinces[province]} today.`);
  }
}


// Functions
function createTripleWidget(data) { // Widget with one wide and two small stacks underneath
  let widget = new ListWidget();
  widget.spacing = defaultSpace;
  widget.backgroundColor = bgColour;
  widget.setPadding(0, 0, 0, 0);

  // Top stack with one wide stack
  let topStack = createWideStack(widget, data[0]);

  // Bottom stack with two small stacks
  let bottomStack = widget.addStack();
  bottomStack.setPadding(0, defaultPadding, 0, defaultPadding);

  let provStack = createSmallStack(bottomStack, data[1]);
  bottomStack.addSpacer(defaultSpace);
  let countryStack = createSmallStack(bottomStack, data[2]);

  return widget;
}

function createDoubleWidget(data) { // Widget with two wide stacks
  let widget = new ListWidget();
  widget.spacing = defaultSpace;
  widget.backgroundColor = bgColour;
  widget.setPadding(0, 0, 0, 0);

  let topStack = createWideStack(widget, data[0]);
  let bottomStack = createWideStack(widget, data[1]);

  return widget;
}

function createWideStack(parent, region) {
  let stack = parent.addStack();
  stack.layoutVertically();
  stack.setPadding(defaultPadding, defaultPadding, defaultPadding, defaultPadding);
  stack.spacing = defaultSpace;
  stack.cornerRadius = 10;

  let titleStack = stack.addStack();
  titleStack.addSpacer();
  let title = titleStack.addText(region.areaLong.toUpperCase());
  title.textColor = textColour;
  title.font = Font.systemFont(10);
  title.centerAlignText();
  titleStack.addSpacer();

  let casesStack = stack.addStack();
  casesStack.addSpacer();
  let cases = casesStack.addText("+" + formatNumber(region.newCases));
  cases.textColor = textColour;
  cases.font = Font.systemFont(28);
  casesStack.addSpacer(defaultSpace);
  let trend = casesStack.addText(region.trendIndicator.symbol);
  trend.textColor = region.trendIndicator.colour;
  trend.font = Font.systemFont(28);
  casesStack.addSpacer();

  return stack;
}

function createSmallStack(parent, region) {
  let stack = parent.addStack();
  stack.layoutVertically();
  stack.size = new Size(0, 40); // Limit height, so width is adjust to content automatically
  stack.setPadding(defaultPadding, defaultPadding, defaultPadding, defaultPadding);
  stack.spacing = defaultSpace;
  stack.backgroundColor = stackColour;
  stack.cornerRadius = 10;

  let titleStack = stack.addStack();
  titleStack.spacing = defaultSpace;
  let title = titleStack.addText(region.area);
  title.textColor = textColour;
  title.font = Font.systemFont(10);

  let trend = titleStack.addText(region.trendIndicator.symbol);
  trend.textColor = region.trendIndicator.colour;
  trend.font = Font.systemFont(10);

  let casesStack = stack.addStack();
  casesStack.addSpacer();
  let cases = casesStack.addText("+" + formatNumber(region.newCases));
  cases.textColor = textColour;
  cases.font = Font.systemFont(10);
  casesStack.addSpacer();

  return stack;
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
