import '@testing-library/jest-dom'

// jsdom doesn't implement layout, so ProseMirror's scroll-into-view /
// coordinate math (used by e.g. editor.chain().focus()) throws without
// these. Values are irrelevant in tests — only that they exist and don't
// throw.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    }) as unknown as DOMRectList
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON: () => {},
    }) as DOMRect
}
if (!Element.prototype.getClientRects) {
  Element.prototype.getClientRects = Range.prototype
    .getClientRects as typeof Element.prototype.getClientRects
}

// jsdom has no layout engine, so it doesn't implement elementFromPoint
// either — ProseMirror's mousedown handler calls it (via posAtCoords) to
// resolve a click into a document position. Returning null is fine for
// tests here: none of them assert on click-to-position placement, only on
// resulting doc content.
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}
