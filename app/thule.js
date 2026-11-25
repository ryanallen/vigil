// Thule Ice, Europa: "The Return Line". Every word and every picture of the watch, from .dev/script-thule.md.
// Times are arrival times at Home; Thule's own camera stamps run twenty-eight minutes behind. Photos are media/watch-thule-<ID>.
export default {
  title: 'The Return Line',
  place: 'Thule Ice · Europa',
  start: '03:12',
  lag: 28,                       // minutes each way, Earth to Europa tonight
  pace: 4,
  media: 'thule',
  lagLine: 'Europa pictures arrive 28 minutes after they are taken.',
  hint: { pointer: 'Point and hold to focus. Switch cameras along the bottom.', touch: 'Tap and hold to focus. Switch cameras below.' },
  cameras: {
    winch: { name: 'Intake winch' }, table: { name: 'Sampler table' }, habitat: { name: 'Habitat' }, archive: { name: 'Older pictures' },
    lock: { name: 'Outer lock' }, below: { name: 'Under the ice' },
  },
  beats: [
    { at: '03:12', show: { winch: 'W01', habitat: 'K01' }, open: ['winch', 'habitat'], cut: 'winch', text: 'The water intake has stopped. Davi and Ivo are bringing the sampler up to see what caught it.', from: 'Ivo', say: 'It caught on something solid. Coming up slowly.' },
    { at: '03:16', show: { table: 'S01' }, open: ['table'], text: 'Europa pictures arrive 28 minutes after they are taken.', from: 'Ivo', say: 'The intake is clear. This clasp came up with the sampler.' },
    { at: '03:20', show: { habitat: 'K02', lock: 'A01' }, open: ['lock'], from: 'Davi', say: 'Leave it on the table. I want to see both sides before we clean it.' },
    { at: '03:25', show: { table: 'S02', archive: 'P01' }, open: ['archive'], from: 'Thule archive', say: 'Intake service, eight years earlier.' },
    { at: '03:29', show: { habitat: 'K03' }, from: 'Ivo', say: 'Why two cups? I am not through the lock yet.' },
    { at: '03:33', show: { below: 'B01', lock: 'A02' }, open: ['below'], from: 'Davi', say: 'The second lock is warm. Keep your light out of the water.' },
    { at: '03:37', show: { below: 'B02', habitat: 'K04' }, from: 'Ivo', say: 'There is someone under the ice. Davi, tell me who I am looking at.' },
    { at: '03:40', show: { lock: 'A03' }, from: 'Davi', say: 'Their name is Mara. They went below before you came to Thule.' },
    { at: '03:43', show: { below: 'B03', lock: 'A04' }, from: 'Davi', say: 'I kept the lock warm because Mara said they would come back.' },
    { at: '03:47', show: { habitat: 'K05', lock: 'A05' }, from: 'Ivo', say: 'The ice is closing around the intake. I need to come inside.',
      note: 'Ivo needs the outer lock. Mara is at its door. Davi has to decide how to bring them in.',
      choose: [['Tell Davi about the old clasp', 'branch:sent'], ['Tell Davi Mara is waiting at the door', 'branch:sent'], ['Send no message', 'branch:quiet']] },
    ...after(false),   // a watch that sends nothing ends with the lock closed at 04:00
  ],
  branches: {
    quiet: after(false),
    sent: after(true),
    reply: [{ at: '04:43', show: { below: 'B04' }, cut: 'below', from: 'Davi', say: "I saw what you sent. The clasp was Mara's. I knew.", end: 'reply', hold: 5 }],
  },
  // Coordinates are fractions of the full 16:9 photograph from its upper left.
  reveals: [
    { id: 'U1', photo: 'S01', x: 0.56, y: 0.49, r: 0.09, text: 'The clasp is shaped for a suit collar. Its hinge has been repaired by hand.' },
    { id: 'U2', photo: 'P01', x: 0.64, y: 0.37, r: 0.08, text: 'The same repair is visible on the suit beside the old intake crew.' },
    { id: 'U3', photo: 'P01', x: 0.28, y: 0.79, r: 0.08, text: 'Mara Solís. Intake service, eight years earlier.' },
    { id: 'U4', photo: 'K01', x: 0.70, y: 0.62, r: 0.08, text: 'These gloves are dry. Someone has warmed them before a visitor arrived.' },
    { id: 'U5', photo: 'K03', x: 0.52, y: 0.66, r: 0.08, text: 'Davi has set out two cups while Ivo is still outside.' },
    { id: 'U6', photo: 'B02', x: 0.67, y: 0.58, r: 0.10, text: "The collar carries a clasp in the place the sampler's old clasp would fit." },
    { id: 'U7', photo: 'A03', x: 0.45, y: 0.35, r: 0.08, text: 'The water is climbing the outside of a sealed door.' },
    { id: 'U8', photo: 'A07', x: 0.58, y: 0.44, r: 0.09, text: "Two breath marks cloud the glass. Only Ivo is in the camera's view." },
  ],
  endings: {
    reply: { title: 'Someone came home.', text: 'Ivo is safe inside. Mara chose the water, and Davi had kept a place warm for them all these years.', controls: [['Watch Thule again', 'restart'], ['Return to the wall', 'wall']] },
    left: { title: 'The lock is closed.', text: 'Ivo is inside. Below the ice, a light is moving away from a door that had been kept warm.', controls: [['Watch Thule again', 'restart'], ['Return to the wall', 'wall']] },
  },
};

// Ivo comes in and Mara goes back under the ice whatever the watcher sends; a sent message can only wait for Davi's reply.
function after(sent) {
  const last = { at: '04:00', show: { below: 'B04' }, cut: 'below', from: 'Davi', say: 'Ivo is in. Mara went back under the ice. I did not ask them to stay. I did not ask them to go.' };
  return [
    { at: '03:51', show: { lock: 'A06' } },
    { at: '03:54', show: { habitat: 'K06' } },
    { at: '03:58', show: { lock: 'A07' } },
    sent ? { ...last, choose: [["Wait for Davi's reply", 'branch:reply'], ['Leave Thule on the wall', 'end:left']] } : { ...last, end: 'left', hold: 5 },
  ];
}
