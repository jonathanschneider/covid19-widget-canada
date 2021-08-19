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

const bgColour = Color.white();
const stackColour = "#E6E6E6";
const textColour = Color.black();
const defaultSpace = 5;

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

class Cases {
  constructor(area, dataObj) {
    this.area = area;
    this.lastUpdated = dataObj.last_updated;
    this.newCases = dataObj.data[dataObj.data.length - 1].change_cases;
    this.totalCases = dataObj.data[dataObj.data.length - 1].total_cases;
    this.trendIndicator = this.getTrend(dataObj.data);
    this.timeseries = dataObj.data;
  }
  getTrend(timeseries) {
    let sum = 0, avg = 0;
    for (let i = 0; i < timeseries.length - 1; i++) {
      sum += timeseries[i].change_cases;
    }
    avg = sum / (timeseries.length - 1);
    return timeseries[timeseries.length - 1] > avg ? {"symbol": "↗", "colour": Color.red()} : {"symbol": "↘︎", "colour": Color.green()};
  }
}

let req = {};
let hrName;
let res;
let widget;

// Evaluate widget parameter
if (args.widgetParameter !== null) { // Widget parameter provided
  if (!isNaN(args.widgetParameter) && args.widgetParameter.length == 4) { // Health region provided
    hrCode = args.widgetParameter;
  } else if (args.widgetParameter.length == 2) { // Province provided
    hrCode = undefined;
    province = args.widgetParameter;
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
d.setDate(d.getDate() - 6);
const lastWeek = d.toISOString().slice(0,10);

// Get health region stats (if provided)
if (hrCode !== undefined) {
  req = new Request("https://api.covid19tracker.ca/reports/regions/" + hrCode + "?stat=cases&fill_dates=true&after=" + lastWeek);
  res = await req.loadJSON();
  casesHr = new Cases(hrName, res);
  console.log(casesHr)
}

// Get province stats
req = new Request("https://api.covid19tracker.ca/reports/province/" + province + "?stat=cases&fill_dates=true&after=" + lastWeek);
res = await req.loadJSON();
casesProvince = new Cases(province, res);
console.log(casesProvince);

// Get country stats
req = new Request("https://api.covid19tracker.ca/reports?stat=cases&fill_dates=true&after=" + lastWeek);
res = await req.loadJSON();
casesCountry = new Cases("CA", res);
console.log(casesCountry);

if (config.runsInWidget) { // Widget
  let widget = createWidget();
  Script.setWidget(widget);
  Script.complete();

} else if (config.runsInApp ) { // App
  let widget = createWidget();
  widget.presentSmall();

  // // make table
  // let table = new UITable();
  // let row = new UITableRow();
  //
  // // Health region (if provided)
  // if (hrCode !== undefined) {
  //   row = new UITableRow();
  //   row.isHeader = true;
  //   row.addText(hrName);
  //   table.addRow(row);
  //   fillData(table, resHealthRegion.data[resHealthRegion.data.length - 1]);
  // }
  //
  // // Province
  // row = new UITableRow();
  // row.isHeader = true;
  // row.addText(provinces[province]);
  // table.addRow(row);
  // fillData(table, resProvince.data[resProvince.data.length - 1]);
  //
  // // Country-wide
  // row = new UITableRow();
  // row.isHeader = true;
  // row.addText("Country-wide");
  // table.addRow(row);
  // fillData(table, resCountry.data[resCountry.data.length - 1]);
  //
  // // Last updated
  // row = new UITableRow();
  // row.addText(""); // Empty row
  // table.addRow(row);
  // table.addRow(createRow("Last Updated", resCountry.last_updated));
  //
  // // present table
  // table.present();

} else if (config.runsWithSiri) { // Siri
  if (hrCode !== undefined) {
    Speech.speak(`There are ${casesHr.newCases} new cases in your health region ${hrName} and ${casesProvince.newCases} new cases in ${provinces[province]} today.`);
  } else {
    Speech.speak(`There are ${casesProvince.newCases} new cases in ${provinces[province]} today.`);
  }
}

function createWidget() {
  let widget = new ListWidget();
  widget.spacing = defaultSpace;
  widget.backgroundColor = bgColour;

  // Health region stack
  let topStack = createBigStack(widget, casesHr);
  // topStack.setPadding(defaultSpace, defaultSpace, 0, defaultSpace);

  // widget.addSpacer(defaultSpace);

  // Bottom stack with province and country data
  let bottomStack = widget.addStack();
  // bottomStack.spacing = defaultSpace;
  // bottomStack.setPadding(0, defaultSpace, defaultSpace, defaultSpace);

  let provStack = createSmallStack(bottomStack, casesProvince);
  bottomStack.addSpacer();
  let countryStack = createSmallStack(bottomStack, casesCountry);

  return widget;
}

function createBigStack(_parent, _data) {
  let stack = _parent.addStack();
  stack.layoutVertically();
  stack.spacing = defaultSpace;
  stack.backgroundColor = new Color(stackColour);
  stack.cornerRadius = 5;

  let title = stack.addText(_data.area.toUpperCase());
  title.textColor = textColour;
  title.font = Font.systemFont(10);
  title.centerAlignText();

  let casesStack = stack.addStack();
  casesStack.addSpacer();
  let cases = casesStack.addText("+" + formatNumber(_data.newCases));
  cases.textColor = textColour;
  cases.font = Font.systemFont(28);
  casesStack.addSpacer(defaultSpace);
  let trend = casesStack.addText(_data.trendIndicator.symbol);
  trend.textColor = _data.trendIndicator.colour;
  trend.font = Font.systemFont(28);
  casesStack.addSpacer();

  return stack;
}

function createSmallStack(_parent, _data) {
  let stack = _parent.addStack();
  stack.layoutVertically();
  stack.spacing = defaultSpace;
  stack.backgroundColor = new Color(stackColour);
  stack.size = new Size(60, 0);
  stack.cornerRadius = 5;

  let titleStack = stack.addStack();
  // titleStack.layoutHorizontally();
  titleStack.addSpacer();
  let title = titleStack.addText(_data.area);
  title.textColor = textColour;
  title.font = Font.systemFont(10);

  let casesStack = stack.addStack();
  // casesStack.centerAlignContent();
  casesStack.addSpacer();
  let cases = casesStack.addText("+" + formatNumber(_data.newCases));
  cases.textColor = textColour;
  cases.font = Font.systemFont(14);
  casesStack.addSpacer(defaultSpace);
  let trend = casesStack.addText(_data.trendIndicator.symbol);
  trend.textColor = _data.trendIndicator.colour;
  trend.font = Font.systemFont(14);
  casesStack.addSpacer();

  return stack;
}

function createRow(title, number) {
  let row = new UITableRow();
  row.addText(title);
  row.addText((number || "null").toString()).rightAligned();
  return row;
}

function fillData(table, data) {
  table.addRow(createRow("New cases", formatNumber(data.change_cases)));
  table.addRow(createRow("Total cases", formatNumber(data.total_cases)));
  // table.addRow(createRow("Deaths", formatNumber(data.total_fatalities)));
  // table.addRow(createRow("Recovered", formatNumber(data.total_recoveries)));
  // table.addRow(createRow("Critical", formatNumber(data.total_criticals)));
}

function formatNumber(num) {
  if (num === null || isNaN(num)) {
    return "0";
  } else {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
  }
}
