// Home, Earth: "The Window". Every word and every picture of the watch, from .dev/script-home.md.
// Home's cameras are local, so their stamps match Home's clock. Photos are media/watch-home-<ID>.
export default {
  title: 'The Window',
  place: 'Home · Earth',
  start: '03:12',
  lag: 0,
  pace: 2.5,
  media: 'home',
  // Photos that play as seamless video loops (media/watch-home-<ID>-loop.mp4, first and last frame the photo).
  loops: ['D01', 'F01', 'G01', 'P01'],
  hint: { pointer: 'Point and hold to focus. Switch cameras along the bottom.', touch: 'Tap and hold to focus. Switch cameras below.' },
  cameras: {
    desk: { name: 'Desk' }, field: { name: 'Field' }, garden: { name: 'Garden' }, power: { name: 'Power cabinet' },
  },
  // The script gives these lines as on-screen text with no sender; they arrive on the wire under Home's name.
  beats: [
    { at: '03:12', show: { desk: 'D01', field: 'F01', garden: 'G01', power: 'P01' }, open: ['desk', 'field', 'garden', 'power'], cut: 'desk', text: "You're awake at Home. The nearest neighbour is forty kilometres away. The storm should cross by morning.", from: 'Home', say: 'Storm line west of Home. House battery full.' },
    { at: '03:16', show: { field: 'F02' }, from: 'Home', say: 'Tower light out. House power normal.' },
    { at: '03:19', show: { field: 'F03' }, from: 'Home', say: 'The tower sends no fault signal.' },
    { at: '03:22', show: { field: 'F04' }, from: 'Home', say: 'Lightning at the far ridge.' },
    { at: '03:25', show: { desk: 'D02', garden: 'G02' }, from: 'Home', say: 'House battery switching to local reserve.' },
    { at: '03:28', show: { power: 'P02', field: 'F05' }, from: 'Home', say: 'Reserve estimate: 19 minutes at the present load.' },
    { at: '03:31', show: { field: 'F06', garden: 'G03' }, from: 'Home', say: 'Automatic floodlight on.' },
    { at: '03:34', id: 'lights', show: { power: 'P03' }, from: 'Home', say: 'Reserve cannot hold all three lights through the outage. Keep two on.',
      keep: { options: ['Keep desk and garden lit', 'Keep desk and camera lit', 'Keep garden and camera lit'], off: ['camera', 'garden', 'desk'], note: 'You can change the pair while power remains.', readout: 'Reserve estimate: {n} minutes at the present load.', until: '03:51' },
      choose: [['Return to the wall', 'end:left']] },
    ...outage(),
  ],
  branches: {
    window: [{ at: '03:51', show: { desk: 'D03' }, cut: 'desk', end: 'window' }],
    door: [{ at: '03:51', show: { desk: 'D04' }, cut: 'desk', end: 'door' }],
  },
  // Live light on each photo, in the same 0-1 space as the reveals: the tower's red light until it goes out at 03:16,
  // the desk lamp's pool, the feed glass, the house robot's charging light, the power cabinet's three indicators.
  // Where each of the three lights falls in each photo, so the one left off goes dark wherever it is seen: the desk
  // lamp's pool on the desk and through the garden window, the garden floodlight on the outside wall and grass, the
  // camera lamp that fills the desk camera's view.
  sources: {
    desk: ['D01', 'D02', 'D03', 'D04'].map(photo => ({ photo, x: 0.555, y: 0.44, r: 0.11, a: 0.65 }))
      .concat(['P01', 'P02', 'P03'].map(photo => ({ photo, x: 0.76, y: 0.47, r: 0.1, a: 0.65 })))
      .concat(['G01', 'G02', 'G03', 'G04'].map(photo => ({ photo, x: 0.68, y: 0.65, r: 0.06, a: 0.7 }))),
    garden: ['G03', 'G04'].map(photo => ({ photo, x: 0.66, y: 0.84, r: 0.16, a: 0.6 })),
    camera: ['D01', 'D02', 'D03', 'D04'].map(photo => ({ photo, x: 0.45, y: 0.55, r: 0.4, a: 0.4 })),
  },
  // Live light on each photo, in the same 0-1 space as the reveals: the tower's red light until it goes out at 03:16,
  // the desk lamp, the feed glass, the house robot's charging light, the power cabinet's indicators, the window's glow.
  lights: {
    D01: [{ x: 0.555, y: 0.43, r: 0.06, a: 0.06, kind: 'flicker', src: 'desk' }, { x: 0.62, y: 0.5, r: 0.05, a: 0.06, kind: 'pulse' }, { x: 0.42, y: 0.4, r: 0.012, a: 0.7, kind: 'blink' }, { x: 0.735, y: 0.42, r: 0.014, a: 0.5, kind: 'pulse' }, { x: 0.94, y: 0.03, r: 0.01, a: 1.2, kind: 'blink' }],
    D02: [{ x: 0.555, y: 0.43, r: 0.06, a: 0.06, kind: 'flicker', src: 'desk' }, { x: 0.62, y: 0.5, r: 0.05, a: 0.06, kind: 'pulse' }, { x: 0.42, y: 0.4, r: 0.012, a: 0.7, kind: 'blink' }, { x: 0.735, y: 0.42, r: 0.014, a: 0.5, kind: 'pulse' }],
    F01: [{ x: 0.845, y: 0.245, r: 0.012, a: 1.2, kind: 'blink' }],
    G01: [{ x: 0.68, y: 0.65, r: 0.05, a: 0.05, kind: 'flicker', src: 'desk' }, { x: 0.95, y: 0.03, r: 0.01, a: 1.2, kind: 'blink' }],
    G02: [{ x: 0.68, y: 0.65, r: 0.05, a: 0.05, kind: 'flicker', src: 'desk' }],
    G03: [{ x: 0.66, y: 0.84, r: 0.12, a: 0.05, kind: 'flicker', src: 'garden' }],
    P01: [{ x: 0.86, y: 0.4, r: 0.016, a: 0.5, kind: 'pulse' }, { x: 0.76, y: 0.47, r: 0.06, a: 0.05, kind: 'flicker', src: 'desk' }],
  },
  // Coordinates are fractions of the full 16:9 photograph from its upper left, set on the thing in each photo.
  reveals: [
    { id: 'O1', photo: 'F01', x: 0.740, y: 0.250, r: 0.06, text: 'A plain service tower. One small maintenance light burns near the top.' },
    { id: 'O2', photo: 'F03', x: 0.740, y: 0.250, r: 0.05, text: 'The upper opening has no shutter. It is black behind the frame.' },
    { id: 'O3', photo: 'F04', x: 0.740, y: 0.250, r: 0.07, text: "There is a shape inside the opening. Its edge has no relation to the tower's straight frame." },
    { id: 'O4', photo: 'G02', x: 0.720, y: 0.650, r: 0.07, text: 'The desk lamp is reflected once. The chair inside is empty.' },
    { id: 'O5', photo: 'P03', x: 0.740, y: 0.420, r: 0.08, text: 'The three lights draw more than the battery can give. One has to go dark.' },
    { id: 'O6', photo: 'F06', x: 0.740, y: 0.250, r: 0.08, text: 'The dark opening looks wider. Its metal frame has not moved.' },
    { id: 'O7', photo: 'G03', x: 0.700, y: 0.680, r: 0.08, text: 'Nothing sits in the chair while the garden light is on.' },
    { id: 'O8', photo: 'G04', x: 0.700, y: 0.680, r: 0.09, text: 'The chair is occupied in this picture. No door has opened.' },
    { id: 'O9', photo: 'D03', x: 0.600, y: 0.290, r: 0.10, text: 'The glass holds a second shape at the height of a person. The room behind it is empty.' },
    { id: 'O10', photo: 'D04', x: 0.310, y: 0.570, r: 0.08, text: 'The darkness under the door moves against the hall light.' },
  ],
  endings: {
    window: { title: 'There is someone in the glass.', text: 'The room behind the camera is empty. The second shape remains in the window after your lamp goes out.', controls: [['Watch Home again', 'restart'], ['Return to the wall', 'wall']] },
    door: { title: 'The door is still shut.', text: 'The line beneath it moves toward the desk. The hall light is on, and no one is there.', controls: [['Watch Home again', 'restart'], ['Return to the wall', 'wall']] },
    left: { title: 'Home is still on the wall.', text: 'The cameras keep taking pictures after you leave. One more has arrived.', controls: [['Open Home again', 'beat:lights'], ['Watch another place', 'wall']] },
  },
};

// The outage runs the same whichever pair is kept: the garden lead shorts at 03:46 and the last reserve fails at 03:51.
function outage() {
  return [
    { at: '03:46', fail: ['garden'] },
    { at: '03:49', show: { garden: 'G04' } },
    { at: '03:51', fail: ['desk', 'camera', 'garden'], choose: [['Look at the window', 'branch:window'], ['Keep the camera on the door', 'branch:door']] },
  ];
}
