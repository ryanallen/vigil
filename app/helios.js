// Helios Array, near the Sun: "The Missing Colour". Every word and every picture of the watch, from .dev/script-helios.md.
// Times are arrival times at Home; Helios's own camera stamps run eight minutes behind. Photos are media/watch-helios-<ID>.
export default {
  title: 'The Missing Colour',
  place: 'Helios Array · near the Sun',
  start: '03:12',
  lag: 8,                        // minutes each way, Earth to the array tonight
  pace: 2.5,
  media: 'helios',
  lagLine: 'Helios picture taken 8 minutes ago.',
  hint: { pointer: 'Point and hold to focus. Switch cameras along the bottom.', touch: 'Tap and hold to focus. Switch cameras below.' },
  cameras: {
    s41: { name: 'Sector 41' }, s42: { name: 'Sector 42' }, mirror: { name: 'Mirror bay' },
    ring: { name: 'Ring' }, receiver: { name: 'Receiver' }, second: { name: 'Second service camera' }, home: { name: 'Home desk' },
  },
  beats: [
    { at: '03:12', show: { ring: 'R01', s41: 'P01', s42: 'N01' }, open: ['ring', 's41', 's42'], cut: 'ring', text: 'Helios sends power across the system. Sector 41 is producing less than the panels beside it.', from: 'Imani Osei, light duty', say: 'Probably a mirror out of line. Compare it with the next sector.' },
    { at: '03:17', show: { s41: 'P02' }, text: 'Helios picture taken 8 minutes ago.', from: 'Helios meter', say: 'Sector 41 output down four percent.' },
    { at: '03:20', show: { mirror: 'M01', s41: 'P03' }, open: ['mirror'], from: 'Imani', say: 'The mirror is in line. I cannot put a colour to the missing band.' },
    { at: '03:23', show: { s41: 'P04', s42: 'N02' }, from: 'Helios meter', say: 'Sector 41 output down eleven percent. Adjacent sector unchanged.' },
    { at: '03:26', show: { ring: 'R02' }, from: 'Imani', say: 'Inspection unit is free. It can look at the panel face or at the power relay.',
      note: 'Next picture due in about 18 minutes.',
      choose: [['Send the unit to the panel', 'branch:panel'], ['Send it to the receiver', 'branch:receiver']] },
  ],
  // Each route's first picture is eighteen minutes after the 03:26 choice; both routes reach the last pulse.
  branches: {
    panel: route({ at: '03:44', show: { s41: 'P05' }, cut: 's41' }),
    receiver: route({ at: '03:44', show: { receiver: 'E01' }, open: ['receiver'], cut: 'receiver' }),
    line: [
      { at: '03:55', show: { second: 'V01' }, open: ['second'], cut: 'second' },
      { at: '03:56', show: { home: 'H03' }, open: ['home'], cut: 'home', end: 'line' },
    ],
    home: [
      { at: '03:55', show: { home: 'H02' }, open: ['home'], cut: 'home' },
      { at: '03:56', show: { home: 'H03' }, end: 'home' },
    ],
  },
  // Coordinates are fractions of the full 16:9 photograph from its upper left.
  reveals: [
    { id: 'L1', photo: 'P01', x: 0.50, y: 0.48, r: 0.08, text: 'The gold surface holds the Sun as a thin bright line.' },
    { id: 'L2', photo: 'P02', x: 0.50, y: 0.48, r: 0.08, text: 'The line is missing on this square. Its surface has no visible scratch.' },
    { id: 'L3', photo: 'N01', x: 0.51, y: 0.47, r: 0.08, text: 'The next sector reflects the Sun across every square.' },
    { id: 'L4', photo: 'M01', x: 0.62, y: 0.39, r: 0.08, text: 'The Sun is present in the mirror except for one narrow band.' },
    { id: 'L5', photo: 'P04', x: 0.73, y: 0.57, r: 0.07, text: 'The hinge reflects light. The panel it holds does not.' },
    { id: 'L6', photo: 'P05', x: 0.47, y: 0.66, r: 0.10, text: 'The unit has one body. Two edges leave it on the panel.' },
    { id: 'L7', photo: 'E01', x: 0.68, y: 0.52, r: 0.08, text: 'The receiver shows a loss where the output meter shows a gain.' },
    { id: 'L8', photo: 'R04', x: 0.75, y: 0.38, r: 0.09, text: 'The missing band is leaving the ring in a straight line. It does not point at Earth.' },
    { id: 'L9', photo: 'P07', x: 0.56, y: 0.51, r: 0.08, text: 'The Sun is no longer on this square. It is still darker than its neighbours.' },
  ],
  endings: {
    line: { title: 'Most of it went.', text: 'The band has left the array. One square still refuses the Sun, and the light in your room no longer reaches the corner.', controls: [['Watch Helios again', 'restart'], ['Return to the wall', 'wall']] },
    home: { title: 'The room is lit.', text: 'The meter says power arrived. The lamp is on. Its light ends before the wall.', controls: [['Watch Helios again', 'restart'], ['Return to the wall', 'wall']] },
  },
};

// A route's first picture, then the beats both routes share.
function route(first) {
  return [
    { ...first, from: 'Inspection unit', say: 'No crack. No heat mark. The surface still takes light.' },
    { at: '03:48', show: { s41: 'P06', ring: 'R03' }, from: 'Helios meter', say: 'Sector 41 output down twenty-nine percent. Power at the receiver is down less than one percent.' },
    { at: '03:52', show: { mirror: 'M02', s42: 'N03' }, from: 'Imani', say: 'The band is crossing the join. Do not aim the unit at it again.' },
    { at: '03:55', show: { ring: 'R04', s41: 'P07' }, cut: 'ring', from: 'Helios meter', say: 'Sector 41 offline. Relay load holding.',
      choose: [['Follow the dim line', 'branch:line'], ['Check Home power', 'branch:home']] },
  ];
}
