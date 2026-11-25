// Halcyon Station, Earth orbit: "The Space Between". Every word and every picture of the watch, from .dev/script-halcyon.md.
// Halcyon's delay is under a second, so its stamps match Home's clock. Photos are media/watch-halcyon-<ID>.
export default {
  title: 'The Space Between',
  place: 'Halcyon Station · Earth orbit',
  start: '03:12',
  lag: 0,
  pace: 4,
  media: 'halcyon',
  lagLine: 'Live from Halcyon · Earth orbit.',
  hint: { pointer: 'Point and hold to focus. Switch cameras along the bottom.', touch: 'Tap and hold to focus. Switch cameras below.' },
  cameras: {
    corridor: { name: 'Watch the corridor' }, bench: { name: 'See the camera bench' },
    old: { name: 'Old view' }, window: { name: 'Window' }, cabin: { name: 'Cabin' },
  },
  beats: [
    { at: '03:12', show: { corridor: 'C01', bench: 'B01', old: 'O01' }, open: ['corridor', 'bench', 'old'], cut: 'corridor', text: 'One camera lens changed. Anika Rao is checking the picture.', from: 'Anika Rao · camera service', say: 'New lens seated. Same corridor, same hour. I am checking the edge of the frame.' },
    { at: '03:15', show: { corridor: 'C02', old: 'O02' }, text: 'Live from Halcyon · Earth orbit.', from: 'Anika', say: 'The new image has an edge the old one does not. I will check the glass.' },
    { at: '03:18', show: { corridor: 'C03', old: 'O03' }, from: 'Anika', say: 'There is no mark on the window. Both cameras caught my sleeve moving.' },
    { at: '03:21', show: { window: 'W01' }, open: ['window'], from: 'Anika', say: 'The pane is sealed. There is a print on the far side.' },
    { at: '03:24', show: { cabin: 'D01', corridor: 'C04' }, open: ['cabin'], from: 'Anika', say: 'I have shut the cabin door. No one is inside.' },
    { at: '03:27', show: { bench: 'B02' }, from: 'Anika', say: 'The old lens gives a clean image. The new one shows an occupied place where the floor ought to be.' },
    { at: '03:30', show: { corridor: 'C05', old: 'O04' }, from: 'Anika', say: 'I am asking the other watch to stay out of this corridor.' },
    { at: '03:33', show: { window: 'W02', cabin: 'D02' }, from: 'Anika', say: 'There are more of them. They cross the glass without opening it.' },
    { at: '03:36', show: { corridor: 'C06' }, from: 'Anika', say: 'The hall is full. I can see the crew walking through it.' },
    { at: '03:38', show: { corridor: 'C07' }, from: 'Anika', say: 'The lens is on a fixed mount. It has found the mount.' },
    { at: '03:39', show: { corridor: 'C08', old: 'O05' }, from: 'Halcyon door log', say: 'Door 4 opened from corridor side.',
      choose: [['Leave the new camera on', 'branch:on'], ['Turn off the new camera', 'branch:off'], ['Keep both pictures', 'branch:both']] },
  ],
  // Door 4 opens in every branch; the choice is how much of it the watcher sees.
  branches: {
    on: [
      { at: '03:41', show: { corridor: 'C09' }, cut: 'corridor', from: 'Anika', say: 'The room was never empty. The glass only let us call it empty.' },
      { at: '03:42', end: 'looked' },
    ],
    off: [
      { at: '03:39', cut: 'old' },
      { at: '03:41', show: { old: 'O06' }, from: 'Anika', say: 'I have taken the picture away. The door is still open.' },
      { at: '03:42', end: 'shut' },
    ],
    both: [
      { at: '03:39', cut: 'corridor', beside: 'old' },
      { at: '03:41', show: { corridor: 'C09', old: 'O06' }, from: 'Anika', say: 'I can see it in one picture. It is opening the door in the other.' },
      { at: '03:42', end: 'two' },
    ],
  },
  // Coordinates are fractions of the full 16:9 photograph from its upper left.
  reveals: [
    { id: 'H1', photo: 'C01', x: 0.46, y: 0.66, r: 0.08, text: "The robot's path is straight. The window beside it is clean." },
    { id: 'H2', photo: 'C02', x: 0.63, y: 0.43, r: 0.09, text: 'An outline remains where the robot stood. It has no reflection in the glass.' },
    { id: 'H3', photo: 'O02', x: 0.63, y: 0.43, r: 0.09, text: 'The old camera shows an empty corridor.' },
    { id: 'H4', photo: 'C03', x: 0.48, y: 0.61, r: 0.06, text: 'Her sleeve folds inward before she turns.' },
    { id: 'H5', photo: 'W01', x: 0.72, y: 0.50, r: 0.08, text: 'Five narrow marks touch the sealed side of the pane. The station is on this side.' },
    { id: 'H6', photo: 'D01', x: 0.67, y: 0.71, r: 0.08, text: 'The blanket has lifted off the bed. Nothing is beneath it.' },
    { id: 'H7', photo: 'B02', x: 0.39, y: 0.56, r: 0.08, text: 'The patch through the new glass has an edge. The tabletop behind it has none.' },
    { id: 'H8', photo: 'C05', x: 0.59, y: 0.46, r: 0.14, text: 'Edges pass through the floor, the rail and one another. There is no unoccupied gap between them.' },
    { id: 'H9', photo: 'C06', x: 0.28, y: 0.58, r: 0.08, text: 'The person moves through the larger outline without slowing. It moves through them.' },
    { id: 'H10', photo: 'C07', x: 0.73, y: 0.38, r: 0.08, text: 'One point holds on the lens. It follows a change in focus.' },
    { id: 'H11', photo: 'O05', x: 0.41, y: 0.64, r: 0.07, text: 'The sensor is depressed. The corridor in front of it is empty.' },
  ],
  endings: {
    looked: { title: 'It found the lens.', text: 'The picture is gone. Door 4 is open, and Anika is still on that side of it.', controls: [['Watch Halcyon again', 'restart'], ['Return to the wall', 'wall']] },
    shut: { title: 'The old camera is still on.', text: 'You can no longer see what crossed the hall. You can see the door it opened.', controls: [['Watch Halcyon again', 'restart'], ['Return to the wall', 'wall']] },
    two: { title: 'Both pictures agree.', text: 'Something opened Door 4. One camera saw it arrive; neither can show where it went.', controls: [['Watch Halcyon again', 'restart'], ['Return to the wall', 'wall']] },
  },
};
