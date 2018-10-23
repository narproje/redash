/* eslint-disable */

import d3 from 'd3';
import angular from 'angular';
import editorTemplate from './treemap-editor.html';
import { partial, map, each, keys, difference, debounce, pluck, max } from 'lodash';
import { ColorPalette } from '@/visualizations/chart/plotly/utils';

import './treemap.less';

function createTreemap(element, data, scope) {
  const margin = {top: 20, right: 50, bottom: 20, left: 50};
  const width = element.clientWidth - margin.right - margin.left;
  const height = 460 - margin.top - margin.bottom;


  if ((width <= 0) || (height <= 0)) {
    return;
  }
        
  const svg = d3.select(element).append('svg')
        .attr('width', width + margin.right + margin.left)
        .attr('height', height + margin.top + margin.bottom)
    .append('g')
        .attr("transform", "translate(-.5,-.5)");

  let tooltip = d3.select("visualization-renderer").append('div').attr("class", "treemap-tooltip");

  const format = d3.format(",d");

  const rootTree = data;

  function update(source) {

    const color = d3.scale.category20c();

    const re = new RegExp('[ \']', 'g');

    d3.select('svg')
      .attr('height', height + margin.top + margin.bottom)
      .attr('width', width + margin.left + margin.right);

    let treemap = d3.layout.treemap()
      .size([width, height])
      .padding(scope.options.cellPadding)
      // .sort(function(a, b) { return a.value - b.value; })
      .value(function(d) { return d.size; });

    const cell = svg.data(source).selectAll("g")
      .data(treemap.nodes)
      .enter().append("g")
      .attr("class", "cell")
      .attr("transform", function(d) { return "translate(" + margin.left + "," + margin.top + ")"; });

    cell.append("rect")
      .attr("id", function(d) { return "rect-" + d.name.replace(re, '-'); })
      .attr("x", function(d) { return d.x; })
      .attr("y", function(d) { return d.y; })
      .attr("width", function(d) { return d.dx; })
      .attr("height", function(d) { return d.dy; })
      .attr("stroke", "white")
      .attr("stroke-width", 0.5)
      .attr("fill", function(d) { return d.children ? color(d.name) : color(d.parent.name); })
      .on("mousemove", function(d) {
        tooltip.style("left", d.x + d.dx / 2 + "px");
        tooltip.style("top", d.y + d.dy / 2 + "px");
        tooltip.style("display", "block");
        tooltip.html("<b>" + d.name + "</b>: " + format(d.value));
      }).on("mouseout", function(d) {
        tooltip.style("display", "none");
      });

    cell.append("clipPath")
      .attr("id", function(d) { return "clip-" + d.name.replace(re, '-'); })
      .append("use")
      .attr("xlink:href", function(d) { return "#rect-" + d.name.replace(re, '-') + ""; });

    cell.append("text")
      .attr("class", "treemap-text")
      .attr("clip-path", function(d) { return "url(#clip-" + d.name.replace(re, '-') + ")"; })
      .attr("x", function(d) { return d.x + 3; })
      .attr("y", function(d) { return d.y; })
      .attr("dy", "1.3em")
      .text(function(d) { return d.children ? null : d.name; });

  }
  update(rootTree);
}

function treemapRenderer() {
  return {
    restrict: 'E',
    scope: {
      queryResult: '=',
      options: '=',
    },
    template: '<div class="treemap-visualization-container" resize-event="handleResize()"></div>',
    replace: false,
    link($scope, element) {

      function refreshData() {
        const queryData = angular.copy($scope.queryResult.getData());

        // eslint-disable-next-line prefer-arrow-callback
        const dataMap = queryData.reduce(function (map, node) {
          map[node[$scope.options.childColumn]] = node;
          return map;
        }, {});

        const treeData = [];
        // eslint-disable-next-line prefer-arrow-callback
        queryData.forEach(function (node) {
          // add to parent
          const parent = dataMap[node[$scope.options.parentColumn]];
          if (parent) {
            // create child array if it doesn't exist
            (parent.children || (parent.children = []))
              // add node to child array
              .push(node);
          } else {
            // parent is null or missing
            treeData.push(node);
          }
        });
        if (treeData) {
          const container = element[0].querySelector('.treemap-visualization-container');
          angular.element(container).empty();
          createTreemap(container, treeData, $scope);
        }
      }

      $scope.$watch('queryResult && queryResult.getData()', refreshData);
      $scope.$watch('options', refreshData, true);
      $scope.handleResize = debounce(refreshData, 50);
    },
  };
}

function treemapEditor() {
  return {
    restrict: 'E',
    template: editorTemplate,
    scope: {
      queryResult: '=',
      options: '=?',
    },
    link(scope) {
      function refreshColumns() {
        scope.columns = scope.queryResult.getColumns();
        scope.columnNames = map(scope.columns, i => i.name);
        if (scope.columnNames.length > 0) {
          each(difference(keys(scope.options.columnMapping), scope.columnNames), (column) => {
            delete scope.options.columnMapping[column];
          });
        }
      }

      // refreshColumns();
    }
  };
}

export default function init(ngModule) {
  ngModule.directive('treemapRenderer', treemapRenderer);
  ngModule.directive('treemapEditor', treemapEditor);

  ngModule.config((VisualizationProvider) => {
    const editTemplate = '<treemap-editor options="visualization.options" query-result="queryResult"></treemap-editor>';

    VisualizationProvider.registerVisualization({
      type: 'TREEMAP',
      name: 'Treemap',
      renderTemplate: '<treemap-renderer options="visualization.options" query-result="queryResult"></treemap-renderer>',
      editorTemplate: editTemplate,
      defaultOptions: {
        cellPadding: 1,
      },
    });
  });
}

