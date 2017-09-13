(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.volcanoPlot = factory());
}(this, (function () { 'use strict';

var defaultSettings = {
    p_col: null,
    ratio_col: null,
    reference_col: null,
    comparison_col: null,
    height: 240,
    width: 300,
    margin: { top: 10, right: 10, bottom: 50, left: 80 },
    showYaxis: 'all',
    structure: [],
    colorVar: '',
    ratioLimit: 2.0,
    hexbin: {
        radius: { min: 3, max: 10 },
        countRange: { min: 3, max: 100 }
    }
};

function setDefaults(settings) {
    settings.p_col = settings.p_col ? settings.p_col : defaultSettings.p_col;
    settings.ratio_col = settings.ratio_col ? settings.ratio_col : defaultSettings.ratio_col;
    settings.height = settings.height ? settings.height : defaultSettings.height;
    settings.width = settings.width ? settings.width : defaultSettings.width;
    settings.margin = settings.margin ? settings.margin : defaultSettings.margin;
    settings.showYaxis = settings.showYaxis ? settings.showYaxis : defaultSettings.showYaxis;
    settings.structure = settings.structure ? settings.structure : [];
    settings.colorVar = settings.colorVar ? settings.colorVar : settings.structure.length >= 1 ? settings.structure[0] : defaultSettings.colorVar;
    settings.ratioLimit = settings.ratioLimit ? settings.ratioLimit : defaultSettings.ratioLimit;
    settings.hexbin = settings.hexbin ? settings.hexbin : {};
    settings.hexbin.radius = settings.hexbin.radius ? settings.hexbin.radius : defaultSettings.hexbin.radius;
    settings.hexbin.countRange = settings.hexbin.countRange ? settings.hexbin.countRange : defaultSettings.hexbin.countRange;

    return settings;
}

function init(data) {
    this.wrap = d3.select(this.element).append('div').attr('class', 'ig-volcano');

    this.config = setDefaults(this.config);
    this.layout();

    this.data = {};
    this.data.raw = data;
    this.data.clean = this.makeCleanData();
    this.makeScales();
    this.data.nested = this.makeNestedData();

    this.plots.parent = this;
    this.plots.init();

    this.tables.parent = this;
    this.tables.init();
}

function makeScales() {
    var chart = this;
    var settings = this.config;

    this.x = d3.scale.linear().range([0, settings.width]).domain(d3.extent(this.data.clean, function (d) {
        return d[settings.ratio_col];
    }));

    this.y = d3.scale.log().range([settings.height, 0]).domain([1, d3.min(this.data.clean, function (d) {
        return d[settings.p_col];
    })]);

    this.xAxis = d3.svg.axis().scale(this.x).orient('bottom');
    this.yAxis = d3.svg.axis().scale(this.y).orient('left').ticks(5, d3.format('r'));

    this.colorScale = d3.scale.ordinal().range(d3.scale.category10().range()).domain(d3.set(this.data.clean.map(function (d) {
        return d[settings.colorVar];
    })).values());

    this.radiusScale = d3.scale.sqrt().range([settings.hexbin.radius.min, settings.hexbin.radius.max]).domain([settings.hexbin.countRange.min, settings.hexbin.countRange.max]);

    this.hexbin = d3.hexbin().size([settings.width, settings.height]).radius(settings.hexbin.radius.max).x(function (d) {
        return chart.x(d[settings.ratio_col]);
    }).y(function (d) {
        return chart.y(d[settings.p_col]);
    });
}

function makeCleanData() {
    var data = this.data.raw;
    var settings = this.config;

    var clean = data.map(function (d) {
        d.plotName = d[settings.comparison_col] + ' vs. ' + d[settings.reference_col];
        d[settings.p_col] = +d[settings.p_col];
        d[settings.ratio_col] = +d[settings.ratio_col];
        if (d[settings.ratio_col] > settings.ratioLimit) {
            d.origRatio = d[settings.ratio_col];
            d[settings.ratio_col] = +settings.ratioLimit;
            d.aboveLimit = true;
        }
        return d;
    });

    return clean;
}

function makeNestedData() {
    //convenience mappings
    var chart = this;
    var data = this.data.clean;
    var settings = this.config;

    var nested = d3.nest().key(function (d) {
        return d.plotName;
    }).entries(data);
    nested.forEach(function (d) {
        d.hexData = chart.hexbin(d.values);
        //Flag the groups to draw the individual points
        d.hexData.forEach(function (e) {
            e.drawCircles = e.length <= settings.hexbin.countRange.min; //draw circles (t) or hex (f)

            //Set the radius of each hex
            e.size = e.length > settings.hexbin.countRange.max ? settings.hexbin.countRange.max : e.length; //calculate the radius variable

            //count records for each level
            e.levels = d3.nest().key(function (d) {
                return d[settings.colorVar];
            }).rollup(function (d) {
                return d.length;
            }).entries(e);

            e.levels.sort(function (a, b) {
                return b.values - a.values;
            });
            e.color = chart.colorScale(e.levels[0].key);
        });
    });
    return nested;
}

function layout() {
    this.wrap.append('div').attr('class', 'top');
    this.wrap.append('div').attr('class', 'middle');
    var bottom = this.wrap.append('div').attr('class', 'bottom');
    bottom.append('div').attr('class', 'info third');
    bottom.append('div').attr('class', 'summarytable third');
    bottom.append('div').attr('class', 'details third');
}

function init$1() {
    this.layout();
    this.drawAxis();
    this.drawHexes();
    this.brush.parent = this;
    this.brush.init();
}

function layout$1() {
    var chart = this.parent;
    var settings = this.parent.config;

    chart.plots.svgs = chart.wrap.select('div.middle').selectAll('div.volcanoPlot').data(chart.data.nested, function (d) {
        return d.key;
    }).enter().append('div').attr('class', 'volcanoPlot').append('svg').attr('height', settings.height + settings.margin.top + settings.margin.bottom).attr('width', function (d, i) {
        //change left margin
        return i > 0 & settings.showYaxis == 'first' ? settings.width + (settings.margin.left - 60) + settings.margin.right : settings.width + settings.margin.left + settings.margin.right;
    }).append('g').attr('transform', function (d, i) {
        return i > 0 & settings.showYaxis == 'first' ? 'translate(' + (settings.margin.left - 60) + ',' + settings.margin.top + ')' : 'translate(' + settings.margin.left + ',' + settings.margin.top + ')';
    });
}

function drawAxis() {
    var chart = this.parent;
    var settings = this.parent.config;
    chart.plots.svgs.append('g').attr('class', 'x axis').attr('transform', 'translate(0,' + settings.height + ')').call(chart.xAxis).append('text').attr('class', 'label').attr('font-size', '24').attr('x', 450).attr('dy', '2em').attr('fill', '#999').style('text-anchor', 'middle').text('Risk Ratio');

    chart.plots.svgs.each(function (d, i) {
        if (i == 0 || settings.showYaxis !== 'first') {
            var yAxisWrap = d3.select(this).append('g').attr('class', 'y axis').call(chart.yAxis);

            yAxisWrap.append('text').attr('class', 'label').attr('transform', 'rotate(-90)').attr('y', 6).attr('dy', '-65px').attr('font-size', '24').attr('fill', '#999').style('text-anchor', 'end').text('p-value');

            yAxisWrap.append('text').attr('class', 'label').attr('transform', 'rotate(-90)').attr('y', 6).attr('dy', '-53px').attr('font-size', '10').attr('fill', '#999').style('text-anchor', 'end').text('(Click to change quadrants)');
        }
    });
}

function drawHexes() {
    var chart = this.parent;
    var settings = this.parent.config;

    chart.plots.svgs.each(function (d) {
        //draw the main hexes/circles
        var pointGroups = d3.select(this).selectAll('g.hexGroups').data(d.hexData).enter().append('g').attr('class', 'hexGroup');

        pointGroups.each(function (d) {
            if (d.drawCircles) {
                d3.select(this).selectAll('circle').data(d).enter().append('circle').attr('class', 'point').attr('cx', function (d) {
                    return chart.x(d[settings.ratio_col]);
                }).attr('cy', function (d) {
                    return chart.y(d[settings.p_col]);
                }).attr('r', 2).attr('fill', function (d) {
                    return chart.colorScale(d[settings.colorVar]);
                });
            } else {
                d3.select(this).append('path').attr('class', 'hex').attr('d', function (d) {
                    return chart.hexbin.hexagon(chart.radiusScale(d.size));
                }).attr('transform', function (d) {
                    return 'translate(' + d.x + ',' + d.y + ')';
                }).attr('fill', function (d) {
                    return d.color;
                });
            }
        });
    });
}

function init$2() {
    var brush = this;
    var plots = this.parent;
    var chart = this.parent.parent;

    chart.plots.svgs.each(function (d) {
        d3.select(this).append('g').attr('class', 'brush').call(d3.svg.brush().x(chart.x).y(chart.y).on('brushstart', brush.start).on('brush', brush.update).on('brushend', brush.end));
    });
}

function start() {
  /*
  d3.select(this).classed("brushing",false)
  d3.selectAll(".volcanoPlot svg g")
  .classed("brushing",false)
  chart.classed("brushing", true);
  //clear all brushed hexes
  d3.selectAll("g.overlayGroup").remove()
    //clear any brush rectangles in other panels
  d3.selectAll(".volcanoPlot svg g:not(.brushing) g.brush rect.extent")
  .attr("height",0)
  .attr("width",0)
    //de-select all hexgroups
  var points=d3.selectAll("circle.point")
  .attr("fill-opacity",1)
  .classed("selected",false);
    var hexes=d3.selectAll("path.hex")
  .attr("fill-opacity",1)
  .classed("selected",false);
  */
}

function update() {
    /*
    console.log("Brushing")
      var points=chart.selectAll("circle.point");
      var hexes=chart.selectAll("path.hex");
      var e = d3.event.target.extent();
        //Flag selected points and hexes
      //note - the hex data is stored in pixels, but the point data and brush data is in raw units, so we have to handle transforms accordingly.
    points.classed("selected", function(d) {
        return e[0][0] <= +d["fc"] && +d["fc"] <= e[1][0]
            && e[0][1] <= +d["post"] && +d["post"] <= e[1][1];
      });
        hexes.classed("selected", function(d) {
        var x_raw = settings.x.invert(d.x)
        var y_raw = settings.y.invert(d.y)
          return e[0][0] <= x_raw && x_raw <= e[1][0]
          && e[0][1] <= y_raw && y_raw <= e[1][1]; // note - the order is flipped here because of the inverted pixel scale
      });
      //disable mouseover on unselected points
    //d3.selectAll("#"+outcome+" svg g g.allpoints g.points.unselected").classed("active",false)
    //d3.selectAll("#"+outcome+" svg g g.allpoints g.points.selected").classed("active",true)
    */
}

function end() {

    /*
    d3.selectAll("circle.point").attr("fill-opacity",0.5)
    d3.selectAll("path.hex").attr("fill-opacity",0.5)
    //	build a data set of the selected taxa
    var current_points=chart.selectAll("circle.selected").data()
    var current_hexes=chart.selectAll("path.selected").data()
    var current_hexes=d3.merge(current_hexes)
      console.log(current_points.length)
    console.log(current_hexes.length)
      var currentIDs=d3.merge([current_points,current_hexes]).map(function(d){return d[settings.vars.id]})
        //update the table
    //drawTable(current)
      //Draw the hex overlay
    //var overlaydata =
    //volcano.addHexData(overlaydata, settings, "overlay");
      d3.selectAll("div.volcanoPlot")
    .each(function(d){
      d.values.forEach(function(e){
        e.overlay = currentIDs.indexOf(e[settings.vars.id])>-1
      })
      volcano.addHexData([d], settings, "overlay");
      volcano.hexMap(d, d3.select(this).select("svg g"), settings)
    })
    */
}

var brush = {
    init: init$2,
    start: start,
    update: update,
    end: end
};

var plots = {
    init: init$1,
    layout: layout$1,
    drawAxis: drawAxis,
    drawHexes: drawHexes,
    brush: brush
};

function init$3() {
    this.selected = { columns: ['Phylum', 'Genus', 'Details'] };
    this.details = { columns: ['key', 'value'] };
    this.layout();
    this.drawSelected();
    this.drawDetails();
}

function layout$2() {
    //Selected table
    this.selected.wrap = this.parent.wrap.append('div').classed('table selected-table', true);
    this.selected.wrap.append('div').classed('title', true).html('Selected Taxa (n=<span id = "nSelected">0</span>)');
    this.selected.wrap.append('div').classed('instruction', true).html('Click and drag a figure or use the search bar below to select taxa.');
    this.selected.table = this.selected.wrap.append('table');
    this.selected.table.append('thead').selectAll('th').data(this.selected.columns).enter().append('th').text(function (d) {
        return d;
    });
    this.selected.table.append('tbody').append('tr').append('td').attr('colspan', this.selected.columns.length).text('None selected');

    //Details table
    this.details.wrap = this.parent.wrap.append('div').classed('details-table', true);
    this.details.wrap.append('div').classed('title', true).text('Details');
    this.details.wrap.append('div').classed('instruction', true).html('Mouse over the figure or summary table for taxa details.');
    this.details.table = this.details.wrap.append('table');
    this.details.table.append('thead');
    this.details.table.append('tbody');
}

function drawSelected() {
    console.log(this.parent.data);
}

function drawDetails() {}

var tables = {
    init: init$3,
    layout: layout$2,
    drawSelected: drawSelected,
    drawDetails: drawDetails
};

function createVolcano() {
    var element = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'body';
    var config = arguments[1];

    var volcano = {
        element: element,
        config: config,
        init: init,
        makeScales: makeScales,
        layout: layout,
        makeCleanData: makeCleanData,
        makeNestedData: makeNestedData,
        plots: plots,
        tables: tables
    };

    volcano.events = {
        init: function init$$1() {},
        complete: function complete() {}
    };

    volcano.on = function (event, callback) {
        var possible_events = ['init', 'complete'];
        if (possible_events.indexOf(event) < 0) {
            return;
        }
        if (callback) {
            volcano.events[event] = callback;
        }
    };

    return volcano;
}

var index = {
    createVolcano: createVolcano
};

return index;

})));
