import json
SP = 'C:/Users/shazb/AppData/Local/Temp/claude/c--Users-shazb/e732bc3b-9b66-4d2c-ab1f-adebd98615eb/scratchpad/'
exec(open(SP + 'mazes3.py', encoding='utf-8').read().split("off = room(")[0])

def fat(M):
    out = []
    for y in range(len(M) - 1):
        for x in range(12):
            sq = [M[yy][xx] for yy in (y, y + 1) for xx in (x, x + 1)]
            if all(c == '#' for c in sq):
                border = [(xx, yy) for yy in (y, y + 1) for xx in (x, x + 1) if xx in (0, 12) or yy in (0, 22)]
                if len(border) >= 2 and all(M[yy][xx] == '#' for xx, yy in border):
                    # two border cells + two wall cells next to the frame: a wall stuck to the frame = thick
                    pass
                out.append((x, y))
    return out
HOUSE = {(x, y) for y in (9, 10, 11) for x in range(3, 10)}
def report(name, M):
    f = [p for p in fat(M) if not ({p, (p[0] + 1, p[1]), (p[0], p[1] + 1), (p[0] + 1, p[1] + 1)} & HOUSE)]
    print(name, 'thick at', f if f else 'NONE')
    check(name, M)

OFF = [
  '#############',
  '#.......#RRR#',
  '#o##.##.DRRR#',
  '#.......#####',
  '#.#.#.#.....#',
  '#.#...#.#.#.#',
  '#...#.....#o#',
  '###.#.#.#.#.#',
  '#...#...#...#',
  '#.#...-...#.#',
  '#.###GGG###.#',
  '#...#####...#',
  '#.#.......#.#',
  '#.#.#.#.#.#.#',
  '#...#...#...#',
  '#o#...P...#o#',
  '#.#.#.#.#.#.#',
  '#...#...#...#',
  '#####.#.#.#.#',
  '#RRR#.......#',
  '#RRRD.#.#.#.#',
  '#####...#...#',
  '#############',
]
CUB = [
  '#############',
  '#####o......#',
  '#RRR#.#.#.#.#',
  '#RRRD.......#',
  '#####.#.#.#.#',
  '#...#...#...#',
  '#.#.#.#.#.#.#',
  '#...#...#...#',
  '#.#.#...#.#.#',
  '#.#...-...#.#',
  '#.###GGG###.#',
  '#...#####...#',
  '#.#.......#.#',
  '#...#.#.#...#',
  '#.#.#...#.#.#',
  '#o#...P...#o#',
  '#.#.#.#.#.#.#',
  '#...#...#...#',
  '#.#.#.#.#####',
  '#.#.....#RRR#',
  '#.#.#.#.DRRR#',
  '#.......#####',
  '#############',
]
KIT = [
  '#############',
  '#...........#',
  '#o#.#.#.#.#o#',
  '#...........#',
  '#####.#.#.#.#',
  '#RRR#.......#',
  '#RRRD.#.#.#.#',
  '#####.#.#...#',
  '#.......#.#.#',
  '#.#...-...#.#',
  '#.###GGG###.#',
  '#...#####...#',
  '#.#.......#.#',
  '#.#.#.#.#.#.#',
  '#...........#',
  '#o#.#.P.#.#o#',
  '#...........#',
  '#.#.#.#.#.#.#',
  '#...#...#...#',
  '#.#.#.#.#####',
  '#.#.....#RRR#',
  '#.....#.DRRR#',
  '#############',
]
for n, m in (('offices', OFF), ('cubicles', CUB), ('kitchen', KIT)): report(n, m)
json.dump({'off': OFF, 'cub': CUB, 'kit': KIT}, open(SP + 'mazes4.json', 'w'))
