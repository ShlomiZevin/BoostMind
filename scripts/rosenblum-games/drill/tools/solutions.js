// one way through each level (t0-levels.js plays the steps in order) = the level's 💡 tip: [at seconds, order, who]
// who: 'first' | { first: floor } (the first walking student on that floor) | { x, f } (x on the 360-wide plan)
module.exports = [
  [{ at: 0, o: 'guide', who: { x: 280, f: 0 } }, { at: 0, o: 'bridge', who: { first: 1 } }],
  [{ at: 0, o: 'guide', who: { x: 305, f: 1 } }, { at: 0, o: 'mop', who: { first: 1 } }],
  [{ at: 0, o: 'close', who: { first: 1 } }, { at: 0, o: 'bridge', who: { x: 60, f: 2 } }, { at: 0, o: 'bridge', who: { first: 3 } }],
  [{ at: 0, o: 'guide', who: { x: 300, f: 1 } }, { at: 0, o: 'stairs', who: { first: 1 } }, { at: 0, o: 'stairs', who: { first: 2 } }],
  [{ at: 2, o: 'clear', who: 'first' }, { at: 0, o: 'mat', who: { first: 1 } }, { at: 0, o: 'clear', who: { first: 2 } }],
  [{ at: 2, o: 'open', who: 'first' }, { at: 0, o: 'guide', who: { x: 310, f: 1 } }, { at: 0, o: 'stairs', who: { first: 2 } }, { at: 0, o: 'bridge', who: { first: 3 } }],
  [{ at: 0, o: 'bridge', who: { first: 1 } }],
  [{ at: 0, o: 'guide', who: { x: 280, f: 0 } }, { at: 0, o: 'bridge', who: { x: 60, f: 1 } }, { at: 0, o: 'stairs', who: { x: 300, f: 2 } }],
  [{ at: 2, o: 'mop', who: 'first' }, { at: 0, o: 'mat', who: { x: 150, f: 0 } }, { at: 0, o: 'close', who: { first: 1 } }, { at: 0, o: 'stairs', who: { x: 225, f: 1 } }],
  [{ at: 2, o: 'mop', who: 'first' }, { at: 0, o: 'bridge', who: { first: 1 } }],
  [{ at: 2, o: 'clear', who: 'first' }, { at: 0, o: 'clear', who: { first: 1 } }],
  [{ at: 2, o: 'open', who: 'first' }, { at: 0, o: 'stairs', who: { first: 1 } }, { at: 0, o: 'bridge', who: { first: 2 } }],
  [{ at: 2, o: 'bridge', who: 'first' }, { at: 0, o: 'mop', who: { first: 1 } }, { at: 0, o: 'mat', who: { x: 60, f: 2 } }],
  [{ at: 0, o: 'guide', who: { x: 280, f: 0 } }, { at: 0, o: 'bridge', who: { first: 1 } }, { at: 0, o: 'open', who: { first: 2 } }, { at: 0, o: 'stairs', who: { x: 200, f: 2 } }],
  [{ at: 2, o: 'close', who: 'first' }, { at: 0, o: 'mop', who: { first: 1 } }, { at: 0, o: 'mat', who: { x: 150, f: 1 } }, { at: 0, o: 'clear', who: { first: 2 } }],
  [{ at: 2, o: 'open', who: 'first' }, { at: 0, o: 'mop', who: { first: 1 } }, { at: 0, o: 'bridge', who: { x: 100, f: 2 } }],
];
// Reut levels: hold the class with a blocker at this spot while her column is out, release when it is gone
module.exports.hold = { 6: { x: 230, f: 2 }, 7: { x: 330, f: 2 }, 9: { x: 200, f: 2 }, 10: { x: 200, f: 2 }, 11: { x: 225, f: 2 }, 12: { x: 100, f: 2 }, 13: { x: 300, f: 2 }, 15: { x: 150, f: 2 } };
