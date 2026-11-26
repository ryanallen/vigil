// Shackleton Foundry, Moon: "The Lower Floor". Every word and every picture of the watch, from .dev/script-shackleton.md.
// The Moon is about a second away, so the stamps match Home's clock. Photos are media/watch-shackleton-<ID>.
export default {
  after: { button: 'Unplug the speaker' },
  title: 'The Lower Floor',
  place: 'Shackleton Foundry · Moon',
  start: '03:12',
  lag: 0,
  pace: 2.5,
  media: 'shackleton',
  lagLine: 'Live from Shackleton · Moon.',
  hint: { pointer: 'Point and hold to focus. Switch cameras along the bottom.', touch: 'Tap and hold to focus. Switch cameras below.' },
  cameras: {
    casting: { name: 'Casting floor' }, pad: { name: 'Furnace pad' }, wall: { name: 'Service wall' },
    bore: { name: 'Bore camera' }, robot: { name: 'Casting robot 6' },
  },
  beats: [
    { at: '03:12', show: { casting: 'C01', pad: 'P01', wall: 'W01' }, open: ['casting', 'pad', 'wall'], cut: 'casting', from: 'Esi', say: 'The casting looks good. There is a tap under the old pad. I want to know whether a pump is touching it.' },
    { at: '03:16', show: { pad: 'P02' }, from: 'Esi', say: 'Three taps. The pumps made two strokes in that time.' },
    { at: '03:20', show: { wall: 'W02', casting: 'C02' }, from: 'Esi', say: 'The sound is moving along the wall. It is below the service channel.' },
    { at: '03:25', id: 'bore', show: { bore: 'B01' }, open: ['bore'], cut: 'bore', from: 'Esi', say: 'The hole reaches another floor. It is too even to be rock.',
      choose: [['Lower the camera', 'branch:b2'], ['Bring it up', 'branch:pad']] },
  ],
  // The bore goes down one level a minute after each choice; it can be brought up from any level.
  branches: {
    pad: [{ at: '03:26', show: { pad: 'P03' }, cut: 'pad', end: 'pad' }],
    b2: [{ at: '03:26', show: { bore: 'B02' }, cut: 'bore', from: 'Esi', say: 'A room under ours. There is a tool on the floor.', choose: [['Lower the camera', 'branch:b3'], ['Bring it up', 'branch:up2']] }],
    b3: [{ at: '03:27', show: { bore: 'B03' }, cut: 'bore', from: 'Esi', say: 'Another floor. Its joins follow the first, though the material is different.', choose: [['Lower the camera', 'branch:b4'], ['Bring it up', 'branch:up3']] }],
    b4: [{ at: '03:28', show: { bore: 'B04' }, cut: 'bore', from: 'Esi', say: 'That nick is on the casting upstairs. There is no line between the two.', choose: [['Turn the camera toward the sound', 'branch:b5'], ['Bring it up', 'branch:up4']] }],
    b5: [{ at: '03:29', show: { bore: 'B05' }, cut: 'bore', from: 'Esi', say: 'The taps are in that wall. The moving thing is one of our casting robots.', choose: [['Look at its camera', 'branch:b6'], ['Bring it up', 'branch:up5']] }],
    b6: [{ at: '03:30', show: { robot: 'B06' }, open: ['robot'], cut: 'robot', from: 'Esi', say: 'I did not send it down. The floor above it has not been opened.', end: 'below', hold: 2 }],
    up2: up('03:27', 'up2'), up3: up('03:28', 'up3'), up4: up('03:29', 'up4'), up5: up('03:30', 'up5'),
  },
  // Coordinates are fractions of the full 16:9 photograph from its upper left.
  reveals: [
    { id: 'S1', photo: 'C01', x: 0.41, y: 0.64, r: 0.07, text: 'A small triangular nick marks the new mold. The casting itself is sound.' },
    { id: 'S2', photo: 'P02', x: 0.57, y: 0.57, r: 0.09, text: 'The dust jumps three times. The pump indicator makes two strokes.' },
    { id: 'S3', photo: 'W02', x: 0.63, y: 0.44, r: 0.08, text: 'Dust shifts along the seam toward the far end of the room.' },
    { id: 'S4', photo: 'B02', x: 0.47, y: 0.72, r: 0.08, text: "A foundry grip lies here under dust too deep for tonight's work." },
    { id: 'S5', photo: 'B03', x: 0.67, y: 0.59, r: 0.08, text: "The joints match the deck above. This floor was not poured by the foundry's machines." },
    { id: 'S6', photo: 'B04', x: 0.49, y: 0.28, r: 0.07, text: 'The triangular nick from the new mold is cut into this older ceiling.' },
    { id: 'S7', photo: 'B05', x: 0.71, y: 0.54, r: 0.09, text: 'The taps travel with this line of dust. It moves through the wall.' },
    { id: 'S8', photo: 'B05', x: 0.84, y: 0.66, r: 0.08, text: 'Casting robot 6. It was last pictured on the floor above.' },
    { id: 'S9', photo: 'B06', x: 0.50, y: 0.36, r: 0.10, text: 'The ceiling is whole. Its underside is the foundry floor.' },
  ],
  endings: {
    below: { title: 'There is a floor below the floor.', text: 'The robot is under the foundry. It was on the casting floor a minute ago, and no door lies between those two pictures.', controls: [['Watch Shackleton again', 'restart'], ['Return to the wall', 'wall']] },
    pad: { title: 'The pad is sound.', text: 'No crack has opened in the floor. Something beneath it is keeping time.', controls: [['Use the bore camera', 'beat:bore'], ['Watch Shackleton again', 'restart'], ['Return to the wall', 'wall']] },
    up2: brought('b2'), up3: brought('b3'), up4: brought('b4'), up5: brought('b5'),
  },
};

// Bringing the camera up: the last picture is the ordinary casting hall.
function up(at, end) { return [{ at, show: { casting: 'C03' }, cut: 'casting', end }]; }
// The same ending from every level; lowering again resumes at the level the camera came up from.
function brought(level) {
  return { title: 'The casting is still cooling.', text: 'Esi brought the camera up. The taps have crossed to the wall beyond the furnace.', controls: [['Lower the camera again', 'branch:' + level], ['Watch Shackleton again', 'restart'], ['Return to the wall', 'wall']] };
}
