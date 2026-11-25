// Atlas Works, Ceres: "The Salt Room". Every word and every picture of the watch, from .dev/script-atlas.md.
// Times are arrival times at Home; Atlas's own camera stamps run seventeen minutes behind. Photos are media/watch-atlas-<ID>.
export default {
  title: 'The Salt Room',
  place: 'Atlas Works · Ceres',
  start: '03:12',
  lag: 17,                       // minutes each way, Earth to Ceres tonight
  pace: 4,
  media: 'atlas',
  lagLine: 'Atlas pictures arrive 17 minutes after they are taken.',
  hint: { pointer: 'Point and hold to focus. Switch cameras along the bottom.', touch: 'Tap and hold to focus. Switch cameras below.' },
  cameras: {
    belt: { name: 'Sorting belt' }, trays: { name: 'Tray room' }, scope: { name: 'Microscope' }, records: { name: 'Old records' },
    door: { name: 'Door' },
  },
  beats: [
    { at: '03:12', show: { belt: 'B01', trays: 'T01', scope: 'M01' }, open: ['belt', 'trays', 'scope'], cut: 'belt', text: 'Bo is checking a new salt sample. The sorting room is empty; the two trays are sealed.', from: 'Bo', say: 'The new cut gave us a clean salt pocket. I have set two trays aside for a second reading.' },
    { at: '03:17', show: { trays: 'T02', belt: 'B02' }, text: 'Atlas pictures arrive 17 minutes after they are taken.', from: 'Atlas scale', say: 'Tray A gained 11 grams. No material entered the room.' },
    { at: '03:21', show: { scope: 'M02', trays: 'T03' }, from: 'Bo', say: 'The balance is sound. I am checking a second scale.' },
    { at: '03:25', show: { trays: 'T04', records: 'R01' }, open: ['records'], from: 'Atlas scale', say: 'Tray A gained 63 grams. Tray B gained 9 grams.' },
    { at: '03:28', show: { trays: 'T05', door: 'D01' }, open: ['door'], from: 'Bo', say: 'I will be at the tray room in forty minutes. Leave both lids closed.',
      note: 'Bo is due at the tray room at 04:08 Home time. A seal command takes 17 minutes to reach Atlas. Close the room now or keep the camera on it.',
      choose: [['Seal the room', 'branch:sealed', 'Bo can still see through the glass.'], ['Keep it open', 'branch:open']] },
    ...room(false, true),   // a watch that sends nothing leaves the room open
  ],
  // A seal sent by 03:33 shuts the room at Atlas before Bo returns; after that it may arrive too late, and is shown as late.
  branches: {
    sealed: room(true, false),
    open: room(false, true),
    late: room(false, false).slice(1),
  },
  // Coordinates are fractions of the full 16:9 photograph from its upper left.
  reveals: [
    { id: 'A1', photo: 'T01', x: 0.52, y: 0.61, r: 0.08, text: 'Both lids are shut. Their feeds are disconnected.' },
    { id: 'A2', photo: 'T02', x: 0.39, y: 0.78, r: 0.07, text: 'The tray has gained weight. Nothing crossed the empty belt.' },
    { id: 'A3', photo: 'T03', x: 0.72, y: 0.43, r: 0.08, text: 'A five-finger print touches the inside of the sealed lid.' },
    { id: 'A4', photo: 'T04', x: 0.36, y: 0.52, r: 0.09, text: 'A name shows beneath the newer mark: Yara Omid.' },
    { id: 'A5', photo: 'R01', x: 0.45, y: 0.44, r: 0.09, text: 'Yara Omid lived on Ceres before Atlas Works. The record ends with her death.' },
    { id: 'A6', photo: 'M03', x: 0.55, y: 0.50, r: 0.10, text: 'The grains move together across a still glass slide.' },
    { id: 'A7', photo: 'T07', x: 0.46, y: 0.66, r: 0.08, text: 'Salt falls from a sleeve that has no seam.' },
    { id: 'A8', photo: 'R02', x: 0.51, y: 0.38, r: 0.08, text: 'The old picture and the room picture match in the eyes. One small scar is on opposite sides.' },
    { id: 'A9', photo: 'T09', x: 0.73, y: 0.55, r: 0.09, text: 'The print on the inner lid has turned. There is pressure from below.' },
    { id: 'A10', photo: 'D04', x: 0.32, y: 0.58, r: 0.08, text: 'Bo is outside the room. The person inside is looking at him, not the camera.' },
  ],
  endings: {
    sealed: { title: 'The room is sealed.', text: 'Bo is outside the glass. Inside, two people stand where two trays stood, and neither appears in a current crew list.', controls: [['Watch Atlas again', 'restart'], ['Return to the wall', 'wall']] },
    open: { title: 'Bo closed the door himself.', text: 'He is safe in the corridor. The second tray opened before the shutter could come down.', controls: [['Watch Atlas again', 'restart'], ['Return to the wall', 'wall']] },
  },
};

// The room on its clock. Sealed in time, the shutter is down at 04:02; otherwise the door is open and Bo shuts it by hand.
// While the seal is unsent, 03:33 still offers it, marked late.
function room(sealed, offerLate) {
  return [
    { at: '03:33', show: { trays: 'T06', scope: 'M03' }, from: 'Atlas scale', say: 'Tray A gained 41 kilograms. Tray B gained 22 kilograms.',
      ...(offerLate ? { choose: [['Send seal command · may arrive too late', 'branch:late']] } : {}) },
    { at: '03:38', show: { trays: 'T07' }, from: 'Bo', say: 'There is someone in the room. I am outside the glass.' },
    { at: '03:43', show: { trays: 'T08', records: 'R02' }, beside: 'records', from: 'Bo', say: 'The old record says Yara Omid. She died before this factory was built.' },
    { at: '03:48', show: { trays: 'T09', door: 'D02' }, from: 'Atlas scale', say: 'Tray B gained 58 kilograms. Lid seal holding.' },
    { at: '04:02', show: { door: sealed ? 'D03' : 'D03b' }, from: 'Atlas door', say: sealed ? 'Salt room sealed.' : 'Salt room open.' },
    { at: '04:08', show: { door: 'D04', trays: 'T10' }, from: 'Bo', say: "The first one knows the old room in the archive. It does not know Yara's daughter. The second lid is lifting." },
    { at: '04:11', show: { door: sealed ? 'D05' : 'D05b' }, cut: 'door', from: 'Bo', say: 'I am clear of the room. Keep the camera there.', end: sealed ? 'sealed' : 'open', hold: 5 },
  ];
}
