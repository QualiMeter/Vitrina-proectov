import './ambient-background.css';

type AmbientVariant = 'hero' | 'auth' | 'dashboard';

const strands = [
  'M 820 -80 C 890 125 1010 250 1260 200 S 1500 110 1680 260',
  'M 760 -65 C 850 160 1040 300 1260 250 S 1510 145 1700 305',
  'M 875 -100 C 965 120 1030 190 1260 155 S 1515 55 1680 210',
  'M 955 -90 C 1030 80 1100 145 1300 120 S 1530 80 1680 145',
  'M 990 720 C 1050 520 1170 470 1340 510 S 1520 620 1690 430',
  'M 870 730 C 990 510 1150 425 1310 460 S 1530 570 1690 390',
  'M 1080 720 C 1140 600 1230 550 1400 570 S 1570 650 1690 500',
];

const links = [
  'M 1020 155 Q 1100 250 1190 240',
  'M 1190 240 Q 1280 155 1390 180',
  'M 1260 250 Q 1330 365 1450 370',
  'M 1340 510 Q 1395 440 1450 370',
  'M 1450 370 Q 1510 260 1590 275',
  'M 1100 490 Q 1200 380 1300 460',
];

const nodes: [number, number, number][] = [
  [1020, 155, 4], [1190, 240, 5], [1260, 250, 3],
  [1390, 180, 4], [1450, 370, 5], [1590, 275, 3],
  [1100, 490, 3], [1300, 460, 4], [1340, 510, 3], [1400, 570, 3],
];

/** A single decorative motif shared by public, auth and cabinet layouts. */
export function AmbientBackground({ variant }: { variant: AmbientVariant }) {
  return <div className={`ambient ambient--${variant}`} aria-hidden="true">
    <svg className="ambient__art" viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" focusable="false">
      <g className="ambient__strands">
        {strands.map((path) => <path key={path} d={path} />)}
      </g>
      <g className="ambient__links">
        {links.map((path) => <path key={path} d={path} />)}
      </g>
      <g className="ambient__nodes">
        {nodes.map(([cx, cy, radius]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={radius} />)}
      </g>
      <path className="ambient__accent" d="M 875 -100 C 965 120 1030 190 1260 155 S 1515 55 1680 210" />
    </svg>
  </div>;
}
