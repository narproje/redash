/* eslint-disable */

import d3 from 'd3';
import angular from 'angular';
import { each, debounce } from 'lodash';
import { ColorPalette } from '@/visualizations/chart/plotly/utils';
import { formatSimpleTemplate } from '@/lib/value-format';
import editorTemplate from './treemap-editor.html';

import './treemap.less';

function createTreemap(element, data, scope) {
  const margin = {
    top: 20, right: 50, bottom: 20, left: 50,
  };
  const width = element.clientWidth - margin.right - margin.left;
  const height = 460 - margin.top - margin.bottom;


  if ((width <= 0) || (height <= 0)) {
    return;
  }

  const svg = d3.select(element).append('svg')
    .attr('width', width + margin.right + margin.left)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(-.5,-.5)');

  const tooltip = d3.select('visualization-renderer').append('div').attr('class', 'treemap-tooltip');

  const rootTree = data;

  function datalabelText(item) {
    const str = formatSimpleTemplate(scope.options.datalabel.template, item);
    const arr = str.split('\n');
    let string = '';
    arr.forEach((t, i) => {
      string += `<tspan dy="${i}em" x="${item.x}">${t}</tspan>`;
    });
    return string;
  }

  function update(source) {
    const color = d3.scale.category20c();

    const re = new RegExp('[ \']', 'g');

    d3.select('svg')
      .attr('height', height + margin.top + margin.bottom)
      .attr('width', width + margin.left + margin.right);

    const treemap = d3.layout.treemap()
      .size([width, height])
      .padding(scope.options.cellPadding)
      // .sort((a, b) { return a.value - b.value; })
      .value(d => d[scope.options.sizeColumn]);

    const cell = svg.data(source).selectAll('g')
      .data(treemap.nodes)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', () => 'translate(' + margin.left + ',' + margin.top + ')');

    const rects = cell.append('rect')
      .attr('id', d => 'rect-' + d.name.replace(re, '-'))
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('width', d => d.dx)
      .attr('height', d => d.dy)
      .attr('stroke', 'white')
      .attr('stroke-width', 0.5)
      .attr('fill', (d) => { return d.children ? color(d.name) : color(d.parent.name); });

    if (scope.options.tooltip.enabled) {
      rects
        .on('mousemove', (d) => {
          tooltip.style('left', d.x + d.dx / 2 + 'px');
          tooltip.style('top', d.y + d.dy / 2 + 'px');
          tooltip.style('display', 'block');
          tooltip.html(formatSimpleTemplate(scope.options.tooltip.template, d));
        })
        .on('mouseout', () => {
          tooltip.style('display', 'none');
        });
    }

    if (scope.options.datalabel.enabled) {
      cell.append('clipPath')
        .attr('id', d => 'clip-' + d.name.replace(re, '-'))
        .append('use')
        .attr('xlink:href', d => '#rect-' + d.name.replace(re, '-') + '');

      cell.append('text')
        .attr('class', 'treemap-text')
        .attr('clip-path', d => 'url(#clip-' + d.name.replace(re, '-') + ')')
        .attr('x', d => d.x + 3)
        .attr('y', d => d.y + 10)
        .attr('dy', '1.3em')
        .html((d) => { return d.children ? null : datalabelText(d); });
    }
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

        each(queryData, (item) => {
          item['@@child'] = item[$scope.options.childColumn];
          item['@@parent'] = item[$scope.options.parentColumn];
          item['@@size'] = item[$scope.options.sizeColumn];
        });

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
        tooltip: {
          enabled: true,
          template: '<b>{{ @@child }} :</b> {{ @@size }}',
        },
        datalabel: {
          enabled: true,
          template: '{{ @@child }}',
        },
      },
    });
  });
}

