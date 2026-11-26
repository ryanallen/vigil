// Tethys Farms, Pacific: "The Low Tide". Every word and every picture of the watch, from .dev/script-tethys.md.
// Earth to Earth, the farm cameras are live. Photos are media/watch-tethys-<ID>.
export default {
  after: { line: 'No ground motion at Home.' },
  title: 'The Low Tide',
  place: 'Tethys Farms · Pacific',
  start: '03:12',
  lag: 0,
  pace: 2.5,
  media: 'tethys',
  hint: { pointer: 'Point and hold to focus. Switch cameras along the bottom.', touch: 'Tap and hold to focus. Switch cameras below.' },
  cameras: {
    mast: { name: 'High mast' }, outer: { name: 'Outer bed' }, bow: { name: 'Skiff bow' },
    deck: { name: 'Recovery deck' }, long: { name: 'Long view' },
  },
  beats: [
    { at: '03:12', show: { mast: 'M01', outer: 'U01', bow: 'B01' }, open: ['mast', 'outer', 'bow'], cut: 'mast', text: 'The beds measure the water to the centimetre. A harvest buoy has slipped its mooring.', from: 'Sora', say: 'A routine swell took buoy seven. I can see its light, but not the line. Which camera has it?' },
    { at: '03:16', id: 'buoy', show: { bow: 'B02', mast: 'M02' }, from: 'Sora', say: 'Got the buoy. Its line is cut.' },
    { at: '03:19', show: { deck: 'R01', outer: 'U02' }, open: ['deck'], from: 'Imani', say: 'The buoy is dry inside. The lamp has been burning under the water.' },
    { at: '03:22', show: { mast: 'M03', outer: 'U03' }, from: 'Dara', say: 'The outer bed has lost six centimetres. The inner bed has lost six. There is no swell running between them.' },
    { at: '03:25', show: { deck: 'R02', bow: 'B03' }, from: 'Dara', say: 'I drew the shape under the mooring. Sora, do not tell me what you saw yet.' },
    { at: '03:27', show: { bow: 'B04' }, from: 'Sora', say: 'Mine has the same angle. I have not seen your paper.' },
    { at: '03:30', show: { mast: 'M04', long: 'L01' }, open: ['long'], from: 'Imani', say: 'That is no reef. The blocks are laid in courses. We are looking at a road.' },
    { at: '03:33', show: { long: 'L02', outer: 'U04' }, from: 'Sora', say: 'There is a door at the end. It is taller than the mast.' },
    { at: '03:36', id: 'skiff', show: { bow: 'B05', mast: 'M05' }, from: 'Sora', say: 'I can go close enough for a picture. I will not put a foot on it unless you ask.',
      choose: [['Hold at the farm', 'branch:hold'], ['Take the skiff to the avenue', 'branch:avenue']] },
    ...hold(),   // a watch that makes no choice keeps the skiff beside the beds
  ],
  branches: {
    hold: hold(),
    avenue: [
      { at: '03:38', show: { bow: 'B06' }, cut: 'bow', from: 'Sora', say: 'I cannot tell which face is the door and which is the ground. Stay on the water.',
        choose: [['Turn back now', 'branch:turn'], ['Hold for one more picture', 'branch:closer']] },
    ],
    turn: [{ at: '03:41', show: { long: 'L03' }, cut: 'long', end: 'turned' }],
    closer: [
      { at: '03:40', show: { bow: 'B07' }, cut: 'bow', from: 'Imani', say: 'Sora. Your mooring line is moving.' },
      { at: '03:41', show: { long: 'L03', mast: 'M06' } },
      { at: '03:42', show: { bow: 'B08' }, choose: [['Bring the skiff home', 'branch:home']] },
    ],
    home: [{ at: '03:43', show: { mast: 'M07' }, cut: 'mast', end: 'door' }],
  },
  // Coordinates are fractions of the full 16:9 photograph from its upper left.
  reveals: [
    { id: 'T1', photo: 'M01', x: 0.77, y: 0.64, r: 0.05, text: 'Buoy seven is thirty metres beyond the last row. Its light is below the surface.', unlock: ['Go to the buoy', 'buoy'] },
    { id: 'T2', photo: 'U01', x: 0.52, y: 0.56, r: 0.08, text: 'Two mooring chains hang at the same angle. The water is running as expected.' },
    { id: 'T3', photo: 'R01', x: 0.47, y: 0.58, r: 0.08, text: 'The seal is intact. Salt has dried on the outside, but the inside is clean.' },
    { id: 'T4', photo: 'U03', x: 0.69, y: 0.78, r: 0.09, text: 'The edge is straight. Five broad sides meet below the chain.' },
    { id: 'T5', photo: 'R02', x: 0.72, y: 0.38, r: 0.08, text: 'Dara has drawn an arch with a broken top left corner.' },
    { id: 'T6', photo: 'B04', x: 0.31, y: 0.62, r: 0.08, text: 'Sora has drawn the same arch, including the break at the top left.' },
    { id: 'T7', photo: 'U04', x: 0.26, y: 0.48, r: 0.09, text: 'The leaves lean toward the exposed stone. The flow meter reads the other way.' },
    { id: 'T8', photo: 'L02', x: 0.66, y: 0.42, r: 0.09, text: 'A seam runs up the stone, across a lintel and down again. The wall is a closed door.' },
    { id: 'T9', photo: 'M04', x: 0.81, y: 0.53, r: 0.07, text: 'The avenue is not sloping down to the sea. Water is draining away from it.' },
  ],
  endings: {
    door: { title: 'The road is under water again.', text: 'Sora is back at the farm. The far mooring is still paying out toward a place the chart has never named.', controls: [['Watch Tethys again', 'restart'], ['Return to the wall', 'wall']] },
    turned: { title: 'You came away before it opened.', text: 'The door is open in the next picture. No camera caught the moment, and the wake has no boat at its head.', controls: [['Watch Tethys again', 'restart'], ['Return to the wall', 'wall']] },
    stayed: { title: 'The beds are still here.', text: "The water has covered the road. Sora and the others are safe; the buoy's clean seal lies on the deck.", controls: [['Take the skiff out', 'beat:skiff'], ['Watch Tethys again', 'restart'], ['Return to the wall', 'wall']] },
  },
};

// Holding at the farm: the door opens unseen at 03:41, and the last picture is the buoy on the recovery deck.
function hold() {
  return [
    { at: '03:41', show: { long: 'L03' }, cut: 'long', from: 'Sora', say: 'We stayed clear. Something crossed where the water had been.' },
    { at: '03:42', show: { deck: 'R03' }, cut: 'deck', end: 'stayed' },
  ];
}
