// Jezero House, Mars: "The House Under the House". Every word and every picture of the watch, from .dev/script-jezero.md.
// Times are arrival times at Home; Jezero's own camera stamps run twelve minutes behind. Photos are media/watch-jezero-<ID>.
export default {
  after: { line: 'Home wall: dry.' },
  title: 'The House Under the House',
  place: 'Jezero House · Mars',
  start: '03:12',
  lag: 12,                       // minutes each way, Earth to Mars tonight
  pace: 2.5,
  media: 'jezero',
  lagLine: 'Jezero pictures arrive 12 minutes after they are taken.',
  hint: { pointer: 'Point and hold to focus. Switch cameras along the bottom.', touch: 'Tap and hold to focus. Switch cameras below.' },
  cameras: {
    kitchen: { name: 'Kitchen' }, greenhouse: { name: 'Greenhouse' }, pipes: { name: 'Pipe chase' }, scan: { name: 'Foundation scan' },
    crawl: { name: 'Crawlspace' }, hall: { name: 'Hall' }, outside: { name: 'Exterior' },
  },
  beats: [
    { at: '03:12', show: { kitchen: 'K01', greenhouse: 'G01', pipes: 'P01' }, open: ['kitchen', 'greenhouse', 'pipes'], cut: 'kitchen', text: 'Priya has checked the water loop. The kitchen wall is damp. There is no pipe behind it.', from: 'Priya', say: 'I dried that wall. It is wet again. The loop lost nothing.' },
    { at: '03:17', show: { kitchen: 'K02', pipes: 'P02' }, text: 'Jezero pictures arrive 12 minutes after they are taken.', from: 'Priya', say: 'The moisture is on both sides of the panel. I have shut the water loop to test it.' },
    { at: '03:22', show: { greenhouse: 'G02', kitchen: 'K03' }, from: 'Priya', say: 'The plants have moved with the loop off. The room is warmer near the floor.' },
    { at: '03:27', show: { crawl: 'C01', pipes: 'P03' }, open: ['crawl'], from: 'Priya', say: 'There is an old curve under the house. I cannot reach its edge with the camera.' },
    { at: '03:31', show: { scan: 'A01', crawl: 'C02' }, open: ['scan'], from: 'Jezero archive', say: 'Foundation survey. Support points verified.',
      choose: [['Send Priya the foundation scan', 'branch:sent'], ['Keep watching', 'branch:quiet']] },
    ...night(false),   // a watch that sends nothing keeps watching
  ],
  // Priya wakes everyone when she hears the wall, scan or no scan; all seven reach the shelter either way.
  branches: {
    quiet: night(false),
    sent: night(true),
    camera: [{ at: '03:53', show: { kitchen: 'K08' }, cut: 'kitchen', end: 'kept' }],
    cameraSent: [
      { at: '03:53', show: { kitchen: 'K08' }, cut: 'kitchen' },
      { at: '03:55', from: 'Priya', say: 'I saw the scan. The supports were put around that curve. We are safe in the shelter.', end: 'kept', hold: 5 },
    ],
  },
  // Coordinates are fractions of the full 16:9 photograph from its upper left.
  reveals: [
    { id: 'J1', photo: 'K01', x: 0.64, y: 0.43, r: 0.08, text: 'A damp patch the width of a hand. The panel has no pipe behind it.' },
    { id: 'J2', photo: 'P02', x: 0.49, y: 0.55, r: 0.08, text: 'Moisture beads on the disconnected panel. The pipe beside it is dry.' },
    { id: 'J3', photo: 'G02', x: 0.58, y: 0.61, r: 0.09, text: 'The leaves have turned toward the kitchen floor and away from the lamp.' },
    { id: 'J4', photo: 'C01', x: 0.72, y: 0.67, r: 0.09, text: "The pale curve continues past the camera's field. Its surface moves with a slow breath." },
    { id: 'J5', photo: 'A01', x: 0.46, y: 0.52, r: 0.10, text: 'The supports were placed around an empty oval in the scan.' },
    { id: 'J6', photo: 'H01', x: 0.74, y: 0.57, r: 0.08, text: "The wall moves between the sleeper's breaths, then falls into time with them." },
    { id: 'J7', photo: 'E01', x: 0.35, y: 0.66, r: 0.10, text: 'Seven people crossed the dust. No one is left at the house.' },
    { id: 'J8', photo: 'K07', x: 0.79, y: 0.74, r: 0.08, text: 'The damp line has reached the door. The house water loop has no pressure.' },
    { id: 'J9', photo: 'K08', x: 0.85, y: 0.81, r: 0.09, text: 'A wet mark continues into the dry dust outside the closed door.' },
  ],
  endings: {
    kept: { title: 'The house is empty.', text: 'All seven people are in the shelter. The mark has gone through the outer door without opening it.', controls: [['Watch Jezero again', 'restart'], ['Return to the wall', 'wall']] },
    left: { title: 'Seven out of seven.', text: 'The people are safe. The kitchen camera is still taking pictures of the wall.', controls: [['Open the next picture', 'branch:camera'], ['Watch Jezero again', 'restart'], ['Return to the wall', 'wall']] },
    leftSent: { title: 'Seven out of seven.', text: 'The people are safe. The kitchen camera is still taking pictures of the wall.', controls: [['Open the next picture', 'branch:cameraSent'], ['Watch Jezero again', 'restart'], ['Return to the wall', 'wall']] },
  },
};

// The house empties on the same clock whether or not the scan was sent.
function night(sent) {
  return [
    { at: '03:35', show: { kitchen: 'K04', hall: 'H01' }, open: ['hall'], from: 'Priya', say: 'I hear someone breathing in the wall. The others are asleep. I am waking them.' },
    { at: '03:39', show: { crawl: 'C03', greenhouse: 'G03' }, from: 'Priya', say: 'Everyone is up. We are going out by the east door.' },
    { at: '03:43', show: { outside: 'E01', kitchen: 'K05' }, open: ['outside'], from: 'Jezero relay', say: 'Seven people outside. Shelter air confirmed.' },
    { at: '03:47', show: { outside: 'E02', kitchen: 'K06' }, from: 'Priya', say: 'We are all inside the shelter. I left the house camera on.' },
    { at: '03:50', show: { kitchen: 'K07', crawl: 'C04' }, cut: 'kitchen', from: 'Jezero relay', say: 'No water-loop pressure in the house.',
      choose: [['Keep the house camera on', sent ? 'branch:cameraSent' : 'branch:camera'], ['Leave Jezero on the wall', sent ? 'end:leftSent' : 'end:left']] },
  ];
}
