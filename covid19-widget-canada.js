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

const backgroundColour = "#FFFFFF";
const textColour = "#000000";

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
let resHealthRegion;

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
  resHealthRegion = await req.loadJSON();
  hrName = resHealthRegion.data.engname;
  province = resHealthRegion.data.province;
}

// Get date 7 days ago
const d = new Date();
d.setDate(d.getDate() - 6);
const lastWeek = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();

// Get health region stats (if provided)
if (hrCode !== undefined) {
  req = new Request("https://api.covid19tracker.ca/reports/regions/" + hrCode + "?stat=cases&fill_dates=true&after=" + lastWeek);
  resHealthRegion = await req.loadJSON();
}

// Get province stats
req = new Request("https://api.covid19tracker.ca/reports/province/" + province + "?stat=cases&fill_dates=true&after=" + lastWeek);
const resProvince = await req.loadJSON();

// Get country stats
req = new Request("https://api.covid19tracker.ca/reports?stat=cases&fill_dates=true&after=" + lastWeek);
const resCountry = await req.loadJSON();

if (config.runsInWidget) { // Widget
  let widget = new ListWidget();
  widget.backgroundColor = new Color(backgroundColour);

  let lines = [];

  lines.push(widget.addText(hrName));
  widget.addSpacer(5);

  lines.push(widget.addText(provinces[province]));
  widget.addSpacer(5);

  lines.push(widget.addText("Country"));
  widget.addSpacer(5);

  // Style text
  lines.forEach(line => {
    line.textColor = new Color(textColour);
    line.textOpacity = 0.8;
    line.font = Font.systemFont(14);
  });

  Script.setWidget(widget);
  Script.complete();

} else if (config.runsInApp ) { // App
  // make table
  let table = new UITable();
  let row = new UITableRow();

  // Health region (if provided)
  if (hrCode !== undefined) {
    row = new UITableRow();
    row.isHeader = true;
    row.addText(hrName);
    table.addRow(row);
    fillData(table, resHealthRegion.data[6]);
  }

  // Province
  row = new UITableRow();
  row.isHeader = true;
  row.addText(provinces[province]);
  table.addRow(row);
  fillData(table, resProvince.data[6]);

  // Country-wide
  row = new UITableRow();
  row.isHeader = true;
  row.addText("Country-wide");
  table.addRow(row);
  fillData(table, resCountry.data[6]);

  // Last updated
  row = new UITableRow();
  row.addText(""); // Empty row
  table.addRow(row);
  table.addRow(createRow("Last Updated", resCountry.last_updated));

  // present table
  table.present();

} else if (config.runsWithSiri) { // Siri
  if (hrCode !== undefined) {
    Speech.speak(`There are ${resHealthRegion.data[6].change_cases} new cases in your health region ${hrName} and ${resProvince.data[6].change_cases} new cases in ${provinces[province]} today.`);
  } else {
    Speech.speak(`There are ${resProvince.data[6].change_cases} new cases in ${provinces[province]} today.`);
  }
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
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}
