import PDFJSAnnotate from '../src/PDFJSAnnotate';
import arrayFrom from '../src/utils/arrayFrom';
import renderPath from '../src/render/renderPath';
import renderRect from '../src/render/renderRect';
import renderLine from '../src/render/renderLine';

const UI = {};

export default UI;

function findSVGAtPoint(x, y) {
  let els = document.elementsFromPoint(x, y);

  for (let i=0, l=els.length; i<l; i++) {
    let el = els[i];
    if (el.nodeName.toUpperCase() === 'SVG' &&
        el.getAttribute('data-pdf-annotate-container') === 'true') {
      return el;
    }
  }

  return null;
}

function getOffset(e) {
  let offsetLeft = 0;
  let offsetTop = 0;
  let parentNode = e;
  let svgFound = false;

  function isContainer() {
    return parentNode.getAttribute('data-pdf-annotate-container') === 'true';
  }

  function adjustOffset() {
    var rect = parentNode.getBoundingClientRect();
    offsetLeft += rect.left;
    offsetTop += rect.top;
  }

  if (isContainer()) {
    // TODO offset is incorrect when flagging found here, but should be correct
    // svgFound = true;
    adjustOffset();
  }

  while ((parentNode = parentNode.parentNode) && parentNode !== document) {
    if (!svgFound && isContainer()) {
      svgFound = true;
    }

    if (svgFound) {
      adjustOffset();
    }
  }

  return {
    offsetLeft,
    offsetTop
  };
}

// Pen stuff
(function () {
  let _penSize;
  let _penColor;
  let path;
  let lines;
  
  function handleMouseDown() {
    path = null;
    lines = [];

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseUp(e) {
    if (lines.length > 1) {
      let svg = findSVGAtPoint(e.clientX, e.clientY);

      PDFJSAnnotate.addAnnotation(
        svg.getAttribute('data-pdf-annotate-document'),
        parseInt(svg.getAttribute('data-pdf-annotate-page'), 10), {
          type: 'drawing',
          width: _penSize,
          color: _penColor,
          lines
        }
      );
    }

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e) {
    let {offsetLeft, offsetTop} = getOffset(findSVGAtPoint(e.clientX, e.clientY));
    lines.push([e.clientX - offsetLeft, e.clientY - offsetTop ]);

    if (lines.length <= 1) {
      return;
    }

    if (path) {
      svg.removeChild(path);
    }

    path = renderPath({
      color: _penColor,
      width: _penSize,
      lines
    });

    svg.appendChild(path);
  }

  function handleSelectStart(e) {
    e.preventDefault();
    return false;
  }

  UI.setPen = (penSize = 1, penColor = '000000') => {
    _penSize = penSize;
    _penColor = penColor;
  };

  UI.enablePen = () => {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('selectstart', handleSelectStart);
  };

  UI.disablePen = () => {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('selectstart', handleSelectStart);
  };
})();

// Rect stuff
(function () {
  let _type;

  function hasSelection() {
    try {
      let selection = window.getSelection();
      let range = selection.getRangeAt(0);
      let rects = range.getClientRects();

      return rects.length > 0;
    } catch (e) {}

    return false;
  }

  function handleMouseUp(e) {
    if (hasSelection()) {
      createRect(_type);
    }
  }

  function createRect(type, color) {
    let selection = window.getSelection();
    let range = selection.getRangeAt(0);
    let rects = range.getClientRects();
    let bounding = selection.anchorNode.parentNode.getBoundingClientRect();
    let svg = findSVGAtPoint(bounding.left, bounding.top);
    let {offsetLeft, offsetTop} = getOffset(svg);
    let node;
    let annotation;

    if (!color) {
      if (type === 'highlight') {
        color = 'FFFF00';
      } else if (type === 'strikeout') {
        color = 'FF0000';
      }
    }

    // Initialize the annotation
    annotation = {
      type,
      color,
      rectangles: Array.prototype.map.call(rects, (r) => {
        let offset = 0;

        if (type === 'strikeout') {
          offset = r.height / 2;
        }

        return {
          y: (r.top + offset) - offsetTop,
          x: r.left - offsetLeft,
          width: r.width,
          height: r.height
        };
      }).filter((r) => r.width > 0 && r.height > 0)
    };

    // Short circuit if no rectangles exist
    if (annotation.rectangles.length === 0) {
      return;
    }

    // Add the annotation
    PDFJSAnnotate.addAnnotation(
      svg.getAttribute('data-pdf-annotate-document'),
      parseInt(svg.getAttribute('data-pdf-annotate-page'), 10),
      annotation
    );

    // Render the annotation
    if (type === 'strikeout') {
      node = renderLine(annotation);
    } else {
      node = renderRect(annotation);
    }

    arrayFrom(node).forEach((el) => {
      svg.appendChild(el);
    });
  }

  UI.enableRect = (type) => {
    _type = type;
    document.addEventListener('mouseup', handleMouseUp);
  };

  UI.disableRect = () => {
    document.removeEventListener('mouseup', handleMouseUp);
  };
})();
