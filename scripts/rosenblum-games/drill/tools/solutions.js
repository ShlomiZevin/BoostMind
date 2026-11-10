// one way through each level (t0-levels.js plays it): [at seconds, order, who]; x on the 360-wide plan (DRILL.X converts)
module.exports = [
  [],
  [{ at: 0, o: 'guide', who: { x: 270, f: 1 } }],
  [{ at: 2, o: 'bridge', who: 'first' }],
  [{ at: 2, o: 'stairs', who: 'first' }],
  [{ at: 0, o: 'guide', who: { x: 280, f: 0 } }],
  [{ at: 2, o: 'open', who: 'first' }],
  [],
  [{ at: 2, o: 'bridge', who: 'first' }],
  [{ at: 2, o: 'open', who: 'first' }, { at: 0, o: 'open', who: { x: 120, f: 2 } }],
  [{ at: 2, o: 'bridge', who: 'first' }, { at: 0, o: 'stairs', who: { x: 60, f: 2 } }],
  [{ at: 2, o: 'open', who: 'first' }, { at: 0, o: 'bridge', who: { x: 100, f: 2 } }],
];
// Reut levels: hold the class with a blocker at this spot while her column is out, release when it is gone
module.exports.hold = { 6: { x: 230, f: 2 }, 7: { x: 200, f: 2 }, 10: { x: 150, f: 2 } };
