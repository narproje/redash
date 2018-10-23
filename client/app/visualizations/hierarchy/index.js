/* eslint-disable */

import d3 from 'd3';
import angular from 'angular';
import editorTemplate from './hierarchy-editor.html';
import { partial, map, each, keys, difference, debounce } from 'lodash';

import './hierarchy.less';

function createHierarchy(element, data, scope) {
  const margin = {top: 20, right: 120, bottom: 20, left: 120};
  const width = element.clientWidth - margin.right - margin.left;
  const height = 460 - margin.top - margin.bottom;
 
  let i = 0;
  const duration = 750;
  
  const tree = d3.layout.tree()
        .size([height, width]);
  
  const diagonal = d3.svg.diagonal()
        .projection(function (d) { return [d.y, d.x]; });
  
  const svg = d3.select(element).append('svg')
        .attr('width', width + margin.right + margin.left)
        .attr('height', height + margin.top + margin.bottom)
    .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`,);

  let tooltip = d3.select("visualization-renderer").append('div').attr("class", "treemap-tooltip");

  const rootTree = data[0];
  rootTree.x0 = height / 2;
  rootTree.y0 = 0;
  // rootTree.children.forEach(collapse);

  function update(source, scope) {

    function collapse(d) {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    } 
  
    function expand(d){   
      let children = (d.children)?d.children:d._children;
      if (d._children) {        
        d.children = d._children;
        d._children = null;       
      }
      if(children)
        children.forEach(expand);
    }
  
    function expandAll(){
      expand(rootTree); 
      update(rootTree, scope);
    }
  
    // Toggle children on click.
    function click(d) {
      const e = event || window.event;
      if (e.shiftKey) {
        expandAll();
      } else {
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else {
          d.children = d._children;
          d._children = null;
        }
        update(d, scope);
      }
    }
  
    // Compute the new tree layout.
    const nodes = tree.nodes(rootTree).reverse(),
          links = tree.links(nodes);

    // Normalize for fixed-depth.
    nodes.forEach(function(d) { d.y = d.depth * 400; });
  
    // Declare the nodes…
    const node = svg.selectAll('g.node')
          .data(nodes, function(d) { return d.id || (d.id = ++i); });

    // Enter the nodes.
    const nodeEnter = node.enter().append('g')
          .attr('class', 'node')
          .attr('transform', function(d) { 
            return 'translate(' + source.y0 + ',' + source.x0 + ')'; })
          .on('click', click)
          .on("mousemove", function(d) {
            tooltip.style("left", margin.left + d.y + 10 + "px");
            tooltip.style("top", d.x + 10 + "px");
            tooltip.style("display", "block");
            tooltip.html("<b>" + d.name + "</b>");
          }).on("mouseout", function(d) {
            tooltip.style("display", "none");
          });

    nodeEnter.append('circle')
          .attr('r', 10)
          .style('fill', function(d) { return d._children ? 'lightsteelblue' : '#fff'; });
  
    nodeEnter.append('text')
          .attr('x', function(d) { 
                return d.children || d._children ? -13 : 13; })
          .attr('dy', '.35em')
          .attr('text-anchor', function(d) { 
                return d.children || d._children ? 'end' : 'start'; })
          .text(function(d) { return d[scope.options.childColumn]; })
          .style('fill-opacity', 1);
  
    const nodeUpdate = node.transition()
      .duration(duration)
      .attr('transform', function(d) { return 'translate(' + d.y + ',' + d.x + ')'; });
  
    nodeUpdate.select('circle')
      .attr('r', 4.5)
      .style('fill', function(d) { return d._children ? 'lightsteelblue' : '#fff'; });
  
    nodeUpdate.select('text')
      .style('fill-opacity', 1);
  
    // Transition exiting nodes to the parent's new position.
    const nodeExit = node.exit().transition()
      .duration(duration)
      .attr('transform', function(d) { return 'translate(' + source.y + ',' + source.x + ')'; })
      .remove();
  
    nodeExit.select('circle')
      .attr('r', 1e-6);
  
    nodeExit.select('text')
      .style('fill-opacity', 1e-6);
  
    // Declare the links
    const link = svg.selectAll('path.link')
          .data(links, function(d) { return d.target.id; });
  
    // Enter the links.
    link.enter().insert('path', 'g')
      .attr('class', 'link')
      .attr('d', function(d) {
        const o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      });
  
    // Transition links to their new position.
    link.transition()
      .duration(duration)
      .attr('d', diagonal);
  
    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
      .duration(duration)
      .attr('d', function(d) {
        const o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .remove();
  
    // Stash the old positions for transition.
    nodes.forEach(function(d) {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }
  update(rootTree, scope);
}

function hierarchyRenderer() {
  return {
    restrict: 'E',
    template: '<div class="hierarchy-visualization-container" resize-event="handleResize()"></div>',
    scope: {
      queryResult: '=',
      options: '=',
    },
    replace: false,
    link($scope, element) {
      $scope.$watch('queryResult && queryResult.getData()', (data) => {
        if (!data) {
          return;
        }

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
            const container = element[0].querySelector('.hierarchy-visualization-container');
            angular.element(container).empty();
            createHierarchy(container, treeData, $scope);
          }
        }
        $scope.$watch('queryResult && queryResult.getData()', refreshData);
        $scope.$watch('options', refreshData, true);
        $scope.handleResize = debounce(refreshData, 50);
      });

    },
  };
}

function hierarchyEditor() {
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

      refreshColumns();
    }
  };
}

export default function init(ngModule) {
  ngModule.directive('hierarchyRenderer', hierarchyRenderer);
  ngModule.directive('hierarchyEditor', hierarchyEditor);

  ngModule.config((VisualizationProvider) => {
    const editTemplate = '<hierarchy-editor options="visualization.options" query-result="queryResult"></hierarchy-editor>';

    VisualizationProvider.registerVisualization({
      type: 'HIERARCHY',
      name: 'Hierarchy',
      renderTemplate: '<hierarchy-renderer resize-event="handleResize()" options="visualization.options" query-result="queryResult"></hierarchy-renderer>',
      editorTemplate: editTemplate,
      defaultOptions: { columnMapping: {} },
    });
  });
}

